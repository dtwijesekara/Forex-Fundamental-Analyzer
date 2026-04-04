// ============================================================
// MARKET REGIME DETECTOR
// Classifies the current macro environment into a regime label
// Uses intermarket data + currency scores as inputs
// ============================================================

import { createAdminClient, TABLES } from '@/lib/supabase';
import { getIntermarketSnapshot, getRegimeSignals } from '@/engines/intermarket/confirmation';
import type { MarketRegime, RegimeLabel, IntermarketSnapshot, CurrencyScore } from '@/types';

// -----------------------------------------------------------------------
// DETECT AND STORE CURRENT MARKET REGIME
// -----------------------------------------------------------------------
export async function detectAndStoreRegime(
  currencyScores?: CurrencyScore[]
): Promise<MarketRegime> {
  const snapshot = await getIntermarketSnapshot();
  const regime = detectRegime(snapshot, currencyScores);

  await storeRegime(regime);
  return regime;
}

// -----------------------------------------------------------------------
// DETECT REGIME (pure function)
// -----------------------------------------------------------------------
export function detectRegime(
  snapshot: IntermarketSnapshot,
  currencyScores?: CurrencyScore[]
): MarketRegime {
  const signals = getRegimeSignals(snapshot);
  let regime: RegimeLabel = 'Mixed';
  let confidence = 50;
  const explanations: string[] = [];

  // Score each possible regime
  const regimeScores: Record<RegimeLabel, number> = {
    'Risk-On': 0,
    'Risk-Off': 0,
    'Policy Divergence': 0,
    'Inflation Focus': 0,
    'Growth Slowdown': 0,
    'Mixed': 20, // baseline
  };

  // Risk-On signals
  if (signals.isRiskOn) {
    regimeScores['Risk-On'] += 40;
    explanations.push('Equities up, VIX low — risk-on environment');
  }
  if (snapshot.sp500?.direction === 'up') regimeScores['Risk-On'] += 15;
  if (snapshot.vix?.direction === 'down') regimeScores['Risk-On'] += 10;
  if (snapshot.oil?.direction === 'up') regimeScores['Risk-On'] += 5; // growth proxy

  // Risk-Off signals
  if (signals.isRiskOff) {
    regimeScores['Risk-Off'] += 40;
    explanations.push('Equities falling, VIX elevated, gold rising — risk-off');
  }
  if (snapshot.vix?.price && snapshot.vix.price > 25) {
    regimeScores['Risk-Off'] += 20;
    explanations.push(`VIX at ${snapshot.vix.price.toFixed(1)} — fear elevated`);
  }
  if (snapshot.gold?.direction === 'up' && snapshot.sp500?.direction === 'down') {
    regimeScores['Risk-Off'] += 15;
  }

  // Policy Divergence signals
  if (currencyScores) {
    const usd = currencyScores.find(s => s.currency === 'USD');
    const jpy = currencyScores.find(s => s.currency === 'JPY');
    const eur = currencyScores.find(s => s.currency === 'EUR');

    if (usd && (usd.score_cb > 15 || usd.score_rate > 10)) {
      regimeScores['Policy Divergence'] += 20;
    }

    // Large CB divergence between currencies
    if (usd && jpy && Math.abs(usd.score_cb - jpy.score_cb) > 30) {
      regimeScores['Policy Divergence'] += 25;
      explanations.push('Strong CB policy divergence between USD and JPY');
    }
    if (eur && usd && Math.abs(eur.score_cb - usd.score_cb) > 20) {
      regimeScores['Policy Divergence'] += 15;
      explanations.push('Significant ECB/Fed divergence');
    }
  }
  if (signals.isDollarStrong && snapshot.us10y?.direction === 'up') {
    regimeScores['Policy Divergence'] += 15;
  }

  // Inflation Focus signals
  if (signals.isInflationFocus) {
    regimeScores['Inflation Focus'] += 30;
    explanations.push('Yields and gold rising — inflation focus');
  }
  if (snapshot.us10y?.direction === 'up') {
    regimeScores['Inflation Focus'] += 15;
  }
  if (snapshot.gold?.direction === 'up') {
    regimeScores['Inflation Focus'] += 10;
  }

  // Growth Slowdown signals
  if (snapshot.sp500?.direction === 'down' && snapshot.oil?.direction === 'down') {
    regimeScores['Growth Slowdown'] += 30;
    explanations.push('Equities and oil both falling — growth concern');
  }
  if (currencyScores) {
    const weakCurrencies = currencyScores.filter(s => s.score_economic < -15);
    if (weakCurrencies.length >= 3) {
      regimeScores['Growth Slowdown'] += 20;
      explanations.push(`${weakCurrencies.length} currencies showing weak economic data`);
    }
  }

  // Find highest scoring regime
  let maxScore = 0;
  for (const [label, score] of Object.entries(regimeScores)) {
    if (score > maxScore) {
      maxScore = score;
      regime = label as RegimeLabel;
    }
  }

  // Check for ties (Mixed)
  const topScores = Object.values(regimeScores).filter(s => s >= maxScore - 10);
  if (topScores.length >= 3 && maxScore < 40) {
    regime = 'Mixed';
    confidence = 40;
  } else {
    confidence = Math.min(90, 40 + maxScore);
  }

  // Build explanation
  const regimeDescriptions: Record<RegimeLabel, string> = {
    'Risk-On': 'Markets in risk-on mode — equities up, low volatility, commodity currencies supported, JPY/CHF weak',
    'Risk-Off': 'Risk-off environment — safe havens bid (JPY, CHF, Gold), equities falling, commodity currencies under pressure',
    'Policy Divergence': 'Central bank policy divergence dominant — focus on rate differentials and CB trajectory differences',
    'Inflation Focus': 'Inflation narrative driving markets — yields up, hard assets bid, CB hawkishness rewarded',
    'Growth Slowdown': 'Growth concerns leading — defensive positioning, commodity currencies weak, risk appetite low',
    'Mixed': 'Mixed/conflicting signals — no clear dominant regime, trade with caution',
  };

  const baseDescription = regimeDescriptions[regime];
  const fullExplanation = [baseDescription, ...explanations.slice(0, 3)].join('\n• ');

  return {
    regime,
    confidence_pct: confidence,
    dxy_level: snapshot.dxy?.price || null,
    dxy_direction: snapshot.dxy?.direction || null,
    us_10y_yield: snapshot.us10y?.price || null,
    vix_level: snapshot.vix?.price || null,
    gold_price: snapshot.gold?.price || null,
    oil_price: snapshot.oil?.price || null,
    sp500_level: snapshot.sp500?.price || null,
    explanation: fullExplanation,
    computed_at: new Date().toISOString(),
    is_current: true,
  };
}

