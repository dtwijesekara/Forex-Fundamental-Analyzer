// ============================================================
// EVENT PARSER
// Classifies events, calculates surprise scores, and determines
// the fundamental impact (bullish/bearish/neutral) on the currency
// ============================================================

import { createAdminClient, TABLES } from '@/lib/supabase';
import { EVENT_CATEGORY_KEYWORDS, EVENT_TIER_MAP, SCORE_WEIGHTS } from '@/lib/constants';
import type {
  EconomicEvent,
  EventCategory,
  EventTier,
  EventImpact,
  ReleaseBias,
  Currency,
} from '@/types';

// -----------------------------------------------------------------------
// CATEGORY CLASSIFICATION
// -----------------------------------------------------------------------
export function classifyEventCategory(title: string): EventCategory {
  const lowerTitle = title.toLowerCase();

  for (const { keywords, category } of EVENT_CATEGORY_KEYWORDS) {
    if (keywords.some(kw => lowerTitle.includes(kw))) {
      return category;
    }
  }
  return 'other';
}

// -----------------------------------------------------------------------
// TIER DETERMINATION
// -----------------------------------------------------------------------
export function determineEventTier(category: EventCategory, impact: EventImpact): EventTier {
  // First check category map
  const tierFromCategory = EVENT_TIER_MAP[category] as EventTier | undefined;
  if (tierFromCategory) return tierFromCategory;

  // Fallback to impact level
  if (impact === 'High') return 2;
  if (impact === 'Medium') return 2;
  return 3;
}

// -----------------------------------------------------------------------
// SURPRISE SCORE CALCULATION
// Returns a score from -10 to +10 for a single event
// -----------------------------------------------------------------------
export function calculateEventImpactScore(event: EconomicEvent): {
  score: number;
  bias: ReleaseBias;
  reason: string;
} {
  const { category, actual_num, forecast_num, previous_num, surprise_value, surprise_pct, tier } = event;

  // If not released or missing data, neutral
  if (!event.is_released || actual_num === null || actual_num === undefined) {
    return { score: 0, bias: 'neutral', reason: 'Not released or no data' };
  }

  // Use surprise percentage as the primary signal
  // If no forecast, compare to previous
  const compareValue = forecast_num !== null && forecast_num !== undefined
    ? forecast_num
    : previous_num;

  if (compareValue === null || compareValue === undefined) {
    return { score: 0, bias: 'neutral', reason: 'No forecast/previous to compare' };
  }

  const surprise = actual_num - compareValue;
  const surprisePctAbs = Math.abs(surprise_pct || 0);

  // Determine raw direction impact (positive surprise = good for currency?)
  const direction = getPositiveSurpriseMeaning(category);

  // Base score calculation
  let rawScore = 0;
  if (surprisePctAbs === 0 || Math.abs(surprise) < 0.001) {
    rawScore = 0; // In-line
  } else if (surprisePctAbs > 30) {
    rawScore = 10 * Math.sign(surprise) * direction; // Huge miss/beat
  } else if (surprisePctAbs > 15) {
    rawScore = 7 * Math.sign(surprise) * direction;  // Big miss/beat
  } else if (surprisePctAbs > 5) {
    rawScore = 4 * Math.sign(surprise) * direction;  // Moderate
  } else {
    rawScore = 2 * Math.sign(surprise) * direction;  // Small
  }

  // Context adjustments for specific categories
  rawScore = applyContextAdjustments(rawScore, event);

  // Apply tier weight
  const tierWeight = tier === 1 ? SCORE_WEIGHTS.TIER1_EVENT_WEIGHT
    : tier === 2 ? SCORE_WEIGHTS.TIER2_EVENT_WEIGHT
    : SCORE_WEIGHTS.TIER3_EVENT_WEIGHT;

  const finalScore = Math.max(-10, Math.min(10, rawScore * tierWeight));
  const bias: ReleaseBias = finalScore > 0.5 ? 'bullish' : finalScore < -0.5 ? 'bearish' : 'neutral';

  const reason = buildReason(event, surprise, rawScore, bias);

  return { score: Number(finalScore.toFixed(2)), bias, reason };
}

// -----------------------------------------------------------------------
// Does a positive data surprise benefit the currency?
// Returns +1 (yes, positive = good) or -1 (yes, negative = good for currency)
// -----------------------------------------------------------------------
function getPositiveSurpriseMeaning(category: EventCategory): 1 | -1 {
  switch (category) {
    // Positive = stronger economy = bullish for currency
    case 'nfp':
    case 'employment_change':
    case 'wages':
    case 'gdp':
    case 'retail_sales':
    case 'consumer_confidence':
    case 'pmi_manufacturing':
    case 'pmi_services':
    case 'pmi_composite':
      return 1;

    // For inflation — higher-than-forecast CPI is bullish (tightening pressure)
    case 'cpi':
    case 'core_cpi':
    case 'ppi':
      return 1;

    // For unemployment — lower = better for currency
    case 'unemployment':
      return -1;

    // Rate decision — covered separately
    case 'rate_decision':
      return 1;

    // Trade balance — surplus = positive
    case 'trade_balance':
      return 1;

    default:
      return 1;
  }
}

