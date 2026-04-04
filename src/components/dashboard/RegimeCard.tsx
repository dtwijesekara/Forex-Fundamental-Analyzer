'use client';

// ============================================================
// REGIME CARD + INTERMARKET PANEL
// Shows current market regime and intermarket asset status
// ============================================================

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { getRegimeColor, getRegimeBg } from '@/lib/utils';
import { directionSymbol, directionColor, formatPrice, formatChange, cn } from '@/lib/utils';
import type { MarketRegime, IntermarketSnapshot } from '@/types';

interface RegimeCardProps {
  regime: MarketRegime | null;
  intermarket: IntermarketSnapshot;
}

export function RegimeCard({ regime, intermarket }: RegimeCardProps) {
  return (
    <div className="space-y-4">
      {/* Regime */}
      <Card>
        <CardHeader>
          <CardTitle>Market Regime</CardTitle>
          {regime && (
            <span className="text-xs text-slate-500">{regime.confidence_pct}% confidence</span>
          )}
        </CardHeader>
        <CardContent>
          {!regime ? (
            <p className="text-slate-500 text-xs">No regime data — run analysis first</p>
          ) : (
            <>
              <div className={cn(
                'inline-flex items-center px-3 py-1.5 rounded-lg border text-sm font-bold mb-3',
                getRegimeBg(regime.regime)
              )}>
                <span className={getRegimeColor(regime.regime)}>{regime.regime}</span>
              </div>

              {/* Confidence bar */}
              <div className="flex items-center gap-2 mb-3">
                <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all', getConfidenceBarColor(regime.confidence_pct))}
                    style={{ width: `${regime.confidence_pct}%` }}
                  />
                </div>
                <span className="text-[10px] text-slate-500">{regime.confidence_pct}%</span>
              </div>

              {/* Explanation */}
              <p className="text-[10px] text-slate-400 leading-relaxed">
                {regime.explanation.split('\n')[0]}
              </p>
            </>
          )}
        </CardContent>
      </Card>

      {/* Intermarket */}
      <Card>
        <CardHeader>
          <CardTitle>Intermarket</CardTitle>
          <span className="text-xs text-slate-500">Market context</span>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-slate-700/30">
            <IntermarketRow label="DXY" symbol="dxy" data={intermarket.dxy} description="Dollar Index" />
            <IntermarketRow label="Gold" symbol="gold" data={intermarket.gold} description="XAU/USD" />
            <IntermarketRow label="Oil" symbol="oil" data={intermarket.oil} description="WTI Crude" />
            <IntermarketRow label="S&P 500" symbol="sp500" data={intermarket.sp500} description="Equity Risk" />
            <IntermarketRow label="VIX" symbol="vix" data={intermarket.vix} description="Fear Index" invertSignal />
            <IntermarketRow label="US 10Y" symbol="us10y" data={intermarket.us10y} description="Yield %" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

interface IntermarketRowProps {
  label: string;
  symbol: string;
  data?: import('@/types').IntermarketData;
  description: string;
  invertSignal?: boolean;
}

function IntermarketRow({ label, symbol, data, description, invertSignal }: IntermarketRowProps) {
  if (!data) {
    return (
      <div className="px-4 py-2.5 flex items-center justify-between">
        <div>
          <span className="text-xs font-semibold text-slate-300">{label}</span>
          <span className="text-[10px] text-slate-600 ml-1.5">{description}</span>
        </div>
        <span className="text-[10px] text-slate-600">No data</span>
      </div>
    );
  }

  const dir = invertSignal
    ? (data.direction === 'up' ? 'down' : data.direction === 'down' ? 'up' : 'flat')
    : data.direction;

  return (
    <div className="px-4 py-2.5 flex items-center justify-between hover:bg-slate-800/20">
      <div>
        <span className="text-xs font-semibold text-slate-200">{label}</span>
        <span className="text-[10px] text-slate-600 ml-1.5">{description}</span>
      </div>
      <div className="text-right">
        <div className="flex items-center gap-1.5 justify-end">
          <span className={`text-sm font-bold ${directionColor(dir)}`}>
            {directionSymbol(data.direction)}
          </span>
          <span className="text-xs font-mono text-slate-300">
            {formatPrice(data.price, label === 'US 10Y' || label === 'VIX' ? 2 : 2)}
          </span>
        </div>
        {data.change_1d !== null && data.change_1d !== undefined && (
          <div className={`text-[10px] ${data.change_1d >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {formatChange(data.change_1d)}
          </div>
        )}
      </div>
    </div>
  );
}

function getConfidenceBarColor(pct: number): string {
  if (pct >= 70) return 'bg-emerald-500';
  if (pct >= 50) return 'bg-amber-500';
  return 'bg-slate-500';
}
