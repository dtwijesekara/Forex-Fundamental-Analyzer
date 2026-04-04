// ============================================================
// API ROUTE: /api/refresh
// Triggers a full analysis pipeline run
// Protected by API_SECRET to prevent unauthorized triggering
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { collectCalendarEvents } from '@/engines/calendar/collector';
import { parseAndScoreRecentReleases } from '@/engines/calendar/parser';
import { scoreAllCurrencies } from '@/engines/scoring/currency-scorer';
import { scoreAllPairs } from '@/engines/scoring/pair-scorer';
import { fetchAndStoreIntermarketData } from '@/engines/intermarket/confirmation';
import { detectAndStoreRegime } from '@/engines/regime/detector';
import { runAlertCheck } from '@/engines/alerts/alert-engine';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  // Verify secret
  const secret = req.headers.get('x-api-secret') || req.nextUrl.searchParams.get('secret');
  const expectedSecret = process.env.API_SECRET;

  if (!expectedSecret || secret !== expectedSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startTime = Date.now();
  const results: Record<string, unknown> = {};
  const errors: string[] = [];

  console.log('[Refresh] Starting full analysis pipeline...');

  try {
    // Step 1: Fetch calendar
    const calResult = await collectCalendarEvents().catch(e => {
      errors.push(`Calendar: ${e.message}`);
      return { inserted: 0, updated: 0, errors: 0 };
    });
    results.calendar = calResult;

    // Step 2: Score released events
    const parsed = await parseAndScoreRecentReleases().catch(e => {
      errors.push(`Parser: ${e.message}`);
      return 0;
    });
    results.events_scored = parsed;

    // Step 3: Fetch intermarket data
    const intermarket = await fetchAndStoreIntermarketData().catch(e => {
      errors.push(`Intermarket: ${e.message}`);
      return {};
    });
    results.intermarket_fetched = Object.keys(intermarket).length;

    // Step 4: Score currencies
    const currencies = await scoreAllCurrencies().catch(e => {
      errors.push(`Currency scoring: ${e.message}`);
      return [];
    });
    results.currencies_scored = currencies.length;

    // Step 5: Score pairs
    const pairs = await scoreAllPairs(currencies).catch(e => {
      errors.push(`Pair scoring: ${e.message}`);
      return [];
    });
    results.pairs_scored = pairs.length;

    // Step 6: Detect regime
    const regime = await detectAndStoreRegime(currencies).catch(e => {
      errors.push(`Regime: ${e.message}`);
      return null;
    });
    results.regime = regime?.regime;

    // Step 7: Run alerts
    if (currencies.length > 0 && pairs.length > 0 && regime) {
      const alerts = await runAlertCheck(currencies, pairs, regime).catch(e => {
        errors.push(`Alerts: ${e.message}`);
        return [];
      });
      results.alerts_generated = alerts.length;
    }

    const duration = Date.now() - startTime;
    console.log(`[Refresh] Pipeline complete in ${duration}ms`);

    return NextResponse.json({
      success: errors.length === 0,
      results,
      errors: errors.length > 0 ? errors : undefined,
      duration_ms: duration,
      timestamp: new Date().toISOString(),
    });

  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[Refresh] Fatal error:', msg);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

// GET — simple health check
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'Send POST with x-api-secret header to trigger refresh',
    timestamp: new Date().toISOString(),
  });
}
