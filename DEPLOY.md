# Deployment Guide — FX Fundamental Analyzer

## Architecture Overview

```
GitHub repo
  ├── Cloudflare Workers (dashboard)  — FREE
  │     ├── Next.js dashboard (all 5 pages), deployed via OpenNext
  │     └── API routes (read-only, served on demand)
  │
  └── Railway (ALL scheduling)       — FREE 500h/mo
        └── node-cron scheduler
              ├── Full analysis every 30 min
              ├── Alert checks every 15 min
              ├── Intermarket refresh every 10 min
              └── News fetch every 20 min

Both services read/write the same Supabase database.
Vercel also works as a drop-in alternative for the dashboard — see Step 2 Alt.
```

> **Why NOT Cloudflare Workers for the scheduler?**
> `workers/scheduler.ts` uses `node-cron`, a real long-running Node.js process with native
> timers — Cloudflare Workers run V8 isolates with request/cron-trigger execution, not a
> persistent Node process. It can't host the scheduler. Railway runs real Node.js — it
> works perfectly for that piece.
>
> The dashboard itself (Next.js pages + API routes) doesn't use any Node-native packages —
> `yahoo-finance2` and `node-telegram-bot-api` are unused leftovers in `package.json`; market
> data comes from plain `fetch()` calls to Stooq/FRED and Telegram alerts go out via `axios`
> HTTP calls. That's why the dashboard runs fine on Cloudflare Workers via the OpenNext
> adapter, even though scheduling still has to stay on Railway.

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

## Step 2 — Deploy Dashboard to Cloudflare Workers

