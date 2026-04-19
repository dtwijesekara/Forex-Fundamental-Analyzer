// ============================================================
// BACKGROUND SCHEDULER
// Runs the analysis pipeline on a cron schedule
// Start with: npm run worker:start
// Deploy on: Railway / Render / VPS (NOT Vercel — no long-running processes)
// ============================================================

import cron from 'node-cron';
import { collectCalendarEvents } from '../src/engines/calendar/collector';
import { parseAndScoreRecentReleases } from '../src/engines/calendar/parser';
import { fetchAndStoreIntermarketData } from '../src/engines/intermarket/confirmation';
import { scoreAllCurrencies } from '../src/engines/scoring/currency-scorer';
import { scoreAllPairs } from '../src/engines/scoring/pair-scorer';
import { detectAndStoreRegime } from '../src/engines/regime/detector';
import { runAlertCheck } from '../src/engines/alerts/alert-engine';
import { generateEventRiskWarnings } from '../src/engines/risk/event-risk';
import { collectForexNews } from '../src/engines/news/collector';
import { refreshActuals } from '../src/engines/calendar/collector';
import { refreshCentralBankRates } from '../src/engines/central-bank/rate-updater';

// ─────────────────────────────────────────────────────────────
// SCHEDULE CONFIGURATION
// Adjust these to your preferred frequency
// ─────────────────────────────────────────────────────────────
const SCHEDULE = {
  // Full analysis pipeline: every 30 minutes during market hours
  FULL_ANALYSIS: process.env.WORKER_CRON_SCORING || '*/30 * * * *',

  // Calendar fetch only: every 30 minutes (aligned with analysis)
  CALENDAR: process.env.WORKER_CRON_CALENDAR || '*/30 * * * *',

  // Alert check: every 15 minutes
  ALERTS: process.env.WORKER_CRON_ALERTS || '*/15 * * * *',

  // Intermarket data: every 10 minutes (markets move fast)
  INTERMARKET: '*/10 * * * *',

  // Forex news collection: every 20 minutes
  NEWS: process.env.WORKER_CRON_NEWS || '*/20 * * * *',

  // Fast actuals patch: every 5 minutes (surgical T1/T2 actual value refresh)
  FAST_ACTUALS: process.env.WORKER_CRON_FAST_ACTUALS || '*/5 * * * *',

  // CB rate auto-update: every 30 minutes (rate decisions happen ~8x/year per bank)
  CB_RATES: process.env.WORKER_CRON_CB_RATES || '*/30 * * * *',
};

let isAnalysisRunning = false;
let isAlertRunning = false;
let isActualsRunning = false;
let isCBRatesRunning = false;

// ─────────────────────────────────────────────────────────────
// FULL ANALYSIS JOB
// ─────────────────────────────────────────────────────────────
async function fullAnalysisJob(): Promise<void> {
  if (isAnalysisRunning) {
    log('Full analysis skipped — previous run still in progress');
    return;
  }
  isAnalysisRunning = true;
  const start = Date.now();
  log('Starting full analysis pipeline...');

  try {
    // 1. Calendar
    await safe('calendar', () => collectCalendarEvents());
    await safe('event-scoring', () => parseAndScoreRecentReleases());

    // 2. Intermarket
    await safe('intermarket', () => fetchAndStoreIntermarketData());

    // 3. Scoring
    const currencies = await safe('currency-scoring', () => scoreAllCurrencies()) ?? [];
    const pairs = await safe('pair-scoring', () => scoreAllPairs(currencies)) ?? [];

    // 4. Regime
    const regime = await safe('regime', () => detectAndStoreRegime(currencies));

    // 5. Alerts
    if (regime) {
      await safe('alerts', () => runAlertCheck(currencies, pairs, regime));
    }

    log(`Full analysis complete in ${((Date.now() - start) / 1000).toFixed(1)}s`);
  } finally {
    isAnalysisRunning = false;
  }
}

// ─────────────────────────────────────────────────────────────
// ALERT-ONLY JOB (runs more frequently)
// ─────────────────────────────────────────────────────────────
async function alertOnlyJob(): Promise<void> {
  if (isAlertRunning || isAnalysisRunning) return;
  isAlertRunning = true;

  try {
    // Only check event risk warnings (fast, no scoring needed)
    const risks = await safe('event-risk-check', () => generateEventRiskWarnings(4));
    if (risks && risks.filter(r => r.severity === 'critical').length > 0) {
      log(`Alert check: ${risks.filter(r => r.severity === 'critical').length} critical event risks found`);
    }
  } finally {
    isAlertRunning = false;
  }
}

// ─────────────────────────────────────────────────────────────
// INTERMARKET-ONLY JOB
// ─────────────────────────────────────────────────────────────
async function intermarketJob(): Promise<void> {
  if (isAnalysisRunning) return;
  await safe('intermarket-refresh', () => fetchAndStoreIntermarketData());
}

