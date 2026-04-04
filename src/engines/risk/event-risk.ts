// ============================================================
// EVENT RISK ENGINE
// Identifies upcoming high-impact events and generates warnings
// that help avoid entering trades at dangerous times
// ============================================================

import { createAdminClient, TABLES } from '@/lib/supabase';
import { PRIORITY_PAIRS, RISK_WARNING_THRESHOLDS, POST_RELEASE_CAUTION_WINDOW } from '@/lib/constants';
import { minutesUntilEvent, formatMinutesAway } from '@/lib/utils';
import type {
  Currency,
  ForexPair,
  EconomicEvent,
  EventRiskWarning,
  AlertSeverity,
  EventTier,
} from '@/types';

// -----------------------------------------------------------------------
// GET UPCOMING EVENTS FOR A CURRENCY
// -----------------------------------------------------------------------
export async function getUpcomingEventsForCurrency(
  currency: Currency,
  hoursAhead = 8
): Promise<EconomicEvent[]> {
  const db = createAdminClient();
  const now = new Date().toISOString();
  const future = new Date(Date.now() + hoursAhead * 3600 * 1000).toISOString();

  const { data, error } = await db
    .from(TABLES.ECONOMIC_EVENTS)
    .select('*')
    .eq('currency', currency)
    .eq('is_released', false)
    .gte('event_time', now)
    .lte('event_time', future)
    .not('impact', 'eq', 'Holiday')
    .order('event_time', { ascending: true });

  if (error) throw error;
  return (data || []) as EconomicEvent[];
}

// -----------------------------------------------------------------------
// CALCULATE EVENT RISK PENALTY
// Returns a penalty value (positive number, subtract from currency score)
// -----------------------------------------------------------------------
export function calculateEventRiskPenalty(upcomingEvents: EconomicEvent[]): number {
  if (!upcomingEvents.length) return 0;

  let penalty = 0;
  for (const event of upcomingEvents) {
    const minutesAway = minutesUntilEvent(event.event_time);

    if (minutesAway < 0) continue; // Already passed

    // Close events have more penalty
    const proximityMultiplier = minutesAway < 60 ? 1.5 : minutesAway < 180 ? 1.0 : 0.5;

    if (event.tier === 1) penalty += 10 * proximityMultiplier;
    else if (event.tier === 2) penalty += 5 * proximityMultiplier;
    else penalty += 2 * proximityMultiplier;
  }

  return Math.min(20, Number(penalty.toFixed(1)));
}

// -----------------------------------------------------------------------
// GENERATE EVENT RISK WARNINGS FOR ALL CURRENCIES
// -----------------------------------------------------------------------
export async function generateEventRiskWarnings(hoursAhead = 24): Promise<EventRiskWarning[]> {
  const db = createAdminClient();
  const now = new Date().toISOString();
  const future = new Date(Date.now() + hoursAhead * 3600 * 1000).toISOString();

  const { data: events, error } = await db
    .from(TABLES.ECONOMIC_EVENTS)
    .select('*')
    .eq('is_released', false)
    .gte('event_time', now)
    .lte('event_time', future)
    .not('impact', 'eq', 'Holiday')
    .order('event_time', { ascending: true });

  if (error) throw error;

  const warnings: EventRiskWarning[] = [];
  const processedEvents = (events || []) as EconomicEvent[];

  for (const event of processedEvents) {
    const minutesAway = minutesUntilEvent(event.event_time);
    if (minutesAway < 0) continue;

    // Only warn about Tier 1 and Tier 2 events
    if (event.tier > 2) continue;

    const severity = getWarningSeverity(minutesAway, event.tier);

    // Find which pairs are affected
    const affectedPairs = getAffectedPairs(event.currency as Currency);

    const message = buildWarningMessage(event, minutesAway);

    warnings.push({
      currency: event.currency as Currency,
      event_name: event.event_name,
      event_time: event.event_time,
      minutes_away: minutesAway,
      tier: event.tier as EventTier,
      severity,
      message,
      affected_pairs: affectedPairs,
    });
  }

  return warnings;
}

