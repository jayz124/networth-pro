/**
 * Financial news fetcher service.
 * Fetches relevant news articles from Google News RSS based on portfolio tickers,
 * account themes, and financial signals. No API key required.
 */
import crypto from 'crypto';

export interface NewsArticle {
  title: string;
  url: string;
  source: string;
  published: string;
  theme: string;
}

// Simple in-memory cache
const _newsCache = new Map<string, { articles: NewsArticle[]; fetchedAt: number }>();
const NEWS_CACHE_TTL = 1800 * 1000; // 30 minutes in ms

function cleanTitle(title: string): string {
  const parts = title.split(' - ');
  if (parts.length === 2 && parts[1].length < 40) {
    return parts[0].trim();
  }
  return title.trim();
}

function parseRssDate(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const dt = new Date(dateStr.trim());
    if (isNaN(dt.getTime())) return dateStr.slice(0, 20);
    return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return dateStr.slice(0, 20);
  }
}

async function fetchRss(query: string, maxResults: number = 5): Promise<NewsArticle[]> {
  const encodedQ = encodeURIComponent(query);
  const url = `https://news.google.com/rss/search?q=${encodedQ}&hl=en-US&gl=US&ceid=US:en`;

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; NetworthPro/1.0)',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) return [];

    const xmlData = await response.text();
    const articles: NewsArticle[] = [];

    // Simple XML parsing for RSS items
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match;
    let count = 0;

    while ((match = itemRegex.exec(xmlData)) !== null && count < maxResults) {
      const itemXml = match[1];

      const titleMatch = /<title>([\s\S]*?)<\/title>/.exec(itemXml);
      const linkMatch = /<link>([\s\S]*?)<\/link>/.exec(itemXml);
      const pubDateMatch = /<pubDate>([\s\S]*?)<\/pubDate>/.exec(itemXml);
      const sourceMatch = /<source[^>]*>([\s\S]*?)<\/source>/.exec(itemXml);

      const title = titleMatch?.[1]?.replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1').trim() || '';
      const link = linkMatch?.[1]?.trim() || '';
      const pubDate = pubDateMatch?.[1]?.trim() || '';
      const source = sourceMatch?.[1]?.replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1').trim() || '';

      if (title && link) {
        articles.push({
          title: cleanTitle(title),
          url: link,
          source,
          published: parseRssDate(pubDate),
          theme: '', // Set by caller
        });
        count++;
      }
    }

    return articles;
  } catch (e) {
    console.warn(`Failed to fetch news for '${query}':`, e);
    return [];
  }
}

function buildSearchQueries(
  tickers: string[],
  propertyTypes: string[],
  liabilityCategories: string[],
  accountTypes: string[],
): Array<{ query: string; theme: string }> {
  const queries: Array<{ query: string; theme: string }> = [];

  // Stock/ETF ticker queries
  for (const ticker of tickers.slice(0, 5)) {
    const clean = ticker.toUpperCase().trim();
    queries.push({ query: `${clean} stock news`, theme: `${clean} Stock` });
  }

  // Sector-level queries
  const sectorQueries = new Set<string>();
  const techTickers = new Set(['AAPL', 'MSFT', 'GOOGL', 'GOOG', 'META', 'AMZN', 'NVDA', 'TSLA', 'AMD', 'INTC', 'CRM', 'NFLX']);
  const financeTickers = new Set(['JPM', 'BAC', 'GS', 'MS', 'WFC', 'V', 'MA', 'AXP']);
  const healthTickers = new Set(['JNJ', 'UNH', 'PFE', 'MRK', 'ABT', 'TMO', 'ABBV', 'LLY']);
  const energyTickers = new Set(['XOM', 'CVX', 'COP', 'EOG', 'SLB', 'PSX']);
  const etfTickers = new Set(['SPY', 'VOO', 'VTI', 'QQQ', 'IWM', 'DIA', 'VEA', 'VWO', 'BND', 'AGG']);

  const tickerSet = new Set(tickers.map((t) => t.toUpperCase()));

  if ([...tickerSet].some((t) => techTickers.has(t))) sectorQueries.add('technology sector market outlook');
  if ([...tickerSet].some((t) => financeTickers.has(t))) sectorQueries.add('financial sector banking news');
  if ([...tickerSet].some((t) => healthTickers.has(t))) sectorQueries.add('healthcare sector pharma news');
  if ([...tickerSet].some((t) => energyTickers.has(t))) sectorQueries.add('energy sector oil market news');
  if ([...tickerSet].some((t) => etfTickers.has(t))) sectorQueries.add('stock market outlook economy');

  for (const sq of [...sectorQueries].slice(0, 2)) {
    queries.push({ query: sq, theme: 'Market Outlook' });
  }

  // Real estate queries
  if (propertyTypes.length > 0) {
    queries.push({ query: 'real estate market housing prices', theme: 'Real Estate' });
    if (propertyTypes.some((pt) => pt.toLowerCase() === 'rental')) {
      queries.push({ query: 'rental property investment landlord news', theme: 'Rental Market' });
    }
  }

  // Liability queries
  if (liabilityCategories.length > 0) {
    const catsLower = liabilityCategories.filter(Boolean).map((c) => c.toLowerCase());
    if (catsLower.some((c) => c.includes('student'))) queries.push({ query: 'student loan news policy', theme: 'Student Loans' });
    if (catsLower.some((c) => c.includes('credit'))) queries.push({ query: 'credit card interest rates personal finance', theme: 'Credit Cards' });
    if (catsLower.some((c) => c.includes('auto'))) queries.push({ query: 'auto loan rates car financing', theme: 'Auto Loans' });
  }

  // Fallback
  if (queries.length === 0) {
    queries.push({ query: 'personal finance investing tips', theme: 'Personal Finance' });
  }

  return queries.slice(0, 8);
}

export async function fetchRelevantNews(
  tickers: string[] = [],
  propertyTypes: string[] = [],
  liabilityCategories: string[] = [],
  accountTypes: string[] = [],
  maxArticles: number = 8,
): Promise<NewsArticle[]> {
  // Build cache key
  const cacheInput = `${tickers}|${propertyTypes}|${liabilityCategories}|${accountTypes}`;
  const cacheKey = crypto.createHash('md5').update(cacheInput).digest('hex');

  // Check cache
  const now = Date.now();
  const cached = _newsCache.get(cacheKey);
  if (cached && now - cached.fetchedAt < NEWS_CACHE_TTL) {
    return cached.articles;
  }

  const queries = buildSearchQueries(tickers, propertyTypes, liabilityCategories, accountTypes);

  const allArticles: NewsArticle[] = [];
  const seenTitles = new Set<string>();

  for (const qInfo of queries) {
    const articles = await fetchRss(qInfo.query, 3);
    for (const article of articles) {
      const titleKey = article.title.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 50);
      if (!seenTitles.has(titleKey)) {
        seenTitles.add(titleKey);
        article.theme = qInfo.theme;
        allArticles.push(article);
      }
    }
  }

  const result = allArticles.slice(0, maxArticles);

  // Cache result
  _newsCache.set(cacheKey, { articles: result, fetchedAt: now });

  // Prune old cache entries
  if (_newsCache.size > 50) {
    for (const [k, v] of _newsCache.entries()) {
      if (now - v.fetchedAt > NEWS_CACHE_TTL) {
        _newsCache.delete(k);
      }
    }
  }

  return result;
}
