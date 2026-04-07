'use client';

// ============================================================
// EVENT PANEL
// Upcoming events (with live countdown) + recent releases
// (with actual vs forecast beat/miss display)
// ============================================================

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { TierBadge } from '@/components/ui/Badge';
import { formatEventTime, formatEventDateTime, minutesUntilEvent, formatMinutesAway, cn } from '@/lib/utils';
import { CURRENCY_FLAGS } from '@/lib/constants';
import { Clock, CheckCircle, AlertTriangle, RefreshCw, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { EconomicEvent, EventRiskWarning, Currency } from '@/types';

interface EventPanelProps {
  upcoming: EconomicEvent[];
  recent: EconomicEvent[];
  risks: EventRiskWarning[];
  onRefreshActuals?: () => Promise<void>;
  refreshing?: boolean;
  isFirstLoad?: boolean;
}

export function EventPanel({ upcoming, recent, risks, onRefreshActuals, refreshing, isFirstLoad }: EventPanelProps) {
  const importantUpcoming = upcoming.filter(e => e.tier <= 2).slice(0, 8);
  const importantRecent   = recent.filter(e => e.tier <= 2).slice(0, 6);
  const criticalRisks     = risks.filter(r => r.severity === 'critical' || r.severity === 'warning');

  return (
    <div className="space-y-4">
      {/* Risk warnings */}
      {criticalRisks.length > 0 && (
        <div className="space-y-2">
          {criticalRisks.map((risk, i) => (
            <RiskWarningBanner key={i} risk={risk} />
          ))}
        </div>
      )}

      {/* Upcoming events */}
      <Card>
        <CardHeader>
          <CardTitle>Upcoming Events</CardTitle>
          <div className="flex items-center gap-1 text-slate-500">
            <Clock size={12} />
            <span className="text-xs">Next 24h</span>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {importantUpcoming.length === 0 ? (
            <p className="text-slate-500 text-xs p-4">No high/medium impact events in next 24h</p>
          ) : (
            <div className="divide-y divide-slate-700/30">
              {importantUpcoming.map((event, i) => (
                <UpcomingEventRow
                  key={event.id}
                  event={event}
                  animate={isFirstLoad}
                  index={i}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent releases */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Releases</CardTitle>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 text-slate-500">
              <CheckCircle size={12} />
              <span className="text-xs">Last 12h</span>
            </div>
            {onRefreshActuals && (
              <button
                onClick={onRefreshActuals}
                disabled={refreshing}
                className="flex items-center gap-1 text-[9px] text-slate-500 hover:text-slate-300 transition-colors disabled:opacity-40"
                title="Refresh actuals from Forex Factory"
              >
                <RefreshCw size={9} className={refreshing ? 'animate-spin' : ''} />
                Refresh
              </button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {importantRecent.length === 0 ? (
            <p className="text-slate-500 text-xs p-4">No recent releases</p>
          ) : (
            <div className="divide-y divide-slate-700/30">
              {importantRecent.map(event => (
                <RecentEventRow key={event.id} event={event} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── RISK WARNING BANNER ───────────────────────────────────────
function RiskWarningBanner({ risk }: { risk: EventRiskWarning }) {
  const isCritical = risk.severity === 'critical';
  return (
    <div className={cn(
      'rounded-lg border p-3 flex items-start gap-2',
      isCritical
        ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
        : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
    )}>
      <AlertTriangle size={14} className="shrink-0 mt-0.5" />
      <div>
        <p className="text-xs font-semibold">{risk.message}</p>
        {risk.affected_pairs.length > 0 && (
          <p className="text-[10px] opacity-70 mt-0.5">
            Pairs: {risk.affected_pairs.join(', ')}
          </p>
        )}
      </div>
    </div>
  );
}

// ── UPCOMING EVENT ROW (with live countdown) ─────────────────
function UpcomingEventRow({ event, animate, index }: {
  event: EconomicEvent;
  animate?: boolean;
  index: number;
}) {
  const minutesAway = minutesUntilEvent(event.event_time);
  const isVeryClose = minutesAway <= 30;
  const isSoon      = minutesAway <= 120;
  const isImminient = minutesAway <= 5;

  // Live seconds countdown when < 5 min away
  const [secondsLeft, setSecondsLeft] = useState(() =>
    Math.max(0, Math.floor((new Date(event.event_time).getTime() - Date.now()) / 1000))
  );

  useEffect(() => {
    if (minutesAway > 5) return;
    const t = setInterval(() => {
      const s = Math.max(0, Math.floor((new Date(event.event_time).getTime() - Date.now()) / 1000));
      setSecondsLeft(s);
    }, 1000);
    return () => clearInterval(t);
  }, [event.event_time, minutesAway]);

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
  const ss = String(secondsLeft % 60).padStart(2, '0');
  const isCountingDown = isImminient && secondsLeft > 0;

  return (
    <div
      className={cn(
        'px-4 py-2.5 flex items-center gap-3',
        isVeryClose && 'bg-rose-500/5',
        isSoon && !isVeryClose && 'bg-amber-500/5',
        animate && 'stagger-item',
      )}
      style={animate ? { animationDelay: `${Math.min(index + 1, 10) * 40}ms` } : undefined}
    >
      {/* Time / countdown */}
      <div className="text-right shrink-0 min-w-[48px]">
        {isCountingDown ? (
          <>
            <div className="text-sm font-mono font-black text-rose-400 tabular-nums animate-pulse">
              {mm}:{ss}
            </div>
            <div className="text-[9px] font-bold text-rose-500 uppercase tracking-wide">Live</div>
          </>
        ) : (
          <>
            <div className="text-xs font-mono text-slate-300">{formatEventTime(event.event_time)}</div>
            <div className={cn(
              'text-[10px] font-bold',
              isVeryClose ? 'text-rose-400' : isSoon ? 'text-amber-400' : 'text-slate-500'
            )}>
              {formatMinutesAway(minutesAway)}
            </div>
          </>
        )}
      </div>

      {/* Flag */}
      <div className="shrink-0">
        <span className="text-base">{CURRENCY_FLAGS[event.currency as Currency] || '🌍'}</span>
      </div>

      {/* Event details */}
      <div className="flex-1 min-w-0">
        <p className="text-xs text-slate-200 truncate font-medium">{event.event_name}</p>
        <div className="flex items-center gap-2 text-[10px] mt-0.5 flex-wrap">
          {event.forecast != null && (
            <span className="text-slate-500">
              F: <span className="text-slate-400 font-medium">{event.forecast}</span>
            </span>
          )}
          {event.previous != null && (
            <span className="text-slate-600">
              P: {event.previous}
            </span>
          )}
        </div>
      </div>

      <TierBadge tier={event.tier} />
    </div>
  );
}

// ── RECENT EVENT ROW (with beat/miss display) ────────────────
function RecentEventRow({ event }: { event: EconomicEvent }) {
  const bias = event.release_bias;

  // Derive beat/miss from surprise_value if bias not set
  const surpriseDir: 'beat' | 'miss' | 'inline' | null = (() => {
    if (event.surprise_value != null && Math.abs(event.surprise_value) > 0.001) {
      return event.surprise_value > 0 ? 'beat' : 'miss';
    }
    if (bias === 'bullish') return 'beat';
    if (bias === 'bearish') return 'miss';
    if (bias === 'neutral') return 'inline';
    return null;
  })();

  const hasActual = event.actual && event.actual.trim() !== '';

  const SurpriseIcon = surpriseDir === 'beat' ? TrendingUp
    : surpriseDir === 'miss' ? TrendingDown
    : Minus;

  const accentColor = surpriseDir === 'beat'
    ? 'text-emerald-400'
    : surpriseDir === 'miss'
    ? 'text-rose-400'
    : 'text-slate-400';

  const badgeStyle = surpriseDir === 'beat'
    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25'
    : surpriseDir === 'miss'
    ? 'bg-rose-500/15 text-rose-300 border-rose-500/25'
    : 'bg-slate-700/40 text-slate-400 border-slate-600/30';

  const surprisePct = event.surprise_pct != null
    ? `${event.surprise_pct > 0 ? '+' : ''}${event.surprise_pct.toFixed(1)}%`
    : null;

  return (
    <div className="px-4 py-2.5">
      {/* Top row: time + flag + event name + tier */}
      <div className="flex items-center gap-3">
        <div className="text-right shrink-0">
          <div className="text-[10px] font-mono text-slate-600">{formatEventDateTime(event.event_time)}</div>
        </div>
        <span className="text-base shrink-0">{CURRENCY_FLAGS[event.currency as Currency] || '🌍'}</span>
        <p className="text-xs text-slate-300 truncate flex-1 font-medium">{event.event_name}</p>
        <TierBadge tier={event.tier} />
      </div>

      {/* Data row: actual / forecast / previous + beat/miss badge */}
      {hasActual ? (
        <div className="flex items-center gap-3 mt-1.5 pl-9 flex-wrap">
          {/* Actual — prominent */}
          <div className="flex items-center gap-1">
            <SurpriseIcon size={10} className={accentColor} />
            <span className="text-[11px] font-black tabular-nums" style={{ color: 'inherit' }}>
              <span className={accentColor}>A: {event.actual}</span>
            </span>
          </div>

          {/* Forecast */}
          {event.forecast && (
            <span className="text-[10px] text-slate-500">F: <span className="text-slate-400">{event.forecast}</span></span>
          )}

          {/* Previous */}
          {event.previous && (
            <span className="text-[10px] text-slate-600">P: {event.previous}</span>
          )}

          {/* Beat/Miss badge */}
          {surpriseDir && (
            <span className={cn(
              'ml-auto text-[8px] font-bold uppercase px-1.5 py-0.5 rounded border leading-none',
              badgeStyle
            )}>
              {surpriseDir === 'beat' ? 'BEAT'
                : surpriseDir === 'miss' ? 'MISS'
                : 'IN LINE'}
              {surprisePct && ` ${surprisePct}`}
            </span>
          )}
        </div>
      ) : (
        /* Actual not yet in FF feed — show forecast/prev + awaiting label */
        <div className="flex items-center gap-3 mt-1 pl-9 flex-wrap">
          {event.forecast && (
            <span className="text-[10px] text-slate-600">F: <span className="text-slate-500">{event.forecast}</span></span>
          )}
          {event.previous && (
            <span className="text-[10px] text-slate-700">P: {event.previous}</span>
          )}
          <span
            className="text-[8px] text-amber-600/70 ml-auto uppercase tracking-wide"
            title="Actual value updates within ~5–10 min of release via Forex Factory"
          >
            Awaiting actual…
          </span>
        </div>
      )}
    </div>
  );
}
