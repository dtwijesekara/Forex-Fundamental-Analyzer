// ============================================================
// DEBUG ENDPOINT: /api/debug/actuals
// Shows what FF JSON has vs what's in the DB for recent events.
// Used to diagnose why actuals aren't appearing.
// ============================================================

import { NextResponse } from 'next/server';
import axios from 'axios';
import { createAdminClient, TABLES } from '@/lib/supabase';
import { makeEventId } from '@/lib/utils';
import { COUNTRY_TO_CURRENCY } from '@/lib/constants';
import type { Currency, RawCalendarEvent } from '@/types';

export const dynamic = 'force-dynamic';

export async function GET() {
  const db = createAdminClient();

  // 1. What's in the DB for the past 48h?
  const windowStart = new Date(Date.now() - 48 * 3600 * 1000).toISOString();
  const now = new Date().toISOString();

  const { data: dbEvents } = await db
    .from(TABLES.ECONOMIC_EVENTS)
    .select('id, event_id, event_name, event_time, actual, currency')
    .gte('event_time', windowStart)
    .lte('event_time', now)
    .not('impact', 'eq', 'Holiday')
    .order('event_time', { ascending: false })
    .limit(30);

  // 2. Fetch FF JSON
  let ffEvents: RawCalendarEvent[] = [];
  let ffError = null;
  try {
    const resp = await axios.get<RawCalendarEvent[]>(
      'https://nfs.faireconomy.media/ff_calendar_thisweek.json',
      { timeout: 8000, headers: { 'User-Agent': 'ForexFundamentalAnalyzer/1.0' } }
    );
    ffEvents = Array.isArray(resp.data) ? resp.data : [];
  } catch (e) {
    ffError = e instanceof Error ? e.message : String(e);
  }

  // 3. Of the FF events with actuals, which match our DB?
  const dbLookup = new Map((dbEvents ?? []).map((e: any) => [e.event_id, e]));

  const ffWithActuals = ffEvents.filter(e => e.actual && e.actual.trim() !== '');
  const matchAnalysis = ffWithActuals.map(raw => {
    const currency = COUNTRY_TO_CURRENCY[raw.country] as Currency | undefined;
    if (!currency) return { title: raw.title, country: raw.country, skipped: 'no_currency_map' };
    const generated_id = makeEventId({ currency, event_name: raw.title, event_time: raw.date });
    const dbMatch = dbLookup.get(generated_id);
    return {
      title: raw.title,
      country: raw.country,
      currency,
      raw_date: raw.date,
      ff_actual: raw.actual,
      generated_id,
      db_found: !!dbMatch,
      db_actual: dbMatch ? (dbMatch as any).actual : 'NOT IN DB',
      needs_update: dbMatch ? (dbMatch as any).actual !== raw.actual : false,
    };
  });

  return NextResponse.json({
    now,
    window_start: windowStart,
    db_events_in_window: (dbEvents ?? []).length,
    db_events_without_actual: (dbEvents ?? []).filter((e: any) => !e.actual).length,
    ff_total_events: ffEvents.length,
    ff_events_with_actuals: ffWithActuals.length,
    ff_error: ffError,
    // Sample of DB events (most recent first)
    db_sample: (dbEvents ?? []).slice(0, 10).map((e: any) => ({
      event_name: e.event_name,
      event_time: e.event_time,
      actual: e.actual,
      event_id: e.event_id,
    })),
    // FF events with actuals and their match status
    ff_actuals_match_analysis: matchAnalysis,
  }, { status: 200 });
}
