/**
 * API Client for Networth Pro
 * All functions call the real backend API
 */

const getBaseUrl = () => {
    const isServer = typeof window === 'undefined';
    return isServer ? 'http://127.0.0.1:8000' : '';
};

// Types
export interface Portfolio {
    id: number;
    name: string;
    description?: string;
    currency: string;
    is_active: boolean;
}

export interface Holding {
    id: number;
    portfolio_id: number;
    portfolio_name?: string;
    ticker: string;
    asset_type: string;
    quantity: number;
    purchase_price?: number;
    purchase_date?: string;
    currency: string;
    current_price?: number;
    current_value?: number;
    cost_basis?: number;
    unrealized_gain?: number;
    gain_percent?: number;
    name?: string;
}

export interface SecuritySearchResult {
    ticker: string;
    name: string;
    asset_type: string;
    exchange?: string;
    currency: string;
    sector?: string;
    current_price?: number;
}

export interface Quote {
    ticker: string;
    name?: string;
    current_price?: number;
    previous_close?: number;
    change_percent?: number;
    fetched_at?: string;
    cached?: boolean;
}

export interface Property {
    id: number;
    name: string;
    address: string;
    property_type: string;
    purchase_price: number;
    purchase_date?: string;
    current_value: number;
    currency: string;
    provider_property_id?: string;
    valuation_provider?: string;
    total_mortgage_balance?: number;
    equity?: number;
    monthly_payments?: number;
    mortgages?: Mortgage[];
    appreciation?: number;
    appreciation_percent?: number;
    estimated_rent_monthly?: number;
    value_range_low?: number;
    value_range_high?: number;
    rent_range_low?: number;
    rent_range_high?: number;
    bedrooms?: number;
    bathrooms?: number;
    square_footage?: number;
    year_built?: number;
    valuation_fetched_at?: string;
}

export interface PropertySearchResult {
    address: string;
    city: string;
    state: string;
    zip_code: string;
    provider_property_id: string;
    property_type?: string;
    bedrooms?: number;
    bathrooms?: number;
    square_footage?: number;
    year_built?: number;
    lot_size?: number;
    last_sale_price?: number;
    last_sale_date?: string;
    tax_assessed_value?: number;
    provider: string;
}

export interface PropertyValuation {
    estimated_value?: number;
    estimated_rent_monthly?: number;
    value_range_low?: number;
    value_range_high?: number;
    rent_range_low?: number;
    rent_range_high?: number;
    gross_yield?: number;
    bedrooms?: number;
    bathrooms?: number;
    square_footage?: number;
    year_built?: number;
    provider_property_id?: string;
    cached?: boolean;
    fetched_at?: string;
    provider: string;
}

export interface PropertyValueHistoryPoint {
    date: string;
    estimated_value: number;
    source: string;
}

export interface Mortgage {
    id: number;
    property_id: number;
    lender?: string;
    original_principal: number;
    current_balance: number;
    interest_rate: number;
    monthly_payment: number;
    term_years: number;
    is_active: boolean;
}

export interface Account {
    id: number;
    name: string;
    institution?: string;
    type: string;  // checking, savings, investment, cash
    currency: string;
    tags?: string;
    current_balance: number;
    last_updated?: string;
    created_at: string;
    updated_at: string;
}

export interface Liability {
    id: number;
    name: string;
    category?: string;  // credit_card, student_loan, auto_loan, personal_loan, other
    currency: string;
    tags?: string;
    current_balance: number;
    last_updated?: string;
    created_at: string;
    updated_at: string;
}

export interface NetWorth {
    net_worth: number;
    total_assets: number;
    total_liabilities: number;
    currency: string;
    breakdown?: {
        cash_accounts: number;
        investments: number;
        real_estate_equity: number;
    };
    assets: Array<{
        name: string;
        balance: number;
        currency: string;
        type?: string;
    }>;
    liabilities: Array<{
        name: string;
        balance: number;
        currency: string;
    }>;
}

// Dashboard APIs
export async function fetchNetWorth(): Promise<NetWorth | null> {
    try {
        const baseUrl = getBaseUrl();
        const res = await fetch(`${baseUrl}/api/v1/networth`, {
            cache: 'no-store'
        });

        if (!res.ok) {
            throw new Error('Failed to fetch net worth data');
        }

        return res.json();
    } catch (error) {
        console.error(error);
        return null;
    }
}

export async function fetchHistory() {
    try {
        const baseUrl = getBaseUrl();
        const res = await fetch(`${baseUrl}/api/v1/networth/history`, {
            cache: 'no-store'
        });

        if (!res.ok) {
            throw new Error('Failed to fetch history data');
        }

        return res.json();
    } catch (error) {
        console.error(error);
        return [];
    }
}

// Securities APIs
export async function searchSecurities(query: string): Promise<SecuritySearchResult[]> {
    try {
        const baseUrl = getBaseUrl();
        const res = await fetch(`${baseUrl}/api/v1/securities/search?q=${encodeURIComponent(query)}`, {
            cache: 'no-store'
        });

        if (!res.ok) {
            return [];
        }

        const data = await res.json();
        return data.results || [];
    } catch (error) {
        console.error(error);
        return [];
    }
}

