// ============================================================
// API ROUTE: POST /api/central-banks/refresh
// Manually triggers a CB rate scan from collected events.
// No API secret needed — it only reads our own DB + writes CB bias.
// ============================================================

import { NextResponse } from 'next/server';
import { refreshCentralBankRates } from '@/engines/central-bank/rate-updater';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const result = await refreshCentralBankRates();
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
