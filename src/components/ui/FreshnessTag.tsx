'use client';

// ============================================================
// FreshnessTag — shows "Updated Xm ago" with color-coded staleness
// FeedStatus  — compact source health indicator
// ============================================================

import { cn } from '@/lib/utils';
import type { DataFreshness } from '@/hooks/useAnalysis';

interface FreshnessTagProps {
  computedAt?: string | null;
  freshness?: DataFreshness;
  className?: string;
  showDot?: boolean;
  compact?: boolean;
}

export function FreshnessTag({
  computedAt,
  freshness,
  className,
  showDot = true,
  compact = false,
}: FreshnessTagProps) {
  if (!computedAt) {
    return (
      <div className={cn('flex items-center gap-1', className)}>
        {showDot && <span className="w-1.5 h-1.5 rounded-full bg-slate-700 shrink-0" />}
        <span className="text-[9px] text-slate-700">No data</span>
      </div>
    );
  }

  const minutes = Math.floor((Date.now() - new Date(computedAt).getTime()) / 60_000);

  let label: string;
  let dotColor: string;
  let textColor: string;

  if (minutes < 2) {
    label = 'Just now'; dotColor = 'bg-emerald-400'; textColor = 'text-emerald-400';
  } else if (minutes < 38) {
    label = `${minutes}m ago`; dotColor = 'bg-emerald-500'; textColor = 'text-emerald-400/70';
  } else if (minutes < 65) {
    label = `${minutes}m ago`; dotColor = 'bg-amber-400'; textColor = 'text-amber-400/70';
  } else {
    const h = Math.floor(minutes / 60);
    label = h >= 2 ? `${h}h ago` : `${minutes}m ago`;
    dotColor = 'bg-rose-500'; textColor = 'text-rose-400/70';
  }

  const isStale = minutes >= 65;

  return (
    <div className={cn('flex items-center gap-1', className)}>
      {showDot && <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', dotColor)} />}
      {!compact && <span className={cn('text-[9px] font-medium', textColor)}>{label}</span>}
      {isStale && (
        <span className="text-[8px] font-bold text-rose-400 bg-rose-500/10 px-1 py-0.5 rounded border border-rose-500/20 leading-none">
          STALE
        </span>
      )}
      {freshness === 'aging' && !isStale && (
        <span className="text-[8px] font-bold text-amber-400 bg-amber-500/10 px-1 py-0.5 rounded border border-amber-500/20 leading-none">
          AGING
        </span>
      )}
    </div>
  );
}

// ── System-wide freshness banner ──────────────────────────────
interface FreshnessBannerProps {
  freshness: DataFreshness;
  ageMinutes: number | null;
  onRefresh?: () => void;
}

export function FreshnessBanner({ freshness, ageMinutes, onRefresh }: FreshnessBannerProps) {
  if (freshness === 'fresh' || freshness === 'unknown') return null;

  const isStale = freshness === 'stale';
  const msg = isStale
    ? `Analysis data is ${ageMinutes}m old — Railway worker may be offline`
    : `Analysis data is ${ageMinutes}m old — refreshing soon`;

  return (
    <div className={cn(
      'flex items-center justify-between px-4 py-2 rounded-xl text-[11px] font-medium mb-4',
      isStale
        ? 'bg-rose-500/8 border border-rose-500/20 text-rose-300'
        : 'bg-amber-500/8 border border-amber-500/20 text-amber-300'
    )}>
      <div className="flex items-center gap-2">
        <span className={cn('w-1.5 h-1.5 rounded-full', isStale ? 'bg-rose-400' : 'bg-amber-400')} />
        {msg}
      </div>
      {onRefresh && (
        <button
          onClick={onRefresh}
          className={cn(
            'text-[10px] font-bold px-2 py-0.5 rounded border transition-colors',
            isStale
              ? 'border-rose-500/30 hover:bg-rose-500/15 text-rose-300'
              : 'border-amber-500/30 hover:bg-amber-500/15 text-amber-300'
          )}
        >
          Refresh
        </button>
      )}
    </div>
  );
}