export async function getQuote(ticker: string): Promise<Quote | null> {
    try {
        const baseUrl = getBaseUrl();
        const res = await fetch(`${baseUrl}/api/v1/securities/${ticker}/quote`, {
            cache: 'no-store'
        });

        if (!res.ok) {
            return null;
        }

        return res.json();
    } catch (error) {
        console.error(error);
        return null;
    }
}

// Portfolio APIs
export async function fetchPortfolios(): Promise<Portfolio[]> {
    try {
        const baseUrl = getBaseUrl();
        const res = await fetch(`${baseUrl}/api/v1/portfolios`, {
            cache: 'no-store'
        });

        if (!res.ok) {
            return [];
        }

        return res.json();
    } catch (error) {
        console.error(error);
        return [];
    }
}

export async function createPortfolio(data: { name: string; description?: string; currency?: string }): Promise<Portfolio | null> {
    try {
        const baseUrl = getBaseUrl();
        const res = await fetch(`${baseUrl}/api/v1/portfolios`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });

        if (!res.ok) {
            throw new Error('Failed to create portfolio');
        }

        return res.json();
    } catch (error) {
        console.error(error);
        return null;
    }
}

export async function deletePortfolio(portfolioId: number): Promise<boolean> {
    try {
        const baseUrl = getBaseUrl();
        const res = await fetch(`${baseUrl}/api/v1/portfolios/${portfolioId}`, {
            method: 'DELETE',
        });

        return res.ok;
    } catch (error) {
        console.error(error);
        return false;
    }
}

export async function fetchHoldings(): Promise<Holding[]> {
    try {
        const baseUrl = getBaseUrl();
        const res = await fetch(`${baseUrl}/api/v1/portfolio/holdings`, {
            cache: 'no-store'
        });

        if (!res.ok) {
            return [];
        }

        return res.json();
    } catch (error) {
        console.error(error);
        return [];
    }
}

export async function addHolding(
    portfolioId: number,
    data: {
        ticker: string;
        asset_type: string;
        quantity: number;
        purchase_price?: number;
        purchase_date?: string;
        currency?: string;
    }
): Promise<Holding | null> {
    try {
        const baseUrl = getBaseUrl();
        const res = await fetch(`${baseUrl}/api/v1/portfolios/${portfolioId}/holdings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });

        if (!res.ok) {
            throw new Error('Failed to add holding');
        }

        return res.json();
    } catch (error) {
        console.error(error);
        return null;
    }
}

export async function updateHolding(
    holdingId: number,
    data: {
        ticker?: string;
        asset_type?: string;
        quantity?: number;
        purchase_price?: number;
        purchase_date?: string;
        current_price?: number;
    }
): Promise<Holding | null> {
    try {
        const baseUrl = getBaseUrl();
        const res = await fetch(`${baseUrl}/api/v1/holdings/${holdingId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });

        if (!res.ok) {
            throw new Error('Failed to update holding');
        }

        return res.json();
    } catch (error) {
        console.error(error);
        return null;
    }
}

export async function deleteHolding(holdingId: number): Promise<boolean> {
    try {
        const baseUrl = getBaseUrl();
        const res = await fetch(`${baseUrl}/api/v1/holdings/${holdingId}`, {
            method: 'DELETE',
        });

        return res.ok;
    } catch (error) {
        console.error(error);
        return false;
    }
}

export async function refreshPortfolioPrices(portfolioId: number): Promise<Holding[]> {
    try {
        const baseUrl = getBaseUrl();
        const res = await fetch(`${baseUrl}/api/v1/portfolios/${portfolioId}/refresh`, {
            method: 'POST',
        });

        if (!res.ok) {
            return [];
        }

        const data = await res.json();
        return data.holdings || [];
    } catch (error) {
        console.error(error);
        return [];
    }
}

export async function refreshAllPrices(): Promise<boolean> {
    try {
        const baseUrl = getBaseUrl();
        const res = await fetch(`${baseUrl}/api/v1/portfolios/refresh-all`, {
            method: 'POST',
        });

        return res.ok;
    } catch (error) {
        console.error(error);
        return false;
    }
}

// Real Estate APIs
export async function fetchProperties(): Promise<Property[]> {
    try {
        const baseUrl = getBaseUrl();
        const res = await fetch(`${baseUrl}/api/v1/properties`, {
            cache: 'no-store'
        });

        if (!res.ok) {
            return [];
        }

        return res.json();
    } catch (error) {
        console.error(error);
        return [];
    }
}

export async function createProperty(data: {
    name: string;
    address: string;
    property_type: string;
    purchase_price: number;
    purchase_date?: string;
    current_value: number;
    currency?: string;
    provider_property_id?: string;
    valuation_provider?: string;
}): Promise<Property | null> {
    try {
        const baseUrl = getBaseUrl();
        const res = await fetch(`${baseUrl}/api/v1/properties`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });

        if (!res.ok) {
            throw new Error('Failed to create property');
        }

        return res.json();
    } catch (error) {
        console.error(error);
        return null;
    }
}

