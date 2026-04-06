// ============================================================
// API: /api/system/health
// Returns pipeline status, last analysis time, feed health
// ============================================================

import { NextResponse } from 'next/server';
import { createAdminClient, TABLES } from '@/lib/supabase';

export const dynamic   = 'force-dynamic';
export const revalidate = 0;

export type HealthStatus = 'healthy' | 'aging' | 'stale' | 'offline';

export async function GET() {
  try {
    const db = createAdminClient();

    // Fetch last 20 health logs + latest scores in parallel
    const [{ data: logs }, { data: latestScore }, { data: latestNews }] = await Promise.all([
      db.from(TABLES.SYSTEM_HEALTH)
        .select('*')
        .order('started_at', { ascending: false })
        .limit(20),

      db.from(TABLES.CURRENCY_SCORES)
        .select('computed_at')
        .eq('is_current', true)
        .order('computed_at', { ascending: false })
        .limit(1)
        .maybeSingle(),

      db.from('news_items')
        .select('published_at')
        .order('published_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    // Last analysis time
    const lastAnalysis = latestScore?.computed_at ?? null;
    const minutesAgo   = lastAnalysis
      ? Math.floor((Date.now() - new Date(lastAnalysis).getTime()) / 60_000)
      : null;

    // Status classification
    let status: HealthStatus;
    if (!lastAnalysis || minutesAgo === null) status = 'offline';
    else if (minutesAgo < 38)                status = 'healthy';
    else if (minutesAgo < 65)                status = 'aging';
    else                                     status = 'stale';

    // Per-job summary (last run per job name)
    const jobMap: Record<string, { last_run: string; status: string; duration_ms: number | null }> = {};
    for (const log of logs ?? []) {
      if (!jobMap[log.job_name]) {
        jobMap[log.job_name] = {
          last_run:    log.started_at,
          status:      log.status,
          duration_ms: log.duration_ms ?? null,
        };
      }
    }

    // Recent error count (last 5 logs)
    const recentErrors = (logs ?? []).slice(0, 5).filter(l => l.status === 'failed').length;

    return NextResponse.json({
      success: true,
      data: {
        status,
        last_analysis:   lastAnalysis,
        minutes_ago:     minutesAgo,
        last_news:       latestNews?.published_at ?? null,
        recent_errors:   recentErrors,
        jobs:            jobMap,
        recent_logs:     (logs ?? []).slice(0, 8),
      },
    });
  } catch (err) {
    // Return offline status on any error — never hard-fail health endpoint
    return NextResponse.json({
      success: true,
      data: {
        status:          'offline' as HealthStatus,
        last_analysis:   null,
        minutes_ago:     null,
        last_news:       null,
        recent_errors:   0,
        jobs:            {},
        recent_logs:     [],
      },
    });
  }
}
