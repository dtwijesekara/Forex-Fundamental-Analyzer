// ============================================================
// FOREX NEWS COLLECTOR
// Fetches from free RSS feeds: ForexLive, FXStreet, DailyFX, Reuters
// Parses headlines, detects currencies mentioned, scores sentiment
// ============================================================

import Parser from 'rss-parser';
import { createAdminClient } from '@/lib/supabase';

const rssParser = new Parser({ timeout: 10000 });

// ─────────────────────────────────────────────────────────────
// RSS FEED SOURCES
// ─────────────────────────────────────────────────────────────
const RSS_FEEDS = [
  {
    source: 'forexlive',
    url: 'https://www.forexlive.com/feed/news',
    impact: 'high' as const,
  },
  {
    source: 'dailyfx',
    url: 'https://www.dailyfx.com/feeds/all',
    impact: 'medium' as const,
  },
  {
    source: 'fxstreet',
    url: 'https://www.fxstreet.com/rss/news',
    impact: 'medium' as const,
  },
  {
    source: 'reuters_forex',
    url: 'https://feeds.reuters.com/reuters/businessNews',
    impact: 'high' as const,
  },
];

// ─────────────────────────────────────────────────────────────
// CURRENCY DETECTION KEYWORDS
// ─────────────────────────────────────────────────────────────
const CURRENCY_PATTERNS: Record<string, string[]> = {
  USD: ['dollar', 'usd', 'fed', 'federal reserve', 'fomc', 'us jobs', 'nfp', 'u.s.'],
  EUR: ['euro', 'eur', 'ecb', 'european central bank', 'eurozone', 'draghi', 'lagarde'],
  GBP: ['pound', 'sterling', 'gbp', 'bank of england', 'boe', 'mpc', 'uk inflation', 'bailey'],
  JPY: ['yen', 'jpy', 'bank of japan', 'boj', 'ueda', 'japan'],
  AUD: ['aussie', 'aud', 'rba', 'reserve bank of australia', 'australia'],
  CAD: ['loonie', 'cad', 'bank of canada', 'boc', 'canada', 'oil'],
  NZD: ['kiwi', 'nzd', 'rbnz', 'reserve bank of new zealand', 'new zealand'],
  CHF: ['franc', 'chf', 'snb', 'swiss national bank', 'switzerland'],
};

// ─────────────────────────────────────────────────────────────
// SENTIMENT KEYWORDS
// ─────────────────────────────────────────────────────────────
const BULLISH_WORDS = [
  'hawkish', 'hike', 'rate hike', 'tighten', 'strong', 'beat', 'surge', 'rally',
  'gains', 'rise', 'higher', 'positive', 'robust', 'upbeat', 'optimism', 'above forecast',
  'better than expected', 'exceed', 'hot inflation', 'job growth', 'bullish',
];
const BEARISH_WORDS = [
  'dovish', 'cut', 'rate cut', 'ease', 'weak', 'miss', 'drop', 'fall', 'lower',
  'negative', 'concern', 'worry', 'slowdown', 'recession', 'below forecast',
  'worse than expected', 'miss expectations', 'slump', 'plunge', 'bearish',
];
const HIGH_IMPACT_WORDS = [
  'rate decision', 'interest rate', 'cpi', 'inflation', 'nfp', 'payroll', 'gdp',
  'central bank', 'fomc', 'ecb', 'boe', 'boj', 'emergency', 'shock', 'surprise',
  'intervention', 'recession', 'crisis',
];

