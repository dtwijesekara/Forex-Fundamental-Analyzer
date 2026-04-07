// ============================================================
// API ROUTE: /api/actuals  (GET)
// Lightweight endpoint: fetches latest FF JSON and patches any
// events still missing actual values in the DB.
// Called by the "Refresh" button in Recent Releases.
// No auth needed — read-only from a public source.
// ============================================================

import { NextResponse } from 'next/server';
import { refreshActuals } from '@/engines/calendar/collector';
import { collectCalendarEvents } from '@/engines/calendar/collector';
import { parseAndScoreRecentReleases } from '@/engines/calendar/parser';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // 1. Fast patch: surgically update events missing actuals in past 48h
    const actualsResult = await refreshActuals();

    // 2. Full calendar sync: picks up any newly published actuals FF-side
    const calResult = await collectCalendarEvents();

    // 3. If anything changed, re-score recent events
    const totalUpdated = actualsResult.updated + calResult.updated;
    let scored = 0;
    if (totalUpdated > 0) {
      scored = await parseAndScoreRecentReleases().catch(() => 0);
    }

    return NextResponse.json({
      success: true,
      actuals_patched: actualsResult.updated,
      calendar_updated: calResult.updated,
      events_scored: scored,
      checked: actualsResult.checked,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[/api/actuals] Error:', msg);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
