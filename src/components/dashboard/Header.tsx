'use client';

// ============================================================
// DASHBOARD HEADER
// Shows app title, last updated time, and refresh button
// ============================================================

import { useState } from 'react';
import { RefreshCw, Activity, Clock } from 'lucide-react';
import { formatTimeAgo, cn } from '@/lib/utils';

interface HeaderProps {
  lastUpdated: string | null;
  onRefresh: () => Promise<void>;
}

export function Header({ lastUpdated, onRefresh }: HeaderProps) {
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <header className="border-b border-slate-700/50 bg-slate-900/95 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-screen-2xl mx-auto px-4 py-3 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
              <Activity size={14} className="text-emerald-400" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-slate-100 leading-none">Forex Fundamental</h1>
              <p className="text-[10px] text-slate-500 leading-none mt-0.5">Analyzer v1</p>
            </div>
          </div>

          {/* Status pill */}
          <div className="hidden sm:flex items-center gap-1.5 px-2 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[10px] text-emerald-400 font-medium">Live</span>
          </div>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-3">
          {/* Last updated */}
          {lastUpdated && (
            <div className="hidden sm:flex items-center gap-1.5 text-[10px] text-slate-500">
              <Clock size={10} />
              <span>Updated {formatTimeAgo(lastUpdated)}</span>
            </div>
          )}

          {/* Refresh button */}
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium',
              'border border-slate-600/50 bg-slate-800/50 text-slate-300',
              'hover:bg-slate-700/50 hover:border-slate-500/50 hover:text-slate-100',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              'transition-all duration-150'
            )}
          >
            <RefreshCw size={11} className={cn(refreshing && 'animate-spin')} />
            <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>
        </div>
      </div>
    </header>
  );
}
