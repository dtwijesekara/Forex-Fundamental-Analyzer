'use client';

// ============================================================
// PAIR BOARD COMPONENT
// Shows bias and conviction for all priority pairs
// ============================================================

import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { PairBiasBadge } from '@/components/ui/Badge';
import { ConvictionBar } from '@/components/ui/ScoreBar';
import { getPairBiasColor, formatScore, cn } from '@/lib/utils';
import { AlertTriangle, Info } from 'lucide-react';
import type { PairBiasResult } from '@/types';

interface PairBoardProps {
  pairs: PairBiasResult[];
}

export function PairBoard({ pairs }: PairBoardProps) {
  const sorted = [...pairs].sort((a, b) => b.conviction_pct - a.conviction_pct);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pair Bias</CardTitle>
        <span className="text-xs text-slate-500">{pairs.length} pairs analyzed</span>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-slate-700/30">
          {sorted.map(pair => (
            <PairRow key={pair.pair} pair={pair} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function PairRow({ pair }: { pair: PairBiasResult }) {
  const biasColor = getPairBiasColor(pair.bias);

  return (
    <div className={cn(
      'px-4 py-3 hover:bg-slate-800/30 transition-colors',
      pair.conflict_flag && 'border-l-2 border-amber-500/50',
      pair.event_risk_flag && !pair.conflict_flag && 'border-l-2 border-sky-500/30',
    )}>
      {/* Header row */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Link href={`/pair/${pair.pair}`} className="font-mono font-bold text-slate-100 text-sm hover:text-emerald-400 transition-colors">
            {pair.pair}
          </Link>
          <PairBiasBadge bias={pair.bias} />
          {pair.conflict_flag && (
            <AlertTriangle size={12} className="text-amber-400" aria-label={pair.conflict_reason || 'Conflict detected'} />
          )}
          {pair.event_risk_flag && (
            <span className="text-[10px] text-sky-400 bg-sky-500/10 px-1.5 py-0.5 rounded border border-sky-500/20">
              EVENT RISK
            </span>
          )}
        </div>
        <div className="text-right">
          <span className={`text-sm font-bold ${biasColor}`}>
            {pair.pair_score > 0 ? '+' : ''}{pair.pair_score.toFixed(0)}
          </span>
          <span className="text-[10px] text-slate-500 ml-1">pts</span>
        </div>
      </div>

      {/* Conviction bar */}
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[10px] text-slate-500 w-16 shrink-0">Conviction</span>
        <ConvictionBar pct={pair.conviction_pct} className="flex-1" />
        <span className="text-xs font-bold text-slate-300 w-10 text-right">
          {pair.conviction_pct}%
        </span>
      </div>

      {/* Base vs Quote scores */}
      <div className="flex gap-4 mb-1">
        <div className="flex items-center gap-1 text-[10px]">
          <span className="text-slate-500">{pair.base_currency}:</span>
          <span className={pair.base_score > 0 ? 'text-emerald-400' : pair.base_score < 0 ? 'text-red-400' : 'text-slate-400'}>
            {pair.base_score > 0 ? '+' : ''}{pair.base_score.toFixed(0)}
          </span>
        </div>
        <div className="flex items-center gap-1 text-[10px]">
          <span className="text-slate-500">{pair.quote_currency}:</span>
          <span className={pair.quote_score > 0 ? 'text-emerald-400' : pair.quote_score < 0 ? 'text-red-400' : 'text-slate-400'}>
            {pair.quote_score > 0 ? '+' : ''}{pair.quote_score.toFixed(0)}
          </span>
        </div>
      </div>

      {/* Explanation */}
      <p className="text-[10px] text-slate-500 truncate">
        {pair.explanation.split('\n').slice(1, 2).join(' ')}
      </p>

      {/* Conflict or event risk detail */}
      {pair.conflict_flag && pair.conflict_reason && (
        <p className="text-[10px] text-amber-400 mt-1 flex items-center gap-1">
          <AlertTriangle size={9} /> {pair.conflict_reason}
        </p>
      )}
      {pair.event_risk_flag && pair.event_risk_detail && !pair.conflict_flag && (
        <p className="text-[10px] text-sky-400 mt-1">{pair.event_risk_detail}</p>
      )}
    </div>
  );
}