export async function updateProperty(
    propertyId: number,
    data: {
        name?: string;
        address?: string;
        property_type?: string;
        purchase_price?: number;
        purchase_date?: string;
        current_value?: number;
        provider_property_id?: string;
        valuation_provider?: string;
    }
): Promise<Property | null> {
    try {
        const baseUrl = getBaseUrl();
        const res = await fetch(`${baseUrl}/api/v1/properties/${propertyId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });

        if (!res.ok) {
            throw new Error('Failed to update property');
        }

        return res.json();
    } catch (error) {
        console.error(error);
        return null;
    }
}

export async function deleteProperty(propertyId: number): Promise<boolean> {
    try {
        const baseUrl = getBaseUrl();
        const res = await fetch(`${baseUrl}/api/v1/properties/${propertyId}`, {
            method: 'DELETE',
        });

        return res.ok;
    } catch (error) {
        console.error(error);
        return false;
    }
}

// Property Valuation APIs
export async function searchPropertyAddress(query: string): Promise<PropertySearchResult[]> {
    try {
        const baseUrl = getBaseUrl();
        const res = await fetch(`${baseUrl}/api/v1/properties/valuation/search?q=${encodeURIComponent(query)}`, {
            cache: 'no-store'
        });

        if (!res.ok) return [];
        const data = await res.json();
        return data.results || [];
    } catch (error) {
        console.error(error);
        return [];
    }
}

export async function getPropertyValuation(propertyId: number, refresh = false): Promise<PropertyValuation | null> {
    try {
        const baseUrl = getBaseUrl();
        const res = await fetch(`${baseUrl}/api/v1/properties/${propertyId}/valuation?refresh=${refresh}`, {
            cache: 'no-store'
        });

        if (!res.ok) return null;
        return res.json();
    } catch (error) {
        console.error(error);
        return null;
    }
}

export async function getPropertyValueHistory(propertyId: number): Promise<PropertyValueHistoryPoint[]> {
    try {
        const baseUrl = getBaseUrl();
        const res = await fetch(`${baseUrl}/api/v1/properties/${propertyId}/value-history`, {
            cache: 'no-store'
        });

        if (!res.ok) return [];
        const data = await res.json();
        return data.history || [];
    } catch (error) {
        console.error(error);
        return [];
    }
}

export async function refreshPropertyValues(): Promise<{ updated: number; errors: number } | null> {
    try {
        const baseUrl = getBaseUrl();
        const res = await fetch(`${baseUrl}/api/v1/properties/refresh-values`, {
            method: 'POST',
        });

        if (!res.ok) return null;
        return res.json();
    } catch (error) {
        console.error(error);
        return null;
    }
}

export async function getValuationStatus(): Promise<{ rentcast_available: boolean }> {
    try {
        const baseUrl = getBaseUrl();
        const res = await fetch(`${baseUrl}/api/v1/properties/valuation/status`, {
            cache: 'no-store'
        });

        if (!res.ok) return { rentcast_available: false };
        return res.json();
    } catch (error) {
        console.error(error);
        return { rentcast_available: false };
    }
}

export async function addMortgage(
    propertyId: number,
    data: {
        lender?: string;
        original_principal: number;
        current_balance: number;
        interest_rate: number;
        monthly_payment: number;
        term_years: number;
        is_active?: boolean;
    }
): Promise<Mortgage | null> {
    try {
        const baseUrl = getBaseUrl();
        const res = await fetch(`${baseUrl}/api/v1/properties/${propertyId}/mortgage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });

        if (!res.ok) {
            throw new Error('Failed to add mortgage');
        }

        return res.json();
    } catch (error) {
        console.error(error);
        return null;
    }
}

export async function updateMortgage(
    mortgageId: number,
    data: {
        lender?: string;
        current_balance?: number;
        interest_rate?: number;
        monthly_payment?: number;
        is_active?: boolean;
    }
): Promise<Mortgage | null> {
    try {
        const baseUrl = getBaseUrl();
        const res = await fetch(`${baseUrl}/api/v1/properties/mortgages/${mortgageId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });

        if (!res.ok) {
            throw new Error('Failed to update mortgage');
        }

        return res.json();
    } catch (error) {
        console.error(error);
        return null;
    }
}

export async function fetchRealEstateSummary() {
    try {
        const baseUrl = getBaseUrl();
        const res = await fetch(`${baseUrl}/api/v1/properties/summary`, {
            cache: 'no-store'
        });

        if (!res.ok) {
            return null;
        }

        return res.json();
    } catch (error) {
        console.error(error);
        return null;
    }
}

// Account APIs
export async function fetchAccounts(): Promise<Account[]> {
    try {
        const baseUrl = getBaseUrl();
        const res = await fetch(`${baseUrl}/api/v1/accounts`, {
            cache: 'no-store'
        });

        if (!res.ok) {
            return [];
        }

        return res.json();
    } catch (error) {
        console.error(error);
        return [];
    }
}

export async function createAccount(data: {
    name: string;
    institution?: string;
    type: string;
    currency?: string;
    current_balance?: number;
    tags?: string;
}): Promise<Account | null> {
    try {
        const baseUrl = getBaseUrl();
        const res = await fetch(`${baseUrl}/api/v1/accounts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });

        if (!res.ok) {
            throw new Error('Failed to create account');
        }

        return res.json();
    } catch (error) {
        console.error(error);
        return null;
    }
}