// -----------------------------------------------------------------------
// STORE REGIME IN DB
// -----------------------------------------------------------------------
async function storeRegime(regime: MarketRegime): Promise<void> {
  const db = createAdminClient();

  // Mark old as non-current
  await db.from(TABLES.MARKET_REGIME)
    .update({ is_current: false })
    .eq('is_current', true);

  const { error } = await db.from(TABLES.MARKET_REGIME).insert({
    regime: regime.regime,
    confidence_pct: regime.confidence_pct,
    dxy_level: regime.dxy_level,
    dxy_direction: regime.dxy_direction,
    us_10y_yield: regime.us_10y_yield,
    vix_level: regime.vix_level,
    gold_price: regime.gold_price,
    oil_price: regime.oil_price,
    sp500_level: regime.sp500_level,
    explanation: regime.explanation,
    computed_at: regime.computed_at,
    is_current: true,
  });

  if (error) throw error;
}

// -----------------------------------------------------------------------
// GET CURRENT REGIME FROM DB
// -----------------------------------------------------------------------
export async function getCurrentRegime(): Promise<MarketRegime | null> {
  const db = createAdminClient();

  const { data, error } = await db
    .from(TABLES.MARKET_REGIME)
    .select('*')
    .eq('is_current', true)
    .order('computed_at', { ascending: false })
    .limit(1)
    .single();

  if (error || !data) return null;
  return data as MarketRegime;
}

// -----------------------------------------------------------------------
// REGIME COLOR (for UI)
// -----------------------------------------------------------------------
export function getRegimeColor(regime: RegimeLabel): string {
  switch (regime) {
    case 'Risk-On': return 'text-emerald-400';
    case 'Risk-Off': return 'text-red-400';
    case 'Policy Divergence': return 'text-purple-400';
    case 'Inflation Focus': return 'text-amber-400';
    case 'Growth Slowdown': return 'text-orange-400';
    case 'Mixed': return 'text-slate-400';
  }
}

export function getRegimeBg(regime: RegimeLabel): string {
  switch (regime) {
    case 'Risk-On': return 'bg-emerald-500/15 border-emerald-500/30';
    case 'Risk-Off': return 'bg-red-500/15 border-red-500/30';
    case 'Policy Divergence': return 'bg-purple-500/15 border-purple-500/30';
    case 'Inflation Focus': return 'bg-amber-500/15 border-amber-500/30';
    case 'Growth Slowdown': return 'bg-orange-500/15 border-orange-500/30';
    case 'Mixed': return 'bg-slate-500/15 border-slate-500/30';
  }
}
