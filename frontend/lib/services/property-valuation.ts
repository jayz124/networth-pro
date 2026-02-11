/**
 * Property valuation service using RentCast API.
 *
 * Features:
 * - Property value estimates (AVM)
 * - Rent estimates
 * - Property records with sale history
 * - DB-backed caching (30-day TTL for valuations)
 * - Graceful degradation when API key not configured
 */
import { prisma } from '@/lib/prisma';
import { decrypt } from '@/lib/services/encryption';

const RENTCAST_BASE_URL = 'https://api.rentcast.io/v1';
const VALUATION_CACHE_TTL_DAYS = 30;
const REQUEST_TIMEOUT_MS = 15_000;

// ---------------------------------------------------------------------------
// API key helpers
// ---------------------------------------------------------------------------

async function getRentCastApiKey(): Promise<string | null> {
    const setting = await prisma.appSettings.findUnique({
        where: { key: 'rentcast_api_key' },
    });
    if (!setting?.value) return null;
    return decrypt(setting.value);
}

export async function isRentCastAvailable(): Promise<boolean> {
    const key = await getRentCastApiKey();
    return Boolean(key);
}

// ---------------------------------------------------------------------------
// Low-level HTTP helper
// ---------------------------------------------------------------------------

async function callRentCast(
    endpoint: string,
    params: Record<string, string>,
): Promise<Record<string, unknown> | Record<string, unknown>[] | null> {
    const apiKey = await getRentCastApiKey();
    if (!apiKey) {
        console.warn('RentCast API key not configured');
        return null;
    }

    const url = new URL(`${RENTCAST_BASE_URL}${endpoint}`);
    for (const [k, v] of Object.entries(params)) {
        url.searchParams.set(k, v);
    }

    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

        const resp = await fetch(url.toString(), {
            headers: {
                Accept: 'application/json',
                'X-Api-Key': apiKey,
            },
            signal: controller.signal,
        });

        clearTimeout(timeout);

        if (resp.status === 401) {
            console.error('RentCast API: Invalid API key');
            return null;
        }
        if (resp.status === 429) {
            console.warn('RentCast API: Rate limit exceeded (50 calls/month)');
            return null;
        }
        if (resp.status === 404) {
            console.info(`RentCast API: No data found for params`, params);
            return null;
        }
        if (!resp.ok) {
            const text = await resp.text();
            console.error(`RentCast API error ${resp.status}: ${text.slice(0, 200)}`);
            return null;
        }

        return (await resp.json()) as Record<string, unknown> | Record<string, unknown>[];
    } catch (err: unknown) {
        if (err instanceof DOMException && err.name === 'AbortError') {
            console.error('RentCast API: Request timed out');
        } else {
            console.error('RentCast API error:', err);
        }
        return null;
    }
}

// ---------------------------------------------------------------------------
// Address search (1 API call)
// ---------------------------------------------------------------------------

export interface PropertySearchResult {
    address: string;
    city: string;
    state: string;
    zip_code: string;
    provider_property_id: string;
    property_type: string;
    bedrooms: number | null;
    bathrooms: number | null;
    square_footage: number | null;
    year_built: number | null;
    lot_size: number | null;
    last_sale_price: number | null;
    last_sale_date: string | null;
    tax_assessed_value: number | null;
    provider: string;
}

export async function searchAddress(query: string): Promise<PropertySearchResult[]> {
    const available = await isRentCastAvailable();
    if (!available) return [];

    const data = await callRentCast('/properties', { address: query });
    if (!data) return [];

    const properties = Array.isArray(data) ? data : [data];

    return properties.map((prop) => ({
        address:
            (prop.formattedAddress as string) ||
            (prop.addressLine1 as string) ||
            '',
        city: (prop.city as string) || '',
        state: (prop.state as string) || '',
        zip_code: (prop.zipCode as string) || '',
        provider_property_id: (prop.id as string) || '',
        property_type: (prop.propertyType as string) || '',
        bedrooms: (prop.bedrooms as number) ?? null,
        bathrooms: (prop.bathrooms as number) ?? null,
        square_footage: (prop.squareFootage as number) ?? null,
        year_built: (prop.yearBuilt as number) ?? null,
        lot_size: (prop.lotSize as number) ?? null,
        last_sale_price: (prop.lastSalePrice as number) ?? null,
        last_sale_date: (prop.lastSaleDate as string) ?? null,
        tax_assessed_value:
            (prop.assessorMarketValue as number) ??
            (prop.taxAssessment as number) ??
            null,
        provider: 'rentcast',
    }));
}

// ---------------------------------------------------------------------------
// Value estimate (1 API call, cached 30 days)
// ---------------------------------------------------------------------------

