'use client';

// ============================================================
// FOREX NEWS FEED COMPONENT
// Displays recent forex news with sentiment, currency tags, links
// ============================================================

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { cn, formatTimeAgo } from '@/lib/utils';
import { Newspaper, ExternalLink, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { NewsItem } from '@/engines/news/collector';

const SOURCE_LABELS: Record<string, string> = {
  forexlive: 'ForexLive',
  fxstreet: 'FXStreet',
  dailyfx: 'DailyFX',
  reuters_forex: 'Reuters',
};

const CURRENCY_LIST = ['ALL', 'USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'NZD', 'CHF'];

export function NewsFeed() {
  const [news, setNews]           = useState<NewsItem[]>([]);
  const [loading, setLoading]     = useState(true);
  const [filter, setFilter]       = useState('ALL');
  const [impactFilter, setImpact] = useState<'all' | 'high' | 'medium'>('all');

  const fetchNews = () => {
    setLoading(true);
    const params = new URLSearchParams({ limit: '40', hours: '24' });
    if (filter !== 'ALL') params.set('currency', filter);
    if (impactFilter !== 'all') params.set('impact', impactFilter);

    fetch(`/api/news?${params}`)
      .then(r => r.json())
      .then(json => { if (json.success) setNews(json.data); })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchNews(); }, [filter, impactFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-refresh every 5 minutes
  useEffect(() => {
    const t = setInterval(fetchNews, 5 * 60 * 1000);
    return () => clearInterval(t);
  }, [filter, impactFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  const displayed = news.slice(0, 20);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Newspaper size={13} className="text-slate-500" />
          <CardTitle>Forex News</CardTitle>
          <span className="text-[10px] text-slate-600">24h</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setImpact('all')}
            className={cn('text-[9px] px-1.5 py-0.5 rounded font-semibold',
              impactFilter === 'all' ? 'bg-slate-600 text-white' : 'text-slate-500')}
          >All</button>
          <button
            onClick={() => setImpact('high')}
            className={cn('text-[9px] px-1.5 py-0.5 rounded font-semibold',
              impactFilter === 'high' ? 'bg-rose-500/30 text-rose-300' : 'text-slate-500')}
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
          <div className="p-6 text-center text-slate-600 text-xs">Loading news...</div>
        ) : displayed.length === 0 ? (
          <div className="p-6 text-center">
            <p className="text-slate-600 text-xs">No news yet</p>
            <p className="text-slate-700 text-[10px] mt-1">Run news cron or add news table to Supabase first</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-700/30 max-h-[480px] overflow-y-auto">
            {displayed.map(item => (
              <NewsRow key={item.id} item={item} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────
// SINGLE NEWS ROW
// ─────────────────────────────────────────────────────────────
function NewsRow({ item }: { item: NewsItem }) {
  const SentimentIcon = item.sentiment === 'bullish'
    ? TrendingUp : item.sentiment === 'bearish' ? TrendingDown : Minus;

  const sentimentColor = item.sentiment === 'bullish'
    ? 'text-emerald-400'
    : item.sentiment === 'bearish'
    ? 'text-red-400'
    : 'text-slate-500';

  const impactDot = item.impact === 'high'
    ? 'bg-rose-500' : item.impact === 'medium'
    ? 'bg-amber-500' : 'bg-slate-600';

  return (
    <div className="px-3 py-2.5 hover:bg-slate-800/30 transition-colors group">
      {/* Top row */}
      <div className="flex items-start gap-2">
        {/* Sentiment icon */}
        <SentimentIcon size={12} className={cn('shrink-0 mt-0.5', sentimentColor)} />

        {/* Title */}
        <div className="flex-1 min-w-0">
          {item.url ? (
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] text-slate-200 hover:text-white leading-snug group-hover:underline line-clamp-2 flex items-start gap-1"
            >
              {item.title}
              <ExternalLink size={8} className="shrink-0 mt-0.5 opacity-0 group-hover:opacity-50 transition-opacity" />
            </a>
          ) : (
            <p className="text-[11px] text-slate-200 leading-snug line-clamp-2">{item.title}</p>
          )}
        </div>
      </div>

      {/* Bottom row — meta */}
      <div className="flex items-center gap-2 mt-1.5 pl-5 flex-wrap">
        {/* Impact dot */}
        <div className="flex items-center gap-1">
          <span className={cn('w-1.5 h-1.5 rounded-full', impactDot)} />
          <span className="text-[9px] text-slate-600 capitalize">{item.impact}</span>
        </div>

        {/* Source */}
        <span className="text-[9px] text-slate-600">
          {SOURCE_LABELS[item.source] || item.source}
        </span>

        {/* Time */}
        <span className="text-[9px] text-slate-700">
          {formatTimeAgo(item.published_at)}
        </span>

        {/* Currency badges */}
        <div className="flex gap-1 ml-auto">
          {item.currencies.slice(0, 4).map(c => (
            <span
              key={c}
              className={cn(
                'text-[8px] font-bold px-1 py-0.5 rounded',
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
            <span key={tag} className="text-[8px] text-slate-700 bg-slate-800/60 px-1 rounded">
              #{tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
