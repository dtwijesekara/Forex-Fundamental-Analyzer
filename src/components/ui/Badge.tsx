// ============================================================
// BADGE COMPONENT
// ============================================================

import { cn } from '@/lib/utils';

interface BadgeProps {
  children: React.ReactNode;
  className?: string;
  variant?: 'default' | 'bullish' | 'bearish' | 'neutral' | 'warning' | 'critical' | 'info';
}

export function Badge({ children, className, variant = 'default' }: BadgeProps) {
  const variantClasses = {
    default: 'bg-slate-700/50 text-slate-300 border-slate-600/50',
    bullish: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    bearish: 'bg-red-500/20 text-red-400 border-red-500/30',
    neutral: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
    warning: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    critical: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
    info: 'bg-sky-500/20 text-sky-400 border-sky-500/30',
  };

  return (
    <span className={cn(
      'inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border',
      variantClasses[variant],
      className
    )}>
      {children}
    </span>
  );
}

// Bias badge
import type { BiasLabel, PairBiasDirection, CBBiasLabel } from '@/types';

export function BiasBadge({ label }: { label: BiasLabel }) {
  const variant = label.includes('Bullish') ? 'bullish' : label.includes('Bearish') ? 'bearish' : 'neutral';
  return <Badge variant={variant}>{label}</Badge>;
}

export function PairBiasBadge({ bias }: { bias: PairBiasDirection }) {
  const variant = bias === 'bullish' ? 'bullish' : bias === 'bearish' ? 'bearish' : 'neutral';
  const label = bias === 'bullish' ? 'Bullish' : bias === 'bearish' ? 'Bearish' : 'Neutral';
  return <Badge variant={variant}>{label}</Badge>;
}

export function CBBadge({ label }: { label: CBBiasLabel }) {
  const variant = label.includes('Hawkish') ? 'bullish' : label.includes('Dovish') ? 'bearish' : 'neutral';
  return <Badge variant={variant} className="text-[10px]">{label}</Badge>;
}

export function TierBadge({ tier }: { tier: number }) {
  const variant = tier === 1 ? 'critical' : tier === 2 ? 'warning' : 'neutral';
  const label = `T${tier}`;
  return <Badge variant={variant} className="text-[10px] font-bold">{label}</Badge>;
}
