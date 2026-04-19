// Run: npx tsx scripts/seed-cb-rates.ts
// Seeds current-state CB rates into Supabase central_bank_bias table.

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Load .env.local manually without dotenv dependency
try {
  const env = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8');
  for (const line of env.split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim();
  }
} catch { /* ignore */ }

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const db = createClient(supabaseUrl, supabaseKey);
const TABLE = 'central_bank_bias';

// ── VERIFIED RATES — April 2026 ──────────────────────────────────────────────
// USD: Fed cut to 3.50–3.75% range. Midpoint = 3.625%.
// EUR: ECB deposit facility at 2.00%, main refinancing at 2.15%.
// GBP: BoE base rate cut to 3.75%.
// JPY: BoJ hiked to 0.75%.
// AUD: RBA hiked to 4.10% in March 2026 (trend = hiking, NOT cutting).
// CAD / NZD / CHF: not corrected by user — kept from prior knowledge.
// ─────────────────────────────────────────────────────────────────────────────
const CURRENT_CB_DATA = [
  { currency: 'USD', bank_name: 'Federal Reserve',             bias_score: -0.5, bias_label: 'Neutral',        current_rate: 3.625, rate_trend: 'cutting', inflation_stance: 'watching',  growth_concern: true,  labor_concern: false, last_decision: 'cut to 3.50–3.75%',      key_phrase: 'Gradual recalibration amid slowing growth',      notes: 'Fed cut significantly from 2024 highs. 3.50–3.75% range as of Apr 2026.' },
  { currency: 'EUR', bank_name: 'European Central Bank',       bias_score: -2.0, bias_label: 'Dovish',         current_rate: 2.00,  rate_trend: 'cutting', inflation_stance: 'satisfied', growth_concern: true,  labor_concern: false, last_decision: 'cut deposit rate to 2.00%', key_phrase: 'Inflation at target; growth headwinds remain',   notes: 'ECB deposit facility 2.00%, main refinancing 2.15%. Apr 2026.' },
  { currency: 'GBP', bank_name: 'Bank of England',             bias_score: -0.5, bias_label: 'Neutral',        current_rate: 3.75,  rate_trend: 'cutting', inflation_stance: 'watching',  growth_concern: true,  labor_concern: false, last_decision: 'cut to 3.75%',            key_phrase: 'Further gradual cuts likely if data permits',    notes: 'BoE base rate 3.75% as of Apr 2026. Services inflation still watched.' },
  { currency: 'JPY', bank_name: 'Bank of Japan',               bias_score: 1.5,  bias_label: 'Hawkish',        current_rate: 0.75,  rate_trend: 'hiking',  inflation_stance: 'concerned', growth_concern: false, labor_concern: false, last_decision: 'hiked to 0.75%',          key_phrase: 'Sustained wage-price dynamics support further normalisation', notes: 'BoJ hiked to 0.75%. Normalisation cycle continuing. Apr 2026.' },
  { currency: 'AUD', bank_name: 'Reserve Bank of Australia',   bias_score: 0.5,  bias_label: 'Mildly Hawkish', current_rate: 4.10,  rate_trend: 'hiking',  inflation_stance: 'concerned', growth_concern: false, labor_concern: false, last_decision: 'hiked to 4.10%',          key_phrase: 'Inflation persistence warrants restrictive stance', notes: 'RBA hiked to 4.10% in March 2026 — trend is hiking, not cutting.' },
  { currency: 'CAD', bank_name: 'Bank of Canada',              bias_score: -2.0, bias_label: 'Dovish',         current_rate: 2.75,  rate_trend: 'cutting', inflation_stance: 'satisfied', growth_concern: true,  labor_concern: false, last_decision: 'cut to 2.75%',            key_phrase: 'Economy needs lower rates; trade uncertainty',    notes: 'BoC cut aggressively; US tariff risk adds headwinds.' },
  { currency: 'NZD', bank_name: 'Reserve Bank of New Zealand', bias_score: -1.5, bias_label: 'Mildly Dovish',  current_rate: 3.50,  rate_trend: 'cutting', inflation_stance: 'satisfied', growth_concern: true,  labor_concern: false, last_decision: 'cut to 3.50%',            key_phrase: 'Inflation back in band, economy needs support',   notes: 'RBNZ in easing cycle. Inflation under control.' },
  { currency: 'CHF', bank_name: 'Swiss National Bank',         bias_score: -1.0, bias_label: 'Mildly Dovish',  current_rate: 0.25,  rate_trend: 'cutting', inflation_stance: 'satisfied', growth_concern: false, labor_concern: false, last_decision: 'cut to 0.25%',            key_phrase: 'Willing to intervene; further cuts possible',     notes: 'SNB near-zero. Disinflation complete. FX tool available.' },
];

async function run() {
  console.log('Seeding CB rates into Supabase...\n');

  for (const entry of CURRENT_CB_DATA) {
    // Expire existing active record
    const { error: expireError } = await db
      .from(TABLE)
      .update({ valid_to: new Date().toISOString() })
      .eq('currency', entry.currency)
      .is('valid_to', null);

    if (expireError) {
      console.warn(`${entry.currency}: expire error — ${expireError.message}`);
    }

    // Insert new record
    const { error: insertError } = await db
      .from(TABLE)
      .insert({
        ...entry,
        valid_from: new Date().toISOString(),
        valid_to: null,
        updated_at: new Date().toISOString(),
      });

    if (insertError) {
      console.error(`${entry.currency}: INSERT FAILED — ${insertError.message}`);
    } else {
      console.log(`✓ ${entry.currency}: ${entry.current_rate}% (${entry.rate_trend}) — ${entry.bias_label}`);
    }
  }

  console.log('\nDone.');
}

run().catch(err => { console.error(err); process.exit(1); });
