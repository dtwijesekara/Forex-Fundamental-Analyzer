'use client';

// ============================================================
// NAVBAR — Persistent navigation for all pages
// Desktop: sticky top bar with logo + tabs + live dot
// Mobile: compact top bar + horizontal scrollable tabs
// ============================================================

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Activity, LayoutDashboard, BarChart2,
  ArrowLeftRight, CalendarDays, TrendingUp, RefreshCw, Clock,
} from 'lucide-react';
import { cn, formatTimeAgo } from '@/lib/utils';

export interface NavbarProps {
  lastFetch?: string | null;
  refreshing?: boolean;
  onRefresh?: () => void;
}

const NAV_ITEMS = [
  { href: '/',           label: 'Overview',   icon: LayoutDashboard, exact: true },
  { href: '/currencies', label: 'Currencies', icon: BarChart2 },
  { href: '/pairs',      label: 'Pairs',      icon: ArrowLeftRight },
  { href: '/calendar',   label: 'Calendar',   icon: CalendarDays },
  { href: '/markets',    label: 'Markets',    icon: TrendingUp },
];

export function Navbar({ lastFetch, refreshing, onRefresh }: NavbarProps) {
  const pathname = usePathname();

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname.startsWith(href);

  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#0a0a0f]/95 backdrop-blur-xl">
      {/* ── Accent line at very top ── */}
      <div className="h-[2px] bg-gradient-to-r from-transparent via-emerald-500/60 to-transparent" />

      {/* ── Main bar ── */}
      <div className="max-w-screen-2xl mx-auto px-4 h-13 flex items-center justify-between gap-4 py-2.5">

        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 shrink-0 group">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-500/25 to-teal-600/10 border border-emerald-500/30 flex items-center justify-center group-hover:border-emerald-400/50 transition-colors">
            <Activity size={15} className="text-emerald-400" />
          </div>
          <div className="hidden sm:block">
            <p className="text-sm font-bold text-slate-100 leading-none tracking-tight">FX Analyzer</p>
            <p className="text-[9px] text-emerald-500/60 leading-none mt-0.5 font-medium tracking-widest uppercase">Fundamental</p>
          </div>
        </Link>

        {/* Desktop nav tabs — centered */}
        <nav className="hidden md:flex items-center gap-0.5 flex-1 justify-center">
          {NAV_ITEMS.map(({ href, label, icon: Icon, exact }) => {
            const active = isActive(href, exact);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[11px] font-semibold transition-all duration-200',
                  active
                    ? 'bg-emerald-500/12 text-emerald-300 border border-emerald-500/20 shadow-[0_0_16px_rgba(16,185,129,0.07)]'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04] border border-transparent'
                )}
              >
                <Icon size={12} />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Right side: time + refresh + live */}
        <div className="flex items-center gap-2.5 shrink-0">
          {lastFetch && (
            <div className="hidden lg:flex items-center gap-1.5 text-[10px] text-slate-600">
              <Clock size={9} />
              <span>{formatTimeAgo(lastFetch)}</span>
            </div>
          )}

          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={refreshing}
              title="Refresh data"
              className={cn(
                'w-7 h-7 rounded-lg flex items-center justify-center',
                'border border-slate-700/60 bg-slate-800/50 text-slate-400',
                'hover:bg-slate-700/60 hover:text-slate-200 hover:border-slate-600/60',
                'disabled:opacity-40 disabled:cursor-not-allowed',
                'transition-all duration-150'
              )}
            >
              <RefreshCw size={11} className={cn(refreshing && 'animate-spin')} />
            </button>
          )}

          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="hidden sm:block text-[9px] text-emerald-400/60 font-semibold tracking-widest uppercase">Live</span>
          </div>
        </div>
      </div>

      {/* ── Mobile horizontal tabs ── */}
      <div className="md:hidden flex items-center gap-0.5 px-3 pb-2.5 overflow-x-auto scrollbar-none">
        {NAV_ITEMS.map(({ href, label, icon: Icon, exact }) => {
          const active = isActive(href, exact);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-semibold whitespace-nowrap shrink-0 transition-all',
                active
                  ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/20'
                  : 'text-slate-500 hover:text-slate-300 border border-transparent'
              )}
            >
              <Icon size={10} />
              {label}
            </Link>
          );
        })}
      </div>
    </header>
  );
}
