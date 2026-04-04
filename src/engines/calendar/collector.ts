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
export async function getRecentReleases(hoursBack = 24): Promise<EconomicEvent[]> {
  const db = createAdminClient();
  const since = new Date(Date.now() - hoursBack * 3600 * 1000).toISOString();

  const { data, error } = await db
    .from(TABLES.ECONOMIC_EVENTS)
    .select('*')
    .eq('is_released', true)
    .gte('event_time', since)
    .lte('event_time', new Date().toISOString())
    .not('impact', 'eq', 'Holiday')
    .order('event_time', { ascending: false });

  if (error) throw error;
  return (data || []) as EconomicEvent[];
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
