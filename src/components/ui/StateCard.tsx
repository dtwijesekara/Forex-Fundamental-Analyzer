'use client';

// ============================================================
// StateCard — universal empty / error / loading / stale state
// Every panel uses this instead of raw "No data" text
// ============================================================

import { cn } from '@/lib/utils';
import {
  Activity, AlertTriangle, RefreshCw, Database,
  Clock, WifiOff,
} from 'lucide-react';

export type StateType = 'loading' | 'empty' | 'error' | 'stale' | 'offline';

interface StateCardProps {
  type: StateType;
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
  compact?: boolean;
}

const CONFIGS: Record<StateType, {
  icon: React.ElementType;
  iconColor: string;
  bgClass: string;
  defaultTitle: string;
  defaultMsg: string;
}> = {
  loading: {
    icon: Activity,
    iconColor: 'text-slate-600',
    bgClass: '',
    defaultTitle: 'Loading...',
    defaultMsg: 'Fetching data from Supabase',
  },
  empty: {
    icon: Database,
    iconColor: 'text-slate-700',
    bgClass: '',
    defaultTitle: 'No data yet',
    defaultMsg: 'Run the analysis pipeline to populate this section',
  },
  error: {
    icon: AlertTriangle,
    iconColor: 'text-rose-400',
    bgClass: 'bg-rose-500/5 border border-rose-500/15 rounded-xl',
    defaultTitle: 'Failed to load',
    defaultMsg: 'Check Supabase connection and environment variables',
  },
  stale: {
    icon: Clock,
    iconColor: 'text-amber-400',
    bgClass: 'bg-amber-500/5 border border-amber-500/15 rounded-xl',
    defaultTitle: 'Data may be outdated',
    defaultMsg: 'Analysis pipeline may not be running — showing last known state',
  },
  offline: {
    icon: WifiOff,
    iconColor: 'text-slate-500',
    bgClass: 'bg-slate-800/30 border border-slate-700/40 rounded-xl',
    defaultTitle: 'Feed offline',
    defaultMsg: 'Could not reach data source — will retry automatically',
  },
};

export function StateCard({
  type,
  title,
  message,
  onRetry,
  className,
  compact = false,
}: StateCardProps) {
  const { icon: Icon, iconColor, bgClass, defaultTitle, defaultMsg } = CONFIGS[type];
  const py = compact ? 'py-5' : 'py-10';

  return (
    <div className={cn('flex flex-col items-center justify-center text-center px-4', py, bgClass, className)}>
      <Icon
        size={compact ? 18 : 24}
        className={cn(iconColor, 'mb-2.5', type === 'loading' && 'animate-pulse')}
      />
      <p className={cn(
        'font-semibold',
        compact ? 'text-xs' : 'text-sm',
        type === 'error' ? 'text-rose-300'
          : type === 'stale' ? 'text-amber-300'
          : type === 'offline' ? 'text-slate-400'
          : 'text-slate-500',
      )}>
        {title || defaultTitle}
      </p>
      {(message || defaultMsg) && (
        <p className="text-[10px] text-slate-700 mt-1 max-w-xs leading-relaxed">
          {message || defaultMsg}
        </p>
      )}
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700/60 text-slate-300 text-[11px] font-medium hover:bg-slate-700 transition-colors"
        >
          <RefreshCw size={10} /> Try again
        </button>
      )}
    </div>
  );
}

// ── Loading skeletons ──────────────────────────────────────
export function SkeletonRows({ rows = 4, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn('space-y-3 p-4', className)}>
      {[...Array(rows)].map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="skeleton w-8 h-8 rounded-full shrink-0" />
          <div className="flex-1 space-y-1.5">
            <div className="skeleton h-3 rounded w-3/4" />
            <div className="skeleton h-2 rounded w-1/2" />
          </div>
          <div className="skeleton h-4 w-12 rounded" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonCard({ height = 'h-40', className }: { height?: string; className?: string }) {
  return <div className={cn('skeleton rounded-xl', height, className)} />;
}
