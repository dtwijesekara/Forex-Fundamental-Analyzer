'use client';

// ============================================================
// MARKETS PAGE  (/markets)
// Market regime, intermarket data, alerts
// ============================================================

import { PageShell } from '@/components/layout/PageShell';
import { RegimeCard } from '@/components/dashboard/RegimeCard';
import { AlertsPanel } from '@/components/dashboard/AlertsPanel';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { useAnalysis } from '@/hooks/useAnalysis';
import { getRegimeColor, getRegimeBg, cn } from '@/lib/utils';
import { RefreshCw, AlertTriangle, TrendingUp, TrendingDown, Minus } from 'lucide-react';

export default function MarketsPage() {
  const { data, loading, error, lastFetch, refreshing, refresh } = useAnalysis();

  if (loading) return <PageShell><PageSkeleton /></PageShell>;
  if (error && !data) return <PageShell><ErrorState error={error} onRetry={refresh} /></PageShell>;

  const regime        = data?.regime       ?? null;
  const intermarket   = data?.intermarket  ?? {};
  const recent_alerts = data?.recent_alerts ?? [];

  return (
    <PageShell lastFetch={lastFetch} refreshing={refreshing} onRefresh={refresh}>
      <div className="animate-fadeInUp space-y-4">

        {/* Page header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-base font-bold gradient-text">Market Overview</h1>
            <p className="text-[11px] text-slate-500 mt-0.5">Regime detection, intermarket context, system alerts</p>
          </div>
          {refreshing && (
            <div className="flex items-center gap-1.5 text-[10px] text-emerald-400">
              <RefreshCw size={10} className="animate-spin" /> Updating…
            </div>
          )}
        </div>

        {/* Regime hero banner */}
        {regime && (
          <div className={cn(
            'rounded-xl border p-5 flex items-center justify-between',
            getRegimeBg(regime.regime)
          )}>
            <div>
              <p className="text-[10px] uppercase tracking-[0.12em] text-slate-500 font-bold mb-1">Current Regime</p>
              <p className={`text-2xl font-black ${getRegimeColor(regime.regime)}`}>{regime.regime}</p>
              <p className="text-xs text-slate-500 mt-1 max-w-md">{regime.explanation.split('\n')[0]}</p>
            </div>
            <div className="text-right shrink-0 ml-4">
              <div className="text-3xl font-black text-slate-200">{regime.confidence_pct}%</div>
              <div className="text-[10px] text-slate-500 font-semibold">confidence</div>
              {/* Confidence bar */}
              <div className="mt-2 w-24 h-1.5 bg-slate-800 rounded-full overflow-hidden ml-auto">
                <div
                  className={cn('h-full rounded-full', regime.confidence_pct >= 70 ? 'bg-emerald-500' : regime.confidence_pct >= 50 ? 'bg-amber-500' : 'bg-slate-500')}
                  style={{ width: `${regime.confidence_pct}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Two-column */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <RegimeCard regime={regime} intermarket={intermarket} />
          <div className="space-y-4">
            <AlertsPanel alerts={recent_alerts} />
            {/* Intermarket context legend */}
            <Card>
              <CardHeader>
                <CardTitle>Reading the Signals</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2.5 text-[11px]">
                {SIGNAL_HINTS.map(({ icon: Icon, label, color, hint }) => (
                  <div key={label} className="flex items-start gap-2.5">
                    <Icon size={12} className={cn('shrink-0 mt-0.5', color)} />
                    <div>
                      <span className="font-semibold text-slate-300">{label}: </span>
                      <span className="text-slate-500">{hint}</span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </PageShell>
  );
}

const SIGNAL_HINTS = [
  { icon: TrendingUp,   color: 'text-emerald-400', label: 'DXY rising',   hint: 'USD strength — watch USD/JPY, USD/CHF for trend trades.' },
  { icon: TrendingUp,   color: 'text-amber-400',   label: 'Gold rising',  hint: 'Risk-off or inflation concerns — JPY and CHF tend to strengthen.' },
  { icon: TrendingDown, color: 'text-red-400',      label: 'VIX spike',   hint: 'Risk-off spike — avoid commodity currencies (AUD, CAD, NZD).' },
  { icon: TrendingUp,   color: 'text-sky-400',      label: 'US 10Y rising', hint: 'Rate expectations up — bullish USD, bearish JPY carry.' },
  { icon: TrendingUp,   color: 'text-emerald-400',  label: 'S&P 500 up',  hint: 'Risk-on — AUD, NZD, CAD typically bid. JPY weaker.' },
  { icon: Minus,        color: 'text-slate-500',    label: 'Oil rising',  hint: 'CAD typically benefits. Watch energy-importing currencies (JPY).' },
];

function PageSkeleton() {
  return (
    <div className="space-y-4 animate-fadeInUp">
      <div className="skeleton h-8 w-44 rounded-lg" />
      <div className="skeleton h-28 rounded-xl" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="skeleton h-[500px] rounded-xl" />
        <div className="skeleton h-[500px] rounded-xl" />
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
