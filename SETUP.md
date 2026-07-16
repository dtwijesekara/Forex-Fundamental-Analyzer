# Forex Fundamental Analyzer — Setup Guide

Personal-use macro analysis dashboard. Built with Next.js, Supabase, and Yahoo Finance data.

---

## Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) account (free tier works fine)
- Optional: A Telegram bot for alerts
- Optional: A Railway/Render account for the background worker

---

## Step 1 — Install Dependencies

```bash
cd "Forex fundamnetal analyzer"
npm install
```

---

## Step 2 — Create Supabase Project

1. Go to [supabase.com](https://supabase.com) → New Project
2. Name it `forex-analyzer` (or anything)
3. Choose a region close to you
4. Go to **SQL Editor** → paste the full contents of `supabase/schema.sql` → Run
5. From **Project Settings → API**, copy:
   - Project URL
   - `anon` public key
   - `service_role` secret key

---

## Step 3 — Configure Environment

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```env
# Required
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Your timezone (for event display)
USER_TIMEZONE=Asia/Colombo

# Random strong secret — keep private
API_SECRET=change_this_to_something_random_and_strong

# Optional — Telegram alerts
TELEGRAM_BOT_TOKEN=123456789:ABCdef...
TELEGRAM_CHAT_ID=123456789
```

### Finding your Telegram Chat ID
1. Message [@BotFather](https://t.me/BotFather) → `/newbot` → follow steps → copy token
2. Message your new bot anything
3. Visit: `https://api.telegram.org/bot<TOKEN>/getUpdates`
4. Find `"chat":{"id":...}` in the response — that's your chat ID

---

## Step 4 — Run the Dashboard Locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

The dashboard will load but show empty states until you run the first analysis.

---

## Step 5 — Run First Analysis

### Option A — Using the API (simplest)

```bash
curl -X POST http://localhost:3000/api/refresh \
  -H "x-api-secret: your_api_secret_here"
```

Or from the dashboard — click **Refresh**, enter your API secret when prompted.

### Option B — Using the Worker Directly

```bash
npm run worker:run
```

This runs the full analysis pipeline once and prints results to terminal.

Expected output:
```
FOREX FUNDAMENTAL ANALYZER — Analysis Run
Started: 2025-01-01T12:00:00.000Z

  Calendar Fetch... ✓ Inserted: 45, Updated: 3, Errors: 0 (2341ms)
  Event Scoring... ✓ Scored 12 events (89ms)
  Intermarket Fetch... ✓ Fetched 6/6 symbols (1203ms)
  Currency Scoring... ✓ Scored 8 currencies (340ms)
  Pair Scoring... ✓ Scored 10 pairs (520ms)
  Regime Detection... ✓ Regime: Risk-Off (72% confidence) (45ms)
  Alert Check... ✓ Generated 2 alerts (120ms)

CURRENCY SCORES:
  USD  [··········|···▶·····]  +32.0 | Bullish
  GBP  [··········|··▶·······]  +18.5 | Neutral
  ...
```

---

## Step 6 — Deploy Dashboard to Cloudflare Workers

```bash
# Login to Cloudflare
npx wrangler login

# Set secrets (Workers don't read .env.local)
npx wrangler secret put NEXT_PUBLIC_SUPABASE_URL
npx wrangler secret put NEXT_PUBLIC_SUPABASE_ANON_KEY
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
npx wrangler secret put API_SECRET
npx wrangler secret put CRON_SECRET
npx wrangler secret put TELEGRAM_BOT_TOKEN
npx wrangler secret put TELEGRAM_CHAT_ID

# Build (via OpenNext) and deploy
npm run cf:deploy
```

Prints a live `https://forex-fundamental-analyzer.<your-subdomain>.workers.dev` URL on success.
See `DEPLOY.md` Step 2 for the full walkthrough, or Step 2 Alt if you'd rather use Vercel
instead — same env vars, `vercel` CLI or dashboard-based setup.

---

## Step 7 — Deploy Background Worker (Required for Auto-Updates)

> **Important:** Cloudflare Workers and Vercel both can't run the scheduler (no persistent
> processes on either). Deploy the worker separately, e.g. to Railway.

### Option A — Railway (Recommended, free tier available)

1. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub
2. Set Start Command: `npm run worker:start`
3. Add all the same `.env.local` variables in Railway → Variables
4. Railway keeps the worker running 24/7

### Option B — Render (Free tier)

1. Go to [render.com](https://render.com) → New Background Worker
2. Connect your GitHub repo
3. Start Command: `npm run worker:start`
4. Add environment variables in Render dashboard

### Option C — VPS / Local Machine

Run in a persistent terminal session (or use `pm2`):

```bash
# With pm2 (recommended for reliability)
npm install -g pm2
pm2 start "npm run worker:start" --name forex-worker
pm2 save
pm2 startup   # auto-restart on system reboot
```

---

## How the System Works

```
Every 30 minutes (via worker/scheduler):

1. Calendar Fetch      → Forex Factory JSON calendar → stored in Supabase
2. Event Scoring       → actual vs forecast → release bias + score per event
3. Intermarket Fetch   → Yahoo Finance (DXY, Gold, Oil, S&P500, VIX, Yields)
4. Currency Scoring    → 8 currencies scored on 5 components
5. Pair Scoring        → 10 pairs get bias + conviction % + explanations
6. Regime Detection    → market context classified (Risk-On/Off/etc.)
7. Alert Checks        → events approaching, bias flips, regime changes → Telegram

Every 15 minutes (alert-only check):
- Checks for Tier 1/2 events approaching in next 4 hours
- Sends Telegram alerts if critical thresholds crossed

Dashboard (Next.js on Cloudflare Workers):
- Reads precomputed data from Supabase
- Displays instantly (no live computation on page load)
- Auto-refreshes every 5 minutes
```

---

## Updating Central Bank Biases

Central bank stances must be updated manually after meetings/speeches.

### Via API:

```bash
curl -X PATCH https://your-app-url/api/central-banks \
  -H "x-api-secret: your_secret" \
  -H "Content-Type: application/json" \
  -d '{
    "currency": "USD",
    "bias_score": 2.0,
    "bias_label": "Hawkish",
    "rate_trend": "holding",
    "last_decision": "hold",
    "key_phrase": "No rush to cut rates"
  }'
```

### Via Supabase Dashboard:

Go to Supabase → Table Editor → `central_bank_bias` → edit directly.

CB Bias Scale:
- `+5` = Aggressive Hawkish (actively hiking)
- `+3/+4` = Hawkish
- `+1/+2` = Mildly Hawkish
- `0` = Neutral
- `-1/-2` = Mildly Dovish
- `-3/-4` = Dovish
- `-5` = Aggressive Dovish (actively cutting)

---

## Seeding COT Data (Optional)

CFTC publishes COT data every Friday. You can import it via the Supabase Table Editor into the `cot_data` table, or write a custom fetcher later.

Fields: `currency`, `report_date`, `net_position`, `long_positions`, `short_positions`, `net_pct`

---

## Score System Explained

### Currency Score (-100 to +100)

| Component | Range | Source |
|-----------|-------|--------|
| Economic releases | -30 to +30 | Actual vs forecast, tiered by event type |
| Central bank bias | -25 to +25 | CB stance × 5 |
| Rate outlook | -20 to +20 | Rate trend + CB confirmation |
| Intermarket | -15 to +15 | DXY, yields, commodities, risk sentiment |
| Sentiment/COT | -10 to +10 | Net speculative positioning |
| Event risk penalty | 0 to -20 | Upcoming Tier 1/2 events reduce conviction |

**Labels:**
- +50 to +100 → Strong Bullish
- +20 to +49 → Bullish
- -19 to +19 → Neutral
- -20 to -49 → Bearish
- -50 to -100 → Strong Bearish

### Pair Score & Conviction

```
pair_score = base_currency_score - quote_currency_score
conviction_pct = min(|pair_score| / 80 × 100, 100)
```

Pairs with `conviction_pct < 40` are low-confidence. Conflicts reduce conviction by 20%.

### Event Tiers

- **Tier 1**: Rate decisions, CPI/Core CPI, NFP, GDP, CB speeches → can flip bias
- **Tier 2**: PMI, retail sales, wages, unemployment, PPI → adjust conviction
- **Tier 3**: Minor data → context only

---

## Dashboard Usage Guide

### Opening the Dashboard

The top 4 cards give you an instant picture:
1. **Strongest** — top 3 currencies by fundamental score
2. **Weakest** — bottom 3 currencies
3. **Regime** — current market environment
4. **Next Event** — next Tier 1 release and time remaining

### Reading Currency Board

- Green scores = fundamentally supported
- Red scores = fundamentally weak
- CB badge shows central bank stance
- Score breakdown shows what's driving the score

### Reading Pair Board

- **Conviction %** = how strong is the signal (higher = more aligned)
- **Yellow border** = conflict detected (treat with extra caution)
- **Blue EVENT RISK badge** = major release coming, avoid fresh entries
- Pairs sorted by conviction descending

### Event Panel

- Tier 1 events shown with **T1** red badge — highest priority
- Red background = event < 30 min away (critical)
- Amber background = event < 2 hours away
- Recent releases show Actual vs Forecast and release bias

### When NOT to Trade Based on This System

1. When a Tier 1 event is within 30 minutes for either pair currency
2. When conviction is below 40%
3. When a conflict flag is shown
4. When regime is "Mixed"
5. Within 30 minutes after a Tier 1 release (volatility window)

---

## File Structure

```
forex-fundamental-analyzer/
├── src/
│   ├── app/                    # Next.js app (dashboard + API routes)
│   │   ├── page.tsx            # Main dashboard
│   │   ├── layout.tsx
│   │   ├── globals.css
│   │   └── api/
│   │       ├── analysis/       # GET full dashboard data
│   │       ├── calendar/       # GET events
│   │       ├── currencies/     # GET currency scores
│   │       ├── central-banks/  # GET/PATCH CB biases
│   │       └── refresh/        # POST trigger analysis run
│   ├── components/
│   │   ├── ui/                 # Card, Badge, ScoreBar
│   │   └── dashboard/          # CurrencyBoard, PairBoard, EventPanel, etc.
│   ├── engines/
│   │   ├── calendar/           # Forex Factory fetcher + event scorer
│   │   ├── central-bank/       # CB bias engine
│   │   ├── scoring/            # Currency + pair scorers
│   │   ├── intermarket/        # Yahoo Finance data + scoring
│   │   ├── sentiment/          # COT data
│   │   ├── risk/               # Event risk warnings
│   │   ├── regime/             # Market regime detector
│   │   └── alerts/             # Telegram + alert engine
│   ├── lib/
│   │   ├── constants.ts        # Currencies, pairs, weights, labels
│   │   ├── utils.ts            # Helpers (formatting, scoring)
│   │   └── supabase.ts         # DB client
│   └── types/
│       └── index.ts            # All TypeScript types
├── workers/
│   ├── run-analysis.ts         # Single run (npm run worker:run)
│   └── scheduler.ts            # Cron scheduler (npm run worker:start)
├── supabase/
│   └── schema.sql              # Full DB schema + seed data
├── .env.example
└── package.json
```

---

## Troubleshooting

### "No currency data" on dashboard
→ Run `npm run worker:run` to populate the database for the first time.

### Calendar shows no events
→ Forex Factory endpoint may be slow. Try again after a few minutes. Check `system_health` table in Supabase for error details.

### Intermarket data missing
→ Yahoo Finance rate limits or market is closed. Prices will update on next run during market hours.

### Telegram alerts not sending
→ Verify `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` are correct. Test the bot manually by sending it a message first.

### Worker crashes on startup
→ Check `.env.local` (or your hosting env vars) — all Supabase variables must be set. Run `npm run worker:run` locally first to see the error.

---

## Planned V2 Upgrades (do not build now)

- Richer NLP on central bank speeches
- Machine learning score optimizer
- COT data auto-fetcher from CFTC
- Backtesting module (how did bias perform historically?)
- Trade journal connector
- Score history charts on dashboard
- More currencies / exotic pairs
- Mobile app wrapper

---

*This system is for personal use only. It provides fundamental analysis context to support manual trading decisions. It is not a signal service, not financial advice, and does not execute trades.*
