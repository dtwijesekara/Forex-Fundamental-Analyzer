'use client';

// ============================================================
// CALENDAR PAGE  (/calendar)
// Upcoming events, recent releases, event risks + news feed
// ============================================================

import { PageShell } from '@/components/layout/PageShell';
import { EventPanel } from '@/components/dashboard/EventPanel';
import { NewsFeed } from '@/components/dashboard/NewsFeed';
import { useAnalysis } from '@/hooks/useAnalysis';
import { useFirstLoad } from '@/hooks/useFirstLoad';
import { LoadingScreen } from '@/components/layout/LoadingScreen';
import { RefreshCw, AlertTriangle, Zap } from 'lucide-react';

export default function CalendarPage() {
  const { data, loading, error, lastFetch, refreshing, isFastMode, refresh } = useAnalysis();
  const isFirstLoad = useFirstLoad(!loading && !!data);

  if (loading && !data) return <LoadingScreen />;
  if (error && !data) return <PageShell><ErrorState error={error} onRetry={refresh} /></PageShell>;

  const upcoming_events  = data?.upcoming_events  ?? [];
  const recent_releases  = data?.recent_releases  ?? [];
  const event_risks      = data?.event_risks       ?? [];

  return (
    <PageShell lastFetch={lastFetch} refreshing={refreshing} onRefresh={refresh}>
      <div className="animate-fadeInUp space-y-4">

        {/* Page header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-base font-bold gradient-text">Economic Calendar</h1>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {upcoming_events.filter(e => e.tier <= 2).length} high-impact events upcoming
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isFastMode && (
              <div className="flex items-center gap-1 text-[9px] text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded px-1.5 py-0.5">
                <Zap size={8} /> Fast mode
              </div>
            )}
            {refreshing && (
              <div className="flex items-center gap-1.5 text-[10px] text-emerald-400">
                <RefreshCw size={10} className="animate-spin" /> Updating…
              </div>
            )}
          </div>
        </div>

        {/* Two-column: events + news */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <EventPanel
            upcoming={upcoming_events}
            recent={recent_releases}
            risks={event_risks}
            onRefreshActuals={refresh}
            refreshing={refreshing}
            isFirstLoad={isFirstLoad}
          />
          <NewsFeed />
        </div>
      </div>
    </PageShell>
  );
}

function PageSkeleton() {
  return (
    <div className="space-y-4 animate-fadeInUp">
      <div className="skeleton h-8 w-52 rounded-lg" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="skeleton h-[600px] rounded-xl" />
        <div className="skeleton h-[600px] rounded-xl" />
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
