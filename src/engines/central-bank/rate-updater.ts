// ============================================================
// CENTRAL BANK RATE AUTO-UPDATER
// Scans economic_events for released rate decisions and
// automatically keeps central_bank_bias table current.
// ============================================================

import { createAdminClient, TABLES } from '@/lib/supabase';
import { getAllCBBiases, updateCBBias } from './bias-engine';
import type { Currency, CBBiasLabel } from '@/types';

// How far back to look for rate decisions (90 days catches recent decisions even if
// the DB was seeded but no events were collected yet)
const RATE_DECISION_LOOKBACK_DAYS = 90;

// -----------------------------------------------------------------------
// RATE DECISION EVENTS
// FF calendar event name substrings that signal a CB rate decision
// These must align with EVENT_CATEGORY_KEYWORDS in constants.ts
// -----------------------------------------------------------------------
const CB_RATE_EVENT_PATTERNS: Array<{ currency: Currency; patterns: string[] }> = [
  { currency: 'USD', patterns: ['fed funds rate', 'federal funds rate', 'fomc rate', 'interest rate decision'] },
  { currency: 'EUR', patterns: ['deposit facility rate', 'main refinancing rate', 'ecb rate decision', 'interest rate decision'] },
  { currency: 'GBP', patterns: ['official bank rate', 'boe rate decision', 'interest rate decision', 'bank rate'] },
  { currency: 'JPY', patterns: ['boj rate', 'interest rate decision', 'policy rate', 'short-term policy'] },
  { currency: 'AUD', patterns: ['cash rate', 'rba rate', 'interest rate decision'] },
  { currency: 'CAD', patterns: ['overnight rate', 'boc rate', 'interest rate decision'] },
  { currency: 'NZD', patterns: ['official cash rate', 'ocr', 'rbnz rate', 'interest rate decision'] },
  { currency: 'CHF', patterns: ['snb policy rate', 'snb rate', 'interest rate decision', 'libor rate'] },
];

interface RateDecisionEvent {
  currency: Currency;
  event_name: string;
  event_time: string;
  actual_num: number;
  previous_num: number | null;
}

// -----------------------------------------------------------------------
// MAIN REFRESH FUNCTION
// Called by scheduler every 30 min (rate decisions don't happen often,
// but when they do we want to catch them within one scheduling cycle)
// -----------------------------------------------------------------------
export async function refreshCentralBankRates(): Promise<{
  checked: number;
  updated: number;
  skipped: number;
}> {
  const db = createAdminClient();
  const windowStart = new Date(Date.now() - RATE_DECISION_LOOKBACK_DAYS * 86400 * 1000).toISOString();

  // 1. Fetch recent released rate decision events from our DB
  const { data: events, error } = await db
    .from(TABLES.ECONOMIC_EVENTS)
    .select('currency, event_name, event_time, actual_num, previous_num')
    .eq('category', 'rate_decision')
    .eq('is_released', true)
    .not('actual_num', 'is', null)
    .gte('event_time', windowStart)
    .order('event_time', { ascending: false });

  if (error) {
    console.error('[CBRateUpdater] DB query error:', error.message);
    return { checked: 0, updated: 0, skipped: 0 };
  }

  if (!events || events.length === 0) {
    console.log('[CBRateUpdater] No released rate decision events found in window');
    return { checked: 0, updated: 0, skipped: 0 };
  }

  // 2. Get current CB biases
  const currentBiases = await getAllCBBiases();

  let checked = 0;
  let updated = 0;
  let skipped = 0;

  // 3. For each currency, find the most recent rate decision
  for (const { currency, patterns } of CB_RATE_EVENT_PATTERNS) {
    const currencyEvents = (events as any[]).filter(e =>
      e.currency === currency &&
      patterns.some(p => e.event_name.toLowerCase().includes(p))
    );

    if (currencyEvents.length === 0) {
      console.log(`[CBRateUpdater] No rate decision events found for ${currency}`);
      skipped++;
      continue;
    }

    checked++;
    const mostRecent = currencyEvents[0]; // already ordered by event_time DESC
    const newRate = mostRecent.actual_num as number;
    const prevRate = (mostRecent.previous_num ?? null) as number | null;
    const decisionDate = mostRecent.event_time as string;

    const currentBias = currentBiases[currency];
    const currentUpdatedAt = new Date(currentBias.updated_at || 0).getTime();
    const decisionAt = new Date(decisionDate).getTime();

    // Skip if our bias record is already newer than the rate decision
    if (currentUpdatedAt > decisionAt && currentBias.current_rate === newRate) {
      console.log(`[CBRateUpdater] ${currency}: already up-to-date at ${newRate}%`);
      skipped++;
      continue;
    }

    // Determine rate trend
    const rateTrend = determineRateTrend(newRate, prevRate, currentBias.current_rate ?? null);

    // Determine new bias score (preserve existing score but nudge based on trend)
    const newBiasScore = computeNewBiasScore(currentBias.bias_score, rateTrend, newRate, prevRate);
    const newBiasLabel = scoreToBiasLabel(newBiasScore);

    const lastDecision = rateTrend === 'hiking'
      ? `hiked to ${newRate}%`
      : rateTrend === 'cutting'
      ? `cut to ${newRate}%`
      : `held at ${newRate}%`;

    try {
      await updateCBBias(currency, {
        current_rate: newRate,
        rate_trend: rateTrend,
        bias_score: newBiasScore,
        bias_label: newBiasLabel,
        last_decision: lastDecision,
        last_decision_date: decisionDate,
      });

      console.log(`[CBRateUpdater] ${currency}: updated → ${newRate}% (${rateTrend}) bias=${newBiasScore.toFixed(1)} [${newBiasLabel}]`);
      updated++;
    } catch (err) {
      console.error(`[CBRateUpdater] Failed to update ${currency}:`, err instanceof Error ? err.message : String(err));
    }
  }

  console.log(`[CBRateUpdater] Done — checked=${checked} updated=${updated} skipped=${skipped}`);
  return { checked, updated, skipped };
}

// -----------------------------------------------------------------------
// HELPERS
// -----------------------------------------------------------------------

function determineRateTrend(
  newRate: number,
  prevRate: number | null,
  currentStoredRate: number | null
): 'hiking' | 'cutting' | 'holding' {
  const baseline = prevRate ?? currentStoredRate;
  if (baseline === null) return 'holding';
  const delta = newRate - baseline;
  if (delta > 0.001) return 'hiking';
  if (delta < -0.001) return 'cutting';
  return 'holding';
}

function computeNewBiasScore(
  existingScore: number,
  trend: 'hiking' | 'cutting' | 'holding',
  newRate: number,
  prevRate: number | null
): number {
  let score = existingScore;

  // Nudge bias based on what just happened
  if (trend === 'hiking') {
    score = Math.min(5, score + 1.0);
  } else if (trend === 'cutting') {
    score = Math.max(-5, score - 1.0);
  }
  // holding → no change to bias score from rate alone

  // Clamp
  return Math.round(score * 10) / 10;
}

function scoreToBiasLabel(score: number): CBBiasLabel {
  if (score >= 3.5) return 'Aggressive Hawkish';
  if (score >= 1.5) return 'Hawkish';
  if (score >= 0.5) return 'Mildly Hawkish';
  if (score > -0.5) return 'Neutral';
  if (score > -1.5) return 'Mildly Dovish';
  if (score > -3.5) return 'Dovish';
  return 'Aggressive Dovish';
}
