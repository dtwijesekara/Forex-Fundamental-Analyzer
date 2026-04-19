// ============================================================
// ADMIN ROUTE: POST /api/admin/seed-cb-rates
// One-time (idempotent) endpoint to overwrite stale seed CB data
// with up-to-date rates and policy stances.
// Protected by x-api-secret header.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { updateCBBias } from '@/engines/central-bank/bias-engine';
import type { Currency, CBBiasLabel, RateTrend } from '@/types';

export const dynamic = 'force-dynamic';

interface CBSeedEntry {
  currency: Currency;
  bias_score: number;
  bias_label: CBBiasLabel;
  current_rate: number;
  rate_trend: RateTrend;
  inflation_stance: 'concerned' | 'watching' | 'satisfied';
  growth_concern: boolean;
  last_decision: string;
  key_phrase: string;
  notes: string;
}

// Current stance as of early 2026. These will be superseded by
// refreshCentralBankRates() once rate decision events populate the DB.
const CURRENT_CB_DATA: CBSeedEntry[] = [
  {
    currency: 'USD',
    bias_score: 0.5,
    bias_label: 'Mildly Hawkish',
    current_rate: 4.33,
    rate_trend: 'holding',
    inflation_stance: 'watching',
    growth_concern: false,
    last_decision: 'held at 4.25–4.50%',
    key_phrase: 'Gradual, data-dependent approach to policy',
    notes: 'Fed cut 100bps in late 2024, paused in 2025. Watching labor + inflation balance.',
  },
  {
    currency: 'EUR',
    bias_score: -1.5,
    bias_label: 'Mildly Dovish',
    current_rate: 2.50,
    rate_trend: 'cutting',
    inflation_stance: 'satisfied',
    growth_concern: true,
    last_decision: 'cut to 2.50%',
    key_phrase: 'Disinflation on track, growth remains subdued',
    notes: 'ECB cut aggressively through 2024–2025 as inflation returned to target. Growth concerns persist.',
  },
  {
    currency: 'GBP',
    bias_score: 0.0,
    bias_label: 'Neutral',
    current_rate: 4.50,
    rate_trend: 'cutting',
    inflation_stance: 'watching',
    growth_concern: true,
    last_decision: 'cut to 4.50%',
    key_phrase: 'Gradual removal of restriction warranted',
    notes: 'BoE cutting slowly — services inflation sticky. Growth weak.',
  },
  {
    currency: 'JPY',
    bias_score: 1.0,
    bias_label: 'Mildly Hawkish',
    current_rate: 0.50,
    rate_trend: 'hiking',
    inflation_stance: 'concerned',
    growth_concern: false,
    last_decision: 'hiked to 0.50%',
    key_phrase: 'Virtuous cycle of wages and prices taking hold',
    notes: 'BoJ normalizing policy as inflation and wage growth become self-sustaining.',
  },
  {
    currency: 'AUD',
    bias_score: -0.5,
    bias_label: 'Neutral',
    current_rate: 4.10,
    rate_trend: 'cutting',
    inflation_stance: 'watching',
    growth_concern: true,
    last_decision: 'cut to 4.10%',
    key_phrase: 'Remain data-dependent on path of cuts',
    notes: 'RBA began cutting in 2025. Progress on inflation. Labor market still tight.',
  },
  {
    currency: 'CAD',
    bias_score: -2.0,
    bias_label: 'Dovish',
    current_rate: 2.75,
    rate_trend: 'cutting',
    inflation_stance: 'satisfied',
    growth_concern: true,
    last_decision: 'cut to 2.75%',
    key_phrase: 'Economy needs lower rates; trade uncertainty weighs',
    notes: 'BoC cut aggressively, concerned about US tariff impacts and weak growth.',
  },
  {
    currency: 'NZD',
    bias_score: -1.5,
    bias_label: 'Mildly Dovish',
    current_rate: 3.50,
    rate_trend: 'cutting',
    inflation_stance: 'satisfied',
    growth_concern: true,
    last_decision: 'cut to 3.50%',
    key_phrase: 'Inflation back in band, economy needs support',
    notes: 'RBNZ in aggressive easing cycle. Inflation under control, recession risk present.',
  },
  {
    currency: 'CHF',
    bias_score: -1.0,
    bias_label: 'Mildly Dovish',
    current_rate: 0.25,
    rate_trend: 'cutting',
    inflation_stance: 'satisfied',
    growth_concern: false,
    last_decision: 'cut to 0.25%',
    key_phrase: 'Willing to intervene; further cuts possible',
    notes: 'SNB near-zero, disinflation complete. FX intervention tool remains available.',
  },
];

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-api-secret');
  if (!process.env.API_SECRET || secret !== process.env.API_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const results: Array<{ currency: string; status: string }> = [];

  for (const entry of CURRENT_CB_DATA) {
    try {
      await updateCBBias(entry.currency, {
        bias_score: entry.bias_score,
        bias_label: entry.bias_label,
        current_rate: entry.current_rate,
        rate_trend: entry.rate_trend,
        inflation_stance: entry.inflation_stance,
        growth_concern: entry.growth_concern,
        last_decision: entry.last_decision,
        key_phrase: entry.key_phrase,
        notes: entry.notes,
      });
      results.push({ currency: entry.currency, status: 'updated' });
    } catch (err) {
      results.push({ currency: entry.currency, status: 'error: ' + (err instanceof Error ? err.message : String(err)) });
    }
  }

  return NextResponse.json({ success: true, results });
}
