// ============================================================
// SINGLE-RUN ANALYSIS WORKER
// Run manually: npm run worker:run
// Or called by the scheduler every cycle
// ============================================================

import { collectCalendarEvents } from '../src/engines/calendar/collector';
import { parseAndScoreRecentReleases } from '../src/engines/calendar/parser';
import { fetchAndStoreIntermarketData } from '../src/engines/intermarket/confirmation';
import { scoreAllCurrencies } from '../src/engines/scoring/currency-scorer';
import { scoreAllPairs } from '../src/engines/scoring/pair-scorer';
import { detectAndStoreRegime } from '../src/engines/regime/detector';
import { runAlertCheck } from '../src/engines/alerts/alert-engine';

interface StepResult {
  step: string;
  success: boolean;
  detail?: string;
  error?: string;
  duration_ms: number;
}

async function runAnalysis(): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log('FOREX FUNDAMENTAL ANALYZER — Analysis Run');
  console.log(`Started: ${new Date().toISOString()}`);
  console.log('='.repeat(60) + '\n');

  const results: StepResult[] = [];
  const totalStart = Date.now();

  // ────────────────────────────────────────────────
  // STEP 1: Fetch economic calendar
  // ────────────────────────────────────────────────
  await runStep('Calendar Fetch', async () => {
    const result = await collectCalendarEvents();
    return `Inserted: ${result.inserted}, Updated: ${result.updated}, Errors: ${result.errors}`;
  }, results);

  // ────────────────────────────────────────────────
  // STEP 2: Score released events
  // ────────────────────────────────────────────────
  await runStep('Event Scoring', async () => {
    const count = await parseAndScoreRecentReleases();
    return `Scored ${count} events`;
  }, results);

  // ────────────────────────────────────────────────
  // STEP 3: Fetch intermarket data
  // ────────────────────────────────────────────────
  await runStep('Intermarket Fetch', async () => {
    const snapshot = await fetchAndStoreIntermarketData();
    const count = Object.values(snapshot).filter(Boolean).length;
    return `Fetched ${count}/6 symbols`;
  }, results);

  // ────────────────────────────────────────────────
  // STEP 4: Score currencies
  // ────────────────────────────────────────────────
  let currencyScores: Awaited<ReturnType<typeof scoreAllCurrencies>> = [];
  await runStep('Currency Scoring', async () => {
    currencyScores = await scoreAllCurrencies();
    const summary = currencyScores
      .sort((a, b) => b.score - a.score)
      .map(s => `${s.currency}:${s.score.toFixed(0)}`)
      .join(', ');
    return `Scored ${currencyScores.length} currencies | ${summary}`;
  }, results);

  // ────────────────────────────────────────────────
  // STEP 5: Score pairs
  // ────────────────────────────────────────────────
  let pairResults: Awaited<ReturnType<typeof scoreAllPairs>> = [];
  await runStep('Pair Scoring', async () => {
    pairResults = await scoreAllPairs(currencyScores);
    return `Scored ${pairResults.length} pairs`;
  }, results);

  // ────────────────────────────────────────────────
  // STEP 6: Detect regime
  // ────────────────────────────────────────────────
  let regime: Awaited<ReturnType<typeof detectAndStoreRegime>> | null = null;
  await runStep('Regime Detection', async () => {
    regime = await detectAndStoreRegime(currencyScores);
    return `Regime: ${regime.regime} (${regime.confidence_pct}% confidence)`;
  }, results);

  // ────────────────────────────────────────────────
  // STEP 7: Run alert checks
  // ────────────────────────────────────────────────
  await runStep('Alert Check', async () => {
    if (!regime) return 'Skipped — no regime data';
    const alerts = await runAlertCheck(currencyScores, pairResults, regime);
    return `Generated ${alerts.length} alerts`;
  }, results);

  // ────────────────────────────────────────────────
  // SUMMARY
  // ────────────────────────────────────────────────
  const totalDuration = Date.now() - totalStart;
  const successes = results.filter(r => r.success).length;
  const failures = results.filter(r => !r.success).length;

  console.log('\n' + '─'.repeat(60));
  console.log(`ANALYSIS COMPLETE in ${(totalDuration / 1000).toFixed(1)}s`);
  console.log(`Steps: ${successes} ok, ${failures} failed`);

  if (failures > 0) {
    console.log('\nFailed steps:');
    results.filter(r => !r.success).forEach(r => {
      console.log(`  ✗ ${r.step}: ${r.error}`);
    });
  }

  console.log('─'.repeat(60) + '\n');

  // Print currency summary table
  if (currencyScores.length > 0) {
    console.log('CURRENCY SCORES:');
    const sorted = [...currencyScores].sort((a, b) => b.score - a.score);
    for (const s of sorted) {
      const bar = getScoreBar(s.score);
      console.log(`  ${s.currency.padEnd(4)} ${bar} ${s.score > 0 ? '+' : ''}${s.score.toFixed(1).padStart(6)} | ${s.bias_label}`);
    }
    console.log('');
  }
}

// ────────────────────────────────────────────────
// HELPER: Run a step with error handling + timing
// ────────────────────────────────────────────────
async function runStep(
  name: string,
  fn: () => Promise<string>,
  results: StepResult[]
): Promise<void> {
  const start = Date.now();
  process.stdout.write(`  ${name}... `);
  try {
    const detail = await fn();
    const duration = Date.now() - start;
    console.log(`✓ ${detail} (${duration}ms)`);
    results.push({ step: name, success: true, detail, duration_ms: duration });
  } catch (err) {
    const duration = Date.now() - start;
    const error = err instanceof Error ? err.message : String(err);
    console.log(`✗ FAILED: ${error}`);
    results.push({ step: name, success: false, error, duration_ms: duration });
  }
}

// ────────────────────────────────────────────────
// HELPER: ASCII score bar
// ────────────────────────────────────────────────
function getScoreBar(score: number): string {
  const MAX = 100;
  const BAR_WIDTH = 20;
  const pos = Math.round(((score + MAX) / (2 * MAX)) * BAR_WIDTH);
  const bar = Array(BAR_WIDTH).fill('·');
  const center = Math.round(BAR_WIDTH / 2);
  bar[center] = '|';
  if (pos !== center) {
    bar[pos] = score > 0 ? '▶' : '◀';
  }
  return '[' + bar.join('') + ']';
}

// ────────────────────────────────────────────────
// RUN
// ────────────────────────────────────────────────
runAnalysis().catch(err => {
  console.error('Fatal error in analysis run:', err);
  process.exit(1);
});
