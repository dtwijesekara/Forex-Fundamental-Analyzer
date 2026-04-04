-- ============================================================
-- FOREX FUNDAMENTAL ANALYZER — Database Schema
-- Run this in: Supabase → SQL Editor
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- ECONOMIC EVENTS TABLE
-- Stores all calendar events fetched from Forex Factory / sources
-- ============================================================
CREATE TABLE IF NOT EXISTS economic_events (
  id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  event_id        TEXT UNIQUE NOT NULL,          -- external dedup key
  currency        TEXT NOT NULL,                  -- USD, EUR, GBP, etc.
  country         TEXT,
  event_name      TEXT NOT NULL,
  event_time      TIMESTAMPTZ NOT NULL,
  impact          TEXT NOT NULL,                  -- High, Medium, Low, Holiday
  tier            INTEGER NOT NULL DEFAULT 3,     -- 1=rate/CPI/NFP, 2=PMI/retail, 3=minor
  category        TEXT,                           -- 'rate_decision','cpi','nfp','pmi', etc.
  actual          TEXT,
  forecast        TEXT,
  previous        TEXT,
  revised         TEXT,
  actual_num      DECIMAL,                        -- parsed numeric actual
  forecast_num    DECIMAL,                        -- parsed numeric forecast
  previous_num    DECIMAL,                        -- parsed numeric previous
  surprise_value  DECIMAL,                        -- actual_num - forecast_num
  surprise_pct    DECIMAL,                        -- surprise as % of forecast
  is_released     BOOLEAN DEFAULT FALSE,
  release_bias    TEXT,                           -- 'bullish','bearish','neutral'
  release_score   DECIMAL DEFAULT 0,             -- -10 to +10 impact on currency
  source          TEXT DEFAULT 'forex_factory',
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_economic_events_currency ON economic_events(currency);
CREATE INDEX IF NOT EXISTS idx_economic_events_time ON economic_events(event_time);
CREATE INDEX IF NOT EXISTS idx_economic_events_tier ON economic_events(tier);
CREATE INDEX IF NOT EXISTS idx_economic_events_released ON economic_events(is_released);

-- ============================================================
-- CENTRAL BANK BIAS TABLE
-- Tracks stance for each major central bank
-- ============================================================
CREATE TABLE IF NOT EXISTS central_bank_bias (
  id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  currency        TEXT NOT NULL,                  -- USD, EUR, GBP, JPY, AUD, CAD, NZD, CHF
  bank_name       TEXT NOT NULL,                  -- Fed, ECB, BoE, BoJ, RBA, BoC, RBNZ, SNB
  bias_score      DECIMAL NOT NULL DEFAULT 0,    -- -5 (very dovish) to +5 (very hawkish)
  bias_label      TEXT NOT NULL DEFAULT 'Neutral', -- Hawkish/Mildly Hawkish/Neutral/etc.
  current_rate    DECIMAL,                        -- current policy rate %
  rate_trend      TEXT,                           -- 'hiking','holding','cutting','unknown'
  inflation_stance TEXT,                          -- 'concerned','watching','satisfied'
  growth_concern  BOOLEAN DEFAULT FALSE,
  labor_concern   BOOLEAN DEFAULT FALSE,
  last_decision   TEXT,                           -- 'hike','hold','cut'
  last_decision_date TIMESTAMPTZ,
  next_meeting_date  TIMESTAMPTZ,
  key_phrase      TEXT,                           -- notable quote from last statement
  notes           TEXT,
  source          TEXT,
  valid_from      TIMESTAMPTZ DEFAULT NOW(),
  valid_to        TIMESTAMPTZ,                    -- NULL = currently active
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cb_bias_currency ON central_bank_bias(currency);
CREATE INDEX IF NOT EXISTS idx_cb_bias_valid ON central_bank_bias(valid_from, valid_to);

-- ============================================================
-- CURRENCY SCORES TABLE
-- Stores computed currency strength scores (historical)
-- ============================================================
CREATE TABLE IF NOT EXISTS currency_scores (
  id                UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  currency          TEXT NOT NULL,
  score             DECIMAL NOT NULL DEFAULT 0,   -- -100 to +100
  bias_label        TEXT NOT NULL,                -- Strong Bullish/Bullish/Neutral/Bearish/Strong Bearish
  score_economic    DECIMAL DEFAULT 0,            -- component: economic releases
  score_cb          DECIMAL DEFAULT 0,            -- component: central bank
  score_rate        DECIMAL DEFAULT 0,            -- component: rate outlook
  score_intermarket DECIMAL DEFAULT 0,            -- component: intermarket
  score_sentiment   DECIMAL DEFAULT 0,            -- component: sentiment/COT
  event_risk_penalty DECIMAL DEFAULT 0,           -- penalty for upcoming big events
  explanation       TEXT,                          -- human-readable summary
  computed_at       TIMESTAMPTZ DEFAULT NOW(),
  is_current        BOOLEAN DEFAULT TRUE          -- mark latest score per currency
);

CREATE INDEX IF NOT EXISTS idx_currency_scores_currency ON currency_scores(currency);
CREATE INDEX IF NOT EXISTS idx_currency_scores_current ON currency_scores(is_current);
CREATE INDEX IF NOT EXISTS idx_currency_scores_computed ON currency_scores(computed_at);

-- ============================================================
-- PAIR BIAS TABLE
-- Stores computed pair bias (historical)
-- ============================================================
CREATE TABLE IF NOT EXISTS pair_bias (
  id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  pair            TEXT NOT NULL,                  -- e.g. EURUSD
  base_currency   TEXT NOT NULL,
  quote_currency  TEXT NOT NULL,
  bias            TEXT NOT NULL,                  -- 'bullish','bearish','neutral'
  pair_score      DECIMAL NOT NULL DEFAULT 0,    -- base_score - quote_score
  conviction_pct  DECIMAL NOT NULL DEFAULT 0,   -- 0-100%
  base_score      DECIMAL DEFAULT 0,
  quote_score     DECIMAL DEFAULT 0,
  explanation     TEXT,
  conflict_flag   BOOLEAN DEFAULT FALSE,
  conflict_reason TEXT,
  event_risk_flag BOOLEAN DEFAULT FALSE,
  event_risk_detail TEXT,
  computed_at     TIMESTAMPTZ DEFAULT NOW(),
  is_current      BOOLEAN DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_pair_bias_pair ON pair_bias(pair);
CREATE INDEX IF NOT EXISTS idx_pair_bias_current ON pair_bias(is_current);
CREATE INDEX IF NOT EXISTS idx_pair_bias_computed ON pair_bias(computed_at);

-- ============================================================
-- MARKET REGIME TABLE
-- Stores current/historical regime classification
-- ============================================================
CREATE TABLE IF NOT EXISTS market_regime (
  id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  regime          TEXT NOT NULL,                  -- Risk-On/Risk-Off/Policy Divergence/etc.
  confidence_pct  DECIMAL NOT NULL DEFAULT 50,
  dxy_level       DECIMAL,
  dxy_direction   TEXT,                           -- 'up','down','flat'
  us_10y_yield    DECIMAL,
  vix_level       DECIMAL,
  gold_price      DECIMAL,
  oil_price       DECIMAL,
  sp500_level     DECIMAL,
  explanation     TEXT,
  computed_at     TIMESTAMPTZ DEFAULT NOW(),
  is_current      BOOLEAN DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_market_regime_current ON market_regime(is_current);
CREATE INDEX IF NOT EXISTS idx_market_regime_computed ON market_regime(computed_at);

-- ============================================================
-- INTERMARKET DATA TABLE
-- Stores fetched market prices for DXY, yields, commodities
-- ============================================================
CREATE TABLE IF NOT EXISTS intermarket_data (
  id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  symbol          TEXT NOT NULL,                  -- DXY, GOLD, OIL, SP500, VIX, US10Y
  price           DECIMAL,
  change_1d       DECIMAL,                        -- 1-day % change
  change_5d       DECIMAL,                        -- 5-day % change
  direction       TEXT,                           -- 'up','down','flat'
  fetched_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_intermarket_symbol ON intermarket_data(symbol);
CREATE INDEX IF NOT EXISTS idx_intermarket_fetched ON intermarket_data(fetched_at);

-- ============================================================
-- ALERTS LOG TABLE
-- Tracks all alerts sent
-- ============================================================
CREATE TABLE IF NOT EXISTS alerts_log (
  id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  alert_type      TEXT NOT NULL,                  -- 'event_warning','bias_flip','regime_change', etc.
  severity        TEXT NOT NULL DEFAULT 'info',   -- 'info','warning','critical'
  title           TEXT NOT NULL,
  message         TEXT NOT NULL,
  currency        TEXT,
  pair            TEXT,
  sent_telegram   BOOLEAN DEFAULT FALSE,
  sent_at         TIMESTAMPTZ DEFAULT NOW(),
  acknowledged    BOOLEAN DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_alerts_log_type ON alerts_log(alert_type);
CREATE INDEX IF NOT EXISTS idx_alerts_log_sent ON alerts_log(sent_at);

-- ============================================================
-- SYSTEM HEALTH TABLE
-- Tracks data source status and update history
-- ============================================================
CREATE TABLE IF NOT EXISTS system_health (
  id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  job_name        TEXT NOT NULL,                  -- 'calendar_fetch','scoring_run','alert_check'
  status          TEXT NOT NULL,                  -- 'success','partial','failed'
  records_processed INTEGER DEFAULT 0,
  error_message   TEXT,
  started_at      TIMESTAMPTZ DEFAULT NOW(),
  completed_at    TIMESTAMPTZ,
  duration_ms     INTEGER
);

CREATE INDEX IF NOT EXISTS idx_system_health_job ON system_health(job_name);
CREATE INDEX IF NOT EXISTS idx_system_health_started ON system_health(started_at);

-- ============================================================
-- SENTIMENT / COT DATA TABLE
-- Stores CFTC Commitments of Traders data
-- ============================================================
CREATE TABLE IF NOT EXISTS cot_data (
  id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  currency        TEXT NOT NULL,
  report_date     DATE NOT NULL,
  net_position    DECIMAL,                        -- net non-commercial contracts
  long_positions  DECIMAL,
  short_positions DECIMAL,
  position_change DECIMAL,                        -- week-over-week change
  net_pct         DECIMAL,                        -- net as % of open interest
  sentiment_label TEXT,                           -- 'extreme_long','long','neutral','short','extreme_short'
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(currency, report_date)
);

CREATE INDEX IF NOT EXISTS idx_cot_currency ON cot_data(currency);
CREATE INDEX IF NOT EXISTS idx_cot_report_date ON cot_data(report_date);

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================

-- Auto-update updated_at on economic_events
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_economic_events_updated_at
    BEFORE UPDATE ON economic_events
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_cb_bias_updated_at
    BEFORE UPDATE ON central_bank_bias
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- SEED DATA: Central Bank Bias (initial values - update regularly)
-- Reflects approximate state as of early 2025
-- ============================================================
INSERT INTO central_bank_bias (currency, bank_name, bias_score, bias_label, current_rate, rate_trend, inflation_stance, last_decision, key_phrase, notes)
VALUES
  ('USD', 'Federal Reserve', 1.0, 'Mildly Hawkish', 5.25, 'holding', 'watching',
   'hold', 'Patient approach, data dependent',
   'Fed on hold, cautious about cuts, watching inflation persistence'),
  ('EUR', 'European Central Bank', -1.5, 'Mildly Dovish', 4.00, 'cutting', 'watching',
   'cut', 'Disinflation on track, gradual easing',
   'ECB began cutting cycle, gradual pace, growth concerns'),
  ('GBP', 'Bank of England', 0.5, 'Mildly Hawkish', 5.25, 'holding', 'concerned',
   'hold', 'Services inflation remains sticky',
   'BoE holding, services inflation concern, labor market strong'),
  ('JPY', 'Bank of Japan', -2.0, 'Dovish', 0.10, 'hiking', 'watching',
   'hike', 'Gradual normalization, very cautious',
   'BoJ very slowly normalizing, still accommodative, yen weakness concern'),
  ('AUD', 'Reserve Bank of Australia', 0.0, 'Neutral', 4.35, 'holding', 'watching',
   'hold', 'Data dependent, balanced risks',
   'RBA on hold, inflation still above target, balanced outlook'),
  ('CAD', 'Bank of Canada', -2.0, 'Dovish', 4.75, 'cutting', 'satisfied',
   'cut', 'Inflation returning to target, growth softening',
   'BoC cutting, growth slowdown concern, inflation easing'),
  ('NZD', 'Reserve Bank of New Zealand', -2.5, 'Dovish', 5.50, 'cutting', 'satisfied',
   'cut', 'Restrictive policy no longer needed',
   'RBNZ cutting aggressively, recession risk, inflation falling'),
  ('CHF', 'Swiss National Bank', -3.0, 'Dovish', 1.25, 'cutting', 'satisfied',
   'cut', 'Inflation well under control',
   'SNB cutting, inflation below target, strong CHF concern')
ON CONFLICT DO NOTHING;
