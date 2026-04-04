// ============================================================
// VERCEL CRON: /api/cron/news — runs every 20 minutes
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { collectForexNews } from '@/engines/news/collector';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const count = await collectForexNews();
    return NextResponse.json({ ok: true, inserted: count });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
