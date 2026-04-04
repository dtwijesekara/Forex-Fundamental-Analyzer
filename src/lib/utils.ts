// ============================================================
// FOREX FUNDAMENTAL ANALYZER — Utility Functions
// ============================================================

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, formatDistanceToNow, differenceInMinutes } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import type { BiasLabel, PairBiasDirection, CBBiasLabel, AlertSeverity } from '@/types';

// --- TAILWIND CLASS MERGE ---
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- TIMEZONE ---
export function getUserTimezone(): string {
  return process.env.USER_TIMEZONE || process.env.NEXT_PUBLIC_USER_TIMEZONE || 'UTC';
}

export function toUserTime(date: string | Date): Date {
  const tz = getUserTimezone();
  return toZonedTime(new Date(date), tz);
}

export function formatEventTime(date: string | Date): string {
  const tz = getUserTimezone();
  const zonedDate = toZonedTime(new Date(date), tz);
  return format(zonedDate, 'HH:mm');
}

export function formatEventDateTime(date: string | Date): string {
  const tz = getUserTimezone();
  const zonedDate = toZonedTime(new Date(date), tz);
  return format(zonedDate, 'dd MMM HH:mm');
}

export function formatTimeAgo(date: string | Date): string {
  return formatDistanceToNow(new Date(date), { addSuffix: true });
}

export function minutesUntilEvent(eventTime: string | Date): number {
  return differenceInMinutes(new Date(eventTime), new Date());
}

export function formatMinutesAway(minutes: number): string {
  if (minutes < 0) return 'Released';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

// --- NUMBER PARSING ---
export function parseEventValue(value: string | null | undefined): number | null {
  if (!value || value.trim() === '' || value === 'N/A') return null;

  // Remove non-numeric characters except -, ., and leading/trailing whitespace
  const cleaned = value.trim()
    .replace(/[,%K]/g, '')   // remove %, comma, K
    .replace(/[BbMmTt]$/, '') // remove B, M, T suffix
    .trim();

  const num = parseFloat(cleaned);
  if (isNaN(num)) return null;

  // Handle suffixes like "B" (billion), "M" (million), "K" (thousand) in original
  const lv = value.toLowerCase().trim();
  if (lv.endsWith('b')) return num * 1000;
  if (lv.endsWith('m') && !lv.includes('%')) return num;
  if (lv.endsWith('k')) return num / 1000;

  return num;
}

export function calculateSurprise(actual: number | null, forecast: number | null): {
  value: number | null;
  pct: number | null;
} {
  if (actual === null || forecast === null) return { value: null, pct: null };
  const value = actual - forecast;
  const pct = forecast !== 0 ? (value / Math.abs(forecast)) * 100 : null;
  return { value: Number(value.toFixed(4)), pct: pct !== null ? Number(pct.toFixed(2)) : null };
}

// --- SCORE FORMATTING ---
export function formatScore(score: number): string {
  const rounded = Math.round(score);
  return rounded > 0 ? `+${rounded}` : `${rounded}`;
}

export function clampScore(score: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, score));
}

// --- COLOR HELPERS (for className strings) ---
export function getBiasColor(label: BiasLabel): string {
  switch (label) {
    case 'Strong Bullish': return 'text-emerald-400';
    case 'Bullish': return 'text-green-400';
    case 'Neutral': return 'text-slate-400';
    case 'Bearish': return 'text-red-400';
    case 'Strong Bearish': return 'text-rose-500';
  }
}

export function getBiasBgColor(label: BiasLabel): string {
  switch (label) {
    case 'Strong Bullish': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
    case 'Bullish': return 'bg-green-500/20 text-green-400 border-green-500/30';
    case 'Neutral': return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
    case 'Bearish': return 'bg-red-500/20 text-red-400 border-red-500/30';
    case 'Strong Bearish': return 'bg-rose-500/20 text-rose-400 border-rose-500/30';
  }
}

export function getPairBiasColor(bias: PairBiasDirection): string {
  switch (bias) {
    case 'bullish': return 'text-emerald-400';
    case 'bearish': return 'text-red-400';
    case 'neutral': return 'text-slate-400';
  }
}

export function getPairBiasBg(bias: PairBiasDirection): string {
  switch (bias) {
    case 'bullish': return 'bg-emerald-500/15 border-emerald-500/25';
    case 'bearish': return 'bg-red-500/15 border-red-500/25';
    case 'neutral': return 'bg-slate-500/15 border-slate-500/25';
  }
}

export function getCBBiasColor(label: CBBiasLabel): string {
  if (label.includes('Hawkish')) return label.includes('Aggressive') ? 'text-emerald-400' : label.includes('Mildly') ? 'text-green-300' : 'text-green-400';
  if (label.includes('Dovish')) return label.includes('Aggressive') ? 'text-rose-500' : label.includes('Mildly') ? 'text-red-300' : 'text-red-400';
  return 'text-slate-400';
}

