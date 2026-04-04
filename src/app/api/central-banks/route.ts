// ============================================================
// API ROUTE: /api/central-banks
// GET: all CB biases
// PATCH: update a CB bias (protected)
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { getAllCBBiases, updateCBBias } from '@/engines/central-bank/bias-engine';
import type { Currency } from '@/types';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const biases = await getAllCBBiases();
    return NextResponse.json({ success: true, data: biases });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

// PATCH /api/central-banks — update CB bias manually
export async function PATCH(req: NextRequest) {
  const secret = req.headers.get('x-api-secret');
  if (!process.env.API_SECRET || secret !== process.env.API_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { currency, ...update } = body;

    if (!currency) {
      return NextResponse.json({ error: 'currency is required' }, { status: 400 });
    }

    const updated = await updateCBBias(currency as Currency, update);
    return NextResponse.json({ success: true, data: updated });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
