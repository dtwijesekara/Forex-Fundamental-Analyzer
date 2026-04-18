// ============================================================
// DEBUG ENDPOINT: /api/debug/actuals
// Shows what FF JSON + TradingView have vs what's in the DB.
// Used to diagnose why actuals aren't appearing.
// ============================================================

import { NextResponse } from 'next/server';
import axios from 'axios';
import { createAdminClient, TABLES } from '@/lib/supabase';
import { makeEventId } from '@/lib/utils';
import { COUNTRY_TO_CURRENCY } from '@/lib/constants';
import type { Currency, RawCalendarEvent } from '@/types';

export const dynamic = 'force-dynamic';

const TV_TO_CURRENCY: Record<string, Currency> = {
  US: 'USD', EU: 'EUR', GB: 'GBP', JP: 'JPY',
  AU: 'AUD', CA: 'CAD', NZ: 'NZD', CH: 'CHF',
  DE: 'EUR', FR: 'EUR', IT: 'EUR', ES: 'EUR',
};

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

  // 2. Fetch FF JSON (cache-busted)
  let ffEvents: RawCalendarEvent[] = [];
  let ffError = null;
  try {
    const resp = await axios.get<RawCalendarEvent[]>(
      `https://nfs.faireconomy.media/ff_calendar_thisweek.json?t=${Date.now()}`,
      {
        timeout: 8000,
        headers: {
          'Cache-Control': 'no-cache, no-store',
          'Pragma': 'no-cache',
          'User-Agent': 'ForexFundamentalAnalyzer/1.0',
        },
      }
    );
    ffEvents = Array.isArray(resp.data) ? resp.data : [];
  } catch (e) {
    ffError = e instanceof Error ? e.message : String(e);
  }

  // 3. Fetch TradingView
  let tvEvents: Array<{ title: string; currency: string; date: string; actual: string }> = [];
  let tvError = null;
  let tvRawSample = null;
  try {
    const from = new Date(Date.now() - 48 * 3600 * 1000).toISOString().slice(0, 19) + 'Z';
    const to   = new Date().toISOString().slice(0, 19) + 'Z';
    const resp = await axios.get(
      `https://economic-calendar.tradingview.com/events?from=${from}&to=${to}&countries=US,EU,GB,JP,AU,CA,NZ,CH`,
      {
        timeout: 10000,
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Origin':  'https://www.tradingview.com',
          'Referer': 'https://www.tradingview.com/',
        },
      }
    );
    const rows = Array.isArray(resp.data?.result) ? resp.data.result : Array.isArray(resp.data) ? resp.data : [];
    tvRawSample = rows.slice(0, 2);
    for (const row of rows) {
      const actual = String(row.actual ?? '').trim();
      if (!actual) continue;
      const currency = TV_TO_CURRENCY[String(row.country ?? '')];
      if (!currency) continue;
      tvEvents.push({ title: String(row.title ?? ''), currency, date: String(row.date ?? ''), actual });
    }
  } catch (e) {
    tvError = e instanceof Error ? e.message : String(e);
  }

  // 4. FF match analysis
  const dbLookup = new Map((dbEvents ?? []).map((e: any) => [e.event_id, e]));
  const ffWithActuals = ffEvents.filter(e => e.actual && e.actual.trim() !== '');
  const ffMatchAnalysis = ffWithActuals.map(raw => {
    const currency = COUNTRY_TO_CURRENCY[raw.country] as Currency | undefined;
    if (!currency) return { title: raw.title, country: raw.country, skipped: 'no_currency_map' };
    const generated_id = makeEventId({ currency, event_name: raw.title, event_time: raw.date });
    const dbMatch = dbLookup.get(generated_id);
    return {
      title: raw.title,
      currency,
      raw_date: raw.date,
      ff_actual: raw.actual,
      generated_id,
      db_found: !!dbMatch,
      db_actual: dbMatch ? (dbMatch as any).actual : 'NOT IN DB',
      needs_update: dbMatch ? (dbMatch as any).actual !== raw.actual : false,
    };
  });

  // 5. TV match analysis against DB (by currency + UTC hour)
  const hourLookup = new Map<string, any[]>();
  for (const e of (dbEvents ?? []) as any[]) {
    const utcHour = new Date(e.event_time).toISOString().slice(0, 13);
    const key = `${e.currency}_${utcHour}`;
    const arr = hourLookup.get(key) ?? [];
    arr.push(e);
    hourLookup.set(key, arr);
  }

  const tvMatchAnalysis = tvEvents.map(tv => {
    const tvTime = new Date(tv.date);
    for (let h = 0; h <= 1; h++) {
      for (const sign of [1, -1]) {
        const checkTime = new Date(tvTime.getTime() + sign * h * 3600000);
        const key = `${tv.currency}_${checkTime.toISOString().slice(0, 13)}`;
        const candidates = hourLookup.get(key) ?? [];
        if (candidates.length > 0) {
          return {
            title: tv.title,
            currency: tv.currency,
            date: tv.date,
            actual: tv.actual,
            db_candidates: candidates.map((c: any) => ({ name: c.event_name, actual: c.actual })),
            hour_key: key,
          };
        }
      }
    }
    return { title: tv.title, currency: tv.currency, date: tv.date, actual: tv.actual, db_candidates: [], no_match: true };
  });

  return NextResponse.json({
    now,
    window_start: windowStart,
    db_events_in_window: (dbEvents ?? []).length,
    db_events_without_actual: (dbEvents ?? []).filter((e: any) => !e.actual).length,
    // FF
    ff_total_events: ffEvents.length,
    ff_events_with_actuals: ffWithActuals.length,
    ff_error: ffError,
    ff_actuals_match_analysis: ffMatchAnalysis,
    // TradingView
    tv_events_with_actuals: tvEvents.length,
    tv_error: tvError,
    tv_raw_sample: tvRawSample,
    tv_match_analysis: tvMatchAnalysis.slice(0, 15),
    // DB sample
    db_sample: (dbEvents ?? []).slice(0, 10).map((e: any) => ({
      event_name: e.event_name,
      event_time: e.event_time,
      actual: e.actual,
      event_id: e.event_id,
    })),
  }, { status: 200 });
}