export function getSeverityColor(severity: AlertSeverity): string {
  switch (severity) {
    case 'critical': return 'text-rose-400 bg-rose-500/15 border-rose-500/30';
    case 'warning': return 'text-amber-400 bg-amber-500/15 border-amber-500/30';
    case 'info': return 'text-sky-400 bg-sky-500/15 border-sky-500/30';
  }
}

// --- SCORE BAR WIDTH ---
// Convert a score in range [-100, +100] to a 0-100% bar width
export function scoreToBarWidth(score: number): number {
  return Math.round(((clampScore(score, -100, 100) + 100) / 200) * 100);
}

// Score color for bar
export function scoreToBarColor(score: number): string {
  if (score >= 50) return 'bg-emerald-500';
  if (score >= 20) return 'bg-green-500';
  if (score > -20) return 'bg-slate-500';
  if (score > -50) return 'bg-red-500';
  return 'bg-rose-600';
}

// --- CONVICTION BAR ---
export function convictionToColor(pct: number): string {
  if (pct >= 70) return 'bg-emerald-500';
  if (pct >= 50) return 'bg-yellow-500';
  return 'bg-slate-500';
}

// --- INTERMARKET DIRECTION ---
export function directionSymbol(direction: 'up' | 'down' | 'flat'): string {
  switch (direction) {
    case 'up': return '↑';
    case 'down': return '↓';
    case 'flat': return '→';
  }
}

export function directionColor(direction: 'up' | 'down' | 'flat'): string {
  switch (direction) {
    case 'up': return 'text-green-400';
    case 'down': return 'text-red-400';
    case 'flat': return 'text-slate-400';
  }
}

// --- PAIR TO CURRENCIES ---
export function parsePair(pair: string): { base: string; quote: string } {
  return { base: pair.slice(0, 3), quote: pair.slice(3, 6) };
}

// --- DEDUPLICATION ---
export function makeEventId(event: { currency: string; event_name: string; event_time: string }): string {
  const dateStr = event.event_time.slice(0, 16); // YYYY-MM-DDTHH:MM
  const name = event.event_name.toLowerCase().replace(/\s+/g, '_').slice(0, 40);
  return `${event.currency}_${name}_${dateStr}`;
}

// --- DATE RANGE HELPERS ---
export function getStartOfWeek(): Date {
  const now = new Date();
  const day = now.getDay(); // 0=Sun, 1=Mon
  const diff = day === 0 ? -6 : 1 - day;
  const start = new Date(now);
  start.setDate(now.getDate() + diff);
  start.setHours(0, 0, 0, 0);
  return start;
}

export function getEndOfWeek(): Date {
  const start = getStartOfWeek();
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return end;
}

export function isWithinHours(date: string | Date, hours: number): boolean {
  const diffMs = new Date(date).getTime() - Date.now();
  return diffMs >= 0 && diffMs <= hours * 60 * 60 * 1000;
}

// --- SAFE NUMBER FORMAT ---
export function formatPrice(num: number | null | undefined, decimals = 2): string {
  if (num === null || num === undefined) return 'N/A';
  return num.toFixed(decimals);
}

export function formatChange(num: number | null | undefined): string {
  if (num === null || num === undefined) return '';
  const sign = num >= 0 ? '+' : '';
  return `${sign}${num.toFixed(2)}%`;
}

// --- REGIME COLORS (pure UI helpers — kept here to avoid server-only engine imports in client components) ---
import type { RegimeLabel } from '@/types';

export function getRegimeColor(regime: RegimeLabel): string {
  switch (regime) {
    case 'Risk-On': return 'text-emerald-400';
    case 'Risk-Off': return 'text-red-400';
    case 'Policy Divergence': return 'text-purple-400';
    case 'Inflation Focus': return 'text-amber-400';
    case 'Growth Slowdown': return 'text-orange-400';
    case 'Mixed': return 'text-slate-400';
  }
}

export function getRegimeBg(regime: RegimeLabel): string {
  switch (regime) {
    case 'Risk-On': return 'bg-emerald-500/15 border-emerald-500/30';
    case 'Risk-Off': return 'bg-red-500/15 border-red-500/30';
    case 'Policy Divergence': return 'bg-purple-500/15 border-purple-500/30';
    case 'Inflation Focus': return 'bg-amber-500/15 border-amber-500/30';
    case 'Growth Slowdown': return 'bg-orange-500/15 border-orange-500/30';
    case 'Mixed': return 'bg-slate-500/15 border-slate-500/30';
  }
}