// -----------------------------------------------------------------------
// CONTEXT-AWARE ADJUSTMENTS
// -----------------------------------------------------------------------
function applyContextAdjustments(rawScore: number, event: EconomicEvent): number {
  let adjusted = rawScore;

  // CPI/inflation: High inflation could be negative if market thinks CB is behind the curve
  // For now, use simple rule: higher inflation = hawkish expectations = bullish
  // This is a simplification — more complex context can be added later

  // Rate decision: actual rate change direction
  if (event.category === 'rate_decision') {
    if (event.actual_num !== null && event.previous_num !== null) {
      const rateChange = (event.actual_num || 0) - (event.previous_num || 0);
      if (rateChange > 0) adjusted = 8;       // hike
      else if (rateChange < -0.124) adjusted = -8;  // cut
      else adjusted = 1;                       // hold — slight positive (no cut)
    }
  }

  // PMI: 50 is the expansion/contraction threshold
  if (event.category === 'pmi_manufacturing' || event.category === 'pmi_services' || event.category === 'pmi_composite') {
    if (event.actual_num !== null && event.actual_num !== undefined) {
      // Being above/below 50 matters as much as the surprise
      if (event.actual_num < 50) adjusted = Math.min(adjusted, 0) - 1; // contraction penalty
      if (event.actual_num >= 50 && adjusted < 0) adjusted = Math.max(adjusted, -2); // above 50 floor
    }
  }

  return adjusted;
}

// -----------------------------------------------------------------------
// BUILD HUMAN-READABLE REASON
// -----------------------------------------------------------------------
function buildReason(
  event: EconomicEvent,
  surprise: number,
  rawScore: number,
  bias: ReleaseBias
): string {
  const dir = surprise > 0 ? 'beat' : surprise < 0 ? 'missed' : 'matched';
  const compareLabel = event.forecast_num !== null ? 'forecast' : 'previous';
  const amt = Math.abs(surprise).toFixed(2);

  if (dir === 'matched') {
    return `${event.event_name} in-line with ${compareLabel} — no surprise, neutral impact`;
  }

  const biasWord = bias === 'bullish' ? 'positive' : bias === 'bearish' ? 'negative' : 'neutral';
  return `${event.event_name} ${dir} ${compareLabel} by ${amt} — ${biasWord} for ${event.currency}`;
}

// -----------------------------------------------------------------------
// BATCH PARSE AND UPDATE RELEASE SCORES
// Run after calendar collection to score all newly released events
// -----------------------------------------------------------------------
export async function parseAndScoreRecentReleases(): Promise<number> {
  const db = createAdminClient();
  const since = new Date(Date.now() - 48 * 3600 * 1000).toISOString();

  // Get recently released events with no score yet
  const { data: events, error } = await db
    .from(TABLES.ECONOMIC_EVENTS)
    .select('*')
    .eq('is_released', true)
    .gte('event_time', since)
    .neq('impact', 'Holiday');

  if (error) throw error;
  if (!events || events.length === 0) return 0;

  let updated = 0;
  for (const event of events as EconomicEvent[]) {
    try {
      const { score, bias, reason } = calculateEventImpactScore(event);

      await db.from(TABLES.ECONOMIC_EVENTS).update({
        release_score: score,
        release_bias: bias,
        notes: reason,
      }).eq('id', event.id);

      updated++;
    } catch (err) {
      console.error(`[Parser] Error scoring event ${event.id}:`, err);
    }
  }

  return updated;
}

// -----------------------------------------------------------------------
// AGGREGATE EVENT SCORES FOR A CURRENCY (for scoring engine)
// -----------------------------------------------------------------------
export function aggregateEventScores(
  events: EconomicEvent[],
  maxContribution: number = SCORE_WEIGHTS.ECONOMIC_MAX
): {
  score: number;
  details: Array<{ event_name: string; score: number; bias: ReleaseBias }>;
} {
  if (!events.length) return { score: 0, details: [] };

  const details: Array<{ event_name: string; score: number; bias: ReleaseBias }> = [];
  let weightedSum = 0;
  let totalWeight = 0;

  // Sort by tier (T1 first) and recency (most recent first)
  const sorted = [...events].sort((a, b) => {
    if (a.tier !== b.tier) return a.tier - b.tier;
    return new Date(b.event_time).getTime() - new Date(a.event_time).getTime();
  });

  // Weight more recent events more heavily
  // Most recent T1 events have most influence; older events decay
  const now = Date.now();
  for (const event of sorted) {
    const { score, bias } = calculateEventImpactScore(event);
    if (score === 0) continue;

    // Recency decay: events older than 3 days have reduced weight
    const ageDays = (now - new Date(event.event_time).getTime()) / (24 * 3600 * 1000);
    const recencyMultiplier = ageDays <= 1 ? 1.0 : ageDays <= 3 ? 0.8 : 0.5;

    // Tier weight
    const tierWeight = event.tier === 1 ? 1.0 : event.tier === 2 ? 0.5 : 0.2;

    const weight = tierWeight * recencyMultiplier;
    weightedSum += score * weight;
    totalWeight += weight;

    details.push({ event_name: event.event_name, score, bias });
  }

  if (totalWeight === 0) return { score: 0, details };

  // Normalize to max contribution range
  const rawAvg = weightedSum / totalWeight;
  // Scale: max raw score is 10, map to maxContribution
  const scaled = (rawAvg / 10) * maxContribution;
  const clamped = Math.max(-maxContribution, Math.min(maxContribution, scaled));

  return { score: Number(clamped.toFixed(2)), details };
}
