// ============================================================
// CALENDAR COLLECTOR
// Fetches economic events from Forex Factory JSON endpoint
// Also supports next week's calendar
// ============================================================

import axios from 'axios';
import { createAdminClient, TABLES } from '@/lib/supabase';
import { makeEventId, parseEventValue, calculateSurprise } from '@/lib/utils';
import { COUNTRY_TO_CURRENCY, EVENT_CATEGORY_KEYWORDS, EVENT_TIER_MAP } from '@/lib/constants';
import { classifyEventCategory, determineEventTier } from './parser';
import type { Currency, RawCalendarEvent, EconomicEvent, EventCategory, EventTier, EventImpact } from '@/types';

// Forex Factory JSON calendar endpoints (free, no key needed)
const FF_ENDPOINTS = {
  thisweek: 'https://nfs.faireconomy.media/ff_calendar_thisweek.json',
  nextweek: 'https://nfs.faireconomy.media/ff_calendar_nextweek.json',
};

// -----------------------------------------------------------------------
// MAIN COLLECTOR FUNCTION
// -----------------------------------------------------------------------
export async function collectCalendarEvents(): Promise<{
  inserted: number;
  updated: number;
  errors: number;
}> {
  const startTime = Date.now();
  const db = createAdminClient();
  let inserted = 0;
  let updated = 0;
  let errors = 0;

  // Log job start
  const { data: healthRecord } = await db.from(TABLES.SYSTEM_HEALTH).insert({
    job_name: 'calendar_fetch',
    status: 'running',
    records_processed: 0,
    started_at: new Date().toISOString(),
  }).select().single();

  try {
    // Fetch this week + next week
    const rawEvents = await fetchAllCalendarData();
    console.log(`[Calendar] Fetched ${rawEvents.length} raw events`);

    // Filter to only our target currencies
    const targetCurrencies = Object.keys(COUNTRY_TO_CURRENCY);
    const filtered = rawEvents.filter(e => targetCurrencies.includes(e.country));
    console.log(`[Calendar] ${filtered.length} events for target currencies`);

    for (const raw of filtered) {
      try {
        const processed = processRawEvent(raw);
        if (!processed) continue;

        // Upsert — use event_id as dedup key
        const { data: existing } = await db
          .from(TABLES.ECONOMIC_EVENTS)
          .select('id, actual, forecast')
          .eq('event_id', processed.event_id)
          .single();

        if (existing) {
          // Update if actual/forecast changed or newly released
          const needsUpdate =
            existing.actual !== processed.actual ||
            existing.forecast !== processed.forecast;

          if (needsUpdate) {
            await db.from(TABLES.ECONOMIC_EVENTS)
              .update({
                actual: processed.actual,
                forecast: processed.forecast,
                previous: processed.previous,
                actual_num: processed.actual_num,
                forecast_num: processed.forecast_num,
                previous_num: processed.previous_num,
                surprise_value: processed.surprise_value,
                surprise_pct: processed.surprise_pct,
                is_released: processed.is_released,
                updated_at: new Date().toISOString(),
              })
              .eq('event_id', processed.event_id);
            updated++;
          }
        } else {
          // Insert new event
          await db.from(TABLES.ECONOMIC_EVENTS).insert(processed);
          inserted++;
        }
      } catch (eventErr) {
        console.error(`[Calendar] Error processing event: ${raw.title}`, eventErr);
        errors++;
      }
    }

    // Update health record
    const duration = Date.now() - startTime;
    await db.from(TABLES.SYSTEM_HEALTH).update({
      status: errors > 0 ? 'partial' : 'success',
      records_processed: inserted + updated,
      completed_at: new Date().toISOString(),
      duration_ms: duration,
    }).eq('id', healthRecord?.id);

    console.log(`[Calendar] Done. Inserted: ${inserted}, Updated: ${updated}, Errors: ${errors}`);
    return { inserted, updated, errors };

  } catch (err) {
    const duration = Date.now() - startTime;
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('[Calendar] Fatal error:', errorMsg);

    await db.from(TABLES.SYSTEM_HEALTH).update({
      status: 'failed',
      error_message: errorMsg,
      completed_at: new Date().toISOString(),
      duration_ms: duration,
    }).eq('id', healthRecord?.id);

    throw err;
  }
}

