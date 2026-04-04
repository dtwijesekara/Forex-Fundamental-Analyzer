'use client';

// ============================================================
// OVERVIEW PAGE  (/}
// Quick-glance summary: regime, sessions, top opportunities,
// critical events, recent alerts
// ============================================================

import Link from 'next/link';
import { PageShell } from '@/components/layout/PageShell';
import { SessionTracker } from '@/components/dashboard/SessionTracker';
import { RegimeCard } from '@/components/dashboard/RegimeCard';
import { AlertsPanel } from '@/components/dashboard/AlertsPanel';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { PairBiasBadge, TierBadge } from '@/components/ui/Badge';
import { ConvictionBar } from '@/components/ui/ScoreBar';
import { useAnalysis } from '@/hooks/useAnalysis';
import { getPairBiasColor, formatEventTime, minutesUntilEvent, formatMinutesAway, cn } from '@/lib/utils';
import { CURRENCY_FLAGS } from '@/lib/constants';
import { AlertTriangle, Activity, RefreshCw, ArrowRight, TrendingUp, Globe, Calendar } from 'lucide-react';
import type { Currency } from '@/types';

export default function OverviewPage() {
  const { data, loading, error, lastFetch, refreshing, refresh } = useAnalysis();

  if (loading) return <LoadingScreen />;
  if (error && !data) return <ErrorScreen error={error} onRetry={refresh} />;

  const {
    currencies      = [],
    pairs           = [],
    regime          = null,
    upcoming_events = [],
    event_risks     = [],
    recent_alerts   = [],
    intermarket     = {},
  } = data || {};

  const sorted             = [...currencies].sort((a, b) => b.score - a.score);
  const strongest          = sorted.slice(0, 4);
  const weakest            = sorted.slice(-4).reverse();
  const topPairs           = [...pairs].sort((a, b) => b.conviction_pct - a.conviction_pct).slice(0, 5);
  const criticalRisks      = event_risks.filter(r => r.severity === 'critical');
  const nextEvents         = upcoming_events.filter(e => e.tier <= 2).slice(0, 4);

  return (
    <PageShell lastFetch={lastFetch} refreshing={refreshing} onRefresh={refresh}>
      <div className="animate-fadeInUp space-y-4">

        {/* ── Page title ── */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-base font-bold gradient-text">Overview</h1>
            <p className="text-[11px] text-slate-500 mt-0.5">Macro summary at a glance</p>
          </div>
          {refreshing && (
            <div className="flex items-center gap-1.5 text-[10px] text-emerald-400">
              <RefreshCw size={10} className="animate-spin" />
              <span>Updating…</span>
            </div>
          )}
        </div>

        {/* ── CRITICAL RISK BANNERS ── */}
        {criticalRisks.length > 0 && (
          <div className="space-y-1.5">
            {criticalRisks.map((risk, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-rose-500/8 border border-rose-500/25 text-rose-400">
                <AlertTriangle size={13} className="shrink-0" />
                <span className="text-xs font-semibold">{risk.message}</span>
                <span className="text-[10px] opacity-50 ml-auto hidden sm:block">{risk.affected_pairs.join(' · ')}</span>
              </div>
            ))}
          </div>
        )}

        {/* ── TOP ROW: Currency strength ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Strongest */}
          <div className="stat-card-green rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] uppercase tracking-[0.12em] text-emerald-400/70 font-bold">Strongest</p>
              <Link href="/currencies" className="text-[10px] text-emerald-500/60 hover:text-emerald-400 flex items-center gap-1 transition-colors">
                All <ArrowRight size={9} />
              </Link>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {strongest.map((c, i) => (
                <div key={c.currency} className="text-center">
                  <div className="text-xl">{CURRENCY_FLAGS[c.currency as Currency]}</div>
                  <div className="text-xs font-bold text-emerald-300 mt-0.5">{c.currency}</div>
                  <div className="text-[9px] text-slate-400 tabular">{c.score > 0 ? '+' : ''}{c.score.toFixed(0)}</div>
                  <div className={`text-[8px] font-bold ${i === 0 ? 'text-emerald-400' : 'text-slate-500'}`}>#{i + 1}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Weakest */}
          <div className="stat-card-red rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] uppercase tracking-[0.12em] text-red-400/70 font-bold">Weakest</p>
              <Link href="/currencies" className="text-[10px] text-red-500/60 hover:text-red-400 flex items-center gap-1 transition-colors">
                All <ArrowRight size={9} />
              </Link>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {weakest.map((c, i) => (
                <div key={c.currency} className="text-center">
                  <div className="text-xl">{CURRENCY_FLAGS[c.currency as Currency]}</div>
                  <div className="text-xs font-bold text-red-300 mt-0.5">{c.currency}</div>
                  <div className="text-[9px] text-slate-400 tabular">{c.score.toFixed(0)}</div>
                  <div className={`text-[8px] font-bold ${i === 0 ? 'text-red-400' : 'text-slate-500'}`}>#{sorted.length - i}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── MAIN 3-COLUMN ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* LEFT: Sessions + Regime */}
          <div className="space-y-4">
            <SessionTracker />
            <RegimeCard regime={regime} intermarket={intermarket} />
          </div>

          {/* CENTER: Top pair opportunities */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <TrendingUp size={12} className="text-slate-500" />
                  <CardTitle>Top Opportunities</CardTitle>
                </div>
                <Link href="/pairs" className="text-[10px] text-slate-500 hover:text-slate-300 flex items-center gap-1 transition-colors">
                  All pairs <ArrowRight size={9} />
                </Link>
              </CardHeader>
              <div className="divide-y divide-white/[0.04]">
                {topPairs.length === 0 ? (
                  <p className="text-slate-600 text-xs p-4 text-center">No pair data — run analysis first</p>
                ) : topPairs.map(pair => (
                  <Link
                    key={pair.pair}
                    href={`/pair/${pair.pair}`}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.02] transition-colors group"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono font-bold text-sm text-slate-100 group-hover:text-emerald-300 transition-colors">
                          {pair.pair}
                        </span>
                        <PairBiasBadge bias={pair.bias} />
                        {pair.conflict_flag && <AlertTriangle size={10} className="text-amber-400" />}
                      </div>
                      <ConvictionBar pct={pair.conviction_pct} />
                    </div>
                    <div className="text-right shrink-0">
                      <div className={`text-sm font-bold tabular ${getPairBiasColor(pair.bias)}`}>
                        {pair.pair_score > 0 ? '+' : ''}{pair.pair_score.toFixed(0)}
                      </div>
                      <div className="text-[10px] text-slate-500">{pair.conviction_pct}%</div>
                    </div>
                    <ArrowRight size={11} className="text-slate-700 group-hover:text-slate-400 transition-colors shrink-0" />
                  </Link>
                ))}
              </div>
            </Card>

            {/* Next events */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Calendar size={12} className="text-slate-500" />
                  <CardTitle>Next Events</CardTitle>
                </div>
                <Link href="/calendar" className="text-[10px] text-slate-500 hover:text-slate-300 flex items-center gap-1 transition-colors">
                  Full calendar <ArrowRight size={9} />
                </Link>
              </CardHeader>
              <div className="divide-y divide-white/[0.04]">
                {nextEvents.length === 0 ? (
                  <p className="text-slate-600 text-xs p-4 text-center">No high-impact events in 24h</p>
                ) : nextEvents.map(event => {
                  const mins = minutesUntilEvent(event.event_time);
                  const soon = mins <= 60;
                  return (
                    <div key={event.id} className="flex items-center gap-3 px-4 py-2.5">
                      <div className="shrink-0 text-center w-12">
                        <div className="text-xs font-mono text-slate-300">{formatEventTime(event.event_time)}</div>
                        <div className={cn('text-[9px] font-bold', soon ? 'text-amber-400' : 'text-slate-600')}>
                          {formatMinutesAway(mins)}
                        </div>
                      </div>
                      <span className="text-sm">{CURRENCY_FLAGS[event.currency as Currency] || '🌍'}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-slate-300 truncate">{event.event_name}</p>
                      </div>
                      <TierBadge tier={event.tier} />
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>

          {/* RIGHT: Alerts */}
          <div className="space-y-4">
            <AlertsPanel alerts={recent_alerts} />

            {/* Quick nav cards */}
            <div className="grid grid-cols-2 gap-2">
              <QuickNavCard href="/currencies" icon={Globe} label="Currencies" sub="Scores & history" color="emerald" />
              <QuickNavCard href="/pairs" icon={TrendingUp} label="Pairs" sub="Bias & conviction" color="purple" />
              <QuickNavCard href="/calendar" icon={Calendar} label="Calendar" sub="Events & news" color="amber" />
              <QuickNavCard href="/markets" icon={Activity} label="Markets" sub="Regime & intermarket" color="sky" />
            </div>
          </div>

        </div>

        <footer className="text-center py-2 text-[9px] text-slate-800">
          FX Fundamental Analyzer — personal use — not financial advice
        </footer>
      </div>
    </PageShell>
  );
}

// ── HELPERS ──────────────────────────────────────────────────

function QuickNavCard({ href, icon: Icon, label, sub, color }: {
  href: string; icon: React.ElementType; label: string; sub: string;
  color: 'emerald' | 'purple' | 'amber' | 'sky';
}) {
  const cls = {
    emerald: 'border-emerald-500/15 hover:border-emerald-500/30 text-emerald-400',
    purple:  'border-purple-500/15  hover:border-purple-500/30  text-purple-400',
    amber:   'border-amber-500/15   hover:border-amber-500/30   text-amber-400',
    sky:     'border-sky-500/15     hover:border-sky-500/30     text-sky-400',
  }[color];

  return (
    <Link href={href} className={cn(
      'rounded-xl border p-3 bg-white/[0.02] hover:bg-white/[0.04] transition-all group block',
      cls
    )}>
      <Icon size={14} className="mb-2" />
      <p className="text-xs font-bold text-slate-200 group-hover:text-white transition-colors">{label}</p>
      <p className="text-[9px] text-slate-600 mt-0.5">{sub}</p>
    </Link>
  );
}

function LoadingScreen() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4">
      <div className="relative">
        <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
          <Activity size={22} className="text-emerald-400" />
        </div>
        <div className="absolute -inset-1 rounded-2xl border border-emerald-500/10 animate-ping" />
      </div>
      <div className="text-center">
        <p className="text-slate-200 font-semibold text-sm">Loading Analysis</p>
        <p className="text-slate-600 text-xs mt-1">Fetching fundamental data…</p>
      </div>
      <div className="flex gap-1.5">
        {[0, 1, 2].map(i => (
          <div key={i} className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-bounce"
            style={{ animationDelay: `${i * 150}ms` }} />
        ))}
      </div>
    </div>
  );
}

function ErrorScreen({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4">
      <AlertTriangle size={28} className="text-rose-400" />
      <div className="text-center">
        <p className="text-slate-200 font-semibold">Failed to load</p>
        <p className="text-slate-500 text-sm mt-1 max-w-xs">{error}</p>
        <p className="text-slate-700 text-xs mt-2">Check .env.local — Supabase credentials required</p>
      </div>
      <button onClick={onRetry}
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 text-sm hover:bg-slate-700 transition-colors">
        <RefreshCw size={12} /> Try again
      </button>
    </div>
  );
}
