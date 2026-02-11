/**
 * Foreign exchange conversion service.
 *
 * Fetches live rates from the Frankfurter API (free, no API key),
 * caches them in memory with a 1-hour TTL, and provides
 * fallback rates when the API is unreachable.
 */

// Cache TTL in milliseconds (1 hour)
const CACHE_TTL = 3600 * 1000;

interface RateCache {
    rates: Record<string, number>;
    fetchedAt: number;
}

let rateCache: RateCache | null = null;

// Fallback USD-based rates (approximate, for offline use)
export const FALLBACK_RATES: Record<string, number> = {
    USD: 1.0,
    EUR: 0.92,
    GBP: 0.79,
    CAD: 1.36,
    AUD: 1.53,
    JPY: 149.5,
    CHF: 0.88,
    CNY: 7.24,
    INR: 83.12,
    SGD: 1.34,
    HKD: 7.82,
    NZD: 1.64,
    SEK: 10.42,
    NOK: 10.55,
    DKK: 6.87,
    AED: 3.67,
    SAR: 3.75,
    KRW: 1320.0,
    BRL: 4.97,
    MXN: 17.15,
    ZAR: 18.6,
    THB: 35.2,
    MYR: 4.72,
    IDR: 15650.0,
    PHP: 56.2,
    PLN: 4.02,
    TRY: 30.25,
    RUB: 92.5,
    ILS: 3.67,
};

export const SUPPORTED_CURRENCIES = Object.keys(FALLBACK_RATES);

async function fetchLiveRates(): Promise<Record<string, number> | null> {
    const targets = SUPPORTED_CURRENCIES.filter((c) => c !== 'USD').join(',');
    const url = `https://api.frankfurter.app/latest?from=USD&to=${targets}`;
    try {
        const resp = await fetch(url, { signal: AbortSignal.timeout(5000) });
        if (!resp.ok) return null;
        const data = await resp.json();
        const rates: Record<string, number> = { USD: 1.0, ...data.rates };
        return rates;
    } catch {
        return null;
    }
}

export async function getRates(): Promise<Record<string, number>> {
    const now = Date.now();

    // Return cached if fresh
    if (rateCache && now - rateCache.fetchedAt < CACHE_TTL) {
        return rateCache.rates;
    }

    // Try live fetch
    const live = await fetchLiveRates();
    if (live) {
        rateCache = { rates: live, fetchedAt: now };
        return live;
    }

    // Stale cache preferred over hardcoded
    if (rateCache) {
        return rateCache.rates;
    }

    // Last resort: hardcoded fallback
    return FALLBACK_RATES;
}

export async function convert(
    amount: number,
    fromCurrency: string,
    toCurrency: string,
): Promise<number> {
    if (fromCurrency === toCurrency) return amount;

    const rates = await getRates();
    const fromRate = rates[fromCurrency] ?? 1.0;
    const toRate = rates[toCurrency] ?? 1.0;

    // Convert: amount -> USD -> target
    const usdAmount = amount / fromRate;
    return usdAmount * toRate;
}

export async function convertToBase(
    amount: number,
    fromCurrency: string,
    baseCurrency: string,
): Promise<number> {
    return convert(amount, fromCurrency, baseCurrency);
}
