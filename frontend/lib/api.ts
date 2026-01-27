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
    total_mortgage_balance?: number;
    equity?: number;
    monthly_payments?: number;
    mortgages?: Mortgage[];
    appreciation?: number;
    appreciation_percent?: number;
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
