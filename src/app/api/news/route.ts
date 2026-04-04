// ============================================================
// API ROUTE: /api/news
// Returns recent forex news items
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { getRecentNews } from '@/engines/news/collector';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const currency  = searchParams.get('currency') || undefined;
  const impact    = searchParams.get('impact') || undefined;
  const hoursBack = parseInt(searchParams.get('hours') || '12');
  const limit     = parseInt(searchParams.get('limit') || '30');

  try {
    const news = await getRecentNews({ limit, currency, impact, hoursBack });
    return NextResponse.json({ success: true, data: news });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
