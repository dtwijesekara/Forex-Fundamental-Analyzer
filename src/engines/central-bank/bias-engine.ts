// ============================================================
// CENTRAL BANK BIAS ENGINE
// Tracks and retrieves the current policy stance for each major CB
// In V1: manually updated with seed data, can add scrapers later
// ============================================================

import { createAdminClient, TABLES } from '@/lib/supabase';
import { CURRENCIES, CENTRAL_BANKS } from '@/lib/constants';
import type { Currency, CentralBankBias, CBBiasLabel } from '@/types';

// -----------------------------------------------------------------------
// GET ALL CURRENT CB BIASES
// -----------------------------------------------------------------------
export async function getAllCBBiases(): Promise<Record<Currency, CentralBankBias>> {
  const db = createAdminClient();

  const { data, error } = await db
    .from(TABLES.CENTRAL_BANK_BIAS)
    .select('*')
    .is('valid_to', null)   // currently active records
    .order('updated_at', { ascending: false });

  if (error) throw error;

  // Build a map — one record per currency (most recent)
  const biasMap: Partial<Record<Currency, CentralBankBias>> = {};
  for (const record of (data || []) as CentralBankBias[]) {
    if (!biasMap[record.currency]) {
      biasMap[record.currency] = record;
    }
  }

  // Ensure all currencies have an entry (fallback to neutral)
  for (const currency of CURRENCIES) {
    if (!biasMap[currency]) {
      console.warn(`[CBBias] No bias data for ${currency} — defaulting to Neutral`);
      biasMap[currency] = createNeutralBias(currency);
    }
  }

  return biasMap as Record<Currency, CentralBankBias>;
}

// -----------------------------------------------------------------------
// GET CB BIAS FOR A SINGLE CURRENCY
// -----------------------------------------------------------------------
export async function getCBBias(currency: Currency): Promise<CentralBankBias> {
  const db = createAdminClient();

  const { data, error } = await db
    .from(TABLES.CENTRAL_BANK_BIAS)
    .select('*')
    .eq('currency', currency)
    .is('valid_to', null)
    .order('updated_at', { ascending: false })
    .limit(1)
    .single();

  if (error || !data) {
    console.warn(`[CBBias] No data for ${currency} — using neutral`);
    return createNeutralBias(currency);
  }

  return data as CentralBankBias;
}