// ─────────────────────────────────────────────────────────────
// NEWS COLLECTION JOB
// ─────────────────────────────────────────────────────────────
async function newsJob(): Promise<void> {
  const count = await safe('news-collection', () => collectForexNews());
  if (count !== null && count > 0) {
    log(`News: inserted ${count} new articles`);
  }
}

// ─────────────────────────────────────────────────────────────
// FAST ACTUALS JOB — patches T1/T2 events missing actuals (< 10 s)
// ─────────────────────────────────────────────────────────────
async function fastActualsJob(): Promise<void> {
  if (isActualsRunning || isAnalysisRunning) return;
  isActualsRunning = true;

  try {
    const result = await safe('fast-actuals', () => refreshActuals());
    if (result && result.updated > 0) {
      log(`Fast actuals: patched ${result.updated}/${result.checked} events — re-scoring...`);
      await safe('event-scoring-fast', () => parseAndScoreRecentReleases());
    }
  } finally {
    isActualsRunning = false;
  }
}

// ─────────────────────────────────────────────────────────────
// CB RATE REFRESH JOB — detects rate decisions and updates CB bias
// ─────────────────────────────────────────────────────────────
async function cbRatesJob(): Promise<void> {
  if (isCBRatesRunning || isAnalysisRunning) return;
  isCBRatesRunning = true;

  try {
    const result = await safe('cb-rates', () => refreshCentralBankRates());
    if (result && result.updated > 0) {
      log(`CB rates: updated ${result.updated}/${result.checked} currencies — re-scoring...`);
      await safe('currency-scoring-cb', () => scoreAllCurrencies());
    }
  } finally {
    isCBRatesRunning = false;
  }
}

// ─────────────────────────────────────────────────────────────
// SAFE WRAPPER — catches errors without crashing the scheduler
// ─────────────────────────────────────────────────────────────
async function safe<T>(name: string, fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log(`ERROR in ${name}: ${msg}`);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────
// LOGGER
// ─────────────────────────────────────────────────────────────
function log(msg: string): void {
  const ts = new Date().toISOString();
  console.log(`[${ts}] [Scheduler] ${msg}`);
}

// ─────────────────────────────────────────────────────────────
// START SCHEDULER
// ─────────────────────────────────────────────────────────────
function start(): void {
  log('='.repeat(50));
  log('Forex Fundamental Analyzer Scheduler started');
  log(`Full analysis: ${SCHEDULE.FULL_ANALYSIS}`);
  log(`Alert checks:  ${SCHEDULE.ALERTS}`);
  log(`Intermarket:   ${SCHEDULE.INTERMARKET}`);
  log(`News:          ${SCHEDULE.NEWS}`);
  log(`Fast actuals:  ${SCHEDULE.FAST_ACTUALS}`);
  log(`CB rates:      ${SCHEDULE.CB_RATES}`);
  log('='.repeat(50));

  // Schedule full analysis
  cron.schedule(SCHEDULE.FULL_ANALYSIS, () => {
    fullAnalysisJob().catch(err => log(`Unhandled error in full analysis: ${err.message}`));
  }, { timezone: 'UTC' });

  // Schedule alert checks
  cron.schedule(SCHEDULE.ALERTS, () => {
    alertOnlyJob().catch(err => log(`Unhandled error in alert check: ${err.message}`));
  }, { timezone: 'UTC' });

  // Schedule intermarket updates
  cron.schedule(SCHEDULE.INTERMARKET, () => {
    intermarketJob().catch(err => log(`Unhandled error in intermarket job: ${err.message}`));
  }, { timezone: 'UTC' });

  // Schedule news collection
  cron.schedule(SCHEDULE.NEWS, () => {
    newsJob().catch(err => log(`Unhandled error in news job: ${err.message}`));
  }, { timezone: 'UTC' });

  // Schedule fast actuals patch
  cron.schedule(SCHEDULE.FAST_ACTUALS, () => {
    fastActualsJob().catch(err => log(`Unhandled error in fast-actuals job: ${err.message}`));
  }, { timezone: 'UTC' });

  // Schedule CB rate auto-updates
  cron.schedule(SCHEDULE.CB_RATES, () => {
    cbRatesJob().catch(err => log(`Unhandled error in cb-rates job: ${err.message}`));
  }, { timezone: 'UTC' });

  // Run once immediately on startup
  log('Running initial analysis on startup...');
  fullAnalysisJob().catch(err => log(`Startup analysis error: ${err.message}`));
  newsJob().catch(err => log(`Startup news error: ${err.message}`));
  cbRatesJob().catch(err => log(`Startup CB rates error: ${err.message}`));
}

// Handle graceful shutdown
process.on('SIGTERM', () => { log('SIGTERM received — shutting down'); process.exit(0); });
process.on('SIGINT', () => { log('SIGINT received — shutting down'); process.exit(0); });

start();
