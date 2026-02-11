/**
 * Market data service using Yahoo Finance and CoinGecko.
 * Provides security search, quotes, and batch price fetching with DB-backed caching.
 */
import { prisma } from '@/lib/prisma';

// Cache TTL in minutes
const PRICE_CACHE_TTL = 5;

// Common tickers for search fallback
const COMMON_TICKERS = [
    'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'TSLA', 'NVDA', 'AMD', 'INTC',
    'JPM', 'BAC', 'WFC', 'GS', 'MS', 'V', 'MA', 'PYPL',
    'JNJ', 'PFE', 'UNH', 'ABBV', 'MRK', 'LLY',
    'XOM', 'CVX', 'COP', 'OXY', 'SLB',
    'VOO', 'SPY', 'QQQ', 'VTI', 'IWM', 'DIA', 'VUG', 'VTV',
    'BTC-USD', 'ETH-USD', 'SOL-USD', 'BNB-USD', 'XRP-USD', 'ADA-USD',
    'O', 'VNQ', 'SCHH', 'IYR', 'XLRE',
    'BND', 'AGG', 'TLT', 'LQD', 'HYG',
];

interface QuoteResult {
    ticker: string;
    name?: string;
    current_price?: number | null;
    previous_close?: number | null;
    change_percent?: number | null;
    fetched_at?: string;
    cached?: boolean;
}

interface SearchResult {
    ticker: string;
    name: string;
    asset_type: string;
    exchange?: string;
    currency: string;
    sector?: string;
    current_price?: number | null;
}