export interface ValuationResult {
    estimated_value: number | null;
    value_range_low: number | null;
    value_range_high: number | null;
    estimated_rent_monthly?: number | null;
    rent_range_low?: number | null;
    rent_range_high?: number | null;
    gross_yield?: number | null;
    bedrooms: number | null;
    bathrooms: number | null;
    square_footage: number | null;
    year_built: number | null;
    provider_property_id?: string;
    cached: boolean;
    fetched_at?: string;
    provider: string;
    is_stale?: boolean;
}

export async function getValueEstimate(
    address: string,
    propertyId?: number,
): Promise<ValuationResult | null> {
    // Check cache first
    if (propertyId) {
        const cached = await prisma.propertyValuationCache.findFirst({
            where: { property_id: propertyId, provider: 'rentcast' },
        });

        if (cached) {
            const age = Date.now() - cached.fetched_at.getTime();
            if (age < VALUATION_CACHE_TTL_DAYS * 24 * 60 * 60 * 1000) {
                return {
                    estimated_value: cached.estimated_value,
                    value_range_low: cached.value_range_low,
                    value_range_high: cached.value_range_high,
                    bedrooms: cached.bedrooms,
                    bathrooms: cached.bathrooms ? Number(cached.bathrooms) : null,
                    square_footage: cached.square_footage,
                    year_built: cached.year_built,
                    cached: true,
                    fetched_at: cached.fetched_at.toISOString(),
                    provider: 'rentcast',
                };
            }
        }
    }

    const data = await callRentCast('/avm/value', { address });
    if (!data || Array.isArray(data)) return null;

    const subject =
        (data.subjectProperty as Record<string, unknown>) ??
        (data.subject as Record<string, unknown>) ??
        {};

    const result: ValuationResult = {
        estimated_value: (data.price as number) ?? null,
        value_range_low: (data.priceRangeLow as number) ?? null,
        value_range_high: (data.priceRangeHigh as number) ?? null,
        bedrooms: (subject.bedrooms as number) ?? null,
        bathrooms: (subject.bathrooms as number) ?? null,
        square_footage: (subject.squareFootage as number) ?? null,
        year_built: (subject.yearBuilt as number) ?? null,
        provider_property_id: (subject.id as string) ?? undefined,
        cached: false,
        provider: 'rentcast',
    };

    if (propertyId && result.estimated_value) {
        await updateValuationCache(propertyId, result, null);
    }

    return result;
}

// ---------------------------------------------------------------------------
// Rent estimate (1 API call)
// ---------------------------------------------------------------------------

export interface RentResult {
    estimated_rent_monthly: number | null;
    rent_range_low: number | null;
    rent_range_high: number | null;
    provider: string;
}

export async function getRentEstimate(
    address: string,
    propertyId?: number,
): Promise<RentResult | null> {
    const data = await callRentCast('/avm/rent/long-term', { address });
    if (!data || Array.isArray(data)) return null;

    const result: RentResult = {
        estimated_rent_monthly: (data.rent as number) ?? null,
        rent_range_low: (data.rentRangeLow as number) ?? null,
        rent_range_high: (data.rentRangeHigh as number) ?? null,
        provider: 'rentcast',
    };

    // Update cache with rent data if we have a property_id
    if (propertyId && result.estimated_rent_monthly) {
        const cached = await prisma.propertyValuationCache.findFirst({
            where: { property_id: propertyId },
        });
        if (cached) {
            await prisma.propertyValuationCache.update({
                where: { id: cached.id },
                data: {
                    estimated_rent_monthly: result.estimated_rent_monthly,
                    rent_range_low: result.rent_range_low,
                    rent_range_high: result.rent_range_high,
                    fetched_at: new Date(),
                },
            });
        }
    }

    return result;
}

// ---------------------------------------------------------------------------
// Full valuation: value + rent (2 API calls)
// ---------------------------------------------------------------------------

export async function getFullValuation(
    address: string,
    propertyId?: number,
): Promise<ValuationResult | null> {
    const valueData = await getValueEstimate(address, propertyId);
    if (!valueData) return null;

    const rentData = await getRentEstimate(address, propertyId);

    const result: ValuationResult = { ...valueData };
    if (rentData) {
        result.estimated_rent_monthly = rentData.estimated_rent_monthly;
        result.rent_range_low = rentData.rent_range_low;
        result.rent_range_high = rentData.rent_range_high;

        if (result.estimated_value && result.estimated_rent_monthly) {
            const annualRent = result.estimated_rent_monthly * 12;
            result.gross_yield = Math.round((annualRent / result.estimated_value) * 10000) / 100;
        }
    }

    // Update cache with full data
    if (propertyId && result.estimated_value) {
        await updateValuationCache(propertyId, result, rentData);
    }

    return result;
}

// ---------------------------------------------------------------------------
// Cache management
// ---------------------------------------------------------------------------

