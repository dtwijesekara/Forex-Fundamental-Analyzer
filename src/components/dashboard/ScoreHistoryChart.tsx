'use client';

// ============================================================
// SCORE HISTORY CHART
// Line chart showing currency score evolution over time
// Uses Recharts (already in dependencies)
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, ResponsiveContainer,
} from 'recharts';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { StateCard } from '@/components/ui/StateCard';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { TrendingUp } from 'lucide-react';

// Currency → chart color
const CURRENCY_COLORS: Record<string, string> = {
  USD: '#60a5fa',
  EUR: '#34d399',
  GBP: '#a78bfa',
  JPY: '#f87171',
  AUD: '#fb923c',
  CAD: '#e879f9',
  NZD: '#2dd4bf',
  CHF: '#facc15',
};

const CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'NZD', 'CHF'];
const DAYS_OPTIONS = [
  { label: '24h', value: 1 },
  { label: '3d',  value: 3 },
  { label: '7d',  value: 7 },
  { label: '14d', value: 14 },
];

interface ChartPoint {
  time: string;
  label: string;
  [currency: string]: string | number;
}

export function ScoreHistoryChart() {
  const [data, setData]       = useState<ChartPoint[]>([]);
  const [days, setDays]       = useState(7);
  const [visible, setVisible] = useState<Record<string, boolean>>(
    Object.fromEntries(CURRENCIES.map(c => [c, true]))
  );
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res  = await fetch(`/api/history?type=currencies&days=${days}`, { cache: 'no-store' });
      const json = await res.json();
      if (json.success) {
        const raw = json.raw as Array<Record<string, unknown>>;
        setData(transformToChart(raw));
      } else {
        setError(json.error || 'Failed to load history');
      }
    } catch {
      setError('Could not reach history API');
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  const toggleCurrency = (c: string) =>
    setVisible(prev => ({ ...prev, [c]: !prev[c] }));

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <TrendingUp size={14} className="text-slate-500" />
          <CardTitle>Score History</CardTitle>
        </div>
        <div className="flex items-center gap-1">
          {DAYS_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setDays(opt.value)}
              className={cn(
                'px-2 py-0.5 rounded text-[10px] font-semibold transition-colors',
                days === opt.value
                  ? 'bg-slate-600 text-slate-100'
                  : 'text-slate-500 hover:text-slate-300'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </CardHeader>

      <CardContent>
        {/* Currency toggles */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          {CURRENCIES.map(c => (
            <button
              key={c}
              onClick={() => toggleCurrency(c)}
              className={cn(
                'flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border transition-all',
                visible[c] ? '' : 'border-slate-700 bg-slate-800/50 text-slate-600'
              )}
              style={visible[c] ? {
                backgroundColor: CURRENCY_COLORS[c] + '22',
                borderColor:     CURRENCY_COLORS[c] + '66',
                color:           CURRENCY_COLORS[c],
              } : {}}
            >
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: visible[c] ? CURRENCY_COLORS[c] : '#4b5563' }}
              />
              {c}
            </button>
          ))}
        </div>

        {/* Chart states */}
        {loading ? (
          <div className="h-[220px]">
            <div className="skeleton h-full w-full rounded-xl" />
          </div>
        ) : error ? (
          <StateCard
            type="error"
            compact
            title="Chart unavailable"
            message={error}
            onRetry={fetchHistory}
            className="h-[220px]"
          />
        ) : data.length < 2 ? (
          <StateCard
            type="empty"
            compact
            title="Building history..."
            message="Run the analysis pipeline a few times to populate this chart"
            className="h-[220px]"
          />
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 9, fill: '#6b7280' }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                domain={[-80, 80]}
                tick={{ fontSize: 9, fill: '#6b7280' }}
                tickLine={false}
                axisLine={false}
              />
              <ReferenceLine y={0}   stroke="rgba(255,255,255,0.10)" strokeDasharray="4 4" />
              <ReferenceLine y={20}  stroke="rgba(52,211,153,0.08)"  strokeDasharray="2 4" />
              <ReferenceLine y={-20} stroke="rgba(248,113,113,0.08)" strokeDasharray="2 4" />
              <Tooltip content={<CustomTooltip />} />
              {CURRENCIES.map(c =>
                visible[c] && (
                  <Line
                    key={c}
                    type="monotone"
                    dataKey={c}
                    stroke={CURRENCY_COLORS[c]}
                    strokeWidth={1.5}
                    dot={false}
                    activeDot={{ r: 3, strokeWidth: 0 }}
                    connectNulls
                  />
                )
              )}
            </LineChart>
          </ResponsiveContainer>
        )}

        {/* Legend note */}
        {!loading && !error && data.length >= 2 && (
          <div className="flex justify-between text-[9px] text-slate-700 mt-1">
            <span>← Bearish | Neutral | Bullish →</span>
            <span>±20 = bias threshold</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── CUSTOM TOOLTIP ────────────────────────────────────────────
function CustomTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const sorted = [...payload].sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
  return (
    <div className="bg-[#0f0f1a] border border-white/[0.08] rounded-xl p-2.5 text-[10px] shadow-2xl">
      <p className="text-slate-400 mb-2 font-mono">{label}</p>
      {sorted.map(entry => (
        <div key={entry.name} className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: entry.color }} />
            <span className="text-slate-300 font-bold">{entry.name}</span>
          </div>
          <span style={{ color: entry.color }} className="font-bold tabular-nums">
            {entry.value > 0 ? '+' : ''}{entry.value?.toFixed(0)}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── TRANSFORM RAW DB → CHART FORMAT ──────────────────────────
function transformToChart(raw: Array<Record<string, unknown>>): ChartPoint[] {
  const byHour: Record<string, Record<string, number>> = {};
  for (const r of raw) {
    const t = new Date(r.computed_at as string);
    t.setMinutes(0, 0, 0);
    const key = t.toISOString();
    if (!byHour[key]) byHour[key] = {};
    byHour[key][r.currency as string] = r.score as number;
  }
  return Object.entries(byHour)
    .sort(([a], [b]) => new Date(a).getTime() - new Date(b).getTime())
    .map(([time, scores]) => ({
      time,
      label: format(new Date(time), 'dd/MM HH:mm'),
      ...scores,
    }));
}
