'use client';

// ============================================================
// CURRENCY BOARD COMPONENT
// Shows all 8 currencies ranked by fundamental strength
// ============================================================

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { BiasBadge, CBBadge } from '@/components/ui/Badge';
import { ScoreBar } from '@/components/ui/ScoreBar';
import { getBiasColor, getCBBiasColor, formatScore } from '@/lib/utils';
import { CURRENCY_FLAGS } from '@/lib/constants';
import type { CurrencyScore, Currency, BiasLabel } from '@/types';

interface CurrencyBoardProps {
  scores: CurrencyScore[];
}

export function CurrencyBoard({ scores }: CurrencyBoardProps) {
  const sorted = [...scores].sort((a, b) => b.score - a.score);
  const strongest = sorted.slice(0, 3);
  const weakest = sorted.slice(-3).reverse();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Currency Strength</CardTitle>
        <span className="text-xs text-slate-500">{scores.length} currencies ranked</span>
      </CardHeader>
      <CardContent className="p-0">
        {/* Summary row */}
        <div className="grid grid-cols-2 gap-px bg-slate-700/30 border-b border-slate-700/50">
          <div className="bg-slate-900/80 p-3">
            <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Strongest</p>
            <div className="flex gap-2">
              {strongest.map(s => (
                <div key={s.currency} className="text-center">
                  <div className="text-lg">{CURRENCY_FLAGS[s.currency as Currency]}</div>
                  <div className="text-xs font-bold text-emerald-400">{s.currency}</div>
                  <div className="text-[10px] text-slate-400">{formatScore(s.score)}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-slate-900/80 p-3">
            <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Weakest</p>
            <div className="flex gap-2">
              {weakest.map(s => (
                <div key={s.currency} className="text-center">
                  <div className="text-lg">{CURRENCY_FLAGS[s.currency as Currency]}</div>
                  <div className="text-xs font-bold text-red-400">{s.currency}</div>
                  <div className="text-[10px] text-slate-400">{formatScore(s.score)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Full ranked list */}
        <div className="divide-y divide-slate-700/30">
          {sorted.map((score, idx) => (
            <CurrencyRow key={score.currency} score={score} rank={idx + 1} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function CurrencyRow({ score, rank }: { score: CurrencyScore; rank: number }) {
  const isTop = rank <= 3;
  const isBottom = rank >= 6;

  return (
    <div className="px-4 py-3 hover:bg-slate-800/30 transition-colors">
      <div className="flex items-center gap-3">
        {/* Rank */}
        <span className={`text-xs font-bold w-4 text-right ${isTop ? 'text-emerald-500' : isBottom ? 'text-red-500' : 'text-slate-500'}`}>
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
            <span className={`text-xs font-bold ${getBiasColor(score.bias_label)}`}>
              {formatScore(score.score)}
            </span>
            <BiasBadge label={score.bias_label} />
          </div>
          <ScoreBar score={score.score} />
        </div>
      </div>

      {/* CB Bias + Details */}
      <div className="mt-2 pl-7 flex items-center gap-2 flex-wrap">
        {score.cb_bias && (
          <CBBadge label={score.cb_bias.bias_label} />
        )}
        <span className="text-[10px] text-slate-500 truncate">
          {score.explanation.split('\n')[0]}
        </span>
      </div>

      {/* Score breakdown (mini) */}
      <div className="mt-1 pl-7 flex gap-3">
        <ScoreComponent label="Eco" value={score.score_economic} />
        <ScoreComponent label="CB" value={score.score_cb} />
        <ScoreComponent label="Rate" value={score.score_rate} />
        <ScoreComponent label="Mkt" value={score.score_intermarket} />
      </div>
    </div>
  );
}

function ScoreComponent({ label, value }: { label: string; value: number }) {
  const color = value > 3 ? 'text-emerald-400' : value < -3 ? 'text-red-400' : 'text-slate-500';
  return (
    <div className="text-[9px] text-slate-600">
      {label}: <span className={color}>{value > 0 ? '+' : ''}{value.toFixed(0)}</span>
    </div>
  );
}
