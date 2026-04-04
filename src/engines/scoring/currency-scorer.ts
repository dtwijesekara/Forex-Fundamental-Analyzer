// ============================================================
// CURRENCY SCORING ENGINE
// Computes a fundamental strength score (-100 to +100) for each
// of the 8 major currencies, with component breakdown + explanation
// ============================================================

import { createAdminClient, TABLES } from '@/lib/supabase';
import { CURRENCIES, getBiasLabel, SCORE_WEIGHTS } from '@/lib/constants';
import { aggregateEventScores } from '@/engines/calendar/parser';
import {
  getAllCBBiases,
  cbBiasToScoreContribution,
  calculateRateOutlookScore,
  generateCBExplanation,
  getApproximateCurrentRates,
} from '@/engines/central-bank/bias-engine';
import { getIntermarketSnapshot, calculateIntermarketScore } from '@/engines/intermarket/confirmation';
import { getLatestCOTData, calculateSentimentScore } from '@/engines/sentiment/cot-engine';
import { getUpcomingEventsForCurrency, calculateEventRiskPenalty } from '@/engines/risk/event-risk';
import { getRecentEventsForCurrency } from '@/engines/calendar/collector';
import { clampScore } from '@/lib/utils';
import type { Currency, CurrencyScore, ScoringContext } from '@/types';

// -----------------------------------------------------------------------
// SCORE ALL 8 CURRENCIES
// -----------------------------------------------------------------------
export async function scoreAllCurrencies(): Promise<CurrencyScore[]> {
  console.log('[Scorer] Starting currency scoring run...');

  // Build shared context (load once, reuse for all currencies)
  const context = await buildScoringContext();

  const scores: CurrencyScore[] = [];
  for (const currency of CURRENCIES) {
    try {
      const score = await scoreCurrency(currency, context);
      scores.push(score);
    } catch (err) {
      console.error(`[Scorer] Error scoring ${currency}:`, err);
    }
  }

  // Save to database
  await saveScores(scores);

  console.log('[Scorer] Scoring complete:', scores.map(s => `${s.currency}:${s.score.toFixed(1)}`).join(', '));
  return scores;
}

// -----------------------------------------------------------------------
// BUILD SCORING CONTEXT (shared data loaded once)
// -----------------------------------------------------------------------
async function buildScoringContext(): Promise<ScoringContext> {
  const [cbBiases, intermarket, cotData] = await Promise.all([
    getAllCBBiases(),
    getIntermarketSnapshot(),
    getLatestCOTDataForAll(),
  ]);

  // Load recent events for all currencies
  const recentEventsMap: Partial<Record<Currency, import('@/types').EconomicEvent[]>> = {};
  for (const currency of CURRENCIES) {
    try {
      recentEventsMap[currency] = await getRecentEventsForCurrency(currency, 7);
    } catch {
      recentEventsMap[currency] = [];
    }
  }

  return {
    recent_events: Object.values(recentEventsMap).flat() as import('@/types').EconomicEvent[],
    cb_biases: cbBiases,
    intermarket,
    cot_data: cotData,
    current_rates: getApproximateCurrentRates(),
  };
}

// -----------------------------------------------------------------------
// SCORE A SINGLE CURRENCY
// -----------------------------------------------------------------------
export async function scoreCurrency(
  currency: Currency,
  context?: ScoringContext
): Promise<CurrencyScore> {
  if (!context) {
    context = await buildScoringContext();
  }

  // 1. ECONOMIC RELEASE SCORE (-30 to +30)
  const recentEvents = context.recent_events.filter(e => e.currency === currency);
  const { score: economicScore } = aggregateEventScores(recentEvents, SCORE_WEIGHTS.ECONOMIC_MAX);

  // 2. CENTRAL BANK BIAS SCORE (-25 to +25)
  const cbBias = context.cb_biases[currency];
  const cbScore = cbBiasToScoreContribution(cbBias?.bias_score || 0, SCORE_WEIGHTS.CB_MAX);

  // 3. RATE OUTLOOK SCORE (-20 to +20)
  const rateScore = cbBias ? calculateRateOutlookScore(cbBias, SCORE_WEIGHTS.RATE_MAX) : 0;

  // 4. INTERMARKET SCORE (-15 to +15)
  const intermarketScore = calculateIntermarketScore(currency, context.intermarket, SCORE_WEIGHTS.INTERMARKET_MAX);

  // 5. SENTIMENT SCORE (-10 to +10)
  const cotEntry = context.cot_data[currency] || null;
  const sentimentScore = calculateSentimentScore(cotEntry, SCORE_WEIGHTS.SENTIMENT_MAX);

  // 6. EVENT RISK PENALTY (0 to -20) — reduce conviction when big events ahead
  const upcomingEvents = await getUpcomingEventsForCurrency(currency, 4); // next 4 hours
  const eventRiskPenalty = -calculateEventRiskPenalty(upcomingEvents);

  // TOTAL SCORE
  const rawTotal = economicScore + cbScore + rateScore + intermarketScore + sentimentScore + eventRiskPenalty;
  const finalScore = clampScore(rawTotal, -100, 100);
  const bias_label = getBiasLabel(finalScore);

  // EXPLANATION
  const explanation = buildCurrencyExplanation(currency, {
    finalScore,
    economicScore,
    cbScore,
    rateScore,
    intermarketScore,
    sentimentScore,
    eventRiskPenalty,
    cbBias,
    recentEvents,
  });

  return {
    currency,
    score: Number(finalScore.toFixed(1)),
    bias_label,
    score_economic: Number(economicScore.toFixed(1)),
    score_cb: Number(cbScore.toFixed(1)),
    score_rate: Number(rateScore.toFixed(1)),
    score_intermarket: Number(intermarketScore.toFixed(1)),
    score_sentiment: Number(sentimentScore.toFixed(1)),
    event_risk_penalty: Number(eventRiskPenalty.toFixed(1)),
    explanation,
    computed_at: new Date().toISOString(),
    is_current: true,
    cb_bias: cbBias,
  };
}