Deploys the Next.js dashboard using the [OpenNext Cloudflare adapter](https://opennext.js.org/cloudflare)
(already configured in this repo via `open-next.config.ts` + `wrangler.jsonc`).

### 2a — Create a Cloudflare account
Go to [dash.cloudflare.com](https://dash.cloudflare.com) → sign up (free) → note your **Account ID**
(Workers & Pages → Overview, right sidebar).

### 2b — Log in with Wrangler
```bash
npx wrangler login
```

### 2c — Set secrets
Cloudflare Workers don't read `.env.local`. Set each secret individually:
```bash
npx wrangler secret put NEXT_PUBLIC_SUPABASE_URL
npx wrangler secret put NEXT_PUBLIC_SUPABASE_ANON_KEY
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
npx wrangler secret put API_SECRET
npx wrangler secret put CRON_SECRET
npx wrangler secret put TELEGRAM_BOT_TOKEN   # optional
npx wrangler secret put TELEGRAM_CHAT_ID     # optional
```

### 2d — Build and deploy
```bash
npm run cf:deploy
```
This runs `opennextjs-cloudflare build` (adapts the Next.js build for Workers) then
`opennextjs-cloudflare deploy` (uploads via Wrangler). On success it prints your live
`https://forex-fundamental-analyzer.<your-subdomain>.workers.dev` URL.

### 2e — Local preview (optional, before deploying)
```bash
npm run cf:preview
```
Runs the Worker build locally against Cloudflare's runtime so you can sanity-check it
before shipping.

> Re-run `npm run cf:deploy` after any push to update it — this isn't wired to auto-deploy on
> `git push` like Railway is, unless you add [Cloudflare Workers Builds](https://developers.cloudflare.com/workers/ci-cd/builds/)
> (connect the GitHub repo under Workers & Pages → your Worker → Settings → Builds) or write
> your own GitHub Action calling `npm run cf:deploy` with a `CLOUDFLARE_API_TOKEN` secret.

---

## Step 2 Alt — Deploy Dashboard to Vercel Instead

If you'd rather use Vercel than Cloudflare for the dashboard, this works identically —
skip Step 2 above and do this instead.

### Create Vercel account & import repo
1. Go to [vercel.com](https://vercel.com) → Sign up with GitHub (free)
2. Vercel dashboard → **Add New → Project** → select your repo → **Import**
3. Framework: **Next.js** (auto-detected) → click **Deploy** (it will fail — expected)

### Add environment variables
Vercel → **Settings → Environment Variables** (scope: Production + Preview + Development):

| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJ...` (anon/public key) |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJ...` (service_role secret key) |
| `API_SECRET` | Any strong random string, e.g. `fx_$(openssl rand -hex 16)` |
| `USER_TIMEZONE` | Your timezone, e.g. `Asia/Colombo` |
| `TELEGRAM_BOT_TOKEN` | `123456:ABC...` (optional) |
| `TELEGRAM_CHAT_ID` | Your chat ID number (optional) |

Then **Deployments → Redeploy**. Live at `https://fx-analyzer-xxx.vercel.app`.

> Vercel Hobby (free) only allows crons that run once/day, which is why `vercel.json` is
> empty here either way — Railway handles scheduling regardless of which host you pick.

---

## Step 3 — Deploy Worker to Railway

Railway runs the heavy analysis scheduler (every 30 min) — the dashboard host (Cloudflare
or Vercel) only serves requests on demand and can't run a persistent background process.

### 3a — Create Railway account
Go to [railway.app](https://railway.app) → Sign up with GitHub (free)

### 3b — Create new project
1. Railway dashboard → **New Project → Deploy from GitHub repo**
2. Select the same `fx-analyzer` repo
3. Railway will auto-detect `railway.toml` and use `npm run worker:start`

### 3c — Add environment variables
Railway project → **Variables** tab → add the **same variables** as the dashboard host:

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
curl -X POST https://YOUR_APP_URL/api/refresh \
  -H "x-api-secret: YOUR_API_SECRET"
```

Or open your dashboard URL (the `workers.dev` URL from Step 2d, or your Vercel URL if you
used Step 2 Alt), click **Refresh** on the Overview page, enter your API secret.

After ~2 minutes the dashboard will populate with live data.

---

## Step 5 — Verify Everything Works

- [ ] Dashboard loads at your Cloudflare Workers URL (or Vercel URL)
- [ ] `/currencies` shows 8 currencies with scores
- [ ] `/pairs` shows 10 pairs with bias
- [ ] `/calendar` shows upcoming events
- [ ] Railway logs show analysis running every 30 min
- [ ] Telegram bot sends alerts (if configured)

---

## Auto-Deploy on Push

Railway watches your GitHub `main` branch and redeploys automatically within ~2 minutes of
any push. Cloudflare Workers does **not** auto-deploy by default — re-run `npm run cf:deploy`
after each push, or set up [Cloudflare Workers Builds](https://developers.cloudflare.com/workers/ci-cd/builds/)
to get the same auto-deploy behavior. (If you used Vercel instead in Step 2 Alt, Vercel
auto-deploys on push like Railway does.)

---

## Updating Central Bank Biases

After every Fed/ECB/BoE meeting, update the CB stance:

```bash
curl -X PATCH https://YOUR_APP_URL/api/central-banks \
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
| Cloudflare Workers | Free (100k req/day) | $0 |
| Railway | Starter (500h free) | $0–$5 |
| Supabase | Free tier | $0 |
| **Total** | | **$0–$5/month** |

---

## Troubleshooting

**Dashboard shows empty state:**
→ Trigger a manual refresh (Step 4). Railway worker may not have run yet.

**Railway worker crashes:**
→ Check Variables tab — all Supabase vars must be set.
→ Railway → Deployments → View Logs to see the specific error.

**Cloudflare deploy fails or 500s at runtime:**
→ Run `npx wrangler secret list` to confirm all secrets from Step 2c are set — Workers
  don't inherit `.env.local`. → Check `npx wrangler tail` while hitting the deployed URL for
  the actual runtime error.

**Cloudflare build fails locally:**
→ Run `npm run cf:build` on its own first to isolate whether it's the `next build` step or
  the OpenNext bundling step that's failing — the error message tells you which.

**(If using Vercel instead) Vercel build fails:**
→ Check all `NEXT_PUBLIC_*` env vars are set in Vercel → Settings → Environment Variables.
→ Redeploy after adding vars.
