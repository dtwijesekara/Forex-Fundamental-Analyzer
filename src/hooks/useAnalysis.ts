'use client';

// ============================================================
// useAnalysis — shared data hook with stale detection
// Preserves last valid data when a refresh fails
// Computes data age from the actual analysis timestamp
// Fast-mode: polls every 2 min when a T1/T2 event is near/just released
// ============================================================

import { useState, useEffect, useCallback, useRef } from 'react';
import type { DashboardData, EconomicEvent } from '@/types';

const AUTO_REFRESH_MS      = 60_000;       // normal poll: every 60s
const FAST_REFRESH_MS      = 120_000;      // fast-mode poll: every 2 min
const STALE_THRESHOLD_MIN  = 65;           // mark stale if analysis > 65 min old
const AGING_THRESHOLD_MIN  = 38;           // warn "aging" if > 38 min
const EVENT_WINDOW_BEFORE  = 10 * 60_000;  // activate fast mode 10 min before T1/T2
const EVENT_WINDOW_AFTER   = 45 * 60_000;  // stay in fast mode for 45 min after release
const FAST_MODE_MAX_MS     = 90 * 60_000;  // cap fast mode at 90 min per activation

export type DataFreshness = 'fresh' | 'aging' | 'stale' | 'unknown';

export interface AnalysisState {
  data: DashboardData | null;
  loading: boolean;
  error: string | null;
  refreshing: boolean;
  /** When we last successfully fetched from the API */
  lastFetch: string | null;
  /** The actual timestamp the analysis pipeline ran (from computed_at) */
  dataComputedAt: string | null;
  /** Minutes since last analysis run */
  dataAgeMinutes: number | null;
  /** Freshness classification */
  freshness: DataFreshness;
  /** True if analysis data is older than STALE_THRESHOLD_MIN */
  isStale: boolean;
  /** True when polling at faster rate due to nearby high-impact event */
  isFastMode: boolean;
  refresh: () => Promise<void>;
}

/** Returns true if a T1/T2 event is within 10 min or fired in last 45 min */
function hasActiveHighImpactEvent(data: DashboardData): boolean {
  const now = Date.now();

  const upcomingHit = (data.upcoming_events ?? []).some((e: EconomicEvent) => {
    if (e.tier > 2) return false;
    const t = new Date(e.event_time).getTime();
    return t - now <= EVENT_WINDOW_BEFORE && t > now;
  });
  if (upcomingHit) return true;

  return (data.recent_releases ?? []).some((e: EconomicEvent) => {
    if (e.tier > 2) return false;
    const t = new Date(e.event_time).getTime();
    return now - t <= EVENT_WINDOW_AFTER;
  });
}

export function useAnalysis(): AnalysisState {
  const [data, setData]             = useState<DashboardData | null>(null);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [lastFetch, setLastFetch]   = useState<string | null>(null);
  const [isFastMode, setIsFastMode] = useState(false);

  // Track last valid data so we never blank the UI on a transient failure
  const lastValidData  = useRef<DashboardData | null>(null);
  // When fast mode should expire (epoch ms); null = not active
  const fastModeUntil  = useRef<number | null>(null);
  // Reference to the scheduled background poll timer
  const timerRef       = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Fetch from API ─────────────────────────────────────────
  const fetchData = useCallback(async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    try {
      const res  = await fetch('/api/analysis', { cache: 'no-store' });
      const json = await res.json();

      if (json.success && json.data) {
        lastValidData.current = json.data;
        setData(json.data);
        setLastFetch(new Date().toISOString());
        setError(null);

        // Activate / extend fast mode if a high-impact event is active
        if (hasActiveHighImpactEvent(json.data)) {
          const expiry = Date.now() + FAST_MODE_MAX_MS;
          // Only extend, never shorten
          if (!fastModeUntil.current || expiry > fastModeUntil.current) {
            fastModeUntil.current = expiry;
            setIsFastMode(true);
          }
        }
      } else {
        if (lastValidData.current) setData(lastValidData.current);
        setError(json.error || 'API returned no data');
      }
    } catch (err) {
      if (lastValidData.current) setData(lastValidData.current);
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Manual refresh ────────────────────────────────────────
  const refresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData(true);
    setRefreshing(false);
  }, [fetchData]);

  // ── Initial load ──────────────────────────────────────────
  useEffect(() => { fetchData(false); }, [fetchData]);

  // ── Adaptive auto-refresh (replaces fixed setInterval) ───
  useEffect(() => {
    function scheduleNext() {
      const now = Date.now();
      // Expire fast mode if past deadline
      if (fastModeUntil.current && now >= fastModeUntil.current) {
        fastModeUntil.current = null;
        setIsFastMode(false);
      }
      const delay = fastModeUntil.current ? FAST_REFRESH_MS : AUTO_REFRESH_MS;
      timerRef.current = setTimeout(async () => {
        await fetchData(true);
        scheduleNext();
      }, delay);
    }

    scheduleNext();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [fetchData]);

  // ── Derived freshness ─────────────────────────────────────
  const dataComputedAt = data?.currencies?.[0]?.computed_at
    ?? data?.regime?.computed_at
    ?? data?.last_updated
    ?? null;

  const dataAgeMinutes = dataComputedAt
    ? Math.floor((Date.now() - new Date(dataComputedAt).getTime()) / 60_000)
    : null;

  let freshness: DataFreshness = 'unknown';
  if (dataAgeMinutes !== null) {
    if (dataAgeMinutes < AGING_THRESHOLD_MIN)       freshness = 'fresh';
    else if (dataAgeMinutes < STALE_THRESHOLD_MIN)  freshness = 'aging';
    else                                             freshness = 'stale';
  }

  return {
    data,
    loading,
    error,
    refreshing,
    lastFetch,
    dataComputedAt,
    dataAgeMinutes,
    freshness,
    isStale: freshness === 'stale',
    isFastMode,
    refresh,
  };
}