async function updateValuationCache(
    propertyId: number,
    valueData: ValuationResult,
    rentData: RentResult | null,
): Promise<void> {
    const existing = await prisma.propertyValuationCache.findFirst({
        where: { property_id: propertyId },
    });

    const cacheData = {
        provider: 'rentcast',
        estimated_value: valueData.estimated_value,
        value_range_low: valueData.value_range_low,
        value_range_high: valueData.value_range_high,
        bedrooms: valueData.bedrooms,
        bathrooms: valueData.bathrooms ? Number(valueData.bathrooms) : null,
        square_footage: valueData.square_footage,
        year_built: valueData.year_built,
        fetched_at: new Date(),
        ...(rentData
            ? {
                  estimated_rent_monthly: rentData.estimated_rent_monthly,
                  rent_range_low: rentData.rent_range_low,
                  rent_range_high: rentData.rent_range_high,
              }
            : {}),
    };

    if (existing) {
        await prisma.propertyValuationCache.update({
            where: { id: existing.id },
            data: cacheData,
        });
    } else {
        await prisma.propertyValuationCache.create({
            data: {
                property_id: propertyId,
                ...cacheData,
            },
        });
    }

    // Also record a history point
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    if (valueData.estimated_value) {
        const existingHistory = await prisma.propertyValueHistory.findUnique({
            where: {
                property_id_date_source: {
                    property_id: propertyId,
                    date: today,
                    source: 'rentcast',
                },
            },
        });

        if (!existingHistory) {
            await prisma.propertyValueHistory.create({
                data: {
                    property_id: propertyId,
                    date: today,
                    estimated_value: valueData.estimated_value,
                    source: 'rentcast',
                },
            });
        }
    }
}

// ---------------------------------------------------------------------------
// Refresh single property (2 API calls, updates property.current_value)
// ---------------------------------------------------------------------------

export async function refreshPropertyValuation(
    propertyId: number,
): Promise<ValuationResult | null> {
    const prop = await prisma.property.findUnique({ where: { id: propertyId } });
    if (!prop) return null;

    const result = await getFullValuation(prop.address, propertyId);
    if (!result || !result.estimated_value) return null;

    // Update property current_value
    await prisma.property.update({
        where: { id: propertyId },
        data: {
            current_value: result.estimated_value,
            valuation_provider: 'rentcast',
            ...(result.provider_property_id
                ? { provider_property_id: result.provider_property_id }
                : {}),
        },
    });

    return result;
}

// ---------------------------------------------------------------------------
// Refresh all properties that have a provider set (2 API calls each)
// ---------------------------------------------------------------------------

export async function refreshAllValuations(): Promise<{
    updated: number;
    errors: number;
    results: Array<{ id: number; name: string; new_value: number }>;
}> {
    const properties = await prisma.property.findMany({
        where: { valuation_provider: { not: null } },
    });

    let updated = 0;
    let errors = 0;
    const results: Array<{ id: number; name: string; new_value: number }> = [];

    for (const prop of properties) {
        try {
            const result = await refreshPropertyValuation(prop.id);
            if (result && result.estimated_value) {
                updated++;
                results.push({
                    id: prop.id,
                    name: prop.name,
                    new_value: result.estimated_value,
                });
            } else {
                errors++;
            }
        } catch (err) {
            console.error(`Error refreshing property ${prop.id}:`, err);
            errors++;
        }
    }

    return { updated, errors, results };
}

// ---------------------------------------------------------------------------
// Value history (no API call)
// ---------------------------------------------------------------------------

export async function getValueHistory(
    propertyId: number,
): Promise<Array<{ date: string; estimated_value: number; source: string }>> {
    const records = await prisma.propertyValueHistory.findMany({
        where: { property_id: propertyId },
        orderBy: { date: 'asc' },
    });

    return records.map((r) => ({
        date: r.date,
        estimated_value: r.estimated_value,
        source: r.source,
    }));
}

// ---------------------------------------------------------------------------
// Cached valuation (no API call)
// ---------------------------------------------------------------------------

export async function getCachedValuation(
    propertyId: number,
): Promise<ValuationResult | null> {
    const cached = await prisma.propertyValuationCache.findFirst({
        where: { property_id: propertyId },
    });

    if (!cached) return null;

    const age = Date.now() - cached.fetched_at.getTime();
    const isStale = age > VALUATION_CACHE_TTL_DAYS * 24 * 60 * 60 * 1000;

    return {
        estimated_value: cached.estimated_value,
        estimated_rent_monthly: cached.estimated_rent_monthly,
        value_range_low: cached.value_range_low,
        value_range_high: cached.value_range_high,
        rent_range_low: cached.rent_range_low,
        rent_range_high: cached.rent_range_high,
        bedrooms: cached.bedrooms,
        bathrooms: cached.bathrooms ? Number(cached.bathrooms) : null,
        square_footage: cached.square_footage,
        year_built: cached.year_built,
        provider: cached.provider,
        fetched_at: cached.fetched_at.toISOString(),
        is_stale: isStale,
        cached: true,
    };
}
