// ============================================================
// ALERT ENGINE
// Checks conditions and fires alerts when thresholds are crossed
// Saves all alerts to DB and sends via Telegram if configured
// ============================================================

import { createAdminClient, TABLES } from '@/lib/supabase';
import {
  sendTelegramMessage,
  formatEventWarningMessage,
  formatBiasFlipMessage,
  formatRegimeChangeMessage,
  formatPairBiasFlipMessage,
} from './telegram';
import { generateEventRiskWarnings } from '@/engines/risk/event-risk';
import { minutesUntilEvent } from '@/lib/utils';
import { RISK_WARNING_THRESHOLDS } from '@/lib/constants';
import type {
  Alert,
  AlertType,
  AlertSeverity,
  CurrencyScore,
  PairBiasResult,
  MarketRegime,
  EventRiskWarning,
  Currency,
  ForexPair,
} from '@/types';

// -----------------------------------------------------------------------
// RUN FULL ALERT CHECK
// -----------------------------------------------------------------------
export async function runAlertCheck(
  currentScores: CurrencyScore[],
  currentPairs: PairBiasResult[],
  currentRegime: MarketRegime
): Promise<Alert[]> {
  const alerts: Alert[] = [];

  // 1. Event risk warnings
  const eventWarnings = await generateEventRiskWarnings(8);
  const eventAlerts = await processEventWarnings(eventWarnings);
  alerts.push(...eventAlerts);

  // 2. Bias flips (compare to previous scores)
  const biasFlipAlerts = await checkBiasFlips(currentScores);
  alerts.push(...biasFlipAlerts);

  // 3. Pair bias flips
  const pairFlipAlerts = await checkPairBiasFlips(currentPairs);
  alerts.push(...pairFlipAlerts);

  // 4. Regime change
  const regimeAlert = await checkRegimeChange(currentRegime);
  if (regimeAlert) alerts.push(regimeAlert);

  // Save all to DB
  if (alerts.length > 0) {
    await saveAlerts(alerts);
  }

  return alerts;
}

// -----------------------------------------------------------------------
// PROCESS EVENT RISK WARNINGS
// Only fire for events we haven't already warned about
// -----------------------------------------------------------------------
async function processEventWarnings(warnings: EventRiskWarning[]): Promise<Alert[]> {
  const db = createAdminClient();
  const alerts: Alert[] = [];

  for (const warning of warnings) {
    if (warning.minutes_away > RISK_WARNING_THRESHOLDS.WARNING_MINUTES) continue;
    if (warning.tier > 1 && warning.minutes_away > RISK_WARNING_THRESHOLDS.CRITICAL_MINUTES) continue;

    // Check if we already alerted for this event in last 2 hours
    const since = new Date(Date.now() - 2 * 3600 * 1000).toISOString();
    const { data: existing } = await db
      .from(TABLES.ALERTS_LOG)
      .select('id')
      .eq('alert_type', 'event_approaching')
      .eq('currency', warning.currency)
      .ilike('message', `%${warning.event_name.slice(0, 30)}%`)
      .gte('sent_at', since)
      .limit(1);

    if (existing && existing.length > 0) continue; // Already alerted

    const message = formatEventWarningMessage(
      warning.event_name,
      warning.currency,
      warning.minutes_away,
      warning.tier,
      warning.affected_pairs
    );

    const sent = await sendTelegramMessage(message);

    alerts.push({
      alert_type: 'event_approaching',
      severity: warning.severity,
      title: `${warning.currency} ${warning.event_name} in ${warning.minutes_away}m`,
      message: warning.message,
      currency: warning.currency,
      pair: null,
      sent_telegram: sent,
      sent_at: new Date().toISOString(),
      acknowledged: false,
    });
  }

  return alerts;
}

