'use client';

// ============================================================
// useAnalysis — shared data hook with stale detection
// Preserves last valid data when a refresh fails
// Computes data age from the actual analysis timestamp
// ============================================================

import { useState, useEffect, useCallback, useRef } from 'react';
import type { DashboardData } from '@/types';

const AUTO_REFRESH_MS = 60_000;       // poll API every 60s
const STALE_THRESHOLD_MIN = 65;       // mark stale if analysis > 65 min old
const AGING_THRESHOLD_MIN = 38;       // warn "aging" if > 38 min

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
  refresh: () => Promise<void>;
}

export function useAnalysis(): AnalysisState {
  const [data, setData]             = useState<DashboardData | null>(null);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [lastFetch, setLastFetch]   = useState<string | null>(null);

  // Track last valid data so we never blank the UI on a transient failure
  const lastValidData = useRef<DashboardData | null>(null);

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
      } else {
        // Keep last valid data visible — just mark the error
        if (lastValidData.current) setData(lastValidData.current);
        setError(json.error || 'API returned no data');
      }
    } catch (err) {
      // Network error — preserve previous state
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

  // ── Background auto-refresh ───────────────────────────────
  useEffect(() => {
    const t = setInterval(() => fetchData(true), AUTO_REFRESH_MS);
    return () => clearInterval(t);
  }, [fetchData]);

  // ── Derived freshness ─────────────────────────────────────
  // Use the actual computed_at from currency scores, not the fetch time
  const dataComputedAt = data?.currencies?.[0]?.computed_at
    ?? data?.regime?.computed_at
    ?? data?.last_updated
    ?? null;

  const dataAgeMinutes = dataComputedAt
    ? Math.floor((Date.now() - new Date(dataComputedAt).getTime()) / 60_000)
    : null;

  let freshness: DataFreshness = 'unknown';
  if (dataAgeMinutes !== null) {
    if (dataAgeMinutes < AGING_THRESHOLD_MIN)  freshness = 'fresh';
    else if (dataAgeMinutes < STALE_THRESHOLD_MIN) freshness = 'aging';
    else freshness = 'stale';
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
    refresh,
  };
}