// -----------------------------------------------------------------------
// FETCH FROM FOREX FACTORY
// -----------------------------------------------------------------------
async function fetchAllCalendarData(): Promise<RawCalendarEvent[]> {
  const results: RawCalendarEvent[] = [];

  for (const [week, url] of Object.entries(FF_ENDPOINTS)) {
    try {
      const response = await axios.get<RawCalendarEvent[]>(url, {
        timeout: 15000,
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'ForexFundamentalAnalyzer/1.0',
        },
      });

      if (Array.isArray(response.data)) {
        results.push(...response.data);
        console.log(`[Calendar] Fetched ${response.data.length} events for ${week}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[Calendar] Failed to fetch ${week}: ${msg}`);
      // Don't throw — try next week
    }
  }

  return results;
}

// -----------------------------------------------------------------------
// PROCESS A SINGLE RAW EVENT
// -----------------------------------------------------------------------
function processRawEvent(raw: RawCalendarEvent): Omit<EconomicEvent, 'id' | 'created_at' | 'updated_at'> | null {
  // Map country to currency
  const currency = COUNTRY_TO_CURRENCY[raw.country] as Currency;
  if (!currency) return null;

  // Map impact
  const impact = mapImpact(raw.impact);

  // Classify category
  const category = classifyEventCategory(raw.title);

  // Determine tier
  const tier = determineEventTier(category, impact);

  // Parse values
  const actual_num = parseEventValue(raw.actual);
  const forecast_num = parseEventValue(raw.forecast);
  const previous_num = parseEventValue(raw.previous);

  const { value: surprise_value, pct: surprise_pct } = calculateSurprise(actual_num, forecast_num);

  // Is the event already released?
  const eventTime = new Date(raw.date);
  const is_released = !!raw.actual && raw.actual.trim() !== '' && eventTime < new Date();

  // Build event ID for deduplication
  const event_id = makeEventId({
    currency,
    event_name: raw.title,
    event_time: raw.date,
  });

  return {
    event_id,
    currency,
    country: raw.country,
    event_name: raw.title,
    event_time: raw.date,
    impact,
    tier,
    category,
    actual: raw.actual || null,
    forecast: raw.forecast || null,
    previous: raw.previous || null,
    revised: null,
    actual_num,
    forecast_num,
    previous_num,
    surprise_value,
    surprise_pct,
    is_released,
    release_bias: null,     // computed by parser separately
    release_score: 0,       // computed by parser separately
    source: 'forex_factory',
    notes: null,
  };
}

// -----------------------------------------------------------------------
// MAP FOREX FACTORY IMPACT TO OUR ENUM
// -----------------------------------------------------------------------
function mapImpact(ffImpact: string): EventImpact {
  const lower = ffImpact.toLowerCase();
  if (lower.includes('high')) return 'High';
  if (lower.includes('medium') || lower.includes('moderate')) return 'Medium';
  if (lower.includes('low')) return 'Low';
  if (lower.includes('holiday')) return 'Holiday';
  return 'Low';
}

