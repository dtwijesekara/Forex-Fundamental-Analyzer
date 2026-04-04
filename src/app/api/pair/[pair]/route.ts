// ============================================================
// API ROUTE: /api/pair/[pair]
// Returns full detail data for a single pair
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient, TABLES } from '@/lib/supabase';
import { PRIORITY_PAIRS } from '@/lib/constants';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ pair: string }> }
) {
  const { pair: rawPair } = await params;
  const pair = rawPair.toUpperCase();
  const pairInfo = PRIORITY_PAIRS.find(p => p.pair === pair);
  if (!pairInfo) {
    return NextResponse.json({ error: `Unknown pair: ${pair}` }, { status: 404 });
  }

  const db = createAdminClient();
  const { base, quote } = pairInfo;
  const since7d = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
  const since24h = new Date(Date.now() - 24 * 3600 * 1000).toISOString();

  const [
    pairBiasRes,
    pairHistoryRes,
    baseScopeRes,
    quoteScopeRes,
    baseHistoryRes,
    quoteHistoryRes,
    baseEventsRes,
    quoteEventsRes,
    baseCBRes,
    quoteCBRes,
    newsRes,
    alertsRes,
  ] = await Promise.all([
    // Current pair bias
    db.from(TABLES.PAIR_BIAS).select('*').eq('pair', pair).eq('is_current', true).single(),
    // Pair bias history (14 days)
    db.from(TABLES.PAIR_BIAS)
      .select('pair_score, conviction_pct, bias, computed_at')
      .eq('pair', pair)
      .gte('computed_at', new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString())
      .order('computed_at', { ascending: true }),
    // Current base currency score
    db.from(TABLES.CURRENCY_SCORES).select('*').eq('currency', base).eq('is_current', true).single(),
    // Current quote currency score
    db.from(TABLES.CURRENCY_SCORES).select('*').eq('currency', quote).eq('is_current', true).single(),
    // Base score history
    db.from(TABLES.CURRENCY_SCORES)
      .select('score, bias_label, computed_at')
      .eq('currency', base)
      .gte('computed_at', since7d)
      .order('computed_at', { ascending: true }),
    // Quote score history
    db.from(TABLES.CURRENCY_SCORES)
      .select('score, bias_label, computed_at')
      .eq('currency', quote)
      .gte('computed_at', since7d)
      .order('computed_at', { ascending: true }),
    // Recent events for base
    db.from(TABLES.ECONOMIC_EVENTS)
      .select('*')
      .eq('currency', base)
      .gte('event_time', since7d)
      .not('impact', 'eq', 'Holiday')
      .order('event_time', { ascending: false })
      .limit(8),
    // Recent events for quote
    db.from(TABLES.ECONOMIC_EVENTS)
      .select('*')
      .eq('currency', quote)
      .gte('event_time', since7d)
      .not('impact', 'eq', 'Holiday')
      .order('event_time', { ascending: false })
      .limit(8),
    // Base CB bias
    db.from(TABLES.CENTRAL_BANK_BIAS).select('*').eq('currency', base).is('valid_to', null).single(),
    // Quote CB bias
    db.from(TABLES.CENTRAL_BANK_BIAS).select('*').eq('currency', quote).is('valid_to', null).single(),
    // Related news
    db.from('news_items')
      .select('*')
      .contains('pairs', [pair])
      .gte('published_at', since24h)
      .order('published_at', { ascending: false })
      .limit(10),
    // Related alerts
    db.from(TABLES.ALERTS_LOG)
      .select('*')
      .eq('pair', pair)
      .gte('sent_at', since7d)
      .order('sent_at', { ascending: false })
      .limit(10),
  ]);

  return NextResponse.json({
    success: true,
    pair,
    base,
    quote,
    data: {
      current_bias: pairBiasRes.data,
      bias_history: pairHistoryRes.data || [],
      base_score: baseScopeRes.data,
      quote_score: quoteScopeRes.data,
      base_history: baseHistoryRes.data || [],
      quote_history: quoteHistoryRes.data || [],
      base_events: baseEventsRes.data || [],
      quote_events: quoteEventsRes.data || [],
      base_cb: baseCBRes.data,
      quote_cb: quoteCBRes.data,
      news: newsRes.data || [],
      alerts: alertsRes.data || [],
    },
  });
}
