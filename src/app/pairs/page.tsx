'use client';

// ============================================================
// PAIRS PAGE  (/pairs)
// Smart-ranked pair list with filter bar and conviction tiers
// ============================================================

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { PageShell } from '@/components/layout/PageShell';
import { Card, CardContent } from '@/components/ui/Card';
import { PairBiasBadge } from '@/components/ui/Badge';
import { ConvictionBar } from '@/components/ui/ScoreBar';
import { StateCard } from '@/components/ui/StateCard';
import { FreshnessTag } from '@/components/ui/FreshnessTag';
import { useAnalysis } from '@/hooks/useAnalysis';
import { useFirstLoad } from '@/hooks/useFirstLoad';
import { LoadingScreen } from '@/components/layout/LoadingScreen';
import { getPairBiasColor, cn } from '@/lib/utils';
import {
  AlertTriangle, RefreshCw, ArrowRight, Activity,
  TrendingUp, TrendingDown, Zap, Calendar, Filter,
  ChevronDown,
} from 'lucide-react';
import type { PairBiasResult } from '@/types';

// ── Filter types ──────────────────────────────────────────────
type FilterKey = 'all' | 'bullish' | 'bearish' | 'neutral' | 'high_conviction' | 'event_risk' | 'conflict';
type SortKey = 'conviction' | 'score' | 'pair';

const FILTERS: { key: FilterKey; label: string; icon?: React.ElementType }[] = [
  { key: 'all',             label: 'All' },
  { key: 'bullish',         label: 'Bullish',         icon: TrendingUp },
  { key: 'bearish',         label: 'Bearish',         icon: TrendingDown },
  { key: 'neutral',         label: 'Neutral',         icon: Activity },
  { key: 'high_conviction', label: 'High Conviction', icon: Zap },
  { key: 'event_risk',      label: 'Event Risk',      icon: Calendar },
  { key: 'conflict',        label: 'Conflicted',      icon: AlertTriangle },
];

