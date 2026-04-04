'use client';

// ============================================================
// EVENT PANEL
// Shows upcoming events and recent releases
// ============================================================

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { TierBadge } from '@/components/ui/Badge';
import { formatEventTime, formatEventDateTime, minutesUntilEvent, formatMinutesAway, cn } from '@/lib/utils';
import { CURRENCY_FLAGS } from '@/lib/constants';
import { Clock, CheckCircle, AlertTriangle } from 'lucide-react';
import type { EconomicEvent, EventRiskWarning, Currency } from '@/types';

interface EventPanelProps {
  upcoming: EconomicEvent[];
  recent: EconomicEvent[];
  risks: EventRiskWarning[];
}

export function EventPanel({ upcoming, recent, risks }: EventPanelProps) {
  // Filter to high/medium impact only
  const importantUpcoming = upcoming.filter(e => e.tier <= 2).slice(0, 8);
  const importantRecent = recent.filter(e => e.tier <= 2).slice(0, 5);
  const criticalRisks = risks.filter(r => r.severity === 'critical' || r.severity === 'warning');

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
              {importantUpcoming.map(event => (
                <UpcomingEventRow key={event.id} event={event} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent releases */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Releases</CardTitle>
          <div className="flex items-center gap-1 text-slate-500">
            <CheckCircle size={12} />
            <span className="text-xs">Last 12h</span>
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

function UpcomingEventRow({ event }: { event: EconomicEvent }) {
  const minutesAway = minutesUntilEvent(event.event_time);
  const isVeryClose = minutesAway <= 30;
  const isSoon = minutesAway <= 120;

  return (
    <div className={cn(
      'px-4 py-2.5 flex items-center gap-3',
      isVeryClose && 'bg-rose-500/5',
      isSoon && !isVeryClose && 'bg-amber-500/5',
    )}>
      {/* Time */}
      <div className="text-right shrink-0">
        <div className="text-xs font-mono text-slate-300">{formatEventTime(event.event_time)}</div>
        <div className={cn(
          'text-[10px] font-bold',
          isVeryClose ? 'text-rose-400' : isSoon ? 'text-amber-400' : 'text-slate-500'
        )}>
          {formatMinutesAway(minutesAway)}
        </div>
      </div>

      {/* Flag + currency */}
      <div className="shrink-0">
        <span className="text-base">{CURRENCY_FLAGS[event.currency as Currency] || '🌍'}</span>
      </div>

      {/* Event name */}
      <div className="flex-1 min-w-0">
        <p className="text-xs text-slate-200 truncate">{event.event_name}</p>
        {event.forecast && (
          <p className="text-[10px] text-slate-500">
            Forecast: <span className="text-slate-400">{event.forecast}</span>
            {event.previous && ` | Prev: ${event.previous}`}
          </p>
        )}
      </div>

      <TierBadge tier={event.tier} />
    </div>
  );
}

function RecentEventRow({ event }: { event: EconomicEvent }) {
  const bias = event.release_bias;
  const biasColor = bias === 'bullish' ? 'text-emerald-400' : bias === 'bearish' ? 'text-red-400' : 'text-slate-400';

  return (
    <div className="px-4 py-2.5 flex items-center gap-3">
      {/* Time */}
      <div className="text-right shrink-0">
        <div className="text-xs font-mono text-slate-500">{formatEventDateTime(event.event_time)}</div>
      </div>

      {/* Flag */}
      <div className="shrink-0">
        <span className="text-base">{CURRENCY_FLAGS[event.currency as Currency] || '🌍'}</span>
      </div>

      {/* Event + values */}
      <div className="flex-1 min-w-0">
        <p className="text-xs text-slate-300 truncate">{event.event_name}</p>
        <div className="flex items-center gap-2 text-[10px] mt-0.5">
          {event.actual && (
            <span className="text-slate-400">
              A: <span className={biasColor}>{event.actual}</span>
            </span>
          )}
          {event.forecast && <span className="text-slate-500">F: {event.forecast}</span>}
          {event.previous && <span className="text-slate-600">P: {event.previous}</span>}
        </div>
      </div>

      <div className="shrink-0 text-right">
        <TierBadge tier={event.tier} />
        {event.release_bias && (
          <div className={`text-[9px] font-bold uppercase mt-0.5 ${biasColor}`}>
            {event.release_bias}
          </div>
        )}
      </div>
    </div>
  );
}
