'use client';

// ============================================================
// OVERVIEW PAGE  (/)
// Command center: hero intel bar + top opportunities + sessions
// ============================================================

import Link from 'next/link';
import { PageShell } from '@/components/layout/PageShell';
import { SessionTracker } from '@/components/dashboard/SessionTracker';
import { RegimeCard } from '@/components/dashboard/RegimeCard';
import { AlertsPanel } from '@/components/dashboard/AlertsPanel';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { PairBiasBadge, TierBadge } from '@/components/ui/Badge';
import { ConvictionBar } from '@/components/ui/ScoreBar';
import { FreshnessTag, FreshnessBanner } from '@/components/ui/FreshnessTag';
import { StateCard, SkeletonCard } from '@/components/ui/StateCard';
import { useAnalysis } from '@/hooks/useAnalysis';
import {
  getPairBiasColor, getRegimeColor, formatEventTime,
  minutesUntilEvent, formatMinutesAway, formatScore, cn,
} from '@/lib/utils';
import { CURRENCY_FLAGS } from '@/lib/constants';
import {
  AlertTriangle, Activity, RefreshCw, ArrowRight,
  TrendingUp, Globe, Calendar, Zap, Shield,
} from 'lucide-react';
import type { Currency } from '@/types';

export default function OverviewPage() {
  const {
    data, loading, error, refreshing,
    dataComputedAt, freshness, isStale, refresh,
  } = useAnalysis();

  // ── Loading skeleton ──────────────────────────────────────
  if (loading && !data) {
    return (
      <PageShell>
        <LoadingCommandCenter />
      </PageShell>
    );
  }

  // ── Fatal error (no previous data) ───────────────────────
  if (error && !data) {
    return (
      <PageShell>
        <StateCard
          type="error"
          title="Cannot load dashboard"
          message={error}
          onRetry={refresh}
          className="mt-8"
        />
      </PageShell>
    );
  }

  const {
    currencies      = [],
    pairs           = [],
    regime          = null,
    upcoming_events = [],
    event_risks     = [],
    recent_alerts   = [],
    intermarket     = {},
  } = data || {};

  const sorted        = [...currencies].sort((a, b) => b.score - a.score);
  const strongest     = sorted[0] ?? null;
  const weakest       = sorted[sorted.length - 1] ?? null;
  const top3strong    = sorted.slice(0, 3);
  const top3weak      = sorted.slice(-3).reverse();
  const topPairs      = [...pairs]
    .sort((a, b) => b.conviction_pct - a.conviction_pct)
    .slice(0, 5);
  const criticalRisks = event_risks.filter(r => r.severity === 'critical');
  const nextEvents    = upcoming_events.filter(e => e.tier <= 2).slice(0, 4);
  const bestPair      = topPairs[0] ?? null;
  const highConviction = topPairs.filter(p => p.conviction_pct >= 60).length;

  return (
    <PageShell>
      <div className="animate-fadeInUp space-y-4">

        {/* ── STALENESS BANNER ── */}
        <FreshnessBanner freshness={freshness} ageMinutes={
          dataComputedAt
            ? Math.floor((Date.now() - new Date(dataComputedAt).getTime()) / 60_000)
            : null
        } onRefresh={refresh} />

        {/* ── COMMAND CENTER HERO BAR ── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          <HeroCard
            label="Strongest"
            color="green"
            icon={<span className="text-xl">{strongest ? CURRENCY_FLAGS[strongest.currency as Currency] : '—'}</span>}
            value={strongest?.currency ?? '—'}
            sub={strongest ? formatScore(strongest.score) : 'No data'}
            href="/currencies"
          />
          <HeroCard
            label="Weakest"
            color="red"
            icon={<span className="text-xl">{weakest ? CURRENCY_FLAGS[weakest.currency as Currency] : '—'}</span>}
            value={weakest?.currency ?? '—'}
            sub={weakest ? formatScore(weakest.score) : 'No data'}
            href="/currencies"
          />
          <HeroCard
            label="Best Pair"
            color="purple"
            icon={<TrendingUp size={18} className="text-purple-400" />}
            value={bestPair?.pair ?? '—'}
            sub={bestPair ? `${bestPair.conviction_pct}% conviction` : 'No pairs'}
            href="/pairs"
          />
          <HeroCard
            label="Regime"
            color="sky"
            icon={<Activity size={18} className="text-sky-400" />}
            value={regime?.regime ?? '—'}
            sub={regime ? `${regime.confidence_pct}% conf.` : 'Not computed'}
            href="/markets"
          />
          <HeroCard
            label="Next Event"
            color="amber"
            icon={<Calendar size={18} className="text-amber-400" />}
            value={nextEvents[0]?.currency ?? '—'}
            sub={nextEvents[0]
              ? `${nextEvents[0].event_name.slice(0, 16)}… ${formatMinutesAway(minutesUntilEvent(nextEvents[0].event_time))}`
              : 'No events'}
            href="/calendar"
          />
          <HeroCard
            label="High Conv."
            color={highConviction >= 3 ? 'green' : 'slate'}
            icon={<Zap size={18} className={highConviction >= 3 ? 'text-emerald-400' : 'text-slate-500'} />}
            value={`${highConviction} pairs`}
            sub={`≥ 60% conviction`}
            href="/pairs"
          />
        </div>

        {/* ── CRITICAL RISK BANNERS ── */}
        {criticalRisks.length > 0 && (
          <div className="space-y-1.5">
            {criticalRisks.map((risk, i) => (
              <div key={i} className="flex items-start gap-3 px-4 py-2.5 rounded-xl bg-rose-500/8 border border-rose-500/25 text-rose-400">
                <AlertTriangle size={13} className="shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold">{risk.message}</p>
                  {risk.affected_pairs.length > 0 && (
                    <p className="text-[10px] opacity-60 mt-0.5">
                      Affects: {risk.affected_pairs.join(', ')}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── MAIN 3-COLUMN ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* LEFT: Sessions + Regime (compact) */}
          <div className="space-y-4">
            <SessionTracker />
            {/* Compact regime summary (no duplicate intermarket table) */}
            {regime ? (
              <Card>
                <CardHeader>
                  <CardTitle>Market Regime</CardTitle>
                  <FreshnessTag computedAt={regime.computed_at} freshness={freshness} />
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-lg font-black ${getRegimeColor(regime.regime)}`}>
                      {regime.regime}
                    </span>
                    <span className="text-2xl font-black text-slate-200">{regime.confidence_pct}%</span>
                  </div>
                  <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden mb-2">
                    <div
                      className={cn('h-full rounded-full transition-all', regime.confidence_pct >= 70 ? 'bg-emerald-500' : regime.confidence_pct >= 50 ? 'bg-amber-500' : 'bg-slate-500')}
                      style={{ width: `${regime.confidence_pct}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-slate-500 leading-relaxed">
                    {regime.explanation.split('\n')[0]}
                  </p>
                  <Link href="/markets" className="flex items-center gap-1 text-[10px] text-slate-600 hover:text-slate-400 mt-2 transition-colors">
                    Full market view <ArrowRight size={9} />
                  </Link>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader><CardTitle>Market Regime</CardTitle></CardHeader>
                <CardContent className="p-0">
                  <StateCard type="empty" compact
                    title="Regime not yet computed"
                    message="Run analysis to detect current market regime"
                  />
                </CardContent>
              </Card>
            )}
          </div>

          {/* CENTER: Top pair opportunities */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <TrendingUp size={12} className="text-slate-500" />
                  <CardTitle>Top Opportunities</CardTitle>
                </div>
                <div className="flex items-center gap-2">
                  <FreshnessTag computedAt={dataComputedAt} freshness={freshness} compact />
                  <Link href="/pairs" className="text-[10px] text-slate-500 hover:text-slate-300 flex items-center gap-1 transition-colors">
                    All <ArrowRight size={9} />
                  </Link>
                </div>
              </CardHeader>
              <div className="divide-y divide-white/[0.04]">
                {topPairs.length === 0 ? (
                  <StateCard type="empty" compact
                    title="No pair data yet"
                    message="Run analysis pipeline to compute pair bias"
                  />
                ) : topPairs.map(pair => (
                  <Link
                    key={pair.pair}
                    href={`/pair/${pair.pair}`}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.02] transition-colors group"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="font-mono font-bold text-sm text-slate-100 group-hover:text-emerald-300 transition-colors">
                          {pair.pair}
                        </span>
                        <PairBiasBadge bias={pair.bias} />
                        {pair.conflict_flag && <AlertTriangle size={10} className="text-amber-400" />}
                        {pair.event_risk_flag && (
                          <span className="text-[8px] text-sky-400 bg-sky-500/10 px-1 rounded border border-sky-500/20 font-bold">EVT</span>
                        )}
                      </div>
                      <ConvictionBar pct={pair.conviction_pct} />
                    </div>
                    <div className="text-right shrink-0">
                      <div className={`text-sm font-bold tabular ${getPairBiasColor(pair.bias)}`}>
                        {(pair.pair_score ?? 0) > 0 ? '+' : ''}{(pair.pair_score ?? 0).toFixed(0)}
                      </div>
                      <div className="text-[10px] text-slate-500">{pair.conviction_pct}%</div>
                    </div>
                    <ArrowRight size={11} className="text-slate-700 group-hover:text-slate-400 transition-colors shrink-0" />
                  </Link>
                ))}
              </div>
            </Card>

            {/* Currency strength snapshot */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Globe size={12} className="text-slate-500" />
                  <CardTitle>Currency Snapshot</CardTitle>
                </div>
                <Link href="/currencies" className="text-[10px] text-slate-500 hover:text-slate-300 flex items-center gap-1 transition-colors">
                  Full board <ArrowRight size={9} />
                </Link>
              </CardHeader>
              <CardContent className="p-3">
                {sorted.length === 0 ? (
                  <StateCard type="empty" compact message="No currency scores" />
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <MiniCurrencyGroup label="Strongest" currencies={top3strong} color="emerald" />
                    <MiniCurrencyGroup label="Weakest" currencies={top3weak} color="red" />
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* RIGHT: Alerts + next events */}
          <div className="space-y-4">
            {/* Next key events */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Calendar size={12} className="text-slate-500" />
                  <CardTitle>Next Events</CardTitle>
                </div>
                <Link href="/calendar" className="text-[10px] text-slate-500 hover:text-slate-300 flex items-center gap-1 transition-colors">
                  Calendar <ArrowRight size={9} />
                </Link>
              </CardHeader>
              <div className="divide-y divide-white/[0.04]">
                {nextEvents.length === 0 ? (
                  <StateCard type="empty" compact message="No high-impact events in 24h" />
                ) : nextEvents.map(event => {
                  const mins = minutesUntilEvent(event.event_time);
                  const critical = mins <= 30;
                  const soon = mins <= 120;
                  return (
                    <div key={event.id} className={cn(
                      'flex items-center gap-3 px-4 py-2.5',
                      critical && 'bg-rose-500/5',
                      soon && !critical && 'bg-amber-500/4',
                    )}>
                      <div className="shrink-0 text-right w-14">
                        <div className="text-xs font-mono text-slate-300">{formatEventTime(event.event_time)}</div>
                        <div className={cn('text-[9px] font-bold', critical ? 'text-rose-400' : soon ? 'text-amber-400' : 'text-slate-600')}>
                          {formatMinutesAway(mins)}
                        </div>
                      </div>
                      <span className="text-base shrink-0">{CURRENCY_FLAGS[event.currency as Currency] || '🌍'}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] text-slate-300 truncate">{event.event_name}</p>
                        {event.forecast && (
                          <p className="text-[9px] text-slate-600">F: {event.forecast}</p>
                        )}
                      </div>
                      <TierBadge tier={event.tier} />
                    </div>
                  );
                })}
              </div>
            </Card>

            {/* Alerts */}
            <AlertsPanel alerts={recent_alerts} />
          </div>

        </div>

        {/* ── QUICK NAV FOOTER ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
          <QuickNavCard href="/currencies" icon={Globe}    label="Currencies" sub="Scores & history"    color="emerald" />
          <QuickNavCard href="/pairs"      icon={TrendingUp} label="Pairs"     sub="Bias & conviction"  color="purple" />
          <QuickNavCard href="/calendar"   icon={Calendar} label="Calendar"   sub="Events & news"      color="amber" />
          <QuickNavCard href="/markets"    icon={Shield}   label="Markets"    sub="Regime & health"    color="sky" />
        </div>

        {/* ── refresh status ── */}
        {refreshing && (
          <div className="fixed bottom-4 right-4 flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-[11px] text-emerald-400 shadow-xl">
            <RefreshCw size={11} className="animate-spin" />
            Refreshing…
          </div>
        )}

        <footer className="text-center py-2 text-[9px] text-slate-800">
          FX Fundamental Analyzer — personal use — not financial advice
        </footer>
      </div>
    </PageShell>
  );
}

// ── HELPERS ──────────────────────────────────────────────────

function HeroCard({ label, value, sub, icon, color, href }: {
  label: string; value: string; sub: string;
  icon: React.ReactNode; color: string; href: string;
}) {
  const borderCls = {
    green:  'border-emerald-500/20 hover:border-emerald-500/35',
    red:    'border-red-500/20    hover:border-red-500/35',
    purple: 'border-purple-500/20 hover:border-purple-500/35',
    sky:    'border-sky-500/20    hover:border-sky-500/35',
    amber:  'border-amber-500/20  hover:border-amber-500/35',
    slate:  'border-white/[0.06]  hover:border-white/[0.1]',
  }[color] ?? 'border-white/[0.06]';

  return (
    <Link href={href} className={cn(
      'rounded-xl border p-3 bg-[#13131d]/90 hover:bg-[#16162a]/90 transition-all group block',
      borderCls,
    )}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-[9px] uppercase tracking-[0.1em] text-slate-600 font-bold">{label}</p>
        {icon}
      </div>
      <p className="text-sm font-black text-slate-100 group-hover:text-white transition-colors leading-none">
        {value}
      </p>
      <p className="text-[9px] text-slate-500 mt-1 truncate">{sub}</p>
    </Link>
  );
}

function MiniCurrencyGroup({ label, currencies, color }: {
  label: string;
  currencies: Array<{ currency: string; score: number }>;
  color: 'emerald' | 'red';
}) {
  return (
    <div>
      <p className={`text-[9px] uppercase tracking-[0.1em] font-bold mb-2 ${color === 'emerald' ? 'text-emerald-500/60' : 'text-red-500/60'}`}>
        {label}
      </p>
      <div className="space-y-1.5">
        {currencies.map((c, i) => (
          <div key={c.currency} className="flex items-center gap-2">
            <span className="text-[9px] font-bold text-slate-600 w-3">{i + 1}</span>
            <span className="text-sm">{CURRENCY_FLAGS[c.currency as Currency]}</span>
            <span className="text-xs font-bold text-slate-200">{c.currency}</span>
            <span className={`text-[10px] font-bold ml-auto tabular ${color === 'emerald' ? 'text-emerald-400' : 'text-red-400'}`}>
              {c.score > 0 ? '+' : ''}{c.score.toFixed(0)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

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

function LoadingCommandCenter() {
  return (
    <div className="animate-fadeInUp space-y-4">
      {/* Hero bar skeleton */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {[...Array(6)].map((_, i) => <SkeletonCard key={i} height="h-20" />)}
      </div>
      {/* Main grid skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="space-y-4">
          <SkeletonCard height="h-60" />
          <SkeletonCard height="h-40" />
        </div>
        <div className="space-y-4">
          <SkeletonCard height="h-72" />
          <SkeletonCard height="h-48" />
        </div>
        <div className="space-y-4">
          <SkeletonCard height="h-40" />
          <SkeletonCard height="h-60" />
        </div>
      </div>
    </div>
  );
}