export default function PairsPage() {
  const { data, loading, error, dataComputedAt, freshness, refreshing, refresh } = useAnalysis();
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all');
  const [sortBy, setSortBy] = useState<SortKey>('conviction');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const isFirstLoad = useFirstLoad(!loading && !!data);

  const rawPairs = data?.pairs ?? [];

  // Sort first, then filter — hooks MUST be before any conditional return
  const sorted = useMemo(() => {
    return [...rawPairs].sort((a, b) => {
      if (sortBy === 'conviction') return b.conviction_pct - a.conviction_pct;
      if (sortBy === 'score')      return Math.abs(b.pair_score ?? 0) - Math.abs(a.pair_score ?? 0);
      return a.pair.localeCompare(b.pair);
    });
  }, [rawPairs, sortBy]);

  const filtered = useMemo(() => {
    switch (activeFilter) {
      case 'bullish':         return sorted.filter(p => p.bias === 'bullish');
      case 'bearish':         return sorted.filter(p => p.bias === 'bearish');
      case 'neutral':         return sorted.filter(p => p.bias === 'neutral');
      case 'high_conviction': return sorted.filter(p => p.conviction_pct >= 70);
      case 'event_risk':      return sorted.filter(p => p.event_risk_flag);
      case 'conflict':        return sorted.filter(p => p.conflict_flag);
      default:                return sorted;
    }
  }, [sorted, activeFilter]);

  if (loading && !data) return <LoadingScreen />;

  // Stats
  const bullishCount    = rawPairs.filter(p => p.bias === 'bullish').length;
  const bearishCount    = rawPairs.filter(p => p.bias === 'bearish').length;
  const neutralCount    = rawPairs.filter(p => p.bias === 'neutral').length;
  const highConvCount   = rawPairs.filter(p => p.conviction_pct >= 70).length;
  const eventRiskCount  = rawPairs.filter(p => p.event_risk_flag).length;

  // Split filtered into tiers
  const highConv  = filtered.filter(p => p.conviction_pct >= 70);
  const midConv   = filtered.filter(p => p.conviction_pct >= 40 && p.conviction_pct < 70);
  const lowConv   = filtered.filter(p => p.conviction_pct < 40);

  const SORT_LABELS: Record<SortKey, string> = {
    conviction: 'Conviction',
    score: 'Score',
    pair: 'Pair name',
  };

  return (
    <PageShell lastFetch={null} refreshing={refreshing} onRefresh={refresh}>
      <div className="animate-fadeInUp space-y-4">

        {/* Page header */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-base font-bold gradient-text">Pair Analysis</h1>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {rawPairs.length} pairs — click any for full drill-down
            </p>
          </div>
          <div className="flex items-center gap-2">
            <FreshnessTag computedAt={dataComputedAt} freshness={freshness} />
            {refreshing && (
              <div className="flex items-center gap-1.5 text-[10px] text-emerald-400">
                <RefreshCw size={10} className="animate-spin" /> Updating…
              </div>
            )}
          </div>
        </div>

        {/* Error banner (non-blocking) */}
        {error && data && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-rose-500/8 border border-rose-500/20 text-rose-300 text-[11px]">
            <AlertTriangle size={11} /> {error} — showing last known data
          </div>
        )}

        {/* Stat summary */}
        {rawPairs.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            <StatPill
              label="Bullish" value={bullishCount} color="emerald"
              icon={TrendingUp} active={activeFilter === 'bullish'}
              onClick={() => setActiveFilter(activeFilter === 'bullish' ? 'all' : 'bullish')}
            />
            <StatPill
              label="Bearish" value={bearishCount} color="rose"
              icon={TrendingDown} active={activeFilter === 'bearish'}
              onClick={() => setActiveFilter(activeFilter === 'bearish' ? 'all' : 'bearish')}
            />
            <StatPill
              label="Neutral" value={neutralCount} color="slate"
              icon={Activity} active={activeFilter === 'neutral'}
              onClick={() => setActiveFilter(activeFilter === 'neutral' ? 'all' : 'neutral')}
            />
            <StatPill
              label="High Conv." value={highConvCount} color="violet"
              icon={Zap} active={activeFilter === 'high_conviction'}
              onClick={() => setActiveFilter(activeFilter === 'high_conviction' ? 'all' : 'high_conviction')}
            />
            <StatPill
              label="Event Risk" value={eventRiskCount} color="sky"
              icon={Calendar} active={activeFilter === 'event_risk'}
              onClick={() => setActiveFilter(activeFilter === 'event_risk' ? 'all' : 'event_risk')}
            />
          </div>
        )}

        {/* Filter + sort bar */}
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-none pb-1">
          <Filter size={10} className="text-slate-600 shrink-0" />
          <div className="flex items-center gap-1 flex-1 min-w-0">
            {FILTERS.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setActiveFilter(key)}
                className={cn(
                  'flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-semibold whitespace-nowrap shrink-0 transition-all border',
                  activeFilter === key
                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25'
                    : 'text-slate-500 border-transparent hover:text-slate-300 hover:bg-white/[0.04]'
                )}
              >
                {Icon && <Icon size={9} />}
                {label}
              </button>
            ))}
          </div>

          {/* Sort dropdown */}
          <div className="relative shrink-0">
            <button
              onClick={() => setShowSortMenu(v => !v)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-semibold border border-slate-700/50 text-slate-400 hover:text-slate-200 hover:border-slate-600/60 transition-all bg-slate-800/40"
            >
              {SORT_LABELS[sortBy]} <ChevronDown size={9} />
            </button>
            {showSortMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowSortMenu(false)} />
                <div className="absolute right-0 top-full mt-1 z-20 bg-[#16162a] border border-white/[0.08] rounded-xl shadow-2xl py-1 min-w-[130px]">
                  {(Object.keys(SORT_LABELS) as SortKey[]).map(k => (
                    <button
                      key={k}
                      onClick={() => { setSortBy(k); setShowSortMenu(false); }}
                      className={cn(
                        'w-full text-left px-3 py-1.5 text-[11px] transition-colors',
                        sortBy === k
                          ? 'text-emerald-300 bg-emerald-500/10'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
                      )}
                    >
                      {SORT_LABELS[k]}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Pairs content */}
        {rawPairs.length === 0 ? (
          <Card>
            <CardContent className="p-0">
              <StateCard
                type="empty"
                title="No pair data yet"
                message="Run the analysis pipeline to compute pair biases"
                onRetry={refresh}
              />
            </CardContent>
          </Card>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="p-0">
              <StateCard
                type="empty"
                compact
                title={`No pairs match "${FILTERS.find(f => f.key === activeFilter)?.label}"`}
                message="Try a different filter"
                onRetry={() => setActiveFilter('all')}
              />
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-5">
            {/* High conviction tier */}
            {highConv.length > 0 && (
              <PairTier
                title="High Conviction"
                subtitle="≥70% — strongest fundamental alignment"
                accent="emerald"
                icon={<Zap size={11} className="text-emerald-400" />}
                pairs={highConv}
                isFirstLoad={isFirstLoad}
              />
            )}

            {/* Mid conviction tier */}
            {midConv.length > 0 && (
              <PairTier
                title="Moderate Conviction"
                subtitle="40–69% — directional bias present"
                accent="amber"
                icon={<TrendingUp size={11} className="text-amber-400" />}
                pairs={midConv}
                isFirstLoad={isFirstLoad}
              />
            )}

            {/* Low conviction tier */}
            {lowConv.length > 0 && (
              <PairTier
                title="Low Conviction"
                subtitle="<40% — conflicted or insufficient data"
                accent="slate"
                icon={<Activity size={11} className="text-slate-500" />}
                pairs={lowConv}
                isFirstLoad={isFirstLoad}
              />
            )}
          </div>
        )}
      </div>
    </PageShell>
  );
}

// ── PAIR TIER ─────────────────────────────────────────────────
function PairTier({
  title, subtitle, accent, icon, pairs, isFirstLoad,
}: {
  title: string;
  subtitle: string;
  accent: 'emerald' | 'amber' | 'slate';
  icon: React.ReactNode;
  pairs: PairBiasResult[];
  isFirstLoad?: boolean;
}) {
  const accentBorder = {
    emerald: 'border-emerald-500/20',
    amber:   'border-amber-500/20',
    slate:   'border-slate-700/40',
  }[accent];

  const accentText = {
    emerald: 'text-emerald-400',
    amber:   'text-amber-400',
    slate:   'text-slate-500',
  }[accent];

  return (
    <div>
      {/* Tier label */}
      <div className={cn('flex items-center gap-2 mb-2 pb-2 border-b', accentBorder)}>
        {icon}
        <span className={cn('text-[11px] font-bold uppercase tracking-wider', accentText)}>{title}</span>
        <span className="text-[10px] text-slate-700">{subtitle}</span>
        <span className={cn('ml-auto text-[10px] font-semibold tabular-nums', accentText)}>
          {pairs.length}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {pairs.map((pair, i) => (
          <PairCard key={pair.pair} pair={pair} className={isFirstLoad ? 'stagger-item' : ''} index={i} />
        ))}
      </div>
    </div>
  );
}

// ── PAIR CARD ─────────────────────────────────────────────────
function PairCard({ pair, className, index }: { pair: PairBiasResult; className?: string; index?: number }) {
  const biasColor = getPairBiasColor(pair.bias);
  const isHighConv = pair.conviction_pct >= 70;

  return (
    <Link
      href={`/pair/${pair.pair}`}
      className={cn('group block', className)}
      style={className?.includes('stagger-item') && index !== undefined
        ? { animationDelay: `${Math.min(index + 1, 10) * 40}ms` }
        : undefined}
    >
      <div className={cn(
        'rounded-xl border p-4 transition-all duration-200',
        'bg-[#13131d]/90 hover:bg-[#16162a]/90',
        'shadow-[0_2px_12px_rgba(0,0,0,0.3)]',
        pair.bias === 'bullish'
          ? 'border-emerald-500/15 hover:border-emerald-500/30 hover:shadow-[0_0_20px_rgba(16,185,129,0.08)]'
          : pair.bias === 'bearish'
          ? 'border-red-500/15 hover:border-red-500/30 hover:shadow-[0_0_20px_rgba(239,68,68,0.08)]'
          : 'border-white/[0.06] hover:border-white/[0.10]',
        pair.conflict_flag && 'border-l-[3px] border-l-amber-500/60',
      )}>

        {/* Header row */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono font-black text-sm text-slate-100 group-hover:text-white transition-colors">
              {pair.pair}
            </span>
            <PairBiasBadge bias={pair.bias} />
            {isHighConv && (
              <span className="text-[8px] font-bold text-violet-300 bg-violet-500/12 px-1.5 py-0.5 rounded border border-violet-500/20 leading-none flex items-center gap-0.5">
                <Zap size={7} /> HIGH
              </span>
            )}
            {pair.conflict_flag && (
              <span className="text-[8px] font-bold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20 leading-none flex items-center gap-0.5">
                <AlertTriangle size={7} /> CONFLICT
              </span>
            )}
            {pair.event_risk_flag && !pair.conflict_flag && (
              <span className="text-[8px] font-bold text-sky-400 bg-sky-500/10 px-1.5 py-0.5 rounded border border-sky-500/20 leading-none flex items-center gap-0.5">
                <Calendar size={7} /> EVENT
              </span>
            )}
          </div>
          <ArrowRight size={12} className="text-slate-700 group-hover:text-slate-400 transition-colors shrink-0" />
        </div>

        {/* Score + conviction */}
        <div className="flex items-end justify-between mb-2.5">
          <div>
            <span className={cn('text-xl font-black tabular-nums', biasColor)}>
              {(pair.pair_score ?? 0) > 0 ? '+' : ''}{(pair.pair_score ?? 0).toFixed(0)}
            </span>
            <span className="text-[10px] text-slate-600 ml-1">pts</span>
          </div>
          <div className="text-right">
            <div className={cn(
              'text-xs font-bold',
              pair.conviction_pct >= 70 ? 'text-emerald-300'
                : pair.conviction_pct >= 40 ? 'text-amber-300'
                : 'text-slate-400'
            )}>
              {pair.conviction_pct}%
            </div>
            <div className="text-[9px] text-slate-600">conviction</div>
          </div>
        </div>

        {/* Conviction bar */}
        <ConvictionBar pct={pair.conviction_pct} className="mb-3" />

        {/* Base vs Quote scores */}
        <div className="flex items-center gap-3 text-[10px]">
          <div className="flex items-center gap-1">
            <span className="text-slate-600 font-mono">{pair.base_currency}</span>
            <span className={cn(
              'font-bold',
              (pair.base_score ?? 0) > 0 ? 'text-emerald-400' : (pair.base_score ?? 0) < 0 ? 'text-red-400' : 'text-slate-500'
            )}>
              {(pair.base_score ?? 0) > 0 ? '+' : ''}{(pair.base_score ?? 0).toFixed(0)}
            </span>
          </div>
          <span className="text-slate-700">vs</span>
          <div className="flex items-center gap-1">
            <span className="text-slate-600 font-mono">{pair.quote_currency}</span>
            <span className={cn(
              'font-bold',
              (pair.quote_score ?? 0) > 0 ? 'text-emerald-400' : (pair.quote_score ?? 0) < 0 ? 'text-red-400' : 'text-slate-500'
            )}>
              {(pair.quote_score ?? 0) > 0 ? '+' : ''}{(pair.quote_score ?? 0).toFixed(0)}
            </span>
          </div>
          <div className="flex-1" />
          {/* Spread indicator */}
          <span className={cn(
            'text-[9px] font-mono font-bold px-1.5 py-0.5 rounded',
            Math.abs(pair.pair_score ?? 0) >= 60 ? 'text-emerald-300 bg-emerald-500/10'
              : Math.abs(pair.pair_score ?? 0) >= 30 ? 'text-amber-300 bg-amber-500/10'
              : 'text-slate-600 bg-slate-800/50'
          )}>
            Δ{Math.abs(pair.pair_score ?? 0).toFixed(0)}
          </span>
        </div>

        {/* Warning rows */}
        {pair.conflict_flag && pair.conflict_reason && (
          <div className="mt-2.5 flex items-start gap-1.5 text-[9px] text-amber-400/80 bg-amber-500/5 border border-amber-500/15 rounded-lg px-2 py-1.5">
            <AlertTriangle size={8} className="mt-0.5 shrink-0" />
            <span className="leading-relaxed">{pair.conflict_reason}</span>
          </div>
        )}
        {pair.event_risk_flag && pair.event_risk_detail && (
          <div className="mt-2 flex items-start gap-1.5 text-[9px] text-sky-400/80 bg-sky-500/5 border border-sky-500/15 rounded-lg px-2 py-1.5">
            <Calendar size={8} className="mt-0.5 shrink-0" />
            <span className="leading-relaxed">{pair.event_risk_detail}</span>
          </div>
        )}
      </div>
    </Link>
  );
}

// ── STAT PILL ─────────────────────────────────────────────────
function StatPill({
  label, value, color, icon: Icon, active, onClick,
}: {
  label: string;
  value: number;
  color: 'emerald' | 'rose' | 'slate' | 'violet' | 'sky';
  icon: React.ElementType;
  active: boolean;
  onClick: () => void;
}) {
  const colors = {
    emerald: {
      active:   'bg-emerald-500/15 border-emerald-500/30 text-emerald-300',
      inactive: 'bg-white/[0.02] border-white/[0.06] text-slate-400 hover:border-emerald-500/20 hover:text-emerald-400',
      icon:     'text-emerald-400',
      val:      'text-emerald-200',
    },
    rose: {
      active:   'bg-rose-500/15 border-rose-500/30 text-rose-300',
      inactive: 'bg-white/[0.02] border-white/[0.06] text-slate-400 hover:border-rose-500/20 hover:text-rose-400',
      icon:     'text-rose-400',
      val:      'text-rose-200',
    },
    slate: {
      active:   'bg-slate-700/40 border-slate-600/50 text-slate-300',
      inactive: 'bg-white/[0.02] border-white/[0.06] text-slate-500 hover:border-slate-600/40',
      icon:     'text-slate-500',
      val:      'text-slate-300',
    },
    violet: {
      active:   'bg-violet-500/15 border-violet-500/30 text-violet-300',
      inactive: 'bg-white/[0.02] border-white/[0.06] text-slate-400 hover:border-violet-500/20 hover:text-violet-400',
      icon:     'text-violet-400',
      val:      'text-violet-200',
    },
    sky: {
      active:   'bg-sky-500/15 border-sky-500/30 text-sky-300',
      inactive: 'bg-white/[0.02] border-white/[0.06] text-slate-400 hover:border-sky-500/20 hover:text-sky-400',
      icon:     'text-sky-400',
      val:      'text-sky-200',
    },
  }[color];

  return (
    <button
      onClick={onClick}
      className={cn(
        'rounded-xl border p-3 text-center transition-all duration-200 cursor-pointer w-full',
        active ? colors.active : colors.inactive
      )}
    >
      <Icon size={14} className={cn('mx-auto mb-1', active ? '' : colors.icon)} />
      <div className={cn('text-lg font-black tabular-nums leading-none', active ? '' : colors.val)}>{value}</div>
      <div className="text-[9px] font-semibold uppercase tracking-wider mt-0.5 opacity-70">{label}</div>
    </button>
  );
}

// ── SKELETON ──────────────────────────────────────────────────
function PageSkeleton() {
  return (
    <div className="space-y-4 animate-fadeInUp">
      <div className="skeleton h-8 w-40 rounded-lg" />
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {[0,1,2,3,4].map(i => <div key={i} className="skeleton h-20 rounded-xl" />)}
      </div>
      <div className="skeleton h-9 w-full rounded-xl" />
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {[...Array(6)].map((_, i) => <div key={i} className="skeleton h-44 rounded-xl" />)}
      </div>
    </div>
  );
}
