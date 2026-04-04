'use client';

// ============================================================
// TRADING SESSION TRACKER COMPONENT
// Shows live status of Sydney / Tokyo / London / New York sessions
// with countdown, progress bar, and overlap warning
// ============================================================

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import {
  getAllSessionStatuses,
  getCurrentOverlap,
  getSessionVolatility,
  formatCountdown,
  type SessionStatus,
} from '@/lib/sessions';
import { cn } from '@/lib/utils';
import { Clock, Zap } from 'lucide-react';

export function SessionTracker() {
  const [statuses, setStatuses] = useState<SessionStatus[]>([]);
  const [currentTime, setCurrentTime] = useState('');

  // Update every 30 seconds
  useEffect(() => {
    const update = () => {
      setStatuses(getAllSessionStatuses());
      const now = new Date();
      setCurrentTime(
        now.toUTCString().slice(17, 22) + ' UTC'
      );
    };
    update();
    const timer = setInterval(update, 30_000);
    return () => clearInterval(timer);
  }, []);

  const overlap = getCurrentOverlap();
  const volatility = getSessionVolatility(statuses);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardTitle>Sessions</CardTitle>
          <span className={cn('text-xs font-semibold', volatility.color)}>
            {volatility.label}
          </span>
        </div>
        <div className="flex items-center gap-1 text-slate-500">
          <Clock size={10} />
          <span className="text-[10px] font-mono">{currentTime}</span>
        </div>
      </CardHeader>

      <CardContent className="p-3 space-y-2">
        {/* Overlap banner */}
        {overlap && (
          <div className={cn(
            'rounded-lg border px-3 py-2 flex items-start gap-2 mb-3',
            overlap.volatility === 'highest'
              ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
              : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
          )}>
            <Zap size={12} className="shrink-0 mt-0.5" />
            <div>
              <p className="text-[11px] font-bold">{overlap.label}</p>
              <p className="text-[10px] opacity-70">{overlap.description}</p>
            </div>
          </div>
        )}

        {/* Session rows */}
        {statuses.map(session => (
          <SessionRow key={session.name} session={session} />
        ))}
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────
// SINGLE SESSION ROW
// ─────────────────────────────────────────────────────────────
function SessionRow({ session }: { session: SessionStatus }) {
  const { isOpen, name, currencies, color, bgColor, borderColor,
          minutesUntilOpen, minutesUntilClose, progressPct } = session;

  return (
    <div className={cn(
      'rounded-lg border p-2.5 transition-all',
      isOpen ? `${bgColor} ${borderColor}` : 'bg-slate-800/30 border-slate-700/30'
    )}>
      <div className="flex items-center justify-between mb-1.5">
        {/* Name + status dot */}
        <div className="flex items-center gap-2">
          <div className={cn(
            'w-1.5 h-1.5 rounded-full',
            isOpen ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'
          )} />
          <span className={cn('text-xs font-bold', isOpen ? color : 'text-slate-500')}>
            {name}
          </span>
          {/* Active currencies */}
          <div className="flex gap-1">
            {currencies.map(c => (
              <span key={c} className={cn(
                'text-[9px] font-bold px-1 py-0.5 rounded',
                isOpen ? `${bgColor} ${color}` : 'bg-slate-700/50 text-slate-600'
              )}>
                {c}
              </span>
            ))}
          </div>
        </div>

        {/* Countdown / time remaining */}
        <div className="text-right">
          {isOpen ? (
            <span className="text-[10px] text-slate-400">
              closes in <span className={cn('font-bold', color)}>{formatCountdown(minutesUntilClose)}</span>
            </span>
          ) : (
            <span className="text-[10px] text-slate-600">
              opens in <span className="font-bold text-slate-400">{formatCountdown(minutesUntilOpen)}</span>
            </span>
          )}
        </div>
      </div>

      {/* Progress bar (only shown when open) */}
      {isOpen && (
        <div className="h-1 bg-slate-700/50 rounded-full overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all duration-1000', {
              'bg-teal-500': name === 'Sydney',
              'bg-red-500': name === 'Tokyo',
              'bg-sky-500': name === 'London',
              'bg-amber-500': name === 'New York',
            })}
            style={{ width: `${progressPct}%` }}
          />
        </div>
      )}
    </div>
  );
}