// ─────────────────────────────────────────────────────────────
// MAIN COLLECTOR
// ─────────────────────────────────────────────────────────────
export async function collectForexNews(): Promise<number> {
  const db = createAdminClient();
  let inserted = 0;

  for (const feed of RSS_FEEDS) {
    try {
      const result = await rssParser.parseURL(feed.url);
      const items = (result.items || []).slice(0, 20); // last 20 per feed

      for (const item of items) {
        const title   = item.title?.trim() || '';
        const summary = item.contentSnippet?.trim() || item.content?.trim() || '';
        const url     = item.link || item.guid || '';
        const pubDate = item.pubDate ? new Date(item.pubDate) : new Date();

        // Skip very old items (>48h)
        if (Date.now() - pubDate.getTime() > 48 * 3600 * 1000) continue;
        if (!title || !url) continue;

        const text = `${title} ${summary}`.toLowerCase();

        const currencies = detectCurrencies(text);
        const sentiment  = detectSentiment(text);
        const impact     = detectImpact(text, feed.impact);
        const tags       = extractTags(text);
        const pairs      = detectPairs(currencies);

        // Upsert by URL
        const { error } = await db.from('news_items').upsert({
          title,
          summary: summary.slice(0, 500),
          url,
          source: feed.source,
          published_at: pubDate.toISOString(),
          currencies,
          pairs,
          sentiment,
          impact,
          tags,
          fetched_at: new Date().toISOString(),
        }, { onConflict: 'url', ignoreDuplicates: true });

        if (!error) inserted++;
      }
    } catch (err) {
      console.warn(`[News] Failed to fetch ${feed.source}:`, err instanceof Error ? err.message : err);
    }
  }

  // Prune old news (keep max 7 days)
  const cutoff = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
  await db.from('news_items').delete().lt('published_at', cutoff);

  return inserted;
}

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────
function detectCurrencies(text: string): string[] {
  const found: string[] = [];
  for (const [currency, patterns] of Object.entries(CURRENCY_PATTERNS)) {
    if (patterns.some(p => text.includes(p))) {
      found.push(currency);
    }
  }
  return [...new Set(found)];
}

function detectSentiment(text: string): 'bullish' | 'bearish' | 'neutral' {
  const bullScore = BULLISH_WORDS.filter(w => text.includes(w)).length;
  const bearScore = BEARISH_WORDS.filter(w => text.includes(w)).length;
  if (bullScore > bearScore + 1) return 'bullish';
  if (bearScore > bullScore + 1) return 'bearish';
  return 'neutral';
}

function detectImpact(text: string, feedDefault: 'high' | 'medium' | 'low'): 'high' | 'medium' | 'low' {
  if (HIGH_IMPACT_WORDS.some(w => text.includes(w))) return 'high';
  return feedDefault;
}

function extractTags(text: string): string[] {
  const tags: string[] = [];
  const TAG_KEYWORDS = [
    'inflation', 'recession', 'rate hike', 'rate cut', 'nfp', 'gdp', 'cpi', 'pmi',
    'fomc', 'ecb', 'boe', 'boj', 'rba', 'boc', 'rbnz', 'snb',
    'oil', 'gold', 'risk-on', 'risk-off', 'geopolitical',
  ];
  for (const tag of TAG_KEYWORDS) {
    if (text.includes(tag)) tags.push(tag);
  }
  return tags.slice(0, 6);
}

function detectPairs(currencies: string[]): string[] {
  const PRIORITY_PAIRS = [
    'EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD', 'NZDUSD',
    'USDCAD', 'USDCHF', 'EURJPY', 'GBPJPY', 'AUDJPY',
  ];
  return PRIORITY_PAIRS.filter(pair =>
    currencies.includes(pair.slice(0, 3)) || currencies.includes(pair.slice(3, 6))
  );
}

// ─────────────────────────────────────────────────────────────
// GET RECENT NEWS (for API/UI)
// ─────────────────────────────────────────────────────────────
export async function getRecentNews(options: {
  limit?: number;
  currency?: string;
  impact?: string;
  hoursBack?: number;
} = {}): Promise<NewsItem[]> {
  const db = createAdminClient();
  const { limit = 30, currency, impact, hoursBack = 12 } = options;
  const since = new Date(Date.now() - hoursBack * 3600 * 1000).toISOString();

  let query = db
    .from('news_items')
    .select('*')
    .gte('published_at', since)
    .order('published_at', { ascending: false })
    .limit(limit);

  if (currency) query = query.contains('currencies', [currency]);
  if (impact)   query = query.eq('impact', impact);

  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as NewsItem[];
}

export interface NewsItem {
  id: string;
  title: string;
  summary?: string;
  url?: string;
  source: string;
  published_at: string;
  currencies: string[];
  pairs: string[];
  sentiment: 'bullish' | 'bearish' | 'neutral';
  impact: 'high' | 'medium' | 'low';
  tags: string[];
}
