// ============================================================
// FOREX FUNDAMENTAL ANALYZER — Constants
// ============================================================

import type { Currency, ForexPair, PairInfo, EventCategory, EventTier } from '@/types';

// --- TARGET CURRENCIES ---
export const CURRENCIES: Currency[] = ['USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'NZD', 'CHF'];

// --- TARGET PAIRS ---
export const PRIORITY_PAIRS: PairInfo[] = [
  { pair: 'EURUSD', base: 'EUR', quote: 'USD' },
  { pair: 'GBPUSD', base: 'GBP', quote: 'USD' },
  { pair: 'USDJPY', base: 'USD', quote: 'JPY' },
  { pair: 'AUDUSD', base: 'AUD', quote: 'USD' },
  { pair: 'NZDUSD', base: 'NZD', quote: 'USD' },
  { pair: 'USDCAD', base: 'USD', quote: 'CAD' },
  { pair: 'USDCHF', base: 'USD', quote: 'CHF' },
  { pair: 'EURJPY', base: 'EUR', quote: 'JPY' },
  { pair: 'GBPJPY', base: 'GBP', quote: 'JPY' },
  { pair: 'AUDJPY', base: 'AUD', quote: 'JPY' },
];

// --- CENTRAL BANK NAMES ---
export const CENTRAL_BANKS: Record<Currency, string> = {
  USD: 'Federal Reserve',
  EUR: 'European Central Bank',
  GBP: 'Bank of England',
  JPY: 'Bank of Japan',
  AUD: 'Reserve Bank of Australia',
  CAD: 'Bank of Canada',
  NZD: 'Reserve Bank of New Zealand',
  CHF: 'Swiss National Bank',
};

// --- CURRENCY FLAGS (for UI) ---
export const CURRENCY_FLAGS: Record<Currency, string> = {
  USD: '🇺🇸',
  EUR: '🇪🇺',
  GBP: '🇬🇧',
  JPY: '🇯🇵',
  AUD: '🇦🇺',
  CAD: '🇨🇦',
  NZD: '🇳🇿',
  CHF: '🇨🇭',
};

// --- COUNTRY CODE TO CURRENCY MAPPING (for Forex Factory data) ---
export const COUNTRY_TO_CURRENCY: Record<string, Currency> = {
  USD: 'USD',
  EUR: 'EUR',
  GBP: 'GBP',
  JPY: 'JPY',
  AUD: 'AUD',
  CAD: 'CAD',
  NZD: 'NZD',
  CHF: 'CHF',
};

// --- INTERMARKET SYMBOLS ---
export const INTERMARKET_SYMBOLS = {
  DXY: 'DX-Y.NYB',       // Dollar Index
  GOLD: 'GC=F',          // Gold futures
  OIL: 'CL=F',           // WTI crude oil futures
  SP500: '^GSPC',        // S&P 500
  VIX: '^VIX',           // Volatility Index
  US10Y: '^TNX',         // US 10-Year Treasury yield
  US2Y: '^IRX',          // US 2-Year Treasury yield (approx via 13-week)
} as const;

// --- EVENT TIER DEFINITIONS ---
export const EVENT_TIER_MAP: Record<string, EventTier> = {
  // Tier 1 — High impact, can flip bias
  rate_decision: 1,
  cpi: 1,
  core_cpi: 1,
  nfp: 1,
  gdp: 1,
  cb_minutes: 1,
  cb_speech: 1,

  // Tier 2 — Medium impact, adjust conviction
  ppi: 2,
  employment_change: 2,
  unemployment: 2,
  wages: 2,
  pmi_manufacturing: 2,
  pmi_services: 2,
  pmi_composite: 2,
  retail_sales: 2,
  consumer_confidence: 2,

  // Tier 3 — Low impact, context only
  trade_balance: 3,
  other: 3,
};

// Event name keywords to category mapping
export const EVENT_CATEGORY_KEYWORDS: Array<{ keywords: string[]; category: EventCategory }> = [
  { keywords: ['rate decision', 'interest rate', 'fed funds', 'bank rate', 'cash rate', 'overnight rate', 'deposit facility', 'policy rate'], category: 'rate_decision' },
  { keywords: ['core cpi', 'core inflation', 'core consumer price'], category: 'core_cpi' },
  { keywords: ['cpi', 'consumer price', 'inflation rate'], category: 'cpi' },
  { keywords: ['ppi', 'producer price', 'producer inflation'], category: 'ppi' },
  { keywords: ['non-farm payroll', 'nonfarm payroll', 'nfp', 'employment change', 'jobs added'], category: 'nfp' },
  { keywords: ['unemployment rate', 'jobless rate'], category: 'unemployment' },
  { keywords: ['employment change', 'job creation', 'labor market'], category: 'employment_change' },
  { keywords: ['average hourly earnings', 'wage', 'earnings'], category: 'wages' },
  { keywords: ['gdp', 'gross domestic product', 'economic growth'], category: 'gdp' },
  { keywords: ['pmi manufacturing', 'manufacturing pmi', 'ism manufacturing'], category: 'pmi_manufacturing' },
  { keywords: ['pmi services', 'services pmi', 'ism services', 'service pmi'], category: 'pmi_services' },
  { keywords: ['composite pmi', 'pmi composite'], category: 'pmi_composite' },
  { keywords: ['retail sales'], category: 'retail_sales' },
  { keywords: ['consumer confidence', 'consumer sentiment', 'cci'], category: 'consumer_confidence' },
  { keywords: ['trade balance', 'current account', 'trade deficit', 'trade surplus'], category: 'trade_balance' },
  { keywords: ['minutes', 'meeting minutes', 'fomc minutes', 'mpc minutes'], category: 'cb_minutes' },
  { keywords: ['speech', 'testimony', 'statement', 'press conference', 'speaks', 'testifies'], category: 'cb_speech' },
];

// --- SCORING WEIGHTS ---
export const SCORE_WEIGHTS = {
  ECONOMIC_MAX: 30,      // max contribution from economic releases
  CB_MAX: 25,            // max from central bank bias
  RATE_MAX: 20,          // max from rate outlook
  INTERMARKET_MAX: 15,   // max from intermarket
  SENTIMENT_MAX: 10,     // max from sentiment/COT

  // Event release impact weights
  TIER1_EVENT_WEIGHT: 1.0,
  TIER2_EVENT_WEIGHT: 0.5,
  TIER3_EVENT_WEIGHT: 0.2,

  // Max single-event score impact (before tier weighting)
  MAX_EVENT_RAW_SCORE: 10,

  // Event risk penalty (subtracted from total)
  EVENT_RISK_TIER1_PENALTY: 10,
  EVENT_RISK_TIER2_PENALTY: 5,
};

// --- BIAS LABELS FROM SCORE ---
export function getBiasLabel(score: number): import('@/types').BiasLabel {
  if (score >= 50) return 'Strong Bullish';
  if (score >= 20) return 'Bullish';
  if (score > -20) return 'Neutral';
  if (score > -50) return 'Bearish';
  return 'Strong Bearish';
}

// --- CB BIAS LABEL FROM SCORE ---
export function getCBBiasLabel(score: number): import('@/types').CBBiasLabel {
  if (score >= 4) return 'Aggressive Hawkish';
  if (score >= 2) return 'Hawkish';
  if (score >= 0.5) return 'Mildly Hawkish';
  if (score > -0.5) return 'Neutral';
  if (score > -2) return 'Mildly Dovish';
  if (score > -4) return 'Dovish';
  return 'Aggressive Dovish';
}

// --- CONVICTION PERCENTAGE FROM PAIR SCORE ---
// pair_score range is roughly -200 to +200 (base - quote, each -100 to +100)
// Normalize to 0-100%
export function getConvictionPct(pairScore: number): number {
  const normalized = Math.min(Math.abs(pairScore) / 80 * 100, 100);
  return Math.round(normalized);
}

// --- PAIR BIAS FROM SCORE ---
export function getPairBiasDirection(pairScore: number): import('@/types').PairBiasDirection {
  if (pairScore >= 8) return 'bullish';
  if (pairScore <= -8) return 'bearish';
  return 'neutral';
}

// --- RISK WARNING TIMING THRESHOLDS (minutes) ---
export const RISK_WARNING_THRESHOLDS = {
  CRITICAL_MINUTES: 30,    // less than 30 mins = critical
  WARNING_MINUTES: 120,    // less than 2 hours = warning
  INFO_MINUTES: 480,       // less than 8 hours = info
};

// --- SAFE-TRADE WINDOW AFTER RELEASE (minutes) ---
export const POST_RELEASE_CAUTION_WINDOW = {
  TIER1: 30,   // wait 30 min after Tier 1 release
  TIER2: 15,   // wait 15 min after Tier 2 release
  TIER3: 5,    // wait 5 min after Tier 3 release
};