export async function updateAccount(
    accountId: number,
    data: {
        name?: string;
        institution?: string;
        type?: string;
        currency?: string;
        tags?: string;
    }
): Promise<Account | null> {
    try {
        const baseUrl = getBaseUrl();
        const res = await fetch(`${baseUrl}/api/v1/accounts/${accountId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });

        if (!res.ok) {
            throw new Error('Failed to update account');
        }

        return res.json();
    } catch (error) {
        console.error(error);
        return null;
    }
}

export async function deleteAccount(accountId: number): Promise<boolean> {
    try {
        const baseUrl = getBaseUrl();
        const res = await fetch(`${baseUrl}/api/v1/accounts/${accountId}`, {
            method: 'DELETE',
        });

        return res.ok;
    } catch (error) {
        console.error(error);
        return false;
    }
}

export async function updateAccountBalance(
    accountId: number,
    amount: number
): Promise<Account | null> {
    try {
        const baseUrl = getBaseUrl();
        const res = await fetch(`${baseUrl}/api/v1/accounts/${accountId}/balance`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount }),
        });

        if (!res.ok) {
            throw new Error('Failed to update balance');
        }

        return res.json();
    } catch (error) {
        console.error(error);
        return null;
    }
}

// Liability APIs
export async function fetchLiabilities(): Promise<Liability[]> {
    try {
        const baseUrl = getBaseUrl();
        const res = await fetch(`${baseUrl}/api/v1/liabilities`, {
            cache: 'no-store'
        });

        if (!res.ok) {
            return [];
        }

        return res.json();
    } catch (error) {
        console.error(error);
        return [];
    }
}

export async function createLiability(data: {
    name: string;
    category?: string;
    currency?: string;
    current_balance?: number;
    tags?: string;
}): Promise<Liability | null> {
    try {
        const baseUrl = getBaseUrl();
        const res = await fetch(`${baseUrl}/api/v1/liabilities`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });

        if (!res.ok) {
            throw new Error('Failed to create liability');
        }

        return res.json();
    } catch (error) {
        console.error(error);
        return null;
    }
}

export async function updateLiability(
    liabilityId: number,
    data: {
        name?: string;
        category?: string;
        currency?: string;
        tags?: string;
    }
): Promise<Liability | null> {
    try {
        const baseUrl = getBaseUrl();
        const res = await fetch(`${baseUrl}/api/v1/liabilities/${liabilityId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });

        if (!res.ok) {
            throw new Error('Failed to update liability');
        }

        return res.json();
    } catch (error) {
        console.error(error);
        return null;
    }
}

export async function deleteLiability(liabilityId: number): Promise<boolean> {
    try {
        const baseUrl = getBaseUrl();
        const res = await fetch(`${baseUrl}/api/v1/liabilities/${liabilityId}`, {
            method: 'DELETE',
        });

        return res.ok;
    } catch (error) {
        console.error(error);
        return false;
    }
}

export async function updateLiabilityBalance(
    liabilityId: number,
    amount: number
): Promise<Liability | null> {
    try {
        const baseUrl = getBaseUrl();
        const res = await fetch(`${baseUrl}/api/v1/liabilities/${liabilityId}/balance`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount }),
        });

        if (!res.ok) {
            throw new Error('Failed to update balance');
        }

        return res.json();
    } catch (error) {
        console.error(error);
        return null;
    }
}

// Settings APIs
export async function resetDatabase(): Promise<{ success: boolean; message: string }> {
    try {
        const baseUrl = getBaseUrl();
        const res = await fetch(`${baseUrl}/api/v1/settings/reset-database`, {
            method: 'POST',
        });

        if (!res.ok) {
            const error = await res.json().catch(() => ({ message: 'Failed to reset database' }));
            return { success: false, message: error.message || 'Failed to reset database' };
        }

        return { success: true, message: 'Database reset successfully' };
    } catch (error) {
        console.error(error);
        return { success: false, message: 'Failed to connect to server' };
    }
}

export async function exportData(): Promise<Blob | null> {
    try {
        const baseUrl = getBaseUrl();
        const res = await fetch(`${baseUrl}/api/v1/settings/export`, {
            method: 'GET',
        });

        if (!res.ok) {
            throw new Error('Failed to export data');
        }

        return res.blob();
    } catch (error) {
        console.error(error);
        return null;
    }
}

export async function importData(file: File): Promise<{ success: boolean; message: string }> {
    try {
        const baseUrl = getBaseUrl();
        const formData = new FormData();
        formData.append('file', file);

        const res = await fetch(`${baseUrl}/api/v1/settings/import`, {
            method: 'POST',
            body: formData,
        });

        if (!res.ok) {
            const error = await res.json().catch(() => ({ message: 'Failed to import data' }));
            return { success: false, message: error.message || 'Failed to import data' };
        }

        return { success: true, message: 'Data imported successfully' };
    } catch (error) {
        console.error(error);
        return { success: false, message: 'Failed to connect to server' };
    }
}

// ============================================
// Retirement Plans API
// ============================================

