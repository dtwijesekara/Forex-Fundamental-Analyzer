// ============================================================
// API ROUTE: /api/currencies
// Returns current currency scores
// ============================================================

import { NextResponse } from 'next/server';
import { getCurrentCurrencyScores } from '@/engines/scoring/currency-scorer';
import { getAllCBBiases } from '@/engines/central-bank/bias-engine';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const [scores, cbBiases] = await Promise.all([
      getCurrentCurrencyScores(),
      getAllCBBiases(),
    ]);

    // Enrich scores with CB bias
    const enriched = scores.map(s => ({
      ...s,
      cb_bias: cbBiases[s.currency] || null,
    }));

    return NextResponse.json({ success: true, data: enriched });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