function determineAssetType(info: Record<string, unknown>): string {
    const quoteType = (String(info.quoteType ?? '')).toUpperCase();
    const symbol = String(info.symbol ?? '');

    if (quoteType === 'CRYPTOCURRENCY' || symbol.endsWith('-USD')) return 'crypto';
    if (quoteType === 'ETF') return 'etf';
    if (quoteType === 'MUTUALFUND') return 'mutual_fund';
    if (info.sector === 'Real Estate') return 'reit';
    return 'stock';
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getYahooFinance(): Promise<any> {
    return (await import('yahoo-finance2')).default;
}

export async function searchSecurities(query: string, limit = 10): Promise<SearchResult[]> {
    if (!query || query.length < 1) return [];

    const yahooFinance = await getYahooFinance();
    const results: SearchResult[] = [];

    // Try exact ticker match first
    try {
        const quote = await yahooFinance.quote(query.toUpperCase());
        if (quote && quote.symbol) {
            results.push({
                ticker: quote.symbol,
                name: quote.shortName || quote.longName || query.toUpperCase(),
                asset_type: determineAssetType(quote as Record<string, unknown>),
                exchange: quote.exchange,
                currency: quote.currency || 'USD',
                sector: undefined,
                current_price: quote.regularMarketPrice,
            });
        }
    } catch {
        // Ticker not found, continue to broader search
    }

    // Try yahoo search API
    try {
        const searchResults = await yahooFinance.search(query, { quotesCount: limit });
        for (const item of searchResults.quotes ?? []) {
            const sym = item.symbol as string | undefined;
            if (sym && !results.find((r) => r.ticker === sym)) {
                results.push({
                    ticker: sym,
                    name: item.shortname || item.longname || sym,
                    asset_type: determineAssetType(item as Record<string, unknown>),
                    exchange: item.exchange as string | undefined,
                    currency: (item.currency as string) || 'USD',
                    sector: undefined,
                    current_price: null,
                });
            }
        }
    } catch {
        // Search API failed, fall through to common tickers
    }

    // Fallback: match against common tickers
    if (results.length < limit) {
        const queryUpper = query.toUpperCase();
        const matching = COMMON_TICKERS.filter(
            (t) => t.includes(queryUpper) && !results.find((r) => r.ticker === t),
        ).slice(0, limit - results.length);

        for (const ticker of matching) {
            results.push({
                ticker,
                name: ticker,
                asset_type: ticker.endsWith('-USD') ? 'crypto' : 'stock',
                currency: 'USD',
            });
        }
    }

    return results.slice(0, limit);
}

export async function getQuote(ticker: string): Promise<QuoteResult | null> {
    ticker = ticker.toUpperCase();

    // Check DB cache first
    const cutoff = new Date(Date.now() - PRICE_CACHE_TTL * 60 * 1000);
    const cached = await prisma.priceCache.findFirst({
        where: { ticker },
        orderBy: { fetched_at: 'desc' },
    });

    if (cached && cached.fetched_at > cutoff) {
        return {
            ticker: cached.ticker,
            current_price: cached.current_price,
            previous_close: cached.previous_close,
            change_percent: cached.change_percent,
            fetched_at: cached.fetched_at.toISOString(),
            cached: true,
        };
    }

    // Fetch fresh data
    try {
        const yahooFinance = await getYahooFinance();
        const quote = await yahooFinance.quote(ticker);

        if (!quote || !quote.symbol) return null;

        const currentPrice = quote.regularMarketPrice ?? null;
        const previousClose = quote.regularMarketPreviousClose ?? null;
        let changePercent: number | null = null;
        if (currentPrice && previousClose && previousClose > 0) {
            changePercent = ((currentPrice - previousClose) / previousClose) * 100;
        }

        // Upsert cache
        if (cached) {
            await prisma.priceCache.update({
                where: { id: cached.id },
                data: {
                    current_price: currentPrice ?? 0,
                    previous_close: previousClose,
                    change_percent: changePercent,
                    fetched_at: new Date(),
                },
            });
        } else {
            await prisma.priceCache.create({
                data: {
                    ticker,
                    current_price: currentPrice ?? 0,
                    previous_close: previousClose,
                    change_percent: changePercent,
                    fetched_at: new Date(),
                },
            });
        }

        // Upsert SecurityInfo
        const existing = await prisma.securityInfo.findUnique({ where: { ticker } });
        if (!existing) {
            await prisma.securityInfo.create({
                data: {
                    ticker,
                    name: quote.shortName || quote.longName || ticker,
                    asset_type: determineAssetType(quote as Record<string, unknown>),
                    exchange: quote.exchange,
                    currency: quote.currency || 'USD',
                    last_updated: new Date(),
                },
            });
        }

        return {
            ticker,
            name: quote.shortName || quote.longName || undefined,
            current_price: currentPrice,
            previous_close: previousClose,
            change_percent: changePercent,
            fetched_at: new Date().toISOString(),
            cached: false,
        };
    } catch (e) {
        console.error(`Error fetching quote for ${ticker}:`, e);
        return null;
    }
}

export async function getBatchQuotes(
    tickers: string[],
): Promise<Record<string, QuoteResult>> {
    if (!tickers.length) return {};

    tickers = tickers.map((t) => t.toUpperCase());
    const results: Record<string, QuoteResult> = {};
    const tickersToFetch: string[] = [];
    const cutoff = new Date(Date.now() - PRICE_CACHE_TTL * 60 * 1000);

    // Check cache for each
    for (const ticker of tickers) {
        const cached = await prisma.priceCache.findFirst({
            where: { ticker },
            orderBy: { fetched_at: 'desc' },
        });

        if (cached && cached.fetched_at > cutoff) {
            results[ticker] = {
                ticker: cached.ticker,
                current_price: cached.current_price,
                previous_close: cached.previous_close,
                change_percent: cached.change_percent,
                fetched_at: cached.fetched_at.toISOString(),
                cached: true,
            };
        } else {
            tickersToFetch.push(ticker);
        }
    }

    // Fetch remaining tickers individually (yahoo-finance2 batch is unreliable)
    for (const ticker of tickersToFetch) {
        const quote = await getQuote(ticker);
        if (quote) {
            results[ticker] = quote;
        }
    }

    return results;
}
