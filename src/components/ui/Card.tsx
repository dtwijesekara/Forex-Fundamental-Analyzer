// ============================================================
// CARD COMPONENT — Premium glass-morphism style
// ============================================================

import { cn } from '@/lib/utils';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  glow?: 'bullish' | 'bearish' | 'warning' | 'none';
}

export function Card({ children, className, glow = 'none' }: CardProps) {
  const glowClass = {
    bullish: 'shadow-[0_0_24px_rgba(16,185,129,0.08)]  border-emerald-500/15',
    bearish: 'shadow-[0_0_24px_rgba(239,68,68,0.08)]   border-red-500/15',
    warning: 'shadow-[0_0_24px_rgba(245,158,11,0.08)]  border-amber-500/15',
    none:    'border-white/[0.06]',
  }[glow];

  return (
    <div className={cn(
      'rounded-xl border bg-[#13131d]/90 backdrop-blur-sm',
      'shadow-[0_2px_16px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.04)]',
      glowClass,
      className
    )}>
      {children}
    </div>
  );
}

export function CardHeader({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn(
      'flex items-center justify-between px-4 py-3',
      'border-b border-white/[0.05]',
      className
    )}>
      {children}
    </div>
  );
}

export function CardTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <h3 className={cn(
      'text-[11px] font-bold text-slate-300 tracking-[0.08em] uppercase',
      className
    )}>
      {children}
    </h3>
  );
}

export function CardContent({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('p-4', className)}>
      {children}
    </div>
  );
}
