// ============================================================
// VERCEL CRON JOB: /api/cron/intermarket
// Runs every 10 minutes — refreshes market prices only
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { fetchAndStoreIntermarketData } from '@/engines/intermarket/confirmation';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const snapshot = await fetchAndStoreIntermarketData();
    const fetched = Object.values(snapshot).filter(Boolean).length;
    return NextResponse.json({ ok: true, symbols_fetched: fetched });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
