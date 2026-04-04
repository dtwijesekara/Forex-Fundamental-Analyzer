'use client';

// ============================================================
// ALERTS PANEL
// Shows recent system alerts and warnings
// ============================================================

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { getSeverityColor, formatTimeAgo, cn } from '@/lib/utils';
import { Bell, AlertTriangle, Info, Zap } from 'lucide-react';
import type { Alert, AlertType } from '@/types';

interface AlertsPanelProps {
  alerts: Alert[];
}

export function AlertsPanel({ alerts }: AlertsPanelProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Alerts</CardTitle>
        <div className="flex items-center gap-1">
          <Bell size={12} className="text-slate-500" />
          <span className="text-xs text-slate-500">{alerts.length} recent</span>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {alerts.length === 0 ? (
          <div className="p-4 text-center">
            <p className="text-slate-600 text-xs">No recent alerts</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-700/30 max-h-64 overflow-y-auto">
            {alerts.map(alert => (
              <AlertRow key={alert.id || alert.sent_at} alert={alert} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AlertRow({ alert }: { alert: Alert }) {
  const Icon = getAlertIcon(alert.alert_type);
  const colorClass = getSeverityColor(alert.severity);

  return (
    <div className={cn('px-4 py-3 flex items-start gap-3', `border-l-2`, getBorderColor(alert.severity))}>
      <Icon size={13} className={`shrink-0 mt-0.5 ${getIconColor(alert.severity)}`} />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-slate-200 truncate">{alert.title}</p>
        <p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed line-clamp-2">{alert.message}</p>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-[9px] text-slate-600">{formatTimeAgo(alert.sent_at)}</span>
          {alert.sent_telegram && (
            <span className="text-[9px] text-sky-500">✓ Telegram</span>
          )}
          {alert.currency && (
            <span className="text-[9px] text-slate-600">#{alert.currency}</span>
          )}
          {alert.pair && (
            <span className="text-[9px] text-slate-600">#{alert.pair}</span>
          )}
        </div>
      </div>
    </div>
  );
}

function getAlertIcon(type: AlertType) {
  switch (type) {
    case 'event_approaching': return AlertTriangle;
    case 'bias_flip': return Zap;
    case 'pair_bias_flip': return Zap;
    case 'regime_change': return Info;
    case 'conflict_detected': return AlertTriangle;
    default: return Bell;
  }
}

function getIconColor(severity: import('@/types').AlertSeverity): string {
  switch (severity) {
    case 'critical': return 'text-rose-400';
    case 'warning': return 'text-amber-400';
    case 'info': return 'text-sky-400';
  }
}

function getBorderColor(severity: import('@/types').AlertSeverity): string {
  switch (severity) {
    case 'critical': return 'border-rose-500/60';
    case 'warning': return 'border-amber-500/60';
    case 'info': return 'border-sky-500/40';
  }
}
