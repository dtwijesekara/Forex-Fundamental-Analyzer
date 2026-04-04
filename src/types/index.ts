// ============================================================
// FOREX FUNDAMENTAL ANALYZER — TypeScript Types
// ============================================================

// --- CURRENCIES & PAIRS ---

export type Currency = 'USD' | 'EUR' | 'GBP' | 'JPY' | 'AUD' | 'CAD' | 'NZD' | 'CHF';

export type ForexPair =
  | 'EURUSD' | 'GBPUSD' | 'USDJPY' | 'AUDUSD' | 'NZDUSD'
  | 'USDCAD' | 'USDCHF' | 'EURJPY' | 'GBPJPY' | 'AUDJPY';

export type BiasLabel = 'Strong Bullish' | 'Bullish' | 'Neutral' | 'Bearish' | 'Strong Bearish';

export type PairBiasDirection = 'bullish' | 'bearish' | 'neutral';

// --- ECONOMIC EVENTS ---

export type EventImpact = 'High' | 'Medium' | 'Low' | 'Holiday';

export type EventTier = 1 | 2 | 3;

export type EventCategory =
  | 'rate_decision'
  | 'cpi' | 'core_cpi' | 'ppi'
  | 'nfp' | 'unemployment' | 'employment_change' | 'wages'
  | 'gdp'
  | 'pmi_manufacturing' | 'pmi_services' | 'pmi_composite'
  | 'retail_sales'
  | 'consumer_confidence'
  | 'trade_balance'
  | 'cb_minutes'
  | 'cb_speech'
  | 'other';

export type ReleaseBias = 'bullish' | 'bearish' | 'neutral';

