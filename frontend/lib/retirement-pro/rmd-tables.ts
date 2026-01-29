/**
 * Required Minimum Distribution (RMD) Tables by Country
 *
 * References:
 * - US: IRS Publication 590-B, Uniform Lifetime Table (SECURE Act 2.0)
 * - Canada: RRIF Minimum Withdrawal Schedule
 * - Australia: Superannuation Minimum Drawdown Rates (ATO)
 * - UK: No mandatory withdrawals
 */

export interface RMDTableEntry {
    age: number;
    divisor?: number;
    percentage?: number;
}

export interface RMDConfig {
    startAge: number | null;
    accountTypes: string[];
    table: Record<number, number>;
}

export const RMD_TABLES: Record<string, RMDConfig> = {
    /**
     * United States - IRS Uniform Lifetime Table
     * SECURE Act 2.0: Age 73 for those turning 72 after 12/31/2022
     */
    US: {
        startAge: 73,
        accountTypes: ['deferred'],
        table: {
            73: 26.5, 74: 25.5, 75: 24.6, 76: 23.7, 77: 22.9, 78: 22.0,
            79: 21.1, 80: 20.2, 81: 19.4, 82: 18.5, 83: 17.7, 84: 16.8,
            85: 16.0, 86: 15.2, 87: 14.4, 88: 13.7, 89: 12.9, 90: 12.2,
            91: 11.5, 92: 10.8, 93: 10.1, 94: 9.5, 95: 8.9, 96: 8.4,
            97: 7.8, 98: 7.3, 99: 6.8, 100: 6.4, 101: 6.0, 102: 5.6,
            103: 5.2, 104: 4.9, 105: 4.6, 106: 4.3, 107: 4.1, 108: 3.9,
            109: 3.7, 110: 3.5, 111: 3.4, 112: 3.3, 113: 3.1, 114: 3.0,
            115: 2.9, 116: 2.8, 117: 2.7, 118: 2.5, 119: 2.3, 120: 2.0,
        },
    },

    // US State variants use same RMD rules
    US_TX: { startAge: 73, accountTypes: ['deferred'], table: {} },
    US_CA: { startAge: 73, accountTypes: ['deferred'], table: {} },
    US_NY: { startAge: 73, accountTypes: ['deferred'], table: {} },

    /**
     * Canada - RRIF Minimum Withdrawal Percentages
     * First withdrawal required in year following conversion (age 72)
     */
    CA: {
        startAge: 72,
        accountTypes: ['deferred'],
        table: {
            55: 2.86, 56: 2.94, 57: 3.03, 58: 3.13, 59: 3.23, 60: 3.33,
            61: 3.45, 62: 3.57, 63: 3.70, 64: 3.85, 65: 4.00, 66: 4.17,
            67: 4.35, 68: 4.55, 69: 4.76, 70: 5.00, 71: 5.28, 72: 5.40,
            73: 5.53, 74: 5.67, 75: 5.82, 76: 5.98, 77: 6.17, 78: 6.36,
            79: 6.58, 80: 6.82, 81: 7.08, 82: 7.38, 83: 7.71, 84: 8.08,
            85: 8.51, 86: 8.99, 87: 9.55, 88: 10.21, 89: 10.99, 90: 11.92,
            91: 13.06, 92: 14.49, 93: 16.34, 94: 18.79, 95: 20.00,
            96: 20.00, 97: 20.00, 98: 20.00, 99: 20.00, 100: 20.00,
        },
    },

    /**
     * Australia - Superannuation Minimum Drawdown Rates
     * Standard access age: 60
     */
    AU: {
        startAge: 60,
        accountTypes: ['deferred'],
        table: {
            60: 4.0, 61: 4.0, 62: 4.0, 63: 4.0, 64: 4.0,
            65: 5.0, 66: 5.0, 67: 5.0, 68: 5.0, 69: 5.0,
            70: 5.0, 71: 5.0, 72: 5.0, 73: 5.0, 74: 5.0,
            75: 6.0, 76: 6.0, 77: 6.0, 78: 6.0, 79: 6.0,
            80: 7.0, 81: 7.0, 82: 7.0, 83: 7.0, 84: 7.0,
            85: 9.0, 86: 9.0, 87: 9.0, 88: 9.0, 89: 9.0,
            90: 11.0, 91: 11.0, 92: 11.0, 93: 11.0, 94: 11.0,
            95: 14.0, 96: 14.0, 97: 14.0, 98: 14.0, 99: 14.0, 100: 14.0,
        },
    },

    /**
     * United Kingdom - No Mandatory Withdrawals
     * Pension freedom rules allow flexible access from age 55
     */
    UK: {
        startAge: null,
        accountTypes: [],
        table: {},
    },

    // Countries without RMD requirements
    IE: { startAge: null, accountTypes: [], table: {} },
    DE: { startAge: null, accountTypes: [], table: {} },
    FR: { startAge: null, accountTypes: [], table: {} },
    ES: { startAge: null, accountTypes: [], table: {} },
    AE: { startAge: null, accountTypes: [], table: {} },
    SG: { startAge: null, accountTypes: [], table: {} },
    CY: { startAge: null, accountTypes: [], table: {} },
    CH: { startAge: null, accountTypes: [], table: {} },
};

/**
 * Get RMD divisor or percentage for a given age and country
 */
export function getRMDFactor(age: number, country: string): number | null {
    // For US state variants, use the main US table
    let config = RMD_TABLES[country];
    if (country.startsWith('US_') && config && Object.keys(config.table).length === 0) {
        config = RMD_TABLES.US;
    }

    if (!config) {
        console.warn(`Unknown country code for RMD: ${country}, defaulting to no RMDs`);
        return null;
    }

    if (config.startAge === null) {
        return null;
    }

    if (age < config.startAge) {
        return null;
    }

    const factor = config.table[age];
    if (factor !== undefined) {
        return factor;
    }

    // For ages beyond table, use the maximum age's factor
    const maxAge = Math.max(...Object.keys(config.table).map(Number));
    return config.table[maxAge] || null;
}

/**
 * Calculate Required Minimum Distribution amount
 */
export function calculateRMD(
    accountBalance: number,
    age: number,
    country: string
): number {
    const factor = getRMDFactor(age, country);

    if (factor === null || accountBalance <= 0) {
        return 0;
    }

    // US uses divisor (balance / factor)
    // Australia/Canada use percentage (balance * factor / 100)
    if (country === 'AU' || country === 'CA') {
        return accountBalance * (factor / 100);
    } else {
        return accountBalance / factor;
    }
}

/**
 * Check if RMDs are required for a given age and country
 */
export function isRMDRequired(age: number, country: string): boolean {
    let config = RMD_TABLES[country];
    if (country.startsWith('US_') && config && Object.keys(config.table).length === 0) {
        config = RMD_TABLES.US;
    }
    return config?.startAge !== null && age >= (config?.startAge ?? Infinity);
}
