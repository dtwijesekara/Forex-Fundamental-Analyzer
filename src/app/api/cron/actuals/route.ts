// ============================================================
// VERCEL CRON: /api/cron/actuals — runs every 5 minutes
// Fast actuals patch: finds T1/T2 events missing actual values
// and fills them from FF JSON + TradingView fallback.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { refreshActuals } from '@/engines/calendar/collector';
import { parseAndScoreRecentReleases } from '@/engines/calendar/parser';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await refreshActuals();
    if (result.updated > 0) {
      await parseAndScoreRecentReleases().catch(() => null);
    }
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
