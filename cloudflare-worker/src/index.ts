// ============================================================
// CLOUDFLARE WORKER — FX Analyzer Cron Scheduler
// Replaces Railway background worker entirely.
// One cron trigger (*/5 * * * *) dispatches all jobs based
// on the current UTC minute, so only 1 Cron Trigger is needed.
//
// Free tier: 100k req/day, 30s CPU/cron, unlimited cron triggers
// Deploy: wrangler deploy (from cloudflare-worker/ directory)
// Secrets: wrangler secret put CRON_SECRET
//          wrangler secret put APP_URL
// ============================================================

interface Env {
  CRON_SECRET: string;
  APP_URL: string;                   // e.g. https://your-app.vercel.app
  VERCEL_BYPASS_SECRET?: string;     // optional: Vercel deployment protection bypass
}

export default {
  // ── CRON HANDLER ────────────────────────────────────────────
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    if (!env.APP_URL || !env.CRON_SECRET) {
      console.error('[Cron] Missing APP_URL or CRON_SECRET secrets — run: wrangler secret put APP_URL');
      return;
    }

    // Strip trailing slash from APP_URL if present
    const baseUrl = env.APP_URL.replace(/\/$/, '');

    const now    = new Date();
    const minute = now.getUTCMinutes();
    const hour   = now.getUTCHours();

    console.log(`[Cron] Fired at ${now.toISOString()} — minute=${minute} hour=${hour} base=${baseUrl}`);

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${env.CRON_SECRET}`,
      'User-Agent':    'FXAnalyzer-CronWorker/1.0',
    };
    // Bypass Vercel Deployment Protection if secret is set
    if (env.VERCEL_BYPASS_SECRET) {
      headers['x-vercel-protection-bypass'] = env.VERCEL_BYPASS_SECRET;
    }

    const calls: Promise<Response>[] = [];
    const hit = (path: string) => {
      console.log(`[Cron] → ${baseUrl}${path}`);
      return fetch(`${baseUrl}${path}`, { method: 'GET', headers });
    };

    // ── Every 5 min: fast actuals patch ─────────────────────
    calls.push(hit('/api/cron/actuals'));

    // ── Every 10 min: intermarket prices ────────────────────
    if (minute % 10 === 0) calls.push(hit('/api/cron/intermarket'));

    // ── Every 15 min: alerts ────────────────────────────────
    if (minute % 15 === 0) calls.push(hit('/api/cron/alerts'));

    // ── Every 20 min: news ──────────────────────────────────
    if (minute % 20 === 0) calls.push(hit('/api/cron/news'));

    // ── Every 30 min: full analysis ─────────────────────────
    if (minute % 30 === 0) calls.push(hit('/api/cron/analysis'));

    // ── Every 6 h (at :15 past): CB rate auto-update ────────
    if (minute === 15 && hour % 6 === 0) calls.push(hit('/api/cron/cb-rates'));

    // Fire all calls — don't block the Worker on Vercel's response time
    ctx.waitUntil(
      Promise.allSettled(calls).then(results => {
        results.forEach((r, i) => {
          if (r.status === 'rejected') {
            console.error(`[Cron] Call ${i} failed:`, r.reason);
          } else {
            console.log(`[Cron] Call ${i} → HTTP ${r.value.status}`);
          }
        });
      })
    );
  },

  // ── HTTP HANDLER (health check) ──────────────────────────
  async fetch(_req: Request, env: Env): Promise<Response> {
    return new Response(JSON.stringify({
      service: 'FX Analyzer Cron Worker',
      status:  'running',
      app_url: env.APP_URL ? '✓ set' : '✗ missing',
      secret:  env.CRON_SECRET ? '✓ set' : '✗ missing',
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  },
};
