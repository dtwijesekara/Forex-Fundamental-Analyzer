// ============================================================
// INTERMARKET CONFIRMATION ENGINE
// Fetches DXY, Gold, Oil, S&P500, VIX, US Yields via Yahoo Finance
// Provides currency-specific intermarket score contribution
// ============================================================

import { createAdminClient, TABLES } from '@/lib/supabase';

// ── Stooq.com market data (free, no auth, reliable) ──────────────────────
// Returns CSV: Symbol,Date,Time,Open,High,Low,Close,Volume
// Change% is approximated from open→close of latest bar.
//
// Stooq symbols confirmed working (tested 2026-04-17):
const STOOQ_MAP: Record<string, string> = {
  'DX-Y.NYB': 'dx.f',   // Dollar index futures  → ~97.90  ✓
  'GC=F':     'gc.f',   // Gold futures           → ~4879   ✓
  'CL=F':     'cl.f',   // WTI Oil futures        → ~83.85  ✓
  '^GSPC':    '^spx',   // S&P 500                → ~7126   ✓
};

// ── FRED (Federal Reserve Economic Data) — official, free, no API key ────
// Used for VIX and US 10Y yield. Stooq VX.F returns VIX *futures* (≈96
// while spot VIX is ≈18), and Stooq ZN.F returns bond price (≈111) not
// the yield (≈4.32%). FRED VIXCLS and DGS10 are the correct series.
const FRED_MAP: Record<string, string> = {
  '^VIX': 'VIXCLS',  // CBOE Volatility Index (spot, daily close)
  '^TNX': 'DGS10',   // 10-Year Treasury Constant Maturity Rate (yield %)
};

async function fetchStooqQuote(stooqSymbol: string): Promise<{
  regularMarketPrice: number | null;
  regularMarketChangePercent: number | null;
} | null> {
  const url = `https://stooq.com/q/l/?s=${encodeURIComponent(stooqSymbol)}&f=sd2t2ohlcv&h&e=csv`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; FXAnalyzer/1.0)' },
  });
  if (!res.ok) return null;

  const text  = await res.text();
  const lines = text.trim().split('\n');
  if (lines.length < 2) return null;

  const parts = lines[1].split(',');
  const close = parseFloat(parts[6]);
  const open  = parseFloat(parts[3]);

  if (isNaN(close) || !isFinite(close) || close <= 0) return null;

  const changePercent = open > 0 ? ((close - open) / open) * 100 : 0;
  return {
    regularMarketPrice:         close,
    regularMarketChangePercent: Number(changePercent.toFixed(3)),
  };
}