export interface RetirementPlan {
    id: number;
    name: string;
    description?: string;
    mode: string;  // "pro" or "essential"
    config_json?: string;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export async function fetchRetirementPlans(): Promise<RetirementPlan[]> {
    try {
        const baseUrl = getBaseUrl();
        const res = await fetch(`${baseUrl}/api/v1/retirement/plans`, {
            cache: 'no-store'
        });
        if (!res.ok) return [];
        return res.json();
    } catch (error) {
        console.error(error);
        return [];
    }
}

export async function fetchRetirementPlan(planId: number): Promise<RetirementPlan | null> {
    try {
        const baseUrl = getBaseUrl();
        const res = await fetch(`${baseUrl}/api/v1/retirement/plans/${planId}`, {
            cache: 'no-store'
        });
        if (!res.ok) return null;
        return res.json();
    } catch (error) {
        console.error(error);
        return null;
    }
}

export async function fetchActiveRetirementPlan(): Promise<RetirementPlan | null> {
    try {
        const baseUrl = getBaseUrl();
        const res = await fetch(`${baseUrl}/api/v1/retirement/plans/active`, {
            cache: 'no-store'
        });
        if (!res.ok) return null;
        return res.json();
    } catch (error) {
        console.error(error);
        return null;
    }
}

export async function createRetirementPlan(data: {
    name: string;
    description?: string;
    mode: string;
    config_json: string;
}): Promise<RetirementPlan | null> {
    try {
        const baseUrl = getBaseUrl();
        const res = await fetch(`${baseUrl}/api/v1/retirement/plans`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
        if (!res.ok) return null;
        return res.json();
    } catch (error) {
        console.error(error);
        return null;
    }
}

export async function updateRetirementPlan(
    planId: number,
    data: {
        name?: string;
        description?: string;
        mode?: string;
        config_json?: string;
    }
): Promise<RetirementPlan | null> {
    try {
        const baseUrl = getBaseUrl();
        const res = await fetch(`${baseUrl}/api/v1/retirement/plans/${planId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
        if (!res.ok) return null;
        return res.json();
    } catch (error) {
        console.error(error);
        return null;
    }
}

export async function deleteRetirementPlan(planId: number): Promise<boolean> {
    try {
        const baseUrl = getBaseUrl();
        const res = await fetch(`${baseUrl}/api/v1/retirement/plans/${planId}`, {
            method: 'DELETE',
        });
        return res.ok;
    } catch (error) {
        console.error(error);
        return false;
    }
}

export async function activateRetirementPlan(planId: number): Promise<boolean> {
    try {
        const baseUrl = getBaseUrl();
        const res = await fetch(`${baseUrl}/api/v1/retirement/plans/${planId}/activate`, {
            method: 'POST',
        });
        return res.ok;
    } catch (error) {
        console.error(error);
        return false;
    }
}

// ============================================
// Budget Categories API
// ============================================

export interface BudgetCategory {
    id: number;
    name: string;
    icon?: string;
    color?: string;
    budget_limit?: number;
    is_income: boolean;
}

export async function fetchBudgetCategories(): Promise<BudgetCategory[]> {
    try {
        const baseUrl = getBaseUrl();
        const res = await fetch(`${baseUrl}/api/v1/budget/categories`, {
            cache: 'no-store'
        });
        if (!res.ok) return [];
        return res.json();
    } catch (error) {
        console.error(error);
        return [];
    }
}

export async function createBudgetCategory(data: {
    name: string;
    icon?: string;
    color?: string;
    budget_limit?: number;
    is_income?: boolean;
}): Promise<BudgetCategory | null> {
    try {
        const baseUrl = getBaseUrl();
        const res = await fetch(`${baseUrl}/api/v1/budget/categories`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
        if (!res.ok) return null;
        return res.json();
    } catch (error) {
        console.error(error);
        return null;
    }
}

export async function updateBudgetCategory(
    categoryId: number,
    data: {
        name?: string;
        icon?: string;
        color?: string;
        budget_limit?: number;
        is_income?: boolean;
    }
): Promise<BudgetCategory | null> {
    try {
        const baseUrl = getBaseUrl();
        const res = await fetch(`${baseUrl}/api/v1/budget/categories/${categoryId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
        if (!res.ok) return null;
        return res.json();
    } catch (error) {
        console.error(error);
        return null;
    }
}

export async function deleteBudgetCategory(categoryId: number): Promise<boolean> {
    try {
        const baseUrl = getBaseUrl();
        const res = await fetch(`${baseUrl}/api/v1/budget/categories/${categoryId}`, {
            method: 'DELETE',
        });
        return res.ok;
    } catch (error) {
        console.error(error);
        return false;
    }
}

// ============================================
// Transactions API
// ============================================

export interface Transaction {
    id: number;
    date: string;
    description: string;
    amount: number;
    category_id?: number;
    category_name?: string;
    category_color?: string;
    account_id?: number;
    account_name?: string;
    is_recurring: boolean;
    recurrence_frequency?: string;  // daily, weekly, bi-weekly, monthly, yearly
    merchant?: string;
    notes?: string;
    ai_categorized: boolean;
    created_at: string;
}

export async function fetchTransactions(params?: {
    start_date?: string;
    end_date?: string;
    category_id?: number;
    account_id?: number;
    limit?: number;
    offset?: number;
}): Promise<Transaction[]> {
    try {
        const baseUrl = getBaseUrl();
        const searchParams = new URLSearchParams();
        if (params?.start_date) searchParams.append('start_date', params.start_date);
        if (params?.end_date) searchParams.append('end_date', params.end_date);
        if (params?.category_id) searchParams.append('category_id', params.category_id.toString());
        if (params?.account_id) searchParams.append('account_id', params.account_id.toString());
        if (params?.limit) searchParams.append('limit', params.limit.toString());
        if (params?.offset) searchParams.append('offset', params.offset.toString());

        const url = `${baseUrl}/api/v1/budget/transactions${searchParams.toString() ? '?' + searchParams.toString() : ''}`;
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) return [];
        return res.json();
    } catch (error) {
        console.error(error);
        return [];
    }
}

export async function createTransaction(data: {
    date: string;
    description: string;
    amount: number;
    category_id?: number;
    account_id?: number;
    is_recurring?: boolean;
    recurrence_frequency?: string;
    merchant?: string;
    notes?: string;
}): Promise<Transaction | null> {
    try {
        const baseUrl = getBaseUrl();
        const res = await fetch(`${baseUrl}/api/v1/budget/transactions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
        if (!res.ok) return null;
        return res.json();
    } catch (error) {
        console.error(error);
        return null;
    }
}

export async function updateTransaction(
    transactionId: number,
    data: {
        date?: string;
        description?: string;
        amount?: number;
        category_id?: number;
        account_id?: number;
        is_recurring?: boolean;
        recurrence_frequency?: string;
        merchant?: string;
        notes?: string;
    }
): Promise<Transaction | null> {
    try {
        const baseUrl = getBaseUrl();
        const res = await fetch(`${baseUrl}/api/v1/budget/transactions/${transactionId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
        if (!res.ok) return null;
        return res.json();
    } catch (error) {
        console.error(error);
        return null;
    }
}

export async function deleteTransaction(transactionId: number): Promise<boolean> {
    try {
        const baseUrl = getBaseUrl();
        const res = await fetch(`${baseUrl}/api/v1/budget/transactions/${transactionId}`, {
            method: 'DELETE',
        });
        return res.ok;
    } catch (error) {
        console.error(error);
        return false;
    }
}

// ============================================
// Subscriptions API
// ============================================

export interface Subscription {
    id: number;
    name: string;
    amount: number;
    frequency: string;
    category_id?: number;
    category_name?: string;
    next_billing_date?: string;
    is_active: boolean;
}

export async function fetchSubscriptions(): Promise<Subscription[]> {
    try {
        const baseUrl = getBaseUrl();
        const res = await fetch(`${baseUrl}/api/v1/budget/subscriptions`, {
            cache: 'no-store'
        });
        if (!res.ok) return [];
        return res.json();
    } catch (error) {
        console.error(error);
        return [];
    }
}

export async function createSubscription(data: {
    name: string;
    amount: number;
    frequency: string;
    category_id?: number;
    next_billing_date?: string;
    is_active?: boolean;
}): Promise<Subscription | null> {
    try {
        const baseUrl = getBaseUrl();
        const res = await fetch(`${baseUrl}/api/v1/budget/subscriptions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
        if (!res.ok) return null;
        return res.json();
    } catch (error) {
        console.error(error);
        return null;
    }
}

export async function updateSubscription(
    subscriptionId: number,
    data: {
        name?: string;
        amount?: number;
        frequency?: string;
        category_id?: number;
        next_billing_date?: string;
        is_active?: boolean;
    }
): Promise<Subscription | null> {
    try {
        const baseUrl = getBaseUrl();
        const res = await fetch(`${baseUrl}/api/v1/budget/subscriptions/${subscriptionId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
        if (!res.ok) return null;
        return res.json();
    } catch (error) {
        console.error(error);
        return null;
    }
}

export async function deleteSubscription(subscriptionId: number): Promise<boolean> {
    try {
        const baseUrl = getBaseUrl();
        const res = await fetch(`${baseUrl}/api/v1/budget/subscriptions/${subscriptionId}`, {
            method: 'DELETE',
        });
        return res.ok;
    } catch (error) {
        console.error(error);
        return false;
    }
}

// ============================================
// Budget Analytics API
// ============================================

export interface BudgetSummary {
    period: {
        start: string;
        end: string;
    };
    total_income: number;
    total_expenses: number;
    net: number;
    transaction_count: number;
    by_category: Array<{
        category_id: number;
        category_name: string;
        category_color: string;
        category_icon: string;
        budget_limit?: number;
        income: number;
        expenses: number;
        net: number;
        transactions: number;
    }>;
}

export interface CashFlowData {
    month: string;
    income: number;
    expenses: number;
    net: number;
}

export async function fetchBudgetSummary(params?: {
    start_date?: string;
    end_date?: string;
}): Promise<BudgetSummary | null> {
    try {
        const baseUrl = getBaseUrl();
        const searchParams = new URLSearchParams();
        if (params?.start_date) searchParams.append('start_date', params.start_date);
        if (params?.end_date) searchParams.append('end_date', params.end_date);

        const url = `${baseUrl}/api/v1/budget/summary${searchParams.toString() ? '?' + searchParams.toString() : ''}`;
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) return null;
        return res.json();
    } catch (error) {
        console.error(error);
        return null;
    }
}

export async function fetchCashFlow(months: number = 6): Promise<CashFlowData[]> {
    try {
        const baseUrl = getBaseUrl();
        const res = await fetch(`${baseUrl}/api/v1/budget/cash-flow?months=${months}`, {
            cache: 'no-store'
        });
        if (!res.ok) return [];
        return res.json();
    } catch (error) {
        console.error(error);
        return [];
    }
}

// ============================================
// Budget AI API
// ============================================

export interface AIInsight {
    type: 'warning' | 'tip' | 'positive' | 'anomaly' | 'milestone' | 'trend';
    title: string;
    description: string;
}

export interface TrendAnalysis {
    trend: string;
    trend_description: string;
    next_month_prediction?: { income: number; expenses: number };
    key_observations: string[];
    recommendations: string[];
}

export interface FinancialStory {
    type: string;
    emoji: string;
    headline: string;
    narrative: string;
    data_points?: string[];
}

export interface NewsArticle {
    title: string;
    url: string;
    source: string;
    published: string;
    theme: string;
}

export interface CategorizeResult {
    transaction_id: number;
    category_id?: number;
    category_name?: string;
    confidence: number;
    method: 'rules' | 'ai';
}

export async function checkAIStatus(): Promise<{ ai_available: boolean; message: string }> {
    try {
        const baseUrl = getBaseUrl();
        const res = await fetch(`${baseUrl}/api/v1/budget/ai/status`, {
            cache: 'no-store'
        });
        if (!res.ok) return { ai_available: false, message: 'Failed to check AI status' };
        return res.json();
    } catch (error) {
        console.error(error);
        return { ai_available: false, message: 'Failed to connect to server' };
    }
}

export async function autoCategorizeTransactions(transactionIds?: number[]): Promise<{
    processed: number;
    updated: number;
    results: CategorizeResult[];
} | null> {
    try {
        const baseUrl = getBaseUrl();
        const res = await fetch(`${baseUrl}/api/v1/budget/ai/categorize`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ transaction_ids: transactionIds }),
        });
        if (!res.ok) return null;
        return res.json();
    } catch (error) {
        console.error(error);
        return null;
    }
}

export async function fetchAIInsights(enhanced: boolean = false): Promise<{
    insights: AIInsight[];
    ai_powered: boolean;
    period: { start: string; end: string };
    trend_analysis?: TrendAnalysis;
    subscription_suggestions?: AIInsight[];
} | null> {
    try {
        const baseUrl = getBaseUrl();
        const params = enhanced ? '?enhanced=true' : '';
        const res = await fetch(`${baseUrl}/api/v1/budget/ai/insights${params}`, {
            cache: 'no-store'
        });
        if (!res.ok) return null;
        return res.json();
    } catch (error) {
        console.error(error);
        return null;
    }
}

export async function fetchDashboardInsights(): Promise<{
    insights: AIInsight[];
    ai_powered: boolean;
} | null> {
    try {
        const baseUrl = getBaseUrl();
        const res = await fetch(`${baseUrl}/api/v1/dashboard/ai/insights`, {
            cache: 'no-store'
        });
        if (!res.ok) return null;
        return res.json();
    } catch (error) {
        console.error(error);
        return null;
    }
}

export async function fetchFinancialStories(refresh: boolean = false): Promise<{
    stories: FinancialStory[];
    news: NewsArticle[];
    ai_powered: boolean;
} | null> {
    try {
        const baseUrl = getBaseUrl();
        const params = refresh ? '?refresh=true' : '';
        const res = await fetch(`${baseUrl}/api/v1/dashboard/ai/stories${params}`, {
            cache: 'no-store'
        });
        if (!res.ok) return null;
        return res.json();
    } catch (error) {
        console.error(error);
        return null;
    }
}

export interface DetectedSubscription {
    name: string;
    amount: number;
    frequency: string;
    occurrences: number;
    last_date?: string;
    suggested_category_id?: number;
}

export async function detectSubscriptions(months: number = 6): Promise<{
    detected: number;
    new_suggestions: DetectedSubscription[];
    existing_count: number;
} | null> {
    try {
        const baseUrl = getBaseUrl();
        const res = await fetch(`${baseUrl}/api/v1/budget/ai/detect-subscriptions?months=${months}`, {
            method: 'POST',
        });
        if (!res.ok) return null;
        return res.json();
    } catch (error) {
        console.error(error);
        return null;
    }
}

export async function createSubscriptionFromDetection(data: {
    name: string;
    amount: number;
    frequency: string;
    category_id?: number;
}): Promise<Subscription | null> {
    try {
        const baseUrl = getBaseUrl();
        const params = new URLSearchParams({
            name: data.name,
            amount: data.amount.toString(),
            frequency: data.frequency,
        });
        if (data.category_id) params.append('category_id', data.category_id.toString());

        const res = await fetch(`${baseUrl}/api/v1/budget/ai/create-subscription-from-detection?${params}`, {
            method: 'POST',
        });
        if (!res.ok) return null;
        return res.json();
    } catch (error) {
        console.error(error);
        return null;
    }
}

// ============================================
// Budget Forecast API
// ============================================

export interface ForecastMonth {
    month: string;
    month_name?: string;
    income: number;
    expenses: number;
    net: number;
    transactions: Array<{
        description: string;
        amount: number;
        frequency: string;
        category_name?: string;
        occurrences?: number;
        total?: number;
        type?: string;
    }>;
}

export interface ForecastResponse {
    months: number;
    total_projected_income: number;
    total_projected_expenses: number;
    total_projected_net: number;
    monthly_average_income: number;
    monthly_average_expenses: number;
    forecast: ForecastMonth[];
    recurring_count: number;
    subscription_count: number;
}

export async function fetchBudgetForecast(months: number = 6): Promise<ForecastResponse | null> {
    try {
        const baseUrl = getBaseUrl();
        const res = await fetch(`${baseUrl}/api/v1/budget/forecast?months=${months}`, {
            cache: 'no-store'
        });
        if (!res.ok) return null;
        return res.json();
    } catch (error) {
        console.error(error);
        return null;
    }
}

// ============================================
// App Settings API
// ============================================

export interface AppSetting {
    key: string;
    value?: string;
    is_secret: boolean;
    is_set: boolean;
    description: string;
    updated_at?: string;
}

export async function fetchAppSettings(): Promise<AppSetting[]> {
    try {
        const baseUrl = getBaseUrl();
        const res = await fetch(`${baseUrl}/api/v1/settings`, {
            cache: 'no-store'
        });
        if (!res.ok) return [];
        return res.json();
    } catch (error) {
        console.error(error);
        return [];
    }
}

export async function fetchAppSetting(key: string): Promise<AppSetting | null> {
    try {
        const baseUrl = getBaseUrl();
        const res = await fetch(`${baseUrl}/api/v1/settings/${key}`, {
            cache: 'no-store'
        });
        if (!res.ok) return null;
        return res.json();
    } catch (error) {
        console.error(error);
        return null;
    }
}

export async function updateAppSetting(key: string, value: string | null): Promise<AppSetting | null> {
    try {
        const baseUrl = getBaseUrl();
        const res = await fetch(`${baseUrl}/api/v1/settings/${key}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ value }),
        });
        if (!res.ok) return null;
        return res.json();
    } catch (error) {
        console.error(error);
        return null;
    }
}

export async function deleteAppSetting(key: string): Promise<boolean> {
    try {
        const baseUrl = getBaseUrl();
        const res = await fetch(`${baseUrl}/api/v1/settings/${key}`, {
            method: 'DELETE',
        });
        return res.ok;
    } catch (error) {
        console.error(error);
        return false;
    }
}

// ============================================
// Statement Upload API
// ============================================

export interface ParsedTransaction {
    index: number;
    date: string;
    description: string;
    amount: number;
    merchant?: string;
    suggested_category_id?: number;
    suggested_category_name?: string;
    confidence: number;
    clean_description?: string;  // AI-cleaned description
    ai_reviewed?: boolean;  // Whether AI has reviewed this transaction
}

export interface StatementParseResponse {
    success: boolean;
    transactions: ParsedTransaction[];
    transaction_count: number;
    errors: string[];
    warnings: string[];
    bank_detected?: string;
    parser_used: string;
    ai_enhanced?: boolean;  // Whether AI was used to enhance categorization
}

export interface AIReviewResponse {
    success: boolean;
    transactions: ParsedTransaction[];
    ai_enhanced?: boolean;
    error?: string;
}

export interface SupportedFormat {
    extension: string;
    name: string;
    description: string;
    requires_ai: boolean;
    available: boolean;
}

export interface SupportedFormatsResponse {
    formats: SupportedFormat[];
    ai_available: boolean;
    ai_message: string;
}

export async function parseStatement(file: File): Promise<StatementParseResponse | null> {
    try {
        const baseUrl = getBaseUrl();
        const formData = new FormData();
        formData.append('file', file);

        const res = await fetch(`${baseUrl}/api/v1/budget/statements/parse`, {
            method: 'POST',
            body: formData,
        });

        if (!res.ok) {
            const error = await res.json().catch(() => ({ detail: 'Failed to parse statement' }));
            return {
                success: false,
                transactions: [],
                transaction_count: 0,
                errors: [error.detail || 'Failed to parse statement'],
                warnings: [],
                parser_used: 'none',
            };
        }

        return res.json();
    } catch (error) {
        console.error(error);
        return {
            success: false,
            transactions: [],
            transaction_count: 0,
            errors: ['Failed to connect to server'],
            warnings: [],
            parser_used: 'none',
        };
    }
}

export interface ImportTransactionData {
    date: string;
    description: string;
    amount: number;
    category_id?: number;
    merchant?: string;
    notes?: string;
}

export interface ImportResult {
    success: boolean;
    imported_count: number;
    imported: Array<{ description: string; amount: number; date: string }>;
    errors: string[];
}

export async function importTransactions(transactions: ImportTransactionData[]): Promise<ImportResult | null> {
    try {
        const baseUrl = getBaseUrl();
        const res = await fetch(`${baseUrl}/api/v1/budget/statements/import`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ transactions }),
        });

        if (!res.ok) {
            return null;
        }

        return res.json();
    } catch (error) {
        console.error(error);
        return null;
    }
}

export async function getSupportedFormats(): Promise<SupportedFormatsResponse | null> {
    try {
        const baseUrl = getBaseUrl();
        const res = await fetch(`${baseUrl}/api/v1/budget/statements/supported-formats`, {
            cache: 'no-store'
        });
        if (!res.ok) return null;
        return res.json();
    } catch (error) {
        console.error(error);
        return null;
    }
}

export async function aiReviewTransactions(transactions: ParsedTransaction[]): Promise<AIReviewResponse | null> {
    try {
        const baseUrl = getBaseUrl();
        const res = await fetch(`${baseUrl}/api/v1/budget/statements/ai-review`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                transactions: transactions.map(t => ({
                    date: t.date,
                    description: t.description,
                    amount: t.amount,
                    merchant: t.merchant,
                }))
            }),
        });

        if (!res.ok) {
            return null;
        }

        return res.json();
    } catch (error) {
        console.error(error);
        return null;
    }
}
