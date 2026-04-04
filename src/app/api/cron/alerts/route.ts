// ============================================================
// VERCEL CRON JOB: /api/cron/alerts
// Runs every 15 minutes — checks event risk warnings only
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { generateEventRiskWarnings } from '@/engines/risk/event-risk';
import { sendTelegramMessage, formatEventWarningMessage } from '@/engines/alerts/telegram';
import { createAdminClient, TABLES } from '@/lib/supabase';
import { RISK_WARNING_THRESHOLDS } from '@/lib/constants';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = createAdminClient();
  const warnings = await generateEventRiskWarnings(4);
  const critical = warnings.filter(
    w => w.severity === 'critical' || (w.severity === 'warning' && w.tier === 1)
  );

  let sent = 0;
  for (const w of critical) {
    // Dedup — don't re-alert within 90 minutes for same event
    const since = new Date(Date.now() - 90 * 60 * 1000).toISOString();
    const { data: existing } = await db
      .from(TABLES.ALERTS_LOG)
      .select('id')
      .eq('alert_type', 'event_approaching')
      .eq('currency', w.currency)
      .ilike('title', `%${w.event_name.slice(0, 25)}%`)
      .gte('sent_at', since)
      .limit(1);

    if (existing && existing.length > 0) continue;

    const msg = formatEventWarningMessage(
      w.event_name, w.currency, w.minutes_away, w.tier, w.affected_pairs
    );
    const ok = await sendTelegramMessage(msg);

    await db.from(TABLES.ALERTS_LOG).insert({
      alert_type: 'event_approaching',
      severity: w.severity,
      title: `${w.currency} ${w.event_name} in ${w.minutes_away}m`,
      message: w.message,
      currency: w.currency,
      sent_telegram: ok,
      sent_at: new Date().toISOString(),
      acknowledged: false,
    });
    sent++;
  }

  return NextResponse.json({ ok: true, warnings: critical.length, sent });
}