async function fetchFREDQuote(seriesId: string): Promise<{
  regularMarketPrice: number | null;
  regularMarketChangePercent: number | null;
} | null> {
  const url = `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${seriesId}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; FXAnalyzer/1.0)' },
  });
  if (!res.ok) return null;

  const text  = await res.text();
  // Filter header row and rows with missing data ('.')
  const rows  = text.trim().split('\n')
    .slice(1)                                   // skip header
    .filter(l => !l.endsWith(',.') && l.trim()); // drop missing-value rows

  if (rows.length < 2) return null;

  const parsePair = (row: string) => parseFloat(row.split(',')[1]);
  const current  = parsePair(rows[rows.length - 1]);
  const previous = parsePair(rows[rows.length - 2]);

  if (isNaN(current) || isNaN(previous) || previous === 0) return null;

  const changePercent = ((current - previous) / previous) * 100;
  return {
    regularMarketPrice:         current,
    regularMarketChangePercent: Number(changePercent.toFixed(3)),
  };
}

async function fetchQuote(yahooSymbol: string): Promise<{
  regularMarketPrice?: number | null;
  regularMarketChangePercent?: number | null;
} | null> {
  if (FRED_MAP[yahooSymbol]) return fetchFREDQuote(FRED_MAP[yahooSymbol]);
  if (STOOQ_MAP[yahooSymbol]) return fetchStooqQuote(STOOQ_MAP[yahooSymbol]);
  return null;
}
import { INTERMARKET_SYMBOLS } from '@/lib/constants';
import type { Currency, IntermarketData, IntermarketSnapshot, MarketSymbol } from '@/types';

// -----------------------------------------------------------------------
// FETCH AND STORE INTERMARKET DATA
// -----------------------------------------------------------------------
export async function fetchAndStoreIntermarketData(): Promise<IntermarketSnapshot> {
  const db = createAdminClient();
  const snapshot: Partial<IntermarketSnapshot> = {};

  const symbolMap: Record<string, { key: keyof IntermarketSnapshot; symbol: MarketSymbol }> = {
    [INTERMARKET_SYMBOLS.DXY]: { key: 'dxy', symbol: 'DXY' },
    [INTERMARKET_SYMBOLS.GOLD]: { key: 'gold', symbol: 'GOLD' },
    [INTERMARKET_SYMBOLS.OIL]: { key: 'oil', symbol: 'OIL' },
    [INTERMARKET_SYMBOLS.SP500]: { key: 'sp500', symbol: 'SP500' },
    [INTERMARKET_SYMBOLS.VIX]: { key: 'vix', symbol: 'VIX' },
    [INTERMARKET_SYMBOLS.US10Y]: { key: 'us10y', symbol: 'US10Y' },
  };

  // Fetch all symbols in parallel for speed (~5s instead of ~25s sequential)
  await Promise.all(
    Object.entries(symbolMap).map(async ([yahooSymbol, { key, symbol }]) => {
      try {
        const quote = await fetchQuote(yahooSymbol);
        if (!quote) return;

        const price = quote.regularMarketPrice ?? null;
        const change1d = quote.regularMarketChangePercent ?? null;
        const direction = getDirection(change1d);

        const record: Omit<IntermarketData, 'id'> = {
          symbol,
          price,
          change_1d: change1d ? Number(change1d.toFixed(3)) : null,
          change_5d: null,
          direction,
          fetched_at: new Date().toISOString(),
        };

        await db.from(TABLES.INTERMARKET_DATA).insert(record);
        snapshot[key] = { ...record, fetched_at: new Date().toISOString() };
      } catch (err) {
        console.warn(`[Intermarket] Failed to fetch ${yahooSymbol}:`, err instanceof Error ? err.message : err);
      }
    })
  );

  return snapshot as IntermarketSnapshot;
}

// -----------------------------------------------------------------------
// GET LATEST INTERMARKET SNAPSHOT FROM DB
// -----------------------------------------------------------------------
export async function getIntermarketSnapshot(): Promise<IntermarketSnapshot> {
  const db = createAdminClient();

  const symbols: MarketSymbol[] = ['DXY', 'GOLD', 'OIL', 'SP500', 'VIX', 'US10Y'];
  const snapshot: Partial<IntermarketSnapshot> = {};

  for (const symbol of symbols) {
    const { data } = await db
      .from(TABLES.INTERMARKET_DATA)
      .select('*')
      .eq('symbol', symbol)
      .order('fetched_at', { ascending: false })
      .limit(1)
      .single();

    if (data) {
      const key = symbolToKey(symbol);
      snapshot[key] = data as IntermarketData;
    }
  }

  return snapshot as IntermarketSnapshot;
}

// -----------------------------------------------------------------------
// CALCULATE INTERMARKET SCORE FOR A CURRENCY
// Returns contribution -maxContribution to +maxContribution
// -----------------------------------------------------------------------
export function calculateIntermarketScore(
  currency: Currency,
  snapshot: IntermarketSnapshot,
  maxContribution = 15
): number {
  let score = 0;

  const dxy = snapshot.dxy;
  const gold = snapshot.gold;
  const oil = snapshot.oil;
  const sp500 = snapshot.sp500;
  const vix = snapshot.vix;
  const us10y = snapshot.us10y;

  const dxyUp = dxy?.direction === 'up';
  const dxyDown = dxy?.direction === 'down';
  const riskOn = isRiskOn(sp500, vix, gold);
  const riskOff = isRiskOff(sp500, vix, gold);

  switch (currency) {
    case 'USD':
      // USD confirmed by DXY direction + US yields
      if (dxyUp) score += 8;
      else if (dxyDown) score -= 8;
      if (us10y?.direction === 'up') score += 4;
      else if (us10y?.direction === 'down') score -= 4;
      break;

    case 'EUR':
      // EUR inverse to DXY; benefits from reduced USD pressure
      if (dxyDown) score += 6;
      else if (dxyUp) score -= 6;
      // EUR benefits from risk-on
      if (riskOn) score += 2;
      else if (riskOff) score -= 2;
      break;

    case 'GBP':
      // GBP tracks risk appetite + DXY inverse
      if (dxyDown) score += 5;
      else if (dxyUp) score -= 5;
      if (riskOn) score += 4;
      else if (riskOff) score -= 4;
      break;

    case 'JPY':
      // JPY safe haven: benefits from risk-off, gold rising, yields falling
      if (riskOff) score += 7;
      else if (riskOn) score -= 5;
      if (gold?.direction === 'up') score += 2;
      if (us10y?.direction === 'up') score -= 3; // high yields = JPY weakness (carry)
      else if (us10y?.direction === 'down') score += 3;
      break;

    case 'CHF':
      // CHF safe haven — similar to JPY
      if (riskOff) score += 7;
      else if (riskOn) score -= 5;
      if (gold?.direction === 'up') score += 3;
      break;

    case 'AUD':
      // AUD risk-on commodity currency
      if (riskOn) score += 7;
      else if (riskOff) score -= 7;
      // Benefits from higher commodities
      if (gold?.direction === 'up') score += 2;
      // Iron ore / commodity proxy via oil
      if (oil?.direction === 'up') score += 2;
      break;

    case 'NZD':
      // NZD risk-on, similar to AUD
      if (riskOn) score += 6;
      else if (riskOff) score -= 6;
      if (oil?.direction === 'up') score += 1;
      break;

    case 'CAD':
      // CAD heavily correlated with oil prices
      if (oil?.direction === 'up') score += 8;
      else if (oil?.direction === 'down') score -= 8;
      // Also mildly risk-on
      if (riskOn) score += 2;
      else if (riskOff) score -= 2;
      break;
  }

  // Clamp and scale
  const maxRaw = 15;
  const scaled = (score / maxRaw) * maxContribution;
  return Math.max(-maxContribution, Math.min(maxContribution, Number(scaled.toFixed(1))));
}

// -----------------------------------------------------------------------
// REGIME SIGNALS FROM INTERMARKET DATA
// -----------------------------------------------------------------------
export function getRegimeSignals(snapshot: IntermarketSnapshot): {
  isRiskOn: boolean;
  isRiskOff: boolean;
  isDollarStrong: boolean;
  isInflationFocus: boolean;
  vixLevel: string;
} {
  const sp500 = snapshot.sp500;
  const vix = snapshot.vix;
  const gold = snapshot.gold;
  const dxy = snapshot.dxy;
  const us10y = snapshot.us10y;

  const riskOn = isRiskOn(sp500, vix, gold);
  const riskOff = isRiskOff(sp500, vix, gold);
  const isDollarStrong = dxy?.direction === 'up';
  const isInflationFocus = (us10y?.direction === 'up' || false) && (gold?.direction === 'up' || false);

  const vixVal = vix?.price || 0;
  const vixLevel = vixVal > 30 ? 'high' : vixVal > 20 ? 'elevated' : vixVal > 15 ? 'moderate' : 'low';

  return { isRiskOn: riskOn, isRiskOff: riskOff, isDollarStrong, isInflationFocus, vixLevel };
}

// -----------------------------------------------------------------------
// HELPER FUNCTIONS
// -----------------------------------------------------------------------
function isRiskOn(
  sp500: IntermarketData | undefined,
  vix: IntermarketData | undefined,
  gold: IntermarketData | undefined
): boolean {
  const sp500Up = sp500?.direction === 'up';
  const vixDown = vix?.direction === 'down';
  const vixLow = vix?.price != null && vix.price < 20;
  return (sp500Up && vixDown) || (sp500Up && vixLow);
}

function isRiskOff(
  sp500: IntermarketData | undefined,
  vix: IntermarketData | undefined,
  gold: IntermarketData | undefined
): boolean {
  const sp500Down = sp500?.direction === 'down';
  const vixUp = vix?.direction === 'up';
  const vixHigh = vix?.price != null && vix.price > 25;
  const goldUp = gold?.direction === 'up';
  return (sp500Down && vixUp) || vixHigh || (goldUp && sp500Down);
}

function getDirection(changePercent: number | null | undefined): 'up' | 'down' | 'flat' {
  if (changePercent === null || changePercent === undefined) return 'flat';
  if (changePercent > 0.15) return 'up';
  if (changePercent < -0.15) return 'down';
  return 'flat';
}

function symbolToKey(symbol: MarketSymbol): keyof IntermarketSnapshot {
  switch (symbol) {
    case 'DXY': return 'dxy';
    case 'GOLD': return 'gold';
    case 'OIL': return 'oil';
    case 'SP500': return 'sp500';
    case 'VIX': return 'vix';
    case 'US10Y': return 'us10y';
    default: return 'dxy';
  }
}