export interface EconomicEvent {
  id: string;
  event_id: string;
  currency: Currency;
  country?: string;
  event_name: string;
  event_time: string;          // ISO timestamp
  impact: EventImpact;
  tier: EventTier;
  category: EventCategory;
  actual?: string | null;
  forecast?: string | null;
  previous?: string | null;
  revised?: string | null;
  actual_num?: number | null;
  forecast_num?: number | null;
  previous_num?: number | null;
  surprise_value?: number | null;
  surprise_pct?: number | null;
  is_released: boolean;
  release_bias?: ReleaseBias | null;
  release_score?: number;      // -10 to +10
  source: string;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface RawCalendarEvent {
  title: string;
  country: string;
  date: string;
  impact: string;
  forecast: string;
  previous: string;
  actual: string;
}

// --- CENTRAL BANK ---

export type CBBiasLabel =
  | 'Aggressive Hawkish'
  | 'Hawkish'
  | 'Mildly Hawkish'
  | 'Neutral'
  | 'Mildly Dovish'
  | 'Dovish'
  | 'Aggressive Dovish';

export type RateTrend = 'hiking' | 'holding' | 'cutting' | 'unknown';

export interface CentralBankBias {
  id: string;
  currency: Currency;
  bank_name: string;
  bias_score: number;          // -5 to +5
  bias_label: CBBiasLabel;
  current_rate?: number | null;
  rate_trend: RateTrend;
  inflation_stance?: string | null;
  growth_concern: boolean;
  labor_concern: boolean;
  last_decision?: string | null;
  last_decision_date?: string | null;
  next_meeting_date?: string | null;
  key_phrase?: string | null;
  notes?: string | null;
  updated_at: string;
}

// --- CURRENCY SCORING ---

export interface CurrencyScoreComponents {
  economic: number;      // -30 to +30
  central_bank: number;  // -25 to +25
  rate_outlook: number;  // -20 to +20
  intermarket: number;   // -15 to +15
  sentiment: number;     // -10 to +10
  event_risk_penalty: number; // 0 to -20 (always negative or 0)
}

export interface CurrencyScore {
  id?: string;
  currency: Currency;
  score: number;                // -100 to +100
  bias_label: BiasLabel;
  score_economic: number;
  score_cb: number;
  score_rate: number;
  score_intermarket: number;
  score_sentiment: number;
  event_risk_penalty: number;
  explanation: string;
  computed_at: string;
  is_current: boolean;
  // Enriched fields (joined)
  cb_bias?: CentralBankBias;
}

// --- PAIR BIAS ---

export interface PairBiasResult {
  id?: string;
  pair: ForexPair;
  base_currency: Currency;
  quote_currency: Currency;
  bias: PairBiasDirection;
  pair_score: number;          // base_score - quote_score
  conviction_pct: number;      // 0-100
  base_score: number;
  quote_score: number;
  explanation: string;
  conflict_flag: boolean;
  conflict_reason?: string | null;
  event_risk_flag: boolean;
  event_risk_detail?: string | null;
  computed_at: string;
  is_current: boolean;
}

// --- INTERMARKET ---

export type MarketSymbol = 'DXY' | 'GOLD' | 'OIL' | 'SP500' | 'VIX' | 'US10Y' | 'US2Y';

export interface IntermarketData {
  id?: string;
  symbol: MarketSymbol;
  price?: number | null;
  change_1d?: number | null;
  change_5d?: number | null;
  direction: 'up' | 'down' | 'flat';
  fetched_at: string;
}

export interface IntermarketSnapshot {
  dxy?: IntermarketData;
  gold?: IntermarketData;
  oil?: IntermarketData;
  sp500?: IntermarketData;
  vix?: IntermarketData;
  us10y?: IntermarketData;
}

// --- MARKET REGIME ---

export type RegimeLabel =
  | 'Risk-On'
  | 'Risk-Off'
  | 'Policy Divergence'
  | 'Inflation Focus'
  | 'Growth Slowdown'
  | 'Mixed';

export interface MarketRegime {
  id?: string;
  regime: RegimeLabel;
  confidence_pct: number;
  dxy_level?: number | null;
  dxy_direction?: string | null;
  us_10y_yield?: number | null;
  vix_level?: number | null;
  gold_price?: number | null;
  oil_price?: number | null;
  sp500_level?: number | null;
  explanation: string;
  computed_at: string;
  is_current: boolean;
}

// --- ALERTS ---

export type AlertType =
  | 'event_approaching'
  | 'event_released'
  | 'bias_flip'
  | 'pair_bias_flip'
  | 'regime_change'
  | 'conflict_detected'
  | 'high_risk_session'
  | 'cb_change';

export type AlertSeverity = 'info' | 'warning' | 'critical';

export interface Alert {
  id?: string;
  alert_type: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  currency?: Currency | null;
  pair?: ForexPair | null;
  sent_telegram: boolean;
  sent_at: string;
  acknowledged: boolean;
}

// --- EVENT RISK ---

export interface EventRiskWarning {
  currency: Currency;
  event_name: string;
  event_time: string;
  minutes_away: number;
  tier: EventTier;
  severity: AlertSeverity;
  message: string;
  affected_pairs: ForexPair[];
}

// --- COT / SENTIMENT ---

export type SentimentLabel =
  | 'Extreme Long'
  | 'Long'
  | 'Neutral'
  | 'Short'
  | 'Extreme Short';

export interface COTData {
  id?: string;
  currency: Currency;
  report_date: string;
  net_position?: number | null;
  long_positions?: number | null;
  short_positions?: number | null;
  position_change?: number | null;
  net_pct?: number | null;
  sentiment_label: SentimentLabel;
}

// --- SYSTEM HEALTH ---

export interface SystemHealth {
  id?: string;
  job_name: string;
  status: 'success' | 'partial' | 'failed';
  records_processed: number;
  error_message?: string | null;
  started_at: string;
  completed_at?: string | null;
  duration_ms?: number | null;
}

// --- DASHBOARD / API RESPONSE TYPES ---

export interface DashboardData {
  currencies: CurrencyScore[];
  pairs: PairBiasResult[];
  regime: MarketRegime | null;
  upcoming_events: EconomicEvent[];
  recent_releases: EconomicEvent[];
  event_risks: EventRiskWarning[];
  recent_alerts: Alert[];
  intermarket: IntermarketSnapshot;
  last_updated: string;
}

export interface AnalysisResult {
  currencies: CurrencyScore[];
  pairs: PairBiasResult[];
  regime: MarketRegime;
  event_risks: EventRiskWarning[];
  alerts_generated: Alert[];
}

// --- PAIR METADATA ---

export interface PairInfo {
  pair: ForexPair;
  base: Currency;
  quote: Currency;
}

// --- SCORING CONTEXT ---

export interface ScoringContext {
  recent_events: EconomicEvent[];       // last 7 days
  cb_biases: Record<Currency, CentralBankBias>;
  intermarket: IntermarketSnapshot;
  cot_data: Record<Currency, COTData | null>;
  current_rates: Record<Currency, number>;
}
