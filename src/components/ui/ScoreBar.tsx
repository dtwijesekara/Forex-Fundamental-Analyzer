// ============================================================
// SCORE BAR COMPONENT
// Visual bar showing a score from -100 to +100
// ============================================================

import { cn } from '@/lib/utils';
import { scoreToBarColor } from '@/lib/utils';

interface ScoreBarProps {
  score: number;        // -100 to +100
  maxScore?: number;    // defaults to 100
  height?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

export function ScoreBar({
  score,
  maxScore = 100,
  height = 'sm',
  showLabel = false,
  className,
}: ScoreBarProps) {
  const clamped = Math.max(-maxScore, Math.min(maxScore, score));
  const centerPct = 50;  // center of the bar

  // For positive scores: bar goes from center to right
  // For negative scores: bar goes from center to left
  const isPositive = clamped >= 0;
  const pct = (Math.abs(clamped) / maxScore) * 50; // half bar width

  const heightClass = height === 'sm' ? 'h-1.5' : height === 'md' ? 'h-2.5' : 'h-3.5';
  const barColor = scoreToBarColor(score);

  return (
    <div className={cn('w-full', className)}>
      {showLabel && (
        <div className="flex justify-between text-[10px] text-slate-500 mb-1">
          <span>-100</span>
          <span>0</span>
          <span>+100</span>
        </div>
      )}
      <div className={cn('relative w-full bg-slate-800 rounded-full overflow-hidden', heightClass)}>
        {/* Center line */}
        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-slate-600 z-10" />

        {/* Score bar */}
        {isPositive ? (
          <div
            className={cn('absolute top-0 bottom-0 rounded-full transition-all duration-500', barColor)}
            style={{
              left: `${centerPct}%`,
              width: `${pct}%`,
            }}
          />
        ) : (
          <div
            className={cn('absolute top-0 bottom-0 rounded-full transition-all duration-500', barColor)}
            style={{
              right: `${centerPct}%`,
              width: `${pct}%`,
            }}
          />
        )}
      </div>
    </div>
  );
}

// Conviction bar (0-100%)
interface ConvictionBarProps {
  pct: number;
  className?: string;
}

export function ConvictionBar({ pct, className }: ConvictionBarProps) {
  const barColor = pct >= 70 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-500' : 'bg-slate-500';

  return (
    <div className={cn('relative w-full h-1.5 bg-slate-800 rounded-full overflow-hidden', className)}>
      <div
        className={cn('h-full rounded-full transition-all duration-500', barColor)}
        style={{ width: `${Math.min(100, pct)}%` }}
      />
    </div>
  );
}
