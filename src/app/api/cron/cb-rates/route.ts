// ============================================================
// VERCEL CRON: /api/cron/cb-rates — runs every 30 minutes
// Detects released rate decision events and auto-updates
// the central_bank_bias table.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { refreshCentralBankRates } from '@/engines/central-bank/rate-updater';
import { scoreAllCurrencies } from '@/engines/scoring/currency-scorer';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await refreshCentralBankRates();
    if (result.updated > 0) {
      await scoreAllCurrencies().catch(() => null);
    }
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
