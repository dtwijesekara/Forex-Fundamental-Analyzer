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
// Surgical update: re-fetches FF JSON (with cache-bust) and patches any
// DB events from the past 48h whose actual value has changed/appeared.
// Falls back to TradingView economic calendar when FF CDN has 0 actuals.
// Designed to run every 5 min — completes in < 15 s.
// -----------------------------------------------------------------------
export async function refreshActuals(): Promise<{ updated: number; checked: number }> {
  const db = createAdminClient();

  // ── 1. Load recent DB events ────────────────────────────────────────
  const windowStart = new Date(Date.now() - 48 * 3600 * 1000).toISOString();
  const now = new Date().toISOString();

  const { data: recentEvents, error } = await db
    .from(TABLES.ECONOMIC_EVENTS)
    .select('id, event_id, actual, event_time, event_name, currency, forecast_num')
    .gte('event_time', windowStart)
    .lte('event_time', now)
    .not('impact', 'eq', 'Holiday');

  if (error) throw error;
  if (!recentEvents || recentEvents.length === 0) {
    console.log('[refreshActuals] No events in past 48h window');
    return { updated: 0, checked: 0 };
  }

  type DBEvent = {
    id: string;
    event_id: string;
    actual: string | null;
    event_time: string;
    event_name: string;
    currency: string;
    forecast_num: number | null;
  };
  const dbEvents = recentEvents as DBEvent[];

  // Primary lookup: event_id → DBEvent  (for FF matching by exact ID)
  const idLookup = new Map<string, DBEvent>(dbEvents.map(e => [e.event_id, e]));

  // Secondary lookup: `${currency}_${UTCHour}` → DBEvent[]  (for TV fuzzy matching)
  // event_time from Supabase is always UTC (TIMESTAMPTZ stored as ISO with offset/Z)
  const hourLookup = new Map<string, DBEvent[]>();
  for (const evt of dbEvents) {
    const utcHour = new Date(evt.event_time).toISOString().slice(0, 13); // "2026-04-07T12"
    const key = `${evt.currency}_${utcHour}`;
    const arr = hourLookup.get(key) ?? [];
    arr.push(evt);
    hourLookup.set(key, arr);
  }

  console.log(`[refreshActuals] ${dbEvents.length} events in window — fetching FF JSON...`);

  // ── 2. Try Forex Factory JSON (thisweek + nextweek) ─────────────────
  let ffUpdated = 0;
  let ffHasActuals = false;

  for (const endpoint of [FF_ENDPOINTS.thisweek, FF_ENDPOINTS.nextweek]) {
    try {
      const bustUrl = `${endpoint}?t=${Date.now()}`;
      const response = await axios.get<RawCalendarEvent[]>(bustUrl, {
        timeout: 10000,
        headers: {
          'Accept': 'application/json',
          'Cache-Control': 'no-cache, no-store',
          'Pragma': 'no-cache',
          'User-Agent': 'Mozilla/5.0 (compatible; ForexFundamentalAnalyzer/1.0)',
        },
      });

      if (!Array.isArray(response.data)) continue;
      const rawEvents = response.data;
      const withActuals = rawEvents.filter(e => e.actual?.trim()).length;
      console.log(`[refreshActuals] FF (${endpoint.includes('next') ? 'next' : 'this'}week): ${rawEvents.length} events, ${withActuals} with actuals`);

      if (withActuals > 0) ffHasActuals = true;

      for (const raw of rawEvents) {
        if (!raw.actual?.trim()) continue;
        const currency = COUNTRY_TO_CURRENCY[raw.country] as Currency;
        if (!currency) continue;

        const event_id = makeEventId({ currency, event_name: raw.title, event_time: raw.date });
        const dbEvent = idLookup.get(event_id);
        if (!dbEvent || dbEvent.actual === raw.actual) continue;

        const actual_num   = parseEventValue(raw.actual);
        const forecast_num = parseEventValue(raw.forecast ?? null) ?? dbEvent.forecast_num;
        const previous_num = parseEventValue(raw.previous ?? null);
        const { value: surprise_value, pct: surprise_pct } = calculateSurprise(actual_num, forecast_num);

        console.log(`[refreshActuals] FF patch: ${event_id} → "${raw.actual}"`);
        const { error: updateErr } = await db.from(TABLES.ECONOMIC_EVENTS).update({
          actual:       raw.actual,
          actual_num,
          forecast:     raw.forecast   || null,
          forecast_num: forecast_num   ?? null,
          previous:     raw.previous   || null,
          previous_num: previous_num   ?? null,
          surprise_value,
          surprise_pct,
          is_released: true,
          updated_at:   new Date().toISOString(),
        }).eq('id', dbEvent.id);

        if (!updateErr) ffUpdated++;
        else console.error(`[refreshActuals] FF update failed: ${updateErr.message}`);
      }
    } catch (err) {
      console.warn(`[refreshActuals] FF fetch error (${endpoint}): ${err instanceof Error ? err.message : err}`);
    }
  }

  // ── 3. TradingView fallback when FF CDN has zero actuals ─────────────
  let tvUpdated = 0;
  if (!ffHasActuals) {
    console.log('[refreshActuals] FF has 0 actuals — trying TradingView fallback...');
    const tvEvents = await fetchTradingViewActuals();

    const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

    for (const tv of tvEvents) {
      if (!tv.currency) continue;

      // Match by currency + UTC hour (±1 h tolerance for any timezone edge cases)
      let matched = false;
      const tvTime = new Date(tv.date);

      for (let offset = 0; offset <= 1 && !matched; offset++) {
        for (const sign of [1, -1]) {
          const checkTime = new Date(tvTime.getTime() + sign * offset * 3600 * 1000);
          const hourKey = `${tv.currency}_${checkTime.toISOString().slice(0, 13)}`;
          const candidates = hourLookup.get(hourKey) ?? [];
          if (candidates.length === 0) continue;

          let dbEvent: DBEvent | undefined;
          if (candidates.length === 1) {
            dbEvent = candidates[0]; // unambiguous match
          } else {
            // Multiple events in same hour — fuzzy title match
            const tvNorm = normalize(tv.title);
            dbEvent = candidates.find(c => {
              const dbNorm = normalize(c.event_name);
              // Match if either string contains the first 8 chars of the other
              const minLen = Math.min(tvNorm.length, dbNorm.length, 10);
              return (
                tvNorm.slice(0, minLen) === dbNorm.slice(0, minLen) ||
                tvNorm.includes(dbNorm.slice(0, minLen)) ||
                dbNorm.includes(tvNorm.slice(0, minLen))
              );
            });
          }

          if (!dbEvent) continue;
          matched = true;

          if (dbEvent.actual === tv.actual) break; // already up to date

          const actual_num = parseEventValue(tv.actual);
          const { value: surprise_value, pct: surprise_pct } = calculateSurprise(
            actual_num,
            dbEvent.forecast_num
          );

          console.log(`[TV patch] ${dbEvent.event_id} → "${tv.actual}" (matched "${tv.title}")`);
          const { error: updateErr } = await db.from(TABLES.ECONOMIC_EVENTS).update({
            actual: tv.actual,
            actual_num,
            surprise_value,
            surprise_pct,
            is_released: true,
            updated_at: new Date().toISOString(),
          }).eq('id', dbEvent.id);

          if (!updateErr) tvUpdated++;
          else console.error(`[refreshActuals] TV update failed: ${updateErr.message}`);
          break;
        }
      }
    }
  }

  const totalUpdated = ffUpdated + tvUpdated;
  console.log(
    `[refreshActuals] Done. FF patched: ${ffUpdated}, TV patched: ${tvUpdated}, ` +
    `total: ${totalUpdated}/${dbEvents.length} events checked`
  );
  return { updated: totalUpdated, checked: dbEvents.length };
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
// TV's public calendar API returns near-real-time data.
// TV uses 2-letter country codes (US, GB, EU, JP…) which map directly
// to our Currency codes — no intermediate FF country name needed.
// -----------------------------------------------------------------------
interface TVEvent {
  title:    string;
  currency: Currency | null;  // derived from TV country code
  date:     string;           // UTC ISO string returned by TV
  actual:   string;
}

// TradingView 2-letter country code → our Currency
const TV_TO_CURRENCY: Record<string, Currency> = {
  US: 'USD', EU: 'EUR', GB: 'GBP', JP: 'JPY',
  AU: 'AUD', CA: 'CAD', NZ: 'NZD', CH: 'CHF',
  // Euro-area countries all map to EUR
  DE: 'EUR', FR: 'EUR', IT: 'EUR', ES: 'EUR',
};

async function fetchTradingViewActuals(): Promise<TVEvent[]> {
  const now  = new Date();
  const from = new Date(now.getTime() - 48 * 3600 * 1000);
  const toStr   = now.toISOString().slice(0, 19) + 'Z';
  const fromStr = from.toISOString().slice(0, 19) + 'Z';

  // TradingView public economic calendar API (no API key required)
  const url = `https://economic-calendar.tradingview.com/events?from=${fromStr}&to=${toStr}&countries=US,EU,GB,JP,AU,CA,NZ,CH`;

  try {
    const resp = await axios.get(url, {
      timeout: 10000,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Origin':  'https://www.tradingview.com',
        'Referer': 'https://www.tradingview.com/',
      },
    });

    const data = resp.data;

    // Response format: { result: [ { title, country, date, actual, forecast, previous, ... } ] }
    // Fallback: data might itself be an array
    const rows: Array<Record<string, unknown>> = Array.isArray(data?.result)
      ? data.result
      : Array.isArray(data)
      ? data
      : [];

    console.log(`[TV fallback] ${rows.length} rows from TradingView`);
    if (rows.length > 0) {
      // Log first row for debugging purposes
      console.log(`[TV fallback] Sample: ${JSON.stringify(rows[0]).slice(0, 200)}`);
    }

    const events: TVEvent[] = [];
    for (const row of rows) {
      const actual = String(row.actual ?? '').trim();
      if (!actual) continue;

      // TV uses ISO 2-letter country codes — map directly to our Currency
      const currency = TV_TO_CURRENCY[String(row.country ?? '')] ?? null;
      if (!currency) continue;

      events.push({
        title:    String(row.title ?? ''),
        currency,
        date:     String(row.date  ?? ''),
        actual,
      });
    }

    console.log(`[TV fallback] ${events.length} events have actuals`);
    return events;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[TV fallback] Failed: ${msg}`);
    return [];
  }
}

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
