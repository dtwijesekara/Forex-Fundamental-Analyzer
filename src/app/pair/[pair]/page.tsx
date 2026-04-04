'use client';

// ============================================================
// PAIR DETAIL PAGE — /pair/EURUSD
// Full drill-down: score breakdown, history chart, events,
// CB comparison, news, alerts, rate differential
// ============================================================

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, ResponsiveContainer, Legend,
} from 'recharts';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { BiasBadge, PairBiasBadge, CBBadge, TierBadge } from '@/components/ui/Badge';
import { ScoreBar, ConvictionBar } from '@/components/ui/ScoreBar';
import {
  getBiasColor, getCBBiasColor, formatScore, formatEventDateTime,
  formatTimeAgo, getPairBiasColor, cn,
} from '@/lib/utils';
import { CURRENCY_FLAGS } from '@/lib/constants';
import type { PairBiasResult, CurrencyScore, CentralBankBias, EconomicEvent, BiasLabel } from '@/types';
import {
  ArrowLeft, AlertTriangle, TrendingUp, TrendingDown,
  Calendar, Newspaper, Bell, Minus,
} from 'lucide-react';
import { format } from 'date-fns';

export default function PairDetailPage() {
  const params   = useParams();
  const router   = useRouter();
  const pairName = (params.pair as string || '').toUpperCase();

  const [data, setData]     = useState<PairDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState<string | null>(null);

  useEffect(() => {
    if (!pairName) return;
    fetch(`/api/pair/${pairName}`)
      .then(r => r.json())
      .then(json => {
        if (json.success) setData(json.data);
        else setError(json.error || 'Failed to load');
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [pairName]);

  if (loading) return <PageShell pair={pairName}><p className="text-slate-500 text-sm p-8 text-center">Loading pair analysis...</p></PageShell>;
  if (error)   return <PageShell pair={pairName}><p className="text-rose-400 text-sm p-8 text-center">{error}</p></PageShell>;
  if (!data)   return <PageShell pair={pairName}><p className="text-slate-500 text-sm p-8 text-center">No data</p></PageShell>;

  const {
    current_bias, bias_history,
    base_score, quote_score,
    base_history, quote_history,
    base_events, quote_events,
    base_cb, quote_cb,
    news, alerts,
  } = data;

  const base  = pairName.slice(0, 3);
  const quote = pairName.slice(3, 6);

  // Build combined history chart data
  const chartData = buildCombinedHistory(base_history, quote_history, base, quote);

  return (
    <PageShell pair={pairName}>
      {/* ── HERO BIAS CARD ── */}
      {current_bias && (
        <div className={cn(
          'rounded-xl border p-4 mb-4',
          current_bias.bias === 'bullish'
            ? 'bg-emerald-500/10 border-emerald-500/30'
            : current_bias.bias === 'bearish'
            ? 'bg-red-500/10 border-red-500/30'
            : 'bg-slate-700/30 border-slate-700'
        )}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <span className="font-mono text-2xl font-black text-slate-100">{pairName}</span>
              <PairBiasBadge bias={current_bias.bias} />
              {current_bias.conflict_flag && (
                <div className="flex items-center gap-1 text-amber-400 text-xs">
                  <AlertTriangle size={12} /> Conflict
                </div>
              )}
            </div>
            <div className="text-right">
              <div className={cn('text-2xl font-black', getPairBiasColor(current_bias.bias))}>
                {current_bias.pair_score > 0 ? '+' : ''}{current_bias.pair_score.toFixed(0)}
              </div>
              <div className="text-xs text-slate-500">score</div>
            </div>
          </div>

          {/* Conviction */}
          <div className="flex items-center gap-3 mb-3">
            <span className="text-xs text-slate-500 w-20">Conviction</span>
            <ConvictionBar pct={current_bias.conviction_pct} className="flex-1" />
            <span className="text-sm font-bold text-slate-200 w-12 text-right">
              {current_bias.conviction_pct}%
            </span>
          </div>

          {/* Score comparison */}
          <div className="grid grid-cols-2 gap-3">
            <MiniScoreCard
              currency={base}
              score={current_bias.base_score}
              biasLabel={base_score?.bias_label}
            />
            <MiniScoreCard
              currency={quote}
              score={current_bias.quote_score}
              biasLabel={quote_score?.bias_label}
            />
          </div>

          {/* Explanation */}
          {current_bias.explanation && (
            <p className="text-xs text-slate-400 mt-3 leading-relaxed border-t border-slate-700/50 pt-3">
              {current_bias.explanation.split('\n').slice(1).join(' • ')}
            </p>
          )}

          {/* Conflict / event risk */}
          {current_bias.conflict_reason && (
            <div className="mt-2 flex items-center gap-1.5 text-amber-400 text-xs">
              <AlertTriangle size={11} /> {current_bias.conflict_reason}
            </div>
          )}
          {current_bias.event_risk_detail && (
            <div className="mt-1 text-sky-400 text-xs">{current_bias.event_risk_detail}</div>
          )}
        </div>
      )}

      {/* ── 2-COLUMN LAYOUT ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* LEFT: History chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Currency Score History (7d)</CardTitle>
          </CardHeader>
          <CardContent>
            {chartData.length < 2 ? (
              <p className="text-slate-600 text-xs text-center py-8">Not enough history — run analysis multiple times</p>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#6b7280' }} tickLine={false} axisLine={false} />
                  <YAxis domain={[-80, 80]} tick={{ fontSize: 9, fill: '#6b7280' }} tickLine={false} axisLine={false} />
                  <ReferenceLine y={0} stroke="rgba(255,255,255,0.1)" strokeDasharray="4 4" />
                  <Tooltip
                    contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, fontSize: 11 }}
                    labelStyle={{ color: '#94a3b8' }}
                  />
                  <Legend wrapperStyle={{ fontSize: 10, paddingTop: 8 }} />
                  <Line type="monotone" dataKey={base} stroke="#60a5fa" strokeWidth={2} dot={false} activeDot={{ r: 3 }} />
                  <Line type="monotone" dataKey={quote} stroke="#f87171" strokeWidth={2} dot={false} activeDot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* CB COMPARISON */}
        <Card>
          <CardHeader><CardTitle>Central Bank Comparison</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {[{ cb: base_cb, currency: base }, { cb: quote_cb, currency: quote }].map(({ cb, currency }) => (
              <div key={currency} className="p-3 rounded-lg bg-slate-800/50 border border-slate-700/50">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-base">{CURRENCY_FLAGS[currency as keyof typeof CURRENCY_FLAGS]}</span>
                    <span className="font-bold text-slate-200 text-sm">{currency}</span>
                  </div>
                  {cb && <CBBadge label={cb.bias_label} />}
                </div>
                {cb ? (
                  <div className="space-y-1">
                    {cb.current_rate != null && (
                      <p className="text-xs text-slate-400">Rate: <span className="text-slate-200 font-bold">{cb.current_rate}%</span>
                        <span className={cn('ml-2 text-[10px]', cb.rate_trend === 'hiking' ? 'text-emerald-400' : cb.rate_trend === 'cutting' ? 'text-red-400' : 'text-slate-500')}>
                          {cb.rate_trend === 'hiking' ? '↑ Hiking' : cb.rate_trend === 'cutting' ? '↓ Cutting' : '— Holding'}
                        </span>
                      </p>
                    )}
                    {cb.key_phrase && (
                      <p className="text-[10px] text-slate-500 italic">"{cb.key_phrase}"</p>
                    )}
                    {cb.notes && (
                      <p className="text-[10px] text-slate-600">{cb.notes}</p>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-slate-600">No CB data</p>
                )}
              </div>
            ))}

            {/* Rate differential */}
            {base_cb?.current_rate != null && quote_cb?.current_rate != null && (
              <div className="p-2 rounded-lg bg-slate-700/30 border border-slate-700/30 text-center">
                <p className="text-[10px] text-slate-500 mb-1">Rate Differential</p>
                <p className={cn('text-lg font-black', (base_cb.current_rate - quote_cb.current_rate) > 0 ? 'text-emerald-400' : 'text-red-400')}>
                  {(base_cb.current_rate - quote_cb.current_rate) > 0 ? '+' : ''}
                  {(base_cb.current_rate - quote_cb.current_rate).toFixed(2)}%
                </p>
                <p className="text-[9px] text-slate-600">
                  {base} {base_cb.current_rate}% vs {quote} {quote_cb.current_rate}%
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* SCORE BREAKDOWN */}
        <Card>
          <CardHeader><CardTitle>Score Breakdown</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {[
              { label: 'Economic', baseVal: base_score?.score_economic, quoteVal: quote_score?.score_economic },
              { label: 'Central Bank', baseVal: base_score?.score_cb, quoteVal: quote_score?.score_cb },
              { label: 'Rate Outlook', baseVal: base_score?.score_rate, quoteVal: quote_score?.score_rate },
              { label: 'Intermarket', baseVal: base_score?.score_intermarket, quoteVal: quote_score?.score_intermarket },
              { label: 'Sentiment', baseVal: base_score?.score_sentiment, quoteVal: quote_score?.score_sentiment },
            ].map(({ label, baseVal, quoteVal }) => (
              <div key={label} className="grid grid-cols-[1fr_80px_1fr] gap-2 items-center">
                <div className="text-right">
                  <span className={cn('text-xs font-bold', (baseVal || 0) > 0 ? 'text-emerald-400' : (baseVal || 0) < 0 ? 'text-red-400' : 'text-slate-500')}>
                    {baseVal != null ? formatScore(baseVal) : '—'}
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 text-center">{label}</p>
                <div>
                  <span className={cn('text-xs font-bold', (quoteVal || 0) > 0 ? 'text-emerald-400' : (quoteVal || 0) < 0 ? 'text-red-400' : 'text-slate-500')}>
                    {quoteVal != null ? formatScore(quoteVal) : '—'}
                  </span>
                </div>
              </div>
            ))}
            <div className="border-t border-slate-700/50 pt-2 grid grid-cols-[1fr_80px_1fr] gap-2 items-center">
              <div className="text-right">
                <span className={cn('text-sm font-black', (base_score?.score || 0) > 0 ? 'text-emerald-400' : 'text-red-400')}>
                  {base_score?.score != null ? formatScore(base_score.score) : '—'}
                </span>
              </div>
              <p className="text-[10px] text-slate-400 text-center font-bold">Total</p>
              <div>
                <span className={cn('text-sm font-black', (quote_score?.score || 0) > 0 ? 'text-emerald-400' : 'text-red-400')}>
                  {quote_score?.score != null ? formatScore(quote_score.score) : '—'}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* EVENTS */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center gap-2"><Calendar size={13} className="text-slate-500" /><CardTitle>Recent Events (7d)</CardTitle></div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="grid grid-cols-1 sm:grid-cols-2 divide-x divide-slate-700/30">
              <EventsList currency={base} events={base_events} />
              <EventsList currency={quote} events={quote_events} />
            </div>
          </CardContent>
        </Card>

        {/* NEWS */}
        {news.length > 0 && (
          <Card className="lg:col-span-2">
            <CardHeader>
              <div className="flex items-center gap-2"><Newspaper size={13} className="text-slate-500" /><CardTitle>Related News</CardTitle></div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-slate-700/30">
                {news.slice(0, 8).map((item) => (
                  <div key={item.id} className="px-4 py-2.5 flex items-start gap-2 hover:bg-slate-800/20">
                    {item.sentiment === 'bullish' ? <TrendingUp size={11} className="text-emerald-400 shrink-0 mt-0.5" />
                      : item.sentiment === 'bearish' ? <TrendingDown size={11} className="text-red-400 shrink-0 mt-0.5" />
                      : <Minus size={11} className="text-slate-500 shrink-0 mt-0.5" />}
                    <div>
                      <p className="text-xs text-slate-200">{item.title}</p>
                      <p className="text-[9px] text-slate-600 mt-0.5">{item.source} · {formatTimeAgo(item.published_at)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </PageShell>
  );
}

// ─────────────────────────────────────────────────────────────
// SUB-COMPONENTS
// ─────────────────────────────────────────────────────────────

function PageShell({ pair, children }: { pair: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      {/* Breadcrumb row — sits below the shared Navbar from layout */}
      <div className="border-b border-white/[0.05] bg-[#0a0a0f]/80 backdrop-blur-sm px-4 py-2.5 flex items-center gap-2">
        <Link href="/pairs" className="flex items-center gap-1.5 text-slate-500 hover:text-slate-300 transition-colors text-xs">
          <ArrowLeft size={12} />
          Pairs
        </Link>
        <span className="text-slate-700 text-xs">/</span>
        <span className="text-xs font-bold text-slate-200 font-mono">{pair}</span>
      </div>
      <main className="max-w-screen-lg mx-auto px-3 sm:px-4 py-4">
        {children}
      </main>
    </div>
  );
}

function MiniScoreCard({ currency, score, biasLabel }: {
  currency: string; score: number; biasLabel?: string;
}) {
  return (
    <div className="bg-slate-800/50 rounded-lg p-2.5 border border-slate-700/30">
      <div className="flex items-center gap-1.5 mb-1.5">
        <span>{CURRENCY_FLAGS[currency as keyof typeof CURRENCY_FLAGS]}</span>
        <span className="text-xs font-bold text-slate-200">{currency}</span>
        {biasLabel && <BiasBadge label={biasLabel as BiasLabel} />}
      </div>
      <div className={cn('text-lg font-black', score > 0 ? 'text-emerald-400' : score < 0 ? 'text-red-400' : 'text-slate-400')}>
        {formatScore(score)}
      </div>
      <ScoreBar score={score} className="mt-1" />
    </div>
  );
}

function EventsList({ currency, events }: { currency: string; events: EconomicEvent[] }) {
  return (
    <div className="p-3">
      <div className="flex items-center gap-1.5 mb-2">
        <span>{CURRENCY_FLAGS[currency as keyof typeof CURRENCY_FLAGS]}</span>
        <span className="text-xs font-bold text-slate-300">{currency}</span>
      </div>
      {events.length === 0 ? (
        <p className="text-slate-600 text-xs">No recent events</p>
      ) : (
        <div className="space-y-1.5">
          {events.map((e, i) => {
            const biasColor = e.release_bias === 'bullish' ? 'text-emerald-400' : e.release_bias === 'bearish' ? 'text-red-400' : 'text-slate-500';
            return (
              <div key={i} className="flex items-start gap-2">
                <TierBadge tier={e.tier} />
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-slate-300 truncate">{e.event_name}</p>
                  <div className="flex items-center gap-2 text-[9px] text-slate-600">
                    <span>{formatEventDateTime(e.event_time)}</span>
                    {e.actual && <span className={biasColor}>A: {e.actual}</span>}
                    {e.forecast && <span>F: {e.forecast}</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// TYPES + HELPERS
// ─────────────────────────────────────────────────────────────
interface PairDetailData {
  current_bias: PairBiasResult | null;
  bias_history: Array<{ pair_score: number; conviction_pct: number; bias: string; computed_at: string }>;
  base_score: CurrencyScore | null;
  quote_score: CurrencyScore | null;
  base_history: Array<{ score: number; bias_label: string; computed_at: string }>;
  quote_history: Array<{ score: number; bias_label: string; computed_at: string }>;
  base_events: EconomicEvent[];
  quote_events: EconomicEvent[];
  base_cb: CentralBankBias | null;
  quote_cb: CentralBankBias | null;
  news: Array<{ id: string; title: string; sentiment: string; source: string; published_at: string; url?: string }>;
  alerts: Array<{ id: string; type: string; message: string; severity: string; sent_at: string }>;
}

function buildCombinedHistory(
  baseHistory: Array<{ score: number; computed_at: string }>,
  quoteHistory: Array<{ score: number; computed_at: string }>,
  base: string,
  quote: string
) {
  const points: Record<string, { time: string; label: string; [k: string]: unknown }> = {};

  for (const r of baseHistory) {
    const t = new Date(r.computed_at);
    t.setMinutes(0, 0, 0);
    const key = t.toISOString();
    if (!points[key]) points[key] = { time: key, label: format(t, 'dd/MM HH:mm') };
    points[key][base] = r.score;
  }
  for (const r of quoteHistory) {
    const t = new Date(r.computed_at);
    t.setMinutes(0, 0, 0);
    const key = t.toISOString();
    if (!points[key]) points[key] = { time: key, label: format(t, 'dd/MM HH:mm') };
    points[key][quote] = r.score;
  }

  return Object.values(points).sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
}
