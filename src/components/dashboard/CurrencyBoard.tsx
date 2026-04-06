'use client';

// ============================================================
// CURRENCY BOARD COMPONENT
// Shows all 8 currencies ranked by fundamental strength
// Click any row to expand full score breakdown
// ============================================================

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { BiasBadge, CBBadge } from '@/components/ui/Badge';
import { ScoreBar } from '@/components/ui/ScoreBar';
import { getBiasColor, getCBBiasColor, formatScore, cn } from '@/lib/utils';
import { CURRENCY_FLAGS } from '@/lib/constants';
import { ChevronDown, Info } from 'lucide-react';
import type { CurrencyScore, Currency } from '@/types';

interface CurrencyBoardProps {
  scores: CurrencyScore[];
}

export function CurrencyBoard({ scores }: CurrencyBoardProps) {
  const [expandedCurrency, setExpandedCurrency] = useState<string | null>(null);
  const sorted = [...scores].sort((a, b) => b.score - a.score);
  const strongest = sorted.slice(0, 3);
  const weakest   = sorted.slice(-3).reverse();

  const toggle = (currency: string) =>
    setExpandedCurrency(prev => prev === currency ? null : currency);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Currency Strength</CardTitle>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-slate-500">{scores.length} currencies ranked</span>
          <span className="text-[9px] text-slate-700 flex items-center gap-0.5">
            <Info size={8} /> tap to expand
          </span>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {/* Summary row */}
        <div className="grid grid-cols-2 gap-px bg-slate-700/30 border-b border-white/[0.05]">
          <div className="bg-[#0e0e18]/80 p-3">
            <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Strongest</p>
            <div className="flex gap-3">
              {strongest.map((s, i) => (
                <div key={s.currency} className="text-center">
                  <div className="text-lg">{CURRENCY_FLAGS[s.currency as Currency]}</div>
                  <div className={cn(
                    'text-xs font-bold',
                    i === 0 ? 'text-emerald-300' : 'text-emerald-400/70'
                  )}>{s.currency}</div>
                  <div className="text-[10px] text-slate-400">{formatScore(s.score)}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-[#0e0e18]/80 p-3">
            <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Weakest</p>
            <div className="flex gap-3">
              {weakest.map((s, i) => (
                <div key={s.currency} className="text-center">
                  <div className="text-lg">{CURRENCY_FLAGS[s.currency as Currency]}</div>
                  <div className={cn(
                    'text-xs font-bold',
                    i === 0 ? 'text-red-300' : 'text-red-400/70'
                  )}>{s.currency}</div>
                  <div className="text-[10px] text-slate-400">{formatScore(s.score)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Full ranked list */}
        <div className="divide-y divide-white/[0.04]">
          {sorted.map((score, idx) => (
            <CurrencyRow
              key={score.currency}
              score={score}
              rank={idx + 1}
              expanded={expandedCurrency === score.currency}
              onToggle={() => toggle(score.currency)}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ── CURRENCY ROW ──────────────────────────────────────────────
function CurrencyRow({
  score, rank, expanded, onToggle,
}: {
  score: CurrencyScore;
  rank: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  const isTop    = rank <= 3;
  const isBottom = rank >= 6;

  return (
    <div>
      {/* Main row — clickable */}
      <button
        className="w-full text-left px-4 py-3 hover:bg-white/[0.02] transition-colors group"
        onClick={onToggle}
      >
        <div className="flex items-center gap-3">
          {/* Rank */}
          <span className={cn(
            'text-xs font-bold w-4 text-right shrink-0',
            isTop ? 'text-emerald-500' : isBottom ? 'text-red-500' : 'text-slate-600'
          )}>
            {rank}
          </span>

          {/* Flag + Currency */}
          <div className="flex items-center gap-1.5 w-14 shrink-0">
            <span className="text-base">{CURRENCY_FLAGS[score.currency as Currency]}</span>
            <span className="text-sm font-bold text-slate-100">{score.currency}</span>
          </div>

          {/* Score bar */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <span className={cn('text-xs font-bold', getBiasColor(score.bias_label))}>
                {formatScore(score.score)}
              </span>
              <BiasBadge label={score.bias_label} />
            </div>
            <ScoreBar score={score.score} />
          </div>

          {/* Expand chevron */}
          <ChevronDown
            size={12}
            className={cn(
              'text-slate-600 group-hover:text-slate-400 transition-all shrink-0',
              expanded && 'rotate-180 text-slate-400'
            )}
          />
        </div>

        {/* Component mini-scores */}
        <div className="mt-2 pl-7 flex gap-3 flex-wrap">
          {score.cb_bias && <CBBadge label={score.cb_bias.bias_label} />}
          <MiniScore label="Eco"  value={score.score_economic}     max={30} />
          <MiniScore label="CB"   value={score.score_cb}           max={25} />
          <MiniScore label="Rate" value={score.score_rate}         max={20} />
          <MiniScore label="Mkt"  value={score.score_intermarket}  max={15} />
          {score.score_sentiment !== 0 && (
            <MiniScore label="Sent" value={score.score_sentiment}  max={10} />
          )}
          {score.event_risk_penalty !== 0 && (
            <MiniScore label="Risk" value={score.event_risk_penalty} max={20} />
          )}
        </div>
      </button>

      {/* Expanded breakdown panel */}
      {expanded && (
        <div className="px-4 pb-4 bg-[#0c0c18]/60 border-t border-white/[0.04]">
          {/* Score breakdown bars */}
          <div className="pt-3 space-y-2.5">
            <p className="text-[9px] text-slate-600 uppercase tracking-wider font-semibold mb-3">
              Score Breakdown
            </p>

            <BreakdownBar label="Economic"    value={score.score_economic}    range={30}  />
            <BreakdownBar label="Central Bank" value={score.score_cb}         range={25}  />
            <BreakdownBar label="Rate Outlook" value={score.score_rate}       range={20}  />
            <BreakdownBar label="Intermarket"  value={score.score_intermarket} range={15} />
            <BreakdownBar label="Sentiment"    value={score.score_sentiment}  range={10}  />
            {score.event_risk_penalty !== 0 && (
              <BreakdownBar label="Event Risk" value={score.event_risk_penalty} range={20} isNegativeOnly />
            )}

            {/* Total */}
            <div className="flex items-center justify-between pt-2 border-t border-white/[0.06]">
              <span className="text-[10px] font-bold text-slate-300">Total Score</span>
              <span className={cn(
                'text-sm font-black tabular-nums',
                getBiasColor(score.bias_label)
              )}>
                {score.score > 0 ? '+' : ''}{score.score.toFixed(0)}
              </span>
            </div>
          </div>

          {/* CB details */}
          {score.cb_bias && (
            <div className="mt-3 p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.04] space-y-1">
              <p className="text-[9px] text-slate-600 uppercase tracking-wider font-semibold">
                {score.cb_bias.bank_name}
              </p>
              {score.cb_bias.current_rate !== null && score.cb_bias.current_rate !== undefined && (
                <div className="flex justify-between text-[10px]">
                  <span className="text-slate-500">Rate</span>
                  <span className="text-slate-200 font-mono font-bold">
                    {score.cb_bias.current_rate.toFixed(2)}%
                  </span>
                </div>
              )}
              <div className="flex justify-between text-[10px]">
                <span className="text-slate-500">Trend</span>
                <span className={cn(
                  'font-semibold capitalize',
                  score.cb_bias.rate_trend === 'hiking'  ? 'text-emerald-400'
                  : score.cb_bias.rate_trend === 'cutting' ? 'text-red-400'
                  : 'text-slate-400'
                )}>
                  {score.cb_bias.rate_trend}
                </span>
              </div>
              {score.cb_bias.key_phrase && (
                <p className="text-[9px] text-slate-600 italic mt-1 leading-relaxed">
                  "{score.cb_bias.key_phrase}"
                </p>
              )}
              {score.cb_bias.next_meeting_date && (
                <div className="flex justify-between text-[10px]">
                  <span className="text-slate-500">Next meeting</span>
                  <span className="text-slate-400">{score.cb_bias.next_meeting_date}</span>
                </div>
              )}
            </div>
          )}

          {/* Explanation */}
          <div className="mt-3">
            <p className="text-[9px] text-slate-600 uppercase tracking-wider font-semibold mb-1.5">
              Analysis
            </p>
            <p className="text-[10px] text-slate-400 leading-relaxed whitespace-pre-line">
              {score.explanation}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ── MINI SCORE CHIP (collapsed view) ─────────────────────────
function MiniScore({ label, value, max }: { label: string; value: number; max: number }) {
  const v        = value ?? 0;
  const isPositive = v > 0;
  const isNegative = v < 0;
  const pct = Math.min(Math.abs(v) / max, 1);
  const intensity = pct > 0.6 ? 'strong' : pct > 0.3 ? 'mid' : 'weak';

  const color =
    isPositive && intensity === 'strong' ? 'text-emerald-300'
    : isPositive && intensity === 'mid'  ? 'text-emerald-400/80'
    : isPositive                          ? 'text-emerald-500/60'
    : isNegative && intensity === 'strong' ? 'text-red-300'
    : isNegative && intensity === 'mid'    ? 'text-red-400/80'
    : isNegative                           ? 'text-red-500/60'
    : 'text-slate-600';

  return (
    <div className="text-[9px] text-slate-600">
      {label}:{' '}
      <span className={cn('font-bold', color)}>
        {(value ?? 0) > 0 ? '+' : ''}{(value ?? 0).toFixed(0)}
      </span>
    </div>
  );
}

// ── BREAKDOWN BAR (expanded view) ────────────────────────────
function BreakdownBar({
  label, value, range, isNegativeOnly = false,
}: {
  label: string;
  value: number;
  range: number;
  isNegativeOnly?: boolean;
}) {
  const v   = value ?? 0;
  const pct = Math.min(Math.abs(v) / range, 1) * 100;
  const isPos = v >= 0;

  const barColor = isNegativeOnly
    ? 'bg-amber-500'
    : isPos ? 'bg-emerald-500' : 'bg-red-500';

  const textColor = isNegativeOnly
    ? 'text-amber-400'
    : isPos ? 'text-emerald-400' : 'text-red-400';

  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-slate-500 w-24 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all', barColor)}
          style={{ width: `${pct}%`, opacity: 0.8 + pct * 0.002 }}
        />
      </div>
      <span className={cn('text-[10px] font-bold tabular-nums w-8 text-right', textColor)}>
        {(value ?? 0) > 0 ? '+' : ''}{(value ?? 0).toFixed(0)}
      </span>
    </div>
  );
}
