'use client';

// ============================================================
// CENTRAL BANK PANEL
// Shows monetary policy stance for all 8 major central banks.
// Data comes from currencies[].cb_bias — no extra API call.
// ============================================================

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { cn } from '@/lib/utils';
import { CURRENCY_FLAGS } from '@/lib/constants';
import { TrendingUp, TrendingDown, Minus, Calendar } from 'lucide-react';
import type { CurrencyScore, Currency, CBBiasLabel, RateTrend } from '@/types';

interface CentralBankPanelProps {
  currencies: CurrencyScore[];
}

export function CentralBankPanel({ currencies }: CentralBankPanelProps) {
  // Only show currencies that have cb_bias data
  const sorted = [...currencies]
    .filter(c => c.cb_bias)
    .sort((a, b) => (b.cb_bias!.bias_score) - (a.cb_bias!.bias_score));

  if (sorted.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Central Banks</CardTitle>
        <span className="text-[10px] text-slate-600">Monetary policy stances</span>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-white/[0.04]">
          {sorted.map(c => (
            <CBRow key={c.currency} score={c} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ── SINGLE CB ROW ─────────────────────────────────────────────
function CBRow({ score }: { score: CurrencyScore }) {
  const cb = score.cb_bias!;

  const { color: biasColor, bg: biasBg } = getBiasStyle(cb.bias_label);
  const { icon: TrendIcon, color: trendColor, label: trendLabel } = getTrendStyle(cb.rate_trend);

  const nextMeeting = cb.next_meeting_date
    ? new Date(cb.next_meeting_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
    : null;

  return (
    <div className="px-4 py-3 hover:bg-white/[0.015] transition-colors">
      {/* Top row */}
      <div className="flex items-center gap-3">
        {/* Flag + currency */}
        <div className="flex items-center gap-1.5 shrink-0 w-16">
          <span className="text-base">{CURRENCY_FLAGS[score.currency as Currency] || '🌍'}</span>
          <span className="text-xs font-bold text-slate-100">{score.currency}</span>
        </div>

        {/* Bank name */}
        <div className="flex-1 min-w-0">
          <p className="text-[10px] text-slate-500 truncate">{cb.bank_name}</p>
        </div>

        {/* Rate trend indicator */}
        <div className={cn('flex items-center gap-1 shrink-0', trendColor)}>
          <TrendIcon size={10} />
          <span className="text-[9px] font-semibold uppercase">{trendLabel}</span>
        </div>

        {/* Current rate */}
        {cb.current_rate != null && (
          <div className="shrink-0 text-right">
            <span className="text-[10px] font-mono font-bold text-slate-200">
              {cb.current_rate.toFixed(2)}%
            </span>
          </div>
        )}

        {/* Bias badge */}
        <div className={cn(
          'shrink-0 text-[8px] font-bold px-2 py-0.5 rounded border leading-none whitespace-nowrap',
          biasBg, biasColor
        )}>
          {formatBiasLabel(cb.bias_label)}
        </div>
      </div>

      {/* Key phrase / next meeting */}
      <div className="flex items-center gap-3 mt-1 pl-[72px] flex-wrap">
        {cb.key_phrase && (
          <p className="text-[9px] text-slate-600 italic flex-1 min-w-0 truncate">
            "{cb.key_phrase}"
          </p>
        )}
        {nextMeeting && (
          <div className="flex items-center gap-1 shrink-0 text-[9px] text-slate-600">
            <Calendar size={8} />
            <span>Next: {nextMeeting}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── HELPERS ───────────────────────────────────────────────────
function getBiasStyle(label: CBBiasLabel): { color: string; bg: string } {
  if (label.includes('Hawkish')) return {
    color: 'text-emerald-300',
    bg: 'bg-emerald-500/12 border-emerald-500/25',
  };
  if (label.includes('Dovish')) return {
    color: 'text-rose-300',
    bg: 'bg-rose-500/12 border-rose-500/25',
  };
  return {
    color: 'text-slate-400',
    bg: 'bg-slate-700/30 border-slate-600/25',
  };
}

function getTrendStyle(trend: RateTrend): {
  icon: typeof TrendingUp;
  color: string;
  label: string;
} {
  switch (trend) {
    case 'hiking':  return { icon: TrendingUp,   color: 'text-emerald-400', label: 'Hiking'  };
    case 'cutting': return { icon: TrendingDown,  color: 'text-rose-400',    label: 'Cutting' };
    case 'holding': return { icon: Minus,         color: 'text-amber-400',   label: 'Holding' };
    default:        return { icon: Minus,         color: 'text-slate-500',   label: 'Unknown' };
  }
}

function formatBiasLabel(label: CBBiasLabel): string {
  // Shorten long labels: "Aggressive Hawkish" → "Agg. Hawkish"
  return label.replace('Aggressive ', 'Agg. ');
}
