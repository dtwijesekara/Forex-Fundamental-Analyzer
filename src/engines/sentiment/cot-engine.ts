// ============================================================
// SENTIMENT / COT ENGINE
// Reads CFTC Commitments of Traders data
// V1: Simple DB-backed, manually seeded or via periodic fetcher
// ============================================================

import { createAdminClient, TABLES } from '@/lib/supabase';
import type { Currency, COTData, SentimentLabel } from '@/types';

// -----------------------------------------------------------------------
// GET LATEST COT DATA FOR A CURRENCY
// -----------------------------------------------------------------------
export async function getLatestCOTData(currency: Currency): Promise<COTData | null> {
  const db = createAdminClient();

  const { data, error } = await db
    .from(TABLES.COT_DATA)
    .select('*')
    .eq('currency', currency)
    .order('report_date', { ascending: false })
    .limit(1)
    .single();

  if (error || !data) return null;
  return data as COTData;
}

// -----------------------------------------------------------------------
// CALCULATE SENTIMENT SCORE FROM COT DATA
// Returns score in range -maxContribution to +maxContribution
// -----------------------------------------------------------------------
export function calculateSentimentScore(
  cot: COTData | null | undefined,
  maxContribution = 10
): number {
  if (!cot || cot.net_pct === null || cot.net_pct === undefined) {
    return 0; // No data = neutral
  }

  const netPct = cot.net_pct;
  const label = cot.sentiment_label;

  // Base score from net position percentage
  // net_pct > 0 = net long = bullish signal (but watch for extremes)
  let score = 0;

  // Non-extreme positioning follows trend
  if (label === 'Long') score = 5;
  else if (label === 'Short') score = -5;
  else if (label === 'Neutral') score = 0;

  // Extreme positioning = contrarian signal (potential reversal risk)
  // Do not give full bullish score if extremely long (crowded trade)
  else if (label === 'Extreme Long') {
    score = 2; // Still mildly positive but flag crowding
  } else if (label === 'Extreme Short') {
    score = -2; // Still mildly negative but flag potential squeeze
  }

  // Scale to max contribution
  const scaled = (score / 10) * maxContribution;
  return Math.max(-maxContribution, Math.min(maxContribution, Number(scaled.toFixed(1))));
}

// -----------------------------------------------------------------------
// CLASSIFY SENTIMENT FROM NET POSITION %
// -----------------------------------------------------------------------
export function classifySentiment(netPct: number): SentimentLabel {
  if (netPct > 60) return 'Extreme Long';
  if (netPct > 20) return 'Long';
  if (netPct < -60) return 'Extreme Short';
  if (netPct < -20) return 'Short';
  return 'Neutral';
}

// -----------------------------------------------------------------------
// UPSERT COT DATA (for manual seeding or future automation)
// -----------------------------------------------------------------------
export async function upsertCOTData(entry: Omit<COTData, 'id'>): Promise<void> {
  const db = createAdminClient();

  const toInsert = {
    ...entry,
    sentiment_label: classifySentiment(entry.net_pct || 0),
  };

  const { error } = await db
    .from(TABLES.COT_DATA)
    .upsert(toInsert, { onConflict: 'currency,report_date' });

  if (error) throw error;
}

// -----------------------------------------------------------------------
// GET SENTIMENT EXPLANATION
// -----------------------------------------------------------------------
export function getSentimentExplanation(cot: COTData | null): string {
  if (!cot) return 'No COT data available';

  const dir = (cot.net_position || 0) > 0 ? 'net long' : 'net short';
  const label = cot.sentiment_label;
  const change = cot.position_change;
  const changeStr = change !== null && change !== undefined
    ? ` (${change > 0 ? '+' : ''}${change.toFixed(0)} contracts WoW)`
    : '';

  let warning = '';
  if (label === 'Extreme Long') warning = ' — crowded long, watch for squeeze';
  if (label === 'Extreme Short') warning = ' — crowded short, watch for reversal squeeze';

  return `Speculative positioning: ${dir} (${label})${changeStr}${warning}`;
}
