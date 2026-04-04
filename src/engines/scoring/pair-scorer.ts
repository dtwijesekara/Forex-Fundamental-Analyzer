// ============================================================
// PAIR BIAS ENGINE
// Computes bias direction and conviction for each forex pair
// Based on relative currency strength + event risk + conflicts
// ============================================================

import { createAdminClient, TABLES } from '@/lib/supabase';
import { PRIORITY_PAIRS, getConvictionPct, getPairBiasDirection } from '@/lib/constants';
import { getUpcomingEventsForCurrency } from '@/engines/risk/event-risk';
import type {
  CurrencyScore,
  PairBiasResult,
  ForexPair,
  Currency,
  PairBiasDirection,
} from '@/types';

// -----------------------------------------------------------------------
// SCORE ALL PRIORITY PAIRS
// -----------------------------------------------------------------------
export async function scoreAllPairs(
  currencyScores: CurrencyScore[]
): Promise<PairBiasResult[]> {
  const scoreMap = buildScoreMap(currencyScores);
  const results: PairBiasResult[] = [];

  for (const pairInfo of PRIORITY_PAIRS) {
    try {
      const result = await scorePair(pairInfo.pair, pairInfo.base, pairInfo.quote, scoreMap, currencyScores);
      results.push(result);
    } catch (err) {
      console.error(`[PairScorer] Error scoring ${pairInfo.pair}:`, err);
    }
  }

  await savePairBias(results);
  return results;
}

// -----------------------------------------------------------------------
// SCORE A SINGLE PAIR
// -----------------------------------------------------------------------
export async function scorePair(
  pair: ForexPair,
  base: Currency,
  quote: Currency,
  scoreMap: Record<Currency, number>,
  fullScores?: CurrencyScore[]
): Promise<PairBiasResult> {
  const baseScore = scoreMap[base] ?? 0;
  const quoteScore = scoreMap[quote] ?? 0;
  const pairScore = baseScore - quoteScore;

  const bias = getPairBiasDirection(pairScore);
  const conviction_pct = getConvictionPct(pairScore);

  // Check for event risk on either currency
  const [baseEvents, quoteEvents] = await Promise.all([
    getUpcomingEventsForCurrency(base, 8),
    getUpcomingEventsForCurrency(quote, 8),
  ]);

  const allUpcomingEvents = [...baseEvents, ...quoteEvents];
  const hasHighImpactSoon = allUpcomingEvents.some(e => e.tier === 1);
  const hasMediumImpactSoon = allUpcomingEvents.some(e => e.tier <= 2);

  const event_risk_flag = hasHighImpactSoon || (hasMediumImpactSoon && allUpcomingEvents.length > 1);
  const event_risk_detail = event_risk_flag
    ? buildEventRiskDetail(allUpcomingEvents, base, quote)
    : null;

  // Detect conflicts
  const { conflict_flag, conflict_reason } = detectConflicts(
    pair, base, quote, baseScore, quoteScore, bias, fullScores
  );

  // Build explanation
  const explanation = buildPairExplanation(pair, base, quote, baseScore, quoteScore, pairScore, bias, conviction_pct, fullScores);

  return {
    pair,
    base_currency: base,
    quote_currency: quote,
    bias,
    pair_score: Number(pairScore.toFixed(1)),
    conviction_pct: conflict_flag ? Math.max(0, conviction_pct - 20) : conviction_pct,
    base_score: Number(baseScore.toFixed(1)),
    quote_score: Number(quoteScore.toFixed(1)),
    explanation,
    conflict_flag,
    conflict_reason,
    event_risk_flag,
    event_risk_detail,
    computed_at: new Date().toISOString(),
    is_current: true,
  };
}

// -----------------------------------------------------------------------
// CONFLICT DETECTION
// -----------------------------------------------------------------------
function detectConflicts(
  pair: ForexPair,
  base: Currency,
  quote: Currency,
  baseScore: number,
  quoteScore: number,
  bias: PairBiasDirection,
  fullScores?: CurrencyScore[]
): { conflict_flag: boolean; conflict_reason: string | null } {
  const conflicts: string[] = [];

  if (!fullScores) return { conflict_flag: false, conflict_reason: null };

  const baseData = fullScores.find(s => s.currency === base);
  const quoteData = fullScores.find(s => s.currency === quote);

  // Conflict 1: Bullish bias on pair but base currency has bearish central bank while quote is hawkish
  if (bias === 'bullish' && baseData && quoteData) {
    const baseCB = baseData.cb_bias?.bias_score || 0;
    const quoteCB = quoteData.cb_bias?.bias_score || 0;
    if (baseCB < 0 && quoteCB > 2) {
      conflicts.push(`${base} CB dovish while ${quote} CB hawkish — rate differential against ${base}`);
    }
  }

  if (bias === 'bearish' && baseData && quoteData) {
    const baseCB = baseData.cb_bias?.bias_score || 0;
    const quoteCB = quoteData.cb_bias?.bias_score || 0;
    if (baseCB > 2 && quoteCB < 0) {
      conflicts.push(`${base} CB hawkish while ${quote} CB dovish — rate differential supports ${base}`);
    }
  }

  // Conflict 2: Both currencies are strong (pair score is large but both are bullish)
  if (Math.abs(baseScore) > 50 && Math.abs(quoteScore) > 50 && Math.sign(baseScore) === Math.sign(quoteScore)) {
    conflicts.push(`Both ${base} and ${quote} are ${baseScore > 0 ? 'strong' : 'weak'} — mixed signals`);
  }

  // Conflict 3: Very low conviction but high event risk
  if (Math.abs(baseScore - quoteScore) < 10) {
    conflicts.push('Currency scores are very close — low-confidence pair bias');
  }

  return {
    conflict_flag: conflicts.length > 0,
    conflict_reason: conflicts.length > 0 ? conflicts.join('; ') : null,
  };
}