// -----------------------------------------------------------------------
// CHECK POST-RELEASE CAUTION WINDOW
// Returns true if we should wait before entering new trades
// -----------------------------------------------------------------------
export async function isPostReleaseWindow(currency: Currency): Promise<{
  inCautionWindow: boolean;
  reason: string | null;
  minutesRemaining: number;
}> {
  const db = createAdminClient();
  const lookback = 60; // Look back 60 minutes for recent releases
  const since = new Date(Date.now() - lookback * 60 * 1000).toISOString();

  const { data } = await db
    .from(TABLES.ECONOMIC_EVENTS)
    .select('*')
    .eq('currency', currency)
    .eq('is_released', true)
    .gte('event_time', since)
    .not('impact', 'eq', 'Holiday')
    .order('event_time', { ascending: false })
    .limit(1);

  if (!data || data.length === 0) {
    return { inCautionWindow: false, reason: null, minutesRemaining: 0 };
  }

  const recentRelease = data[0] as EconomicEvent;
  const minutesSinceRelease = Math.abs(minutesUntilEvent(recentRelease.event_time));

  const cautionWindow = recentRelease.tier === 1
    ? POST_RELEASE_CAUTION_WINDOW.TIER1
    : recentRelease.tier === 2
    ? POST_RELEASE_CAUTION_WINDOW.TIER2
    : POST_RELEASE_CAUTION_WINDOW.TIER3;

  const inWindow = minutesSinceRelease < cautionWindow;
  const minutesRemaining = Math.max(0, cautionWindow - minutesSinceRelease);

  return {
    inCautionWindow: inWindow,
    reason: inWindow
      ? `${recentRelease.event_name} released ${minutesSinceRelease}m ago — allow ${minutesRemaining}m more for stabilization`
      : null,
    minutesRemaining,
  };
}

// -----------------------------------------------------------------------
// GET AFFECTED PAIRS FOR A CURRENCY
// -----------------------------------------------------------------------
function getAffectedPairs(currency: Currency): ForexPair[] {
  return PRIORITY_PAIRS
    .filter(p => p.base === currency || p.quote === currency)
    .map(p => p.pair);
}

// -----------------------------------------------------------------------
// DETERMINE WARNING SEVERITY
// -----------------------------------------------------------------------
function getWarningSeverity(minutesAway: number, tier: EventTier): AlertSeverity {
  if (tier === 1) {
    if (minutesAway <= RISK_WARNING_THRESHOLDS.CRITICAL_MINUTES) return 'critical';
    if (minutesAway <= RISK_WARNING_THRESHOLDS.WARNING_MINUTES) return 'warning';
    return 'info';
  }
  if (tier === 2) {
    if (minutesAway <= RISK_WARNING_THRESHOLDS.CRITICAL_MINUTES) return 'warning';
    return 'info';
  }
  return 'info';
}

// -----------------------------------------------------------------------
// BUILD WARNING MESSAGE
// -----------------------------------------------------------------------
function buildWarningMessage(event: EconomicEvent, minutesAway: number): string {
  const timeStr = formatMinutesAway(minutesAway);
  const tierLabel = event.tier === 1 ? 'HIGH IMPACT' : 'MEDIUM IMPACT';
  return `${tierLabel}: ${event.currency} ${event.event_name} in ${timeStr} — caution on ${event.currency} pairs`;
}

// -----------------------------------------------------------------------
// CHECK IF TRADING IS SAFE (no imminent Tier 1 events)
// -----------------------------------------------------------------------
export async function isSafeToTrade(currencies: Currency[]): Promise<{
  safe: boolean;
  warnings: string[];
}> {
  const warnings: string[] = [];

  for (const currency of currencies) {
    const upcoming = await getUpcomingEventsForCurrency(currency, 2); // 2 hours
    const tier1Events = upcoming.filter(e => e.tier === 1);

    for (const event of tier1Events) {
      const minutesAway = minutesUntilEvent(event.event_time);
      if (minutesAway <= RISK_WARNING_THRESHOLDS.CRITICAL_MINUTES) {
        warnings.push(`${event.currency} ${event.event_name} in ${formatMinutesAway(minutesAway)}`);
      }
    }

    const { inCautionWindow, reason } = await isPostReleaseWindow(currency);
    if (inCautionWindow && reason) {
      warnings.push(reason);
    }
  }

  return { safe: warnings.length === 0, warnings };
}
