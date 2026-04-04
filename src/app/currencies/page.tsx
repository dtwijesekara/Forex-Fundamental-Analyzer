'use client';

// ============================================================
// CURRENCIES PAGE  (/currencies)
// Full currency strength rankings + score history chart
// ============================================================

import { PageShell } from '@/components/layout/PageShell';
import { CurrencyBoard } from '@/components/dashboard/CurrencyBoard';
import { ScoreHistoryChart } from '@/components/dashboard/ScoreHistoryChart';
import { Card, CardContent } from '@/components/ui/Card';
import { useAnalysis } from '@/hooks/useAnalysis';
import { Activity, RefreshCw, AlertTriangle } from 'lucide-react';

export default function CurrenciesPage() {
  const { data, loading, error, lastFetch, refreshing, refresh } = useAnalysis();

  if (loading) return <PageShell><PageSkeleton /></PageShell>;
  if (error && !data) return <PageShell><ErrorState error={error} onRetry={refresh} /></PageShell>;

  const currencies = data?.currencies ?? [];

  return (
    <PageShell lastFetch={lastFetch} refreshing={refreshing} onRefresh={refresh}>
      <div className="animate-fadeInUp space-y-4">

        {/* Page header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-base font-bold gradient-text">Currency Strength</h1>
            <p className="text-[11px] text-slate-500 mt-0.5">{currencies.length} currencies ranked by fundamental score</p>
          </div>
          {refreshing && (
            <div className="flex items-center gap-1.5 text-[10px] text-emerald-400">
              <RefreshCw size={10} className="animate-spin" /> Updating…
            </div>
          )}
        </div>

        {/* Two-column: board + history */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <div>
            {currencies.length > 0
              ? <CurrencyBoard scores={currencies} />
              : <EmptyState message="No currency data — run analysis first." />}
          </div>
          <div>
            <ScoreHistoryChart />
          </div>
        </div>
      </div>
    </PageShell>
  );
}

function PageSkeleton() {
  return (
    <div className="space-y-4 animate-fadeInUp">
      <div className="skeleton h-8 w-48 rounded-lg" />
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="skeleton h-[500px] rounded-xl" />
        <div className="skeleton h-[500px] rounded-xl" />
      </div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <Card>
      <CardContent>
        <div className="py-10 text-center">
          <Activity size={22} className="text-slate-700 mx-auto mb-3" />
          <p className="text-slate-500 text-sm">{message}</p>
        </div>
      </CardContent>
    </Card>
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
