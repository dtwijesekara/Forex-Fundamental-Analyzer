// ============================================================
// API ROUTE: /api/calendar
// Returns upcoming and recent economic events
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { getUpcomingEvents, getRecentReleases } from '@/engines/calendar/collector';
import { generateEventRiskWarnings } from '@/engines/risk/event-risk';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const type = searchParams.get('type') || 'all'; // 'upcoming' | 'recent' | 'risks' | 'all'
  const hours = parseInt(searchParams.get('hours') || '24', 10);

  try {
    if (type === 'upcoming') {
      const events = await getUpcomingEvents(hours);
      return NextResponse.json({ success: true, data: events });
    }

    if (type === 'recent') {
      const events = await getRecentReleases(hours);
      return NextResponse.json({ success: true, data: events });
    }

    if (type === 'risks') {
      const risks = await generateEventRiskWarnings(hours);
      return NextResponse.json({ success: true, data: risks });
    }

    // All
    const [upcoming, recent, risks] = await Promise.all([
      getUpcomingEvents(24),
      getRecentReleases(12),
      generateEventRiskWarnings(8),
    ]);

    return NextResponse.json({
      success: true,
      data: { upcoming, recent, risks },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
