# FX Analyzer — Forex Fundamental Analysis Dashboard

A macro-fundamentals dashboard for forex traders: it scores 8 major currencies and 10 pairs on economic releases, central bank stance, rate outlook, intermarket signals, and positioning data — then serves the result as a live, auto-refreshing dashboard. No price charts, no signals to buy or sell — just the fundamental picture, computed on a schedule and read instantly.

**Stack:** Next.js 15 (App Router) · TypeScript · Supabase (Postgres) · Tailwind CSS · Recharts, deployed on Vercel with a Railway-hosted scheduler.

---

## Why

Most retail forex tools are technical-only — price action, indicators, chart patterns. Fundamentals (rate differentials, central bank bias, economic surprises) are usually left to reading news manually. This project automates that read: it pulls economic calendar releases, central bank policy stance, and cross-market confirmation signals (DXY, yields, gold, equities, VIX) into a single per-currency and per-pair score, refreshed automatically.

## Features

- **Currency Board** — all 8 majors (USD, EUR, GBP, JPY, AUD, CAD, NZD, CHF) scored -100 to +100 across five weighted components, with a breakdown of what's driving each score
- **Pair Board** — 10 priority pairs with bias, conviction %, and plain-language explanation; conflicting signals are flagged
- **Economic Calendar** — upcoming and recent Tier 1/2/3 releases with actual-vs-forecast and release bias, event-risk warnings before high-impact prints
- **Central Bank Panel** — live policy stance per bank (Fed, ECB, BoE, BoJ, RBA, BoC, RBNZ, SNB), auto-refreshed
- **Market Regime Detection** — classifies the broader macro backdrop (Risk-On / Risk-Off / Mixed) from intermarket data
- **Intermarket Confirmation** — DXY, Gold, Oil, S&P 500, VIX, and US 10Y yield fed into currency scoring
- **News Feed** — recent forex-relevant headlines, filterable by currency/impact
- **Telegram Alerts** — event-risk warnings, bias flips, and regime changes pushed to a bot (optional)

## How Scoring Works

Each currency's score combines five weighted components:

| Component | Range | Source |
|---|---|---|
| Economic releases | -30 to +30 | Actual vs. forecast, tiered by event importance |
| Central bank bias | -25 to +25 | Policy stance × weight |
| Rate outlook | -20 to +20 | Rate trend + CB confirmation |
| Intermarket | -15 to +15 | DXY, yields, commodities, risk sentiment |
| Sentiment / COT | -10 to +10 | Net speculative positioning |
| Event risk penalty | 0 to -20 | Upcoming Tier 1/2 events reduce conviction |

Pair scores are the difference between the two currencies' scores; conviction is derived from the magnitude of that gap, discounted when signals conflict. Full detail — including the event tiering system and the score-to-label mapping — is in [`SETUP.md`](./SETUP.md#score-system-explained).

## Architecture

```
GitHub repo
  ├── Vercel (dashboard)          — Next.js pages + read-only API routes, served on demand
  └── Railway (scheduler)         — node-cron worker running the analysis pipeline
        ├── Full analysis     every 30 min
        ├── Alert checks      every 15 min
        ├── Intermarket data  every 10 min
        └── News collection   every 20 min

Both read/write the same Supabase Postgres database.
```

The dashboard never computes anything live on page load — it reads whatever the scheduler last wrote to Supabase, so pages load instantly regardless of how expensive the underlying analysis is.

## Data Sources

- **Economic calendar & releases** — Forex Factory
- **Market data** — Stooq (DXY, Gold, Oil, S&P 500) and FRED (VIX, US 10Y yield)
- **News** — RSS aggregation from forex-relevant feeds
- **Central bank stance** — manually curated, updated after each policy meeting/speech

## Getting Started

```bash
git clone https://github.com/<your-username>/forex-fundamental-analyzer.git
cd forex-fundamental-analyzer
npm install
cp .env.example .env.local   # fill in your Supabase project + secrets
npm run dev
```

Full local setup (Supabase schema, environment variables, first analysis run) is documented in [`SETUP.md`](./SETUP.md). Production deployment (Vercel + Railway) is documented in [`DEPLOY.md`](./DEPLOY.md).

## Project Structure

```
src/
├── app/              # Next.js pages (dashboard) + API routes
├── components/        # UI primitives + dashboard components
├── engines/            # Scoring, calendar, intermarket, alerts, regime detection
├── lib/                 # Constants, Supabase client, shared utilities
└── types/                # Shared TypeScript types
workers/
├── run-analysis.ts   # Single manual pipeline run
└── scheduler.ts       # node-cron scheduler (deployed to Railway)
supabase/
└── schema.sql          # Full database schema
```

## Disclaimer

Built for personal use. It surfaces fundamental context to support manual trading decisions — it is not a signal service, does not execute trades, and is not financial advice.
