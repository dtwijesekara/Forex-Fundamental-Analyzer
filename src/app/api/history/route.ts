// ============================================================
// API ROUTE: /api/history
// Returns historical currency scores and pair bias
// Used by score history chart components
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient, TABLES } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const type    = searchParams.get('type') || 'currencies';  // 'currencies' | 'pairs'
  const days    = Math.min(parseInt(searchParams.get('days') || '7'), 30);
  const filter  = searchParams.get('filter') || null; // specific currency or pair

  const db = createAdminClient();
  const since = new Date(Date.now() - days * 24 * 3600 * 1000).toISOString();

  try {
    if (type === 'currencies') {
      let query = db
        .from(TABLES.CURRENCY_SCORES)
        .select('currency, score, bias_label, score_economic, score_cb, score_rate, score_intermarket, computed_at')
        .gte('computed_at', since)
        .order('computed_at', { ascending: true });

      if (filter) query = query.eq('currency', filter);

      const { data, error } = await query;
      if (error) throw error;

      // Group by computed_at timestamp (round to nearest hour) for chart points
      const grouped = groupByHour(data || [], 'computed_at', 'currency');
      return NextResponse.json({ success: true, data: grouped, raw: data });
    }

    if (type === 'pairs') {
      let query = db
        .from(TABLES.PAIR_BIAS)
        .select('pair, bias, pair_score, conviction_pct, computed_at')
        .gte('computed_at', since)
        .order('computed_at', { ascending: true });

      if (filter) query = query.eq('pair', filter);

      const { data, error } = await query;
      if (error) throw error;

      const grouped = groupByHour(data || [], 'computed_at', 'pair');
      return NextResponse.json({ success: true, data: grouped, raw: data });
    }

    return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

// Group records into hourly buckets, keyed by the group field
function groupByHour(
  records: Record<string, unknown>[],
  timeField: string,
  groupField: string
): Record<string, { time: string; [key: string]: unknown }[]> {
  const buckets: Record<string, Record<string, Record<string, unknown>>> = {};

  for (const r of records) {
    const t = new Date(r[timeField] as string);
    // Round to nearest hour
    t.setMinutes(0, 0, 0);
    const timeKey = t.toISOString();
    const groupKey = r[groupField] as string;

    if (!buckets[timeKey]) buckets[timeKey] = {};
    // Keep the most recent record within the hour per group
    buckets[timeKey][groupKey] = r;
  }

  // Convert to chart-friendly array: [{time, USD: 42, EUR: -12, ...}]
  const result: { time: string; [key: string]: unknown }[] = [];
  for (const [time, groups] of Object.entries(buckets)) {
    const point: { time: string; [key: string]: unknown } = { time };
    for (const [key, record] of Object.entries(groups)) {
      point[key] = record;
    }
    result.push(point);
  }

  result.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
  return { points: result } as unknown as Record<string, { time: string; [key: string]: unknown }[]>;
}
