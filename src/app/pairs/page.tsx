'use client';

// ============================================================
// PAIRS PAGE  (/pairs)
// All 10 priority pairs with bias, conviction, drill-down links
// ============================================================

import Link from 'next/link';
import { PageShell } from '@/components/layout/PageShell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { PairBiasBadge } from '@/components/ui/Badge';
import { ConvictionBar } from '@/components/ui/ScoreBar';
import { useAnalysis } from '@/hooks/useAnalysis';
import { getPairBiasColor, cn } from '@/lib/utils';
import { AlertTriangle, RefreshCw, ArrowRight, Activity, TrendingUp, TrendingDown } from 'lucide-react';
import type { PairBiasResult } from '@/types';

export default function PairsPage() {
  const { data, loading, error, lastFetch, refreshing, refresh } = useAnalysis();

  if (loading) return <PageShell><PageSkeleton /></PageShell>;
  if (error && !data) return <PageShell><ErrorState error={error} onRetry={refresh} /></PageShell>;

  const pairs = [...(data?.pairs ?? [])].sort((a, b) => b.conviction_pct - a.conviction_pct);

  const bullish = pairs.filter(p => p.bias === 'bullish');
  const bearish = pairs.filter(p => p.bias === 'bearish');
  const neutral = pairs.filter(p => p.bias === 'neutral');

  return (
    <PageShell lastFetch={lastFetch} refreshing={refreshing} onRefresh={refresh}>
      <div className="animate-fadeInUp space-y-4">

        {/* Page header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-base font-bold gradient-text">Pair Analysis</h1>
            <p className="text-[11px] text-slate-500 mt-0.5">{pairs.length} pairs — click any for full drill-down</p>
          </div>
          {refreshing && (
            <div className="flex items-center gap-1.5 text-[10px] text-emerald-400">
              <RefreshCw size={10} className="animate-spin" /> Updating…
            </div>
          )}
        </div>

        {/* Summary row */}
        {pairs.length > 0 && (
          <div className="grid grid-cols-3 gap-3">
            <div className="stat-card-green rounded-xl p-3 text-center">
              <TrendingUp size={16} className="text-emerald-400 mx-auto mb-1" />
              <div className="text-lg font-black text-emerald-300">{bullish.length}</div>
              <div className="text-[10px] text-emerald-400/60 font-semibold uppercase tracking-wider">Bullish</div>
            </div>
            <div className="stat-card-red rounded-xl p-3 text-center">
              <TrendingDown size={16} className="text-red-400 mx-auto mb-1" />
              <div className="text-lg font-black text-red-300">{bearish.length}</div>
              <div className="text-[10px] text-red-400/60 font-semibold uppercase tracking-wider">Bearish</div>
            </div>
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-center">
              <Activity size={16} className="text-slate-500 mx-auto mb-1" />
              <div className="text-lg font-black text-slate-400">{neutral.length}</div>
              <div className="text-[10px] text-slate-600 font-semibold uppercase tracking-wider">Neutral</div>
            </div>
          </div>
        )}

        {/* Pairs grid */}
        {pairs.length === 0 ? (
          <Card>
            <CardContent>
              <div className="py-10 text-center">
                <Activity size={22} className="text-slate-700 mx-auto mb-3" />
                <p className="text-slate-500 text-sm">No pair data — run analysis first.</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {pairs.map(pair => <PairCard key={pair.pair} pair={pair} />)}
          </div>
        )}
      </div>
    </PageShell>
  );
}