// -----------------------------------------------------------------------
// BUILD PAIR EXPLANATION
// -----------------------------------------------------------------------
function buildPairExplanation(
  pair: ForexPair,
  base: Currency,
  quote: Currency,
  baseScore: number,
  quoteScore: number,
  pairScore: number,
  bias: PairBiasDirection,
  conviction: number,
  fullScores?: CurrencyScore[]
): string {
  const lines: string[] = [];

  const biasWord = bias === 'bullish' ? 'Bullish' : bias === 'bearish' ? 'Bearish' : 'Neutral';
  lines.push(`${pair} — ${biasWord} | Conviction: ${conviction}%`);

  // Base vs quote scores
  const stronger = baseScore > quoteScore ? base : quote;
  const weaker = baseScore > quoteScore ? quote : base;
  const gap = Math.abs(pairScore).toFixed(0);

  if (Math.abs(pairScore) > 5) {
    const strongerScore = baseScore > quoteScore ? baseScore : quoteScore;
    const weakerScore = baseScore > quoteScore ? quoteScore : baseScore;
    lines.push(`• ${stronger} (${strongerScore.toFixed(0)}) stronger than ${weaker} (${weakerScore.toFixed(0)}) by ${gap} points`);
  }

  // CB context
  if (fullScores) {
    const baseData = fullScores.find(s => s.currency === base);
    const quoteData = fullScores.find(s => s.currency === quote);

    if (baseData?.cb_bias && quoteData?.cb_bias) {
      const baseLabel = baseData.cb_bias.bias_label;
      const quoteLabel = quoteData.cb_bias.bias_label;
      lines.push(`• ${base} CB: ${baseLabel} | ${quote} CB: ${quoteLabel}`);
    }

    // Recent events context
    if (baseData?.score_economic !== 0 || quoteData?.score_economic !== 0) {
      const baseEco = baseData?.score_economic || 0;
      const quoteEco = quoteData?.score_economic || 0;
      if (Math.abs(baseEco) > 5 || Math.abs(quoteEco) > 5) {
        lines.push(`• Economic: ${base} ${baseEco > 0 ? 'positive data' : 'negative data'} | ${quote} ${quoteEco > 0 ? 'positive data' : 'negative data'}`);
      }
    }
  }

  return lines.join('\n');
}

// -----------------------------------------------------------------------
// BUILD EVENT RISK DETAIL
// -----------------------------------------------------------------------
function buildEventRiskDetail(
  events: import('@/types').EconomicEvent[],
  base: Currency,
  quote: Currency
): string {
  const tier1Events = events.filter(e => e.tier === 1);
  const tier2Events = events.filter(e => e.tier === 2);

  const parts: string[] = [];
  if (tier1Events.length > 0) {
    const names = tier1Events.slice(0, 2).map(e => `${e.currency} ${e.event_name}`).join(', ');
    parts.push(`High impact: ${names}`);
  }
  if (tier2Events.length > 0 && tier1Events.length === 0) {
    const names = tier2Events.slice(0, 2).map(e => `${e.currency} ${e.event_name}`).join(', ');
    parts.push(`Medium impact: ${names}`);
  }
  return parts.join(' | ');
}

// -----------------------------------------------------------------------
// BUILD SCORE MAP FROM CURRENCY SCORES
// -----------------------------------------------------------------------
function buildScoreMap(scores: CurrencyScore[]): Record<Currency, number> {
  const map: Partial<Record<Currency, number>> = {};
  for (const s of scores) {
    map[s.currency] = s.score;
  }
  return map as Record<Currency, number>;
}

// -----------------------------------------------------------------------
// SAVE PAIR BIAS TO DB
// -----------------------------------------------------------------------
async function savePairBias(pairs: PairBiasResult[]): Promise<void> {
  const db = createAdminClient();

  // Mark old as non-current
  await db.from(TABLES.PAIR_BIAS)
    .update({ is_current: false })
    .eq('is_current', true);

  const toInsert = pairs.map(p => ({
    pair: p.pair,
    base_currency: p.base_currency,
    quote_currency: p.quote_currency,
    bias: p.bias,
    pair_score: p.pair_score,
    conviction_pct: p.conviction_pct,
    base_score: p.base_score,
    quote_score: p.quote_score,
    explanation: p.explanation,
    conflict_flag: p.conflict_flag,
    conflict_reason: p.conflict_reason,
    event_risk_flag: p.event_risk_flag,
    event_risk_detail: p.event_risk_detail,
    computed_at: p.computed_at,
    is_current: true,
  }));

  const { error } = await db.from(TABLES.PAIR_BIAS).insert(toInsert);
  if (error) {
    console.error('[PairScorer] Error saving pair bias:', error.message);
    throw error;
  }
}

// -----------------------------------------------------------------------
// GET CURRENT PAIR BIAS
// -----------------------------------------------------------------------
export async function getCurrentPairBias(): Promise<PairBiasResult[]> {
  const db = createAdminClient();

  const { data, error } = await db
    .from(TABLES.PAIR_BIAS)
    .select('*')
    .eq('is_current', true)
    .order('conviction_pct', { ascending: false });

  if (error) throw error;
  return (data || []) as PairBiasResult[];
}
