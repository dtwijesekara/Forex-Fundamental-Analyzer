# Deployment Guide — FX Fundamental Analyzer

## Architecture Overview

```
GitHub repo
  ├── Vercel (dashboard + lightweight crons)   — FREE
  │     ├── Next.js dashboard (all 5 pages)
  │     ├── API routes
  │     └── Cron: news (20m), intermarket (10m), alerts (15m)
  │
  └── Railway (background worker)              — FREE 500h/mo
        └── node-cron scheduler → full analysis every 30 min
              ├── Forex Factory calendar fetch
              ├── Event scoring
              ├── Currency + pair scoring
              ├── Regime detection
              └── Telegram alerts

Both services read/write the same Supabase database.
```

> **Why NOT Cloudflare Pages?**
> This project uses `yahoo-finance2`, `node-cron`, and `node-telegram-bot-api` — all rely
> on Node.js native APIs (net, tls, dns). Cloudflare Workers run V8 isolates, not Node.js.
> These packages will crash on Cloudflare. Vercel runs real Node.js — it works perfectly.

---

## Step 1 — Push to GitHub

```bash
# From your project folder
git init
git add .
git commit -m "Initial commit"

# Create a repo on github.com, then:
git remote add origin https://github.com/YOUR_USERNAME/fx-analyzer.git
git branch -M main
git push -u origin main
```

> **Important:** `.env.local` is already in `.gitignore` — your secrets stay local.

---

## Step 2 — Deploy Dashboard to Vercel

### 2a — Create Vercel account
Go to [vercel.com](https://vercel.com) → Sign up with GitHub (free)

### 2b — Import your GitHub repo
1. Vercel dashboard → **Add New → Project**
2. Select your `fx-analyzer` GitHub repo → **Import**
3. Framework: **Next.js** (auto-detected)
4. Do **NOT** add env vars yet — click **Deploy** first

It will fail — that's expected. Fix in next step.

### 2c — Add environment variables
Go to your project on Vercel → **Settings → Environment Variables**

Add each of these (set scope to **Production + Preview + Development**):

| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJ...` (anon/public key) |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJ...` (service_role secret key) |
| `API_SECRET` | Any strong random string, e.g. `fx_$(openssl rand -hex 16)` |
| `USER_TIMEZONE` | Your timezone, e.g. `Asia/Colombo` |
| `TELEGRAM_BOT_TOKEN` | `123456:ABC...` (optional) |
| `TELEGRAM_CHAT_ID` | Your chat ID number (optional) |

### 2d — Redeploy
Vercel → **Deployments** → click the latest failed deploy → **Redeploy**

Your dashboard will be live at `https://fx-analyzer-xxx.vercel.app`

---

## Step 3 — Deploy Worker to Railway

Railway runs the heavy analysis scheduler (every 30 min) that Vercel's free 60s timeout can't handle.

### 3a — Create Railway account
Go to [railway.app](https://railway.app) → Sign up with GitHub (free)

### 3b — Create new project
1. Railway dashboard → **New Project → Deploy from GitHub repo**
2. Select the same `fx-analyzer` repo
3. Railway will auto-detect `railway.toml` and use `npm run worker:start`

### 3c — Add environment variables
Railway project → **Variables** tab → add the **same variables** as Vercel:

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
API_SECRET
USER_TIMEZONE
TELEGRAM_BOT_TOKEN
TELEGRAM_CHAT_ID
```

### 3d — Verify worker is running
Railway → **Deployments → View Logs**

You should see:
```
[scheduler] Starting Forex Fundamental Analyzer scheduler...
[scheduler] Analysis scheduled: every 30 minutes
[scheduler] Alerts scheduled: every 15 minutes
...
```

---

## Step 4 — Run First Analysis

The database is empty until the first analysis runs. Trigger it manually:

```bash
curl -X POST https://YOUR_APP.vercel.app/api/refresh \
  -H "x-api-secret: YOUR_API_SECRET"
```

Or open your Vercel app URL, click **Refresh** on the Overview page, enter your API secret.

After ~2 minutes the dashboard will populate with live data.

---

## Step 5 — Verify Everything Works

- [ ] Dashboard loads at your Vercel URL
- [ ] `/currencies` shows 8 currencies with scores
- [ ] `/pairs` shows 10 pairs with bias
- [ ] `/calendar` shows upcoming events
- [ ] Railway logs show analysis running every 30 min
- [ ] Telegram bot sends alerts (if configured)

---

## Auto-Deploy on Push

Both Vercel and Railway watch your GitHub `main` branch. Any `git push` automatically redeploys both services within ~2 minutes. No manual steps needed after initial setup.

---

## Updating Central Bank Biases

After every Fed/ECB/BoE meeting, update the CB stance:

```bash
curl -X PATCH https://YOUR_APP.vercel.app/api/central-banks \
  -H "x-api-secret: YOUR_API_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "currency": "USD",
    "bias_score": 1.5,
    "bias_label": "Mildly Hawkish",
    "rate_trend": "holding",
    "key_phrase": "Data dependent, no rush to cut"
  }'
```

Or edit directly in Supabase dashboard → Table Editor → `central_bank_bias`.

---

## Cost Summary

| Service | Plan | Monthly Cost |
|---------|------|-------------|
| Vercel | Hobby (free) | $0 |
| Railway | Starter (500h free) | $0–$5 |
| Supabase | Free tier | $0 |
| **Total** | | **$0–$5/month** |

### Vercel Pro upgrade ($20/month) — when you need it
If you want the full analysis cron running on Vercel (instead of Railway):
1. Add back to `vercel.json`: `{ "path": "/api/cron/analysis", "schedule": "*/30 * * * *" }`
2. In `src/app/api/cron/analysis/route.ts` — the `maxDuration: 300` will work on Pro
3. Cancel Railway — Vercel handles everything

---

## Troubleshooting

**Dashboard shows empty state:**
→ Trigger a manual refresh (Step 4). Railway worker may not have run yet.

**Railway worker crashes:**
→ Check Variables tab — all 3 Supabase vars must be set.
→ View logs for the specific error message.

**Vercel build fails:**
→ Check all `NEXT_PUBLIC_*` env vars are set in Vercel → Settings → Environment Variables.

**Cron jobs not running:**
→ Vercel crons only run on Production deployments (not Preview). Make sure you're looking at the production URL.
→ Vercel dashboard → Logs → Cron tab shows execution history.