// -----------------------------------------------------------------------
// CHECK FOR CURRENCY BIAS FLIPS
// -----------------------------------------------------------------------
async function checkBiasFlips(currentScores: CurrencyScore[]): Promise<Alert[]> {
  const db = createAdminClient();
  const alerts: Alert[] = [];

  for (const score of currentScores) {
    // Get previous score
    const { data: previousScores } = await db
      .from(TABLES.CURRENCY_SCORES)
      .select('bias_label, score')
      .eq('currency', score.currency)
      .eq('is_current', false)
      .order('computed_at', { ascending: false })
      .limit(1);

    if (!previousScores || previousScores.length === 0) continue;

    const prev = previousScores[0];
    const prevLabel = prev.bias_label;
    const currLabel = score.bias_label;

    // Detect direction change (Bullish ↔ Bearish, or Neutral to either)
    const prevBull = prevLabel.includes('Bullish');
    const prevBear = prevLabel.includes('Bearish');
    const currBull = currLabel.includes('Bullish');
    const currBear = currLabel.includes('Bearish');

    const flipped = (prevBull && currBear) || (prevBear && currBull) ||
      (prevLabel === 'Neutral' && (currBull || currBear)) && Math.abs(score.score) > 25;

    if (!flipped) continue;

    const message = formatBiasFlipMessage(
      score.currency,
      prevLabel,
      currLabel,
      score.score,
      score.explanation
    );

    const sent = await sendTelegramMessage(message);

    alerts.push({
      alert_type: 'bias_flip',
      severity: 'warning',
      title: `${score.currency} Bias Flip: ${prevLabel} → ${currLabel}`,
      message: `${score.currency} fundamental bias changed from ${prevLabel} to ${currLabel} (score: ${score.score.toFixed(0)})`,
      currency: score.currency as Currency,
      pair: null,
      sent_telegram: sent,
      sent_at: new Date().toISOString(),
      acknowledged: false,
    });
  }

  return alerts;
}

// -----------------------------------------------------------------------
// CHECK FOR PAIR BIAS FLIPS
// -----------------------------------------------------------------------
async function checkPairBiasFlips(currentPairs: PairBiasResult[]): Promise<Alert[]> {
  const db = createAdminClient();
  const alerts: Alert[] = [];

  for (const pair of currentPairs) {
    const { data: previousBias } = await db
      .from(TABLES.PAIR_BIAS)
      .select('bias, conviction_pct')
      .eq('pair', pair.pair)
      .eq('is_current', false)
      .order('computed_at', { ascending: false })
      .limit(1);

    if (!previousBias || previousBias.length === 0) continue;

    const prev = previousBias[0];
    if (prev.bias === pair.bias) continue; // No flip

    // Only alert if flip from bullish/bearish (not neutral→neutral)
    if (prev.bias === 'neutral' && pair.conviction_pct < 40) continue;

    const message = formatPairBiasFlipMessage(
      pair.pair,
      prev.bias,
      pair.bias,
      pair.conviction_pct,
      pair.explanation
    );

    const sent = await sendTelegramMessage(message);

    alerts.push({
      alert_type: 'pair_bias_flip',
      severity: 'info',
      title: `${pair.pair} Flip: ${prev.bias} → ${pair.bias}`,
      message: pair.explanation.split('\n')[0],
      currency: null,
      pair: pair.pair as ForexPair,
      sent_telegram: sent,
      sent_at: new Date().toISOString(),
      acknowledged: false,
    });
  }

  return alerts;
}

// -----------------------------------------------------------------------
// CHECK FOR REGIME CHANGE
// -----------------------------------------------------------------------
async function checkRegimeChange(currentRegime: MarketRegime): Promise<Alert | null> {
  const db = createAdminClient();

  const { data: previousRegimes } = await db
    .from(TABLES.MARKET_REGIME)
    .select('regime')
    .eq('is_current', false)
    .order('computed_at', { ascending: false })
    .limit(1);

  if (!previousRegimes || previousRegimes.length === 0) return null;

  const prevRegime = previousRegimes[0].regime;
  if (prevRegime === currentRegime.regime) return null;

  const message = formatRegimeChangeMessage(
    prevRegime,
    currentRegime.regime,
    currentRegime.explanation
  );

  const sent = await sendTelegramMessage(message);

  return {
    alert_type: 'regime_change',
    severity: 'warning',
    title: `Regime Change: ${prevRegime} → ${currentRegime.regime}`,
    message: currentRegime.explanation.split('\n')[0],
    currency: null,
    pair: null,
    sent_telegram: sent,
    sent_at: new Date().toISOString(),
    acknowledged: false,
  };
}

// -----------------------------------------------------------------------
// SAVE ALERTS TO DB
// -----------------------------------------------------------------------
async function saveAlerts(alerts: Alert[]): Promise<void> {
  const db = createAdminClient();
  const { error } = await db.from(TABLES.ALERTS_LOG).insert(alerts);
  if (error) console.error('[Alerts] Error saving alerts:', error.message);
}

// -----------------------------------------------------------------------
// GET RECENT ALERTS
// -----------------------------------------------------------------------
export async function getRecentAlerts(limit = 20): Promise<Alert[]> {
  const db = createAdminClient();

  const { data, error } = await db
    .from(TABLES.ALERTS_LOG)
    .select('*')
    .order('sent_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data || []) as Alert[];
}
