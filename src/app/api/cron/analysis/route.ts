// ============================================================
// VERCEL CRON JOB: /api/cron/analysis
// Runs every 30 minutes automatically on Vercel
// Protected by CRON_SECRET (set in Vercel env vars)
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { collectCalendarEvents } from '@/engines/calendar/collector';
import { parseAndScoreRecentReleases } from '@/engines/calendar/parser';
import { scoreAllCurrencies } from '@/engines/scoring/currency-scorer';
import { scoreAllPairs } from '@/engines/scoring/pair-scorer';
import { detectAndStoreRegime } from '@/engines/regime/detector';
import { runAlertCheck } from '@/engines/alerts/alert-engine';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes — Vercel Pro/Hobby allows up to 300s

export async function GET(req: NextRequest) {
  // Vercel automatically sends Authorization: Bearer <CRON_SECRET>
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const start = Date.now();
  const errors: string[] = [];

  try {
    await collectCalendarEvents().catch(e => errors.push(`calendar: ${e.message}`));
    await parseAndScoreRecentReleases().catch(e => errors.push(`parser: ${e.message}`));

    const currencies = await scoreAllCurrencies().catch(e => {
      errors.push(`scoring: ${e.message}`);
      return [];
    });

    const pairs = await scoreAllPairs(currencies).catch(e => {
      errors.push(`pairs: ${e.message}`);
      return [];
    });

    const regime = await detectAndStoreRegime(currencies).catch(e => {
      errors.push(`regime: ${e.message}`);
      return null;
    });

    if (regime && currencies.length > 0) {
      await runAlertCheck(currencies, pairs, regime).catch(e => errors.push(`alerts: ${e.message}`));
    }

    return NextResponse.json({
      ok: true,
      currencies: currencies.length,
      pairs: pairs.length,
      regime: regime?.regime,
      errors: errors.length ? errors : undefined,
      duration_ms: Date.now() - start,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
