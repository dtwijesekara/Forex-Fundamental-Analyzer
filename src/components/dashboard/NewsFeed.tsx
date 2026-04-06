'use client';

// ============================================================
// FOREX NEWS FEED COMPONENT
// Displays recent forex news with sentiment, currency tags, links
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { StateCard } from '@/components/ui/StateCard';
import { cn, formatTimeAgo } from '@/lib/utils';
import {
  Newspaper, ExternalLink, TrendingUp, TrendingDown,
  Minus, RefreshCw, AlertTriangle,
} from 'lucide-react';
import type { NewsItem } from '@/engines/news/collector';

const SOURCE_LABELS: Record<string, string> = {
  forexlive:       'ForexLive',
  fxstreet:        'FXStreet',
  dailyfx:         'DailyFX',
  reuters_forex:   'Reuters',
  investing_forex: 'Investing.com',
  marketwatch:     'MarketWatch',
};

const CURRENCY_LIST = ['ALL', 'USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'NZD', 'CHF'];

export function NewsFeed() {
  const [news, setNews]           = useState<NewsItem[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter]       = useState('ALL');
  const [impactFilter, setImpact] = useState<'all' | 'high'>('all');

  const fetchNews = useCallback(async (isBackground = false) => {
    if (isBackground) setRefreshing(true);
    else              setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({ limit: '40', hours: '24' });
      if (filter !== 'ALL')          params.set('currency', filter);
      if (impactFilter !== 'all')    params.set('impact', impactFilter);

      const res  = await fetch(`/api/news?${params}`, { cache: 'no-store' });
      const json = await res.json();
      if (json.success) {
        setNews(json.data ?? []);
      } else {
        setError(json.error || 'Failed to load news');
        // Keep existing news on background refresh
        if (!isBackground) setNews([]);
      }
    } catch {
      setError('Could not reach news API');
      if (!isBackground) setNews([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filter, impactFilter]);

  // Re-fetch on filter change
  useEffect(() => { fetchNews(false); }, [fetchNews]);

  // Background refresh every 5 minutes
  useEffect(() => {
    const t = setInterval(() => fetchNews(true), 5 * 60_000);
    return () => clearInterval(t);
  }, [fetchNews]);

  const displayed = news.slice(0, 20);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Newspaper size={13} className="text-slate-500" />
          <CardTitle>Forex News</CardTitle>
          <span className="text-[10px] text-slate-600">24h</span>
          {refreshing && <RefreshCw size={9} className="text-emerald-400 animate-spin" />}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setImpact('all')}
            className={cn(
              'text-[9px] px-1.5 py-0.5 rounded font-semibold transition-colors',
              impactFilter === 'all' ? 'bg-slate-600 text-white' : 'text-slate-500 hover:text-slate-300'
            )}
          >All</button>
          <button
            onClick={() => setImpact('high')}
            className={cn(
              'text-[9px] px-1.5 py-0.5 rounded font-semibold transition-colors',
              impactFilter === 'high' ? 'bg-rose-500/30 text-rose-300' : 'text-slate-500 hover:text-slate-300'
            )}
          >High</button>
        </div>
      </CardHeader>

      {/* Currency filter tabs */}
      <div className="flex gap-0.5 px-3 pb-2 overflow-x-auto scrollbar-none">
        {CURRENCY_LIST.map(c => (
          <button
            key={c}
            onClick={() => setFilter(c)}
            className={cn(
              'px-2 py-0.5 rounded text-[9px] font-bold shrink-0 transition-colors',
              filter === c
                ? 'bg-slate-600 text-slate-100'
                : 'text-slate-600 hover:text-slate-400'
            )}
          >
            {c}
          </button>
        ))}
      </div>

      <CardContent className="p-0">
        {loading ? (
          <div className="space-y-0 divide-y divide-white/[0.04]">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="px-3 py-2.5 flex items-start gap-2">
                <div className="skeleton w-3 h-3 rounded mt-0.5 shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="skeleton h-3 rounded w-full" />
                  <div className="skeleton h-2.5 rounded w-3/4" />
                  <div className="skeleton h-2 rounded w-1/3" />
                </div>
              </div>
            ))}
          </div>
        ) : error && news.length === 0 ? (
          <StateCard
            type="error"
            compact
            title="News unavailable"
            message={error}
            onRetry={() => fetchNews(false)}
          />
        ) : displayed.length === 0 ? (
          <StateCard
            type="empty"
            compact
            title={filter !== 'ALL' ? `No ${filter} news in last 24h` : 'No news yet'}
            message={filter !== 'ALL'
              ? 'Try removing the currency filter'
              : 'Run the news collector to populate this feed'
            }
            onRetry={filter !== 'ALL' ? () => setFilter('ALL') : () => fetchNews(false)}
          />
        ) : (
          <>
            {error && (
              <div className="mx-3 mb-2 flex items-center gap-1.5 text-[9px] text-amber-400 bg-amber-500/8 border border-amber-500/20 rounded-lg px-2 py-1.5">
                <AlertTriangle size={9} /> Showing cached news — refresh failed
              </div>
            )}
            <div className="divide-y divide-white/[0.04] max-h-[480px] overflow-y-auto">
              {displayed.map(item => (
                <NewsRow key={item.id} item={item} />
              ))}
            </div>
            {news.length > 20 && (
              <div className="px-3 py-2 text-center border-t border-white/[0.04]">
                <span className="text-[9px] text-slate-600">
                  Showing 20 of {news.length} — apply a filter to narrow results
                </span>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ── SINGLE NEWS ROW ───────────────────────────────────────────
function NewsRow({ item }: { item: NewsItem }) {
  const SentimentIcon = item.sentiment === 'bullish'
    ? TrendingUp : item.sentiment === 'bearish'
    ? TrendingDown : Minus;

  const sentimentColor = item.sentiment === 'bullish'
    ? 'text-emerald-400'
    : item.sentiment === 'bearish'
    ? 'text-red-400'
    : 'text-slate-500';

  const impactDot = item.impact === 'high'
    ? 'bg-rose-500' : item.impact === 'medium'
    ? 'bg-amber-500' : 'bg-slate-700';

  return (
    <div className="px-3 py-2.5 hover:bg-white/[0.02] transition-colors group">
      {/* Top row */}
      <div className="flex items-start gap-2">
        <SentimentIcon size={11} className={cn('shrink-0 mt-0.5', sentimentColor)} />
        <div className="flex-1 min-w-0">
          {item.url ? (
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] text-slate-200 hover:text-white leading-snug line-clamp-2 inline-flex items-start gap-1 group-hover:underline"
            >
              {item.title}
              <ExternalLink size={8} className="shrink-0 mt-0.5 opacity-0 group-hover:opacity-40 transition-opacity" />
            </a>
          ) : (
            <p className="text-[11px] text-slate-200 leading-snug line-clamp-2">{item.title}</p>
          )}
        </div>
      </div>

      {/* Meta row */}
      <div className="flex items-center gap-2 mt-1.5 pl-5 flex-wrap">
        <div className="flex items-center gap-1">
          <span className={cn('w-1.5 h-1.5 rounded-full', impactDot)} />
          <span className="text-[9px] text-slate-600 capitalize">{item.impact}</span>
        </div>
        <span className="text-[9px] text-slate-600">
          {SOURCE_LABELS[item.source] ?? item.source}
        </span>
        <span className="text-[9px] text-slate-700">
          {formatTimeAgo(item.published_at)}
        </span>

        {/* Currency badges */}
        <div className="flex gap-1 ml-auto">
          {item.currencies.slice(0, 4).map(c => (
            <span
              key={c}
              className={cn(
                'text-[8px] font-bold px-1 py-0.5 rounded leading-none',
                item.sentiment === 'bullish'
                  ? 'bg-emerald-500/15 text-emerald-400'
                  : item.sentiment === 'bearish'
                  ? 'bg-red-500/15 text-red-400'
                  : 'bg-slate-700/50 text-slate-500'
              )}
            >
              {c}
            </span>
          ))}
        </div>
      </div>

      {/* Tags */}
      {item.tags.length > 0 && (
        <div className="flex gap-1 mt-1 pl-5 flex-wrap">
          {item.tags.slice(0, 4).map(tag => (
            <span key={tag} className="text-[8px] text-slate-700 bg-slate-800/40 px-1 rounded">
              #{tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