// -----------------------------------------------------------------------
// UPDATE CB BIAS (for manual updates or future scrapers)
// Creates a new record and marks the old one as expired
// -----------------------------------------------------------------------
export async function updateCBBias(
  currency: Currency,
  update: Partial<Omit<CentralBankBias, 'id' | 'currency' | 'bank_name' | 'updated_at'>>
): Promise<CentralBankBias> {
  const db = createAdminClient();

  // Expire the current active record
  await db
    .from(TABLES.CENTRAL_BANK_BIAS)
    .update({ valid_to: new Date().toISOString() })
    .eq('currency', currency)
    .is('valid_to', null);

  // Insert new record
  const currentBias = await getCBBias(currency);
  const newRecord = {
    ...currentBias,
    ...update,
    currency,
    bank_name: CENTRAL_BANKS[currency],
    id: undefined,
    valid_from: new Date().toISOString(),
    valid_to: null,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await db
    .from(TABLES.CENTRAL_BANK_BIAS)
    .insert(newRecord)
    .select()
    .single();

  if (error) throw error;
  return data as CentralBankBias;
}

// -----------------------------------------------------------------------
// CALCULATE CB CONTRIBUTION TO CURRENCY SCORE
// CB bias score (-5 to +5) → contribution to currency score (-25 to +25)
// -----------------------------------------------------------------------
export function cbBiasToScoreContribution(biasScore: number, maxContribution = 25): number {
  // bias_score is -5 to +5
  // Scale to -maxContribution to +maxContribution
  const scaled = (biasScore / 5) * maxContribution;
  return Math.max(-maxContribution, Math.min(maxContribution, scaled));
}

// -----------------------------------------------------------------------
// RATE OUTLOOK SCORE
// Uses current rate, rate trend, and bias to estimate rate outlook score
// -----------------------------------------------------------------------
export function calculateRateOutlookScore(bias: CentralBankBias, maxContribution = 20): number {
  let score = 0;

  // Rate trend component
  switch (bias.rate_trend) {
    case 'hiking':
      score += 12;
      break;
    case 'holding':
      score += 2;  // on hold with hawkish lean = slight positive
      break;
    case 'cutting':
      score -= 10;
      break;
    case 'unknown':
      score += 0;
      break;
  }

  // Bias confirmation
  if (bias.bias_score > 2) score += 4;
  else if (bias.bias_score > 0) score += 2;
  else if (bias.bias_score < -2) score -= 4;
  else if (bias.bias_score < 0) score -= 2;

  // Inflation stance
  if (bias.inflation_stance === 'concerned') score += 3;
  else if (bias.inflation_stance === 'satisfied') score -= 3;

  // Growth concern reduces upside
  if (bias.growth_concern) score -= 3;

  // Scale to maxContribution
  const maxRaw = 20;
  const scaled = (score / maxRaw) * maxContribution;
  return Math.max(-maxContribution, Math.min(maxContribution, scaled));
}

// -----------------------------------------------------------------------
// GET CURRENT POLICY RATES (approximate, for reference)
// -----------------------------------------------------------------------
export function getApproximateCurrentRates(): Record<Currency, number> {
  // Fallback reference rates — updated to approximate mid-2025 levels.
  // The refreshCentralBankRates() job keeps the DB current; these are last-resort defaults.
  return {
    USD: 4.33,  // Fed cut to 4.25-4.50% range in late 2024
    EUR: 2.50,  // ECB cut aggressively through 2024-2025
    GBP: 4.50,  // BoE cut gradually
    JPY: 0.50,  // BoJ raised slowly from negative rates
    AUD: 4.10,  // RBA cut in early 2025
    CAD: 2.75,  // BoC cut aggressively
    NZD: 3.50,  // RBNZ cut cycle
    CHF: 0.25,  // SNB cut to near-zero
  };
}

// -----------------------------------------------------------------------
// RATE DIFFERENTIAL (base - quote) for pair context
// -----------------------------------------------------------------------
export function getRateDifferential(
  baseCurrency: Currency,
  quoteCurrency: Currency,
  rates: Record<Currency, number>
): number {
  return (rates[baseCurrency] || 0) - (rates[quoteCurrency] || 0);
}

// -----------------------------------------------------------------------
// GENERATE CB EXPLANATION
// -----------------------------------------------------------------------
export function generateCBExplanation(bias: CentralBankBias): string {
  const parts: string[] = [];

  parts.push(`${bias.bank_name}: ${bias.bias_label}`);

  if (bias.current_rate !== null && bias.current_rate !== undefined) {
    parts.push(`Rate: ${bias.current_rate}%`);
  }

  if (bias.rate_trend === 'hiking') parts.push('actively hiking');
  else if (bias.rate_trend === 'cutting') parts.push('cutting rates');
  else if (bias.rate_trend === 'holding') parts.push('on hold');

  if (bias.last_decision) {
    parts.push(`Last: ${bias.last_decision}`);
  }

  if (bias.key_phrase) {
    parts.push(`"${bias.key_phrase}"`);
  }

  return parts.join(' | ');
}

// -----------------------------------------------------------------------
// FALLBACK NEUTRAL BIAS
// -----------------------------------------------------------------------
function createNeutralBias(currency: Currency): CentralBankBias {
  return {
    id: `fallback_${currency}`,
    currency,
    bank_name: CENTRAL_BANKS[currency] || `${currency} Central Bank`,
    bias_score: 0,
    bias_label: 'Neutral' as CBBiasLabel,
    current_rate: null,
    rate_trend: 'unknown',
    inflation_stance: null,
    growth_concern: false,
    labor_concern: false,
    last_decision: null,
    last_decision_date: null,
    next_meeting_date: null,
    key_phrase: null,
    notes: 'No data available — defaulting to neutral',
    updated_at: new Date().toISOString(),
  };
}
