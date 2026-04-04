'use client';

import { useState, useEffect, useCallback } from 'react';
import type { DashboardData } from '@/types';

const REFRESH_MS = 5 * 60 * 1000;

export function useAnalysis() {
  const [data, setData]           = useState<DashboardData | null>(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [lastFetch, setLastFetch] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(prev => prev);
    try {
      const res  = await fetch('/api/analysis', { cache: 'no-store' });
      const json = await res.json();
      if (json.success) {
        setData(json.data);
        setLastFetch(new Date().toISOString());
        setError(null);
      } else {
        setError(json.error || 'Failed to load analysis');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setLoading(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData(true);
    setRefreshing(false);
  }, [fetchData]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => {
    const t = setInterval(() => fetchData(true), REFRESH_MS);
    return () => clearInterval(t);
  }, [fetchData]);

  return { data, loading, error, lastFetch, refreshing, refresh };
}