// ── PAIR CARD ─────────────────────────────────────────────────
function PairCard({ pair }: { pair: PairBiasResult }) {
  const biasColor = getPairBiasColor(pair.bias);

  return (
    <Link href={`/pair/${pair.pair}`} className="group block">
      <div className={cn(
        'rounded-xl border p-4 transition-all duration-200',
        'bg-[#13131d]/90 hover:bg-[#16162a]/90',
        'shadow-[0_2px_12px_rgba(0,0,0,0.3)]',
        pair.bias === 'bullish'
          ? 'border-emerald-500/15 hover:border-emerald-500/30 hover:shadow-[0_0_20px_rgba(16,185,129,0.08)]'
          : pair.bias === 'bearish'
          ? 'border-red-500/15 hover:border-red-500/30 hover:shadow-[0_0_20px_rgba(239,68,68,0.08)]'
          : 'border-white/[0.06] hover:border-white/[0.12]',
        pair.conflict_flag && 'border-l-2 border-l-amber-500/50',
      )}>
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="font-mono font-black text-sm text-slate-100 group-hover:text-white transition-colors">
              {pair.pair}
            </span>
            <PairBiasBadge bias={pair.bias} />
            {pair.conflict_flag && <AlertTriangle size={11} className="text-amber-400" />}
            {pair.event_risk_flag && !pair.conflict_flag && (
              <span className="text-[8px] text-sky-400 bg-sky-500/10 px-1.5 py-0.5 rounded border border-sky-500/20 font-bold">
                EVENT
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 text-slate-600 group-hover:text-slate-400 transition-colors">
            <ArrowRight size={12} />
          </div>
        </div>

        {/* Score */}
        <div className="flex items-end justify-between mb-3">
          <div>
            <span className={`text-xl font-black tabular ${biasColor}`}>
              {pair.pair_score > 0 ? '+' : ''}{pair.pair_score.toFixed(0)}
            </span>
            <span className="text-[10px] text-slate-600 ml-1">pts</span>
          </div>
          <div className="text-right">
            <div className="text-xs font-bold text-slate-200">{pair.conviction_pct}%</div>
            <div className="text-[9px] text-slate-600">conviction</div>
          </div>
        </div>

        {/* Conviction bar */}
        <ConvictionBar pct={pair.conviction_pct} className="mb-3" />

        {/* Base vs Quote */}
        <div className="flex gap-3 text-[10px]">
          <div className="flex items-center gap-1">
            <span className="text-slate-600">{pair.base_currency}</span>
            <span className={pair.base_score > 0 ? 'text-emerald-400' : pair.base_score < 0 ? 'text-red-400' : 'text-slate-500'}>
              {pair.base_score > 0 ? '+' : ''}{pair.base_score.toFixed(0)}
            </span>
          </div>
          <span className="text-slate-700">vs</span>
          <div className="flex items-center gap-1">
            <span className="text-slate-600">{pair.quote_currency}</span>
            <span className={pair.quote_score > 0 ? 'text-emerald-400' : pair.quote_score < 0 ? 'text-red-400' : 'text-slate-500'}>
              {pair.quote_score > 0 ? '+' : ''}{pair.quote_score.toFixed(0)}
            </span>
          </div>
        </div>

        {/* Conflict reason */}
        {pair.conflict_flag && pair.conflict_reason && (
          <p className="text-[9px] text-amber-400/70 mt-2 flex items-center gap-1">
            <AlertTriangle size={8} /> {pair.conflict_reason}
          </p>
        )}
      </div>
    </Link>
  );
}

function PageSkeleton() {
  return (
    <div className="space-y-4 animate-fadeInUp">
      <div className="skeleton h-8 w-40 rounded-lg" />
      <div className="grid grid-cols-3 gap-3">
        {[0,1,2].map(i => <div key={i} className="skeleton h-20 rounded-xl" />)}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {[...Array(6)].map((_, i) => <div key={i} className="skeleton h-40 rounded-xl" />)}
      </div>
    </div>
  );
}

function ErrorState({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <AlertTriangle size={24} className="text-rose-400" />
      <p className="text-slate-400 text-sm">{error}</p>
      <button onClick={onRetry} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 text-xs hover:bg-slate-700 transition-colors">
        <RefreshCw size={11} /> Retry
      </button>
    </div>
  );
}