// -----------------------------------------------------------------------
// BUILD EXPLANATION STRING
// -----------------------------------------------------------------------
function buildCurrencyExplanation(
  currency: Currency,
  data: {
    finalScore: number;
    economicScore: number;
    cbScore: number;
    rateScore: number;
    intermarketScore: number;
    sentimentScore: number;
    eventRiskPenalty: number;
    cbBias: import('@/types').CentralBankBias | undefined;
    recentEvents: import('@/types').EconomicEvent[];
  }
): string {
  const { finalScore, economicScore, cbScore, rateScore, intermarketScore, sentimentScore, eventRiskPenalty, cbBias, recentEvents } = data;

  const lines: string[] = [];
  const overallDir = finalScore >= 20 ? 'Bullish' : finalScore <= -20 ? 'Bearish' : 'Neutral';
  lines.push(`${currency} — ${overallDir} (${finalScore > 0 ? '+' : ''}${finalScore.toFixed(0)})`);

  // Economic
  if (Math.abs(economicScore) > 2) {
    const dir = economicScore > 0 ? 'supportive' : 'negative';
    const tier1Recent = recentEvents.filter(e => e.tier === 1 && e.is_released).slice(0, 2);
    if (tier1Recent.length > 0) {
      lines.push(`• Economic data ${dir}: recent ${tier1Recent.map(e => e.event_name).join(', ')}`);
    } else {
      lines.push(`• Economic data ${dir} (score: ${economicScore > 0 ? '+' : ''}${economicScore.toFixed(0)})`);
    }
  }

  // CB
  if (cbBias) {
    lines.push(`• ${generateCBExplanation(cbBias)}`);
  }

  // Rate
  if (Math.abs(rateScore) > 3) {
    const dir = rateScore > 0 ? 'supportive' : 'negative';
    lines.push(`• Rate outlook ${dir} (${rateScore > 0 ? '+' : ''}${rateScore.toFixed(0)})`);
  }

  // Intermarket
  if (Math.abs(intermarketScore) > 2) {
    lines.push(`• Intermarket ${intermarketScore > 0 ? 'confirming' : 'headwinds'} (${intermarketScore > 0 ? '+' : ''}${intermarketScore.toFixed(0)})`);
  }

  // Sentiment
  if (Math.abs(sentimentScore) > 1) {
    lines.push(`• Positioning: ${sentimentScore > 0 ? 'net long, modest support' : 'net short, contrarian risk'}`);
  }

  // Event risk
  if (eventRiskPenalty < -3) {
    lines.push(`• Event risk reducing conviction (penalty: ${eventRiskPenalty.toFixed(0)})`);
  }

  return lines.join('\n');
}

// -----------------------------------------------------------------------
// SAVE SCORES TO DATABASE
// -----------------------------------------------------------------------
async function saveScores(scores: CurrencyScore[]): Promise<void> {
  const db = createAdminClient();

  // Mark all current scores as non-current
  await db.from(TABLES.CURRENCY_SCORES)
    .update({ is_current: false })
    .eq('is_current', true);

  // Insert new scores
  const toInsert = scores.map(s => ({
    currency: s.currency,
    score: s.score,
    bias_label: s.bias_label,
    score_economic: s.score_economic,
    score_cb: s.score_cb,
    score_rate: s.score_rate,
    score_intermarket: s.score_intermarket,
    score_sentiment: s.score_sentiment,
    event_risk_penalty: s.event_risk_penalty,
    explanation: s.explanation,
    computed_at: s.computed_at,
    is_current: true,
  }));

  const { error } = await db.from(TABLES.CURRENCY_SCORES).insert(toInsert);
  if (error) {
    console.error('[Scorer] Error saving scores:', error.message);
    throw error;
  }
}

// -----------------------------------------------------------------------
// GET CURRENT SCORES
// -----------------------------------------------------------------------
export async function getCurrentCurrencyScores(): Promise<CurrencyScore[]> {
  const db = createAdminClient();

  const { data, error } = await db
    .from(TABLES.CURRENCY_SCORES)
    .select('*')
    .eq('is_current', true)
    .order('score', { ascending: false });

  if (error) throw error;
  return (data || []) as CurrencyScore[];
}

// -----------------------------------------------------------------------
// HELPER: Get latest COT data for all currencies
// -----------------------------------------------------------------------
async function getLatestCOTDataForAll(): Promise<Record<Currency, import('@/types').COTData | null>> {
  const result: Partial<Record<Currency, import('@/types').COTData | null>> = {};
  for (const currency of CURRENCIES) {
    try {
      result[currency] = await getLatestCOTData(currency);
    } catch {
      result[currency] = null;
    }
  }
  return result as Record<Currency, import('@/types').COTData | null>;
}
