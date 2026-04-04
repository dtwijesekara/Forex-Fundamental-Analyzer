-- ============================================================
-- ADD NEWS TABLE
-- Run in Supabase SQL Editor (after initial schema.sql)
-- ============================================================

CREATE TABLE IF NOT EXISTS news_items (
  id           UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  title        TEXT NOT NULL,
  summary      TEXT,
  url          TEXT,
  source       TEXT NOT NULL,              -- 'forexlive','fxstreet','reuters','dailyfx'
  published_at TIMESTAMPTZ NOT NULL,
  currencies   TEXT[] DEFAULT '{}',        -- e.g. ['USD','EUR']
  pairs        TEXT[] DEFAULT '{}',        -- e.g. ['EURUSD']
  sentiment    TEXT DEFAULT 'neutral',     -- 'bullish','bearish','neutral'
  impact       TEXT DEFAULT 'low',         -- 'high','medium','low'
  tags         TEXT[] DEFAULT '{}',        -- e.g. ['fed','inflation','nfp']
  fetched_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(url)
);

CREATE INDEX IF NOT EXISTS idx_news_published ON news_items(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_news_currencies ON news_items USING GIN(currencies);
CREATE INDEX IF NOT EXISTS idx_news_sentiment ON news_items(sentiment);
CREATE INDEX IF NOT EXISTS idx_news_impact ON news_items(impact);
