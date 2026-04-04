// ============================================================
// API ROUTE: /api/analysis
// Returns full dashboard data — currencies, pairs, regime, events
// GET: returns latest stored analysis
// POST: triggers a fresh analysis run (requires API_SECRET)
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentCurrencyScores } from '@/engines/scoring/currency-scorer';
import { getCurrentPairBias } from '@/engines/scoring/pair-scorer';
import { getCurrentRegime } from '@/engines/regime/detector';
import { getUpcomingEvents, getRecentReleases } from '@/engines/calendar/collector';
import { generateEventRiskWarnings } from '@/engines/risk/event-risk';
import { getRecentAlerts } from '@/engines/alerts/alert-engine';
import { getIntermarketSnapshot } from '@/engines/intermarket/confirmation';
import type { DashboardData } from '@/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET — return dashboard data from DB (fast, precomputed)
export async function GET() {
  try {
    const [currencies, pairs, regime, upcomingEvents, recentReleases, eventRisks, recentAlerts, intermarket] =
      await Promise.all([
        getCurrentCurrencyScores().catch(() => []),
        getCurrentPairBias().catch(() => []),
        getCurrentRegime().catch(() => null),
        getUpcomingEvents(24).catch(() => []),
        getRecentReleases(24).catch(() => []),
        generateEventRiskWarnings(8).catch(() => []),
        getRecentAlerts(15).catch(() => []),
        getIntermarketSnapshot().catch(() => ({})),
      ]);

    const dashboard: DashboardData = {
      currencies,
      pairs,
      regime,
      upcoming_events: upcomingEvents,
      recent_releases: recentReleases,
      event_risks: eventRisks,
      recent_alerts: recentAlerts,
      intermarket,
      last_updated: new Date().toISOString(),
    };

    return NextResponse.json({ success: true, data: dashboard });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[API/analysis] Error:', msg);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
