// ============================================================
// API ROUTE: /api/actuals  (GET)
// Lightweight: fetch FF JSON → patch missing actuals in DB → re-score.
// Called by the "Refresh" button. No auth needed.
// Kept intentionally fast — no full calendar sync (Railway handles that).
// ============================================================

import { NextResponse } from 'next/server';
import { refreshActuals } from '@/engines/calendar/collector';
import { parseAndScoreRecentReleases } from '@/engines/calendar/parser';

export const dynamic = 'force-dynamic';
export const maxDuration = 30; // seconds — enough for FF fetch + DB patch

export async function GET() {
  const start = Date.now();
  try {
    const result = await refreshActuals();

    let scored = 0;
    if (result.updated > 0) {
      scored = await parseAndScoreRecentReleases().catch(() => 0);
    }

    return NextResponse.json({
      success: true,
      checked: result.checked,
      actuals_patched: result.updated,
      events_scored: scored,
      duration_ms: Date.now() - start,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[/api/actuals] Error:', msg);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