// -----------------------------------------------------------------------
// FAST ACTUALS REFRESH
// Surgical update: only re-fetches thisweek FF JSON and patches T1/T2
// events from the past 2 hours that are still missing actual values.
// Designed to run every 5 min — completes in < 10 s.
// -----------------------------------------------------------------------
export async function refreshActuals(): Promise<{ updated: number; checked: number }> {
  const db = createAdminClient();

  // Step 1: Get ALL events from the past 48h — no actual filter (the old
  // .or('actual.is.null,...') Supabase filter was unreliable and returned 0 rows)
  const windowStart = new Date(Date.now() - 48 * 3600 * 1000).toISOString();
  const now = new Date().toISOString();

  const { data: recentEvents, error } = await db
    .from(TABLES.ECONOMIC_EVENTS)
    .select('id, event_id, actual, event_time, event_name')
    .gte('event_time', windowStart)
    .lte('event_time', now)
    .not('impact', 'eq', 'Holiday');

  if (error) throw error;
  if (!recentEvents || recentEvents.length === 0) {
    console.log('[refreshActuals] No events in past 48h window');
    return { updated: 0, checked: 0 };
  }

  console.log(`[refreshActuals] ${recentEvents.length} events in window, fetching FF JSON...`);

  // Step 2: Build lookup: event_id → {id, existing_actual}
  type DBEvent = { id: string; event_id: string; actual: string | null; event_time: string; event_name: string };
  const dbLookup = new Map<string, DBEvent>(
    (recentEvents as DBEvent[]).map(e => [e.event_id, e])
  );

  // Step 3: Fetch FF thisweek JSON — with cache-busting to bypass CDN cache
  let rawEvents: RawCalendarEvent[] = [];
  const bustUrl = `${FF_ENDPOINTS.thisweek}?t=${Date.now()}`;
  try {
    const response = await axios.get<RawCalendarEvent[]>(bustUrl, {
      timeout: 10000,
      headers: {
        'Accept': 'application/json',
        'Cache-Control': 'no-cache, no-store',
        'Pragma': 'no-cache',
        'User-Agent': 'Mozilla/5.0 (compatible; ForexFundamentalAnalyzer/1.0)',
      },
    });
    if (Array.isArray(response.data)) rawEvents = response.data;
    const withActuals = rawEvents.filter(e => e.actual && e.actual.trim() !== '').length;
    console.log(`[refreshActuals] FF returned ${rawEvents.length} events, ${withActuals} with actuals`);

    // If FF has no actuals at all, try TradingView as a secondary source
    if (withActuals === 0) {
      const tvEvents = await fetchTradingViewActuals();
      if (tvEvents.length > 0) {
        console.log(`[refreshActuals] TradingView fallback: ${tvEvents.length} events with actuals`);
        // Merge TV actuals into rawEvents by matching title + date prefix
        for (const tv of tvEvents) {
          const match = rawEvents.find(r =>
            r.country === tv.country &&
            r.title === tv.title &&
            r.date.slice(0, 10) === tv.date.slice(0, 10)
          );
          if (match && !match.actual) match.actual = tv.actual;
        }
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[refreshActuals] FF fetch failed:', msg);
    throw err;
  }

  let updated = 0;

  // Step 4: For each FF event that has an actual, update DB if different
  for (const raw of rawEvents) {
    if (!raw.actual || raw.actual.trim() === '') continue;

    const currency = COUNTRY_TO_CURRENCY[raw.country] as Currency;
    if (!currency) continue;

    const event_id = makeEventId({
      currency,
      event_name: raw.title,
      event_time: raw.date,
    });

    const dbEvent = dbLookup.get(event_id);
    if (!dbEvent) continue;  // event not in our recent window

    // Skip if already up to date
    if (dbEvent.actual === raw.actual) continue;

    const actual_num   = parseEventValue(raw.actual);
    const forecast_num = parseEventValue(raw.forecast ?? null);
    const previous_num = parseEventValue(raw.previous ?? null);
    const { value: surprise_value, pct: surprise_pct } = calculateSurprise(actual_num, forecast_num);

    console.log(`[refreshActuals] Patching ${event_id}: null → "${raw.actual}"`);

    const { error: updateErr } = await db.from(TABLES.ECONOMIC_EVENTS).update({
      actual: raw.actual,
      actual_num,
      forecast: raw.forecast || null,
      forecast_num,
      previous: raw.previous || null,
      previous_num,
      surprise_value,
      surprise_pct,
      is_released: true,
      updated_at: new Date().toISOString(),
    }).eq('id', dbEvent.id);

    if (updateErr) {
      console.error(`[refreshActuals] Update failed for ${event_id}:`, updateErr.message);
    } else {
      updated++;
    }
  }

  console.log(`[refreshActuals] Checked ${recentEvents.length} events, patched ${updated}`);
  return { updated, checked: recentEvents.length };
}

// -----------------------------------------------------------------------
// QUERY HELPERS
// -----------------------------------------------------------------------

// Get all upcoming events (next N hours)
export async function getUpcomingEvents(hoursAhead = 48): Promise<EconomicEvent[]> {
  const db = createAdminClient();
  const now = new Date().toISOString();
  const future = new Date(Date.now() + hoursAhead * 3600 * 1000).toISOString();

  const { data, error } = await db
    .from(TABLES.ECONOMIC_EVENTS)
    .select('*')
    .eq('is_released', false)
    .gte('event_time', now)
    .lte('event_time', future)
    .not('impact', 'eq', 'Holiday')
    .order('event_time', { ascending: true });

  if (error) throw error;
  return (data || []) as EconomicEvent[];
}

// Get recent releases (last N hours)
// Queries by past event_time rather than is_released flag, because Forex
// Factory's JSON feed rarely includes actual values in real-time — events
// that have already happened will still show even without actuals.
export async function getRecentReleases(hoursBack = 24): Promise<EconomicEvent[]> {
  const db = createAdminClient();
  const since = new Date(Date.now() - hoursBack * 3600 * 1000).toISOString();
  const now = new Date().toISOString();

  const { data, error } = await db
    .from(TABLES.ECONOMIC_EVENTS)
    .select('*')
    .gte('event_time', since)
    .lte('event_time', now)
    .not('impact', 'eq', 'Holiday')
    .order('event_time', { ascending: false });

  if (error) throw error;
  return (data || []) as EconomicEvent[];
}

// -----------------------------------------------------------------------
// TRADINGVIEW ECONOMIC CALENDAR FALLBACK
// Used when FF JSON has zero actuals (CDN cache issue or feed delay).
// TV's public calendar API returns near-real-time data.
// -----------------------------------------------------------------------
interface TVEvent {
  title: string;
  country: string;
  date: string;
  actual: string;
}

async function fetchTradingViewActuals(): Promise<TVEvent[]> {
  const now = new Date();
  const from = new Date(now.getTime() - 48 * 3600 * 1000);
  const toStr = now.toISOString().slice(0, 19) + 'Z';
  const fromStr = from.toISOString().slice(0, 19) + 'Z';

  // TradingView public economic calendar API (no key needed)
  const url = `https://economic-calendar.tradingview.com/events?from=${fromStr}&to=${toStr}&countries=US,EU,GB,JP,AU,CA,NZ,CH`;

  try {
    const resp = await axios.get(url, {
      timeout: 8000,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Origin': 'https://www.tradingview.com',
        'Referer': 'https://www.tradingview.com/',
      },
    });

    const data = resp.data;
    const events: TVEvent[] = [];

    // TV response format: { result: [ { title, country, date, actual, ... } ] }
    const rows: Array<Record<string, unknown>> = Array.isArray(data?.result) ? data.result : [];
    for (const row of rows) {
      const actual = (row.actual as string | null) ?? '';
      if (!actual || actual === '') continue;

      // Map TV country codes to FF country names
      const country = TV_COUNTRY_MAP[row.country as string] ?? (row.country as string);
      events.push({
        title: (row.title as string) ?? '',
        country,
        date: (row.date as string) ?? '',
        actual,
      });
    }
    console.log(`[TV fallback] ${events.length} events with actuals from TradingView`);
    return events;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[TV fallback] Failed: ${msg}`);
    return [];
  }
}

// TradingView country codes → FF country names
const TV_COUNTRY_MAP: Record<string, string> = {
  US: 'United States', EU: 'Euro Zone', GB: 'United Kingdom',
  JP: 'Japan', AU: 'Australia', CA: 'Canada', NZ: 'New Zealand', CH: 'Switzerland',
  DE: 'Germany', FR: 'France', IT: 'Italy', ES: 'Spain',
};

// Get recent events for a specific currency (for scoring)
export async function getRecentEventsForCurrency(
  currency: Currency,
  daysBack = 7
): Promise<EconomicEvent[]> {
  const db = createAdminClient();
  const since = new Date(Date.now() - daysBack * 24 * 3600 * 1000).toISOString();

  const { data, error } = await db
    .from(TABLES.ECONOMIC_EVENTS)
    .select('*')
    .eq('currency', currency)
    .eq('is_released', true)
    .gte('event_time', since)
    .not('impact', 'eq', 'Holiday')
    .order('event_time', { ascending: false });

  if (error) throw error;
  return (data || []) as EconomicEvent[];
}
