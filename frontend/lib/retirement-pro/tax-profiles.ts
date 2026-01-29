/**
 * Tax Profiles Database
 * 15 country/region tax profiles with proper tax rules
 */

import type { TaxProfile, CountryCode } from "./types";

export const TAX_PROFILES: Record<CountryCode, TaxProfile> = {
    US: {
        currency: "$",
        reference: "2025 IRS Tax Code (Single Filer)",
        incomeTax: {
            type: "progressive",
            brackets: [
                [15000, 0.0],
                [26925, 0.1],
                [63475, 0.12],
                [118350, 0.22],
                [212300, 0.24],
                [265525, 0.32],
                [641350, 0.35],
                [Infinity, 0.37],
            ],
        },
        capGains: {
            type: "progressive",
            brackets: [
                [64250, 0.0],
                [536150, 0.15],
                [Infinity, 0.2],
            ],
        },
        propertyTax: { type: "flat", rate: 0.011 },
        dividendTax: { type: "linked", correlation: "capGains" },
    },

    US_TX: {
        currency: "$",
        reference: "2025 Federal + Texas State Rules",
        incomeTax: {
            type: "progressive",
            brackets: [
                [15000, 0.0],
                [26925, 0.1],
                [63475, 0.12],
                [118350, 0.22],
                [212300, 0.24],
                [265525, 0.32],
                [641350, 0.35],
                [Infinity, 0.37],
            ],
        },
        capGains: {
            type: "progressive",
            brackets: [
                [64250, 0.0],
                [536150, 0.15],
                [Infinity, 0.2],
            ],
        },
        propertyTax: { type: "flat", rate: 0.018 },
        dividendTax: { type: "linked", correlation: "capGains" },
    },

    US_CA: {
        currency: "$",
        reference: "2025 Federal + California Tax Code",
        incomeTax: {
            type: "progressive",
            brackets: [
                [15000, 0.0],
                [26925, 0.11],
                [63475, 0.16],
                [118350, 0.313],
                [212300, 0.333],
                [265525, 0.413],
                [641350, 0.463],
                [1000000, 0.493],
                [Infinity, 0.503],
            ],
        },
        capGains: {
            type: "progressive",
            brackets: [
                [64250, 0.0],
                [536150, 0.26],
                [Infinity, 0.33],
            ],
        },
        propertyTax: { type: "assessed", rate: 0.012 },
        dividendTax: { type: "linked", correlation: "capGains" },
    },

    US_NY: {
        currency: "$",
        reference: "2025 Federal + NY State + NYC Tax",
        incomeTax: {
            type: "progressive",
            brackets: [
                [15000, 0.0],
                [26925, 0.14],
                [63475, 0.18],
                [118350, 0.28],
                [212300, 0.3],
                [265525, 0.38],
                [641350, 0.42],
                [Infinity, 0.46],
            ],
        },
        capGains: {
            type: "progressive",
            brackets: [
                [52000, 0.06],
                [536150, 0.24],
                [Infinity, 0.3],
            ],
        },
        propertyTax: { type: "flat", rate: 0.017 },
        dividendTax: { type: "linked", correlation: "capGains" },
    },

    UK: {
        currency: "£",
        reference: "2024/25 HMRC Budget (Frozen Thresholds)",
        indexBrackets: false,
        incomeTax: {
            type: "progressive",
            brackets: [
                [12570, 0],
                [50270, 0.2],
                [125140, 0.4],
                [Infinity, 0.45],
            ],
        },
        capGains: { type: "flat", allowance: 3000, rate: 0.2 },
        propertyTax: { type: "fixed", amount: 3000 },
        dividendTax: {
            type: "progressive",
            allowance: 500,
            brackets: [
                [50270, 0.0875],
                [Infinity, 0.3935],
            ],
        },
    },

    IE: {
        currency: "€",
        reference: "Budget 2025 (Projected)",
        incomeTax: {
            type: "progressive",
            brackets: [
                [18750, 0],
                [44000, 0.2],
                [Infinity, 0.4],
            ],
        },
        capGains: { type: "flat", allowance: 1270, rate: 0.33 },
        propertyTax: { type: "flat", rate: 0.0018 },
        dividendTax: { type: "linked", correlation: "incomeTax" },
    },

    AU: {
        currency: "A$",
        reference: "FY2025 (Stage 3 Tax Cuts)",
        incomeTax: {
            type: "progressive",
            brackets: [
                [18200, 0],
                [45000, 0.16],
                [135000, 0.3],
                [190000, 0.37],
                [Infinity, 0.45],
            ],
        },
        capGains: { type: "inclusion", inclusionRate: 0.5 },
        propertyTax: { type: "flat", rate: 0.0 },
        dividendTax: { type: "credit", rate: 0.3 },
    },

    DE: {
        currency: "€",
        reference: "Germany 2024/25 Tax Tables",
        incomeTax: {
            type: "progressive",
            brackets: [
                [11604, 0],
                [66760, 0.42],
                [Infinity, 0.45],
            ],
        },
        capGains: { type: "flat", allowance: 1000, rate: 0.26375 },
        propertyTax: { type: "flat", rate: 0.0035 },
        dividendTax: { type: "linked", correlation: "capGains" },
    },

    FR: {
        currency: "€",
        reference: "France 2024/25 Finance Law",
        incomeTax: {
            type: "progressive",
            brackets: [
                [11294, 0],
                [28797, 0.11],
                [82341, 0.3],
                [177106, 0.41],
                [Infinity, 0.45],
            ],
        },
        capGains: { type: "flat", rate: 0.3 },
        propertyTax: { type: "flat", rate: 0.005 },
        dividendTax: { type: "flat", rate: 0.3 },
    },

    ES: {
        currency: "€",
        reference: "Spain 2024/25 (General + Savings)",
        incomeTax: {
            type: "progressive",
            brackets: [
                [12450, 0.19],
                [20200, 0.24],
                [35200, 0.3],
                [60000, 0.37],
                [300000, 0.45],
                [Infinity, 0.47],
            ],
        },
        capGains: {
            type: "progressive",
            brackets: [
                [6000, 0.19],
                [50000, 0.21],
                [200000, 0.23],
                [Infinity, 0.28],
            ],
        },
        propertyTax: { type: "flat", rate: 0.006 },
        dividendTax: { type: "linked", correlation: "capGains" },
    },

    AE: {
        currency: "AED",
        reference: "UAE Corporate Tax Law (0% Personal)",
        incomeTax: { type: "flat", rate: 0.0 },
        capGains: { type: "flat", rate: 0.0 },
        propertyTax: { type: "flat", rate: 0.0 },
        dividendTax: { type: "flat", rate: 0.0 },
    },

    SG: {
        currency: "S$",
        reference: "IRAS Assessment Year 2024",
        incomeTax: {
            type: "progressive",
            brackets: [
                [20000, 0],
                [30000, 0.02],
                [40000, 0.035],
                [80000, 0.07],
                [120000, 0.115],
                [160000, 0.15],
                [200000, 0.18],
                [240000, 0.19],
                [280000, 0.195],
                [320000, 0.2],
                [500000, 0.22],
                [1000000, 0.23],
                [Infinity, 0.24],
            ],
        },
        capGains: { type: "flat", rate: 0.0 },
        propertyTax: { type: "flat", rate: 0.001 },
        dividendTax: { type: "flat", rate: 0.0 },
    },

    CY: {
        currency: "€",
        reference: "2024 Cyprus Tax Code",
        incomeTax: {
            type: "progressive",
            brackets: [
                [19500, 0],
                [28000, 0.2],
                [36300, 0.25],
                [60000, 0.3],
                [Infinity, 0.35],
            ],
        },
        capGains: { type: "flat", rate: 0.0 },
        propertyTax: { type: "flat", rate: 0.0 },
        dividendTax: { type: "flat", rate: 0.0 },
    },

    CA: {
        currency: "C$",
        reference: "2024 Canadian Federal + Avg Prov",
        incomeTax: {
            type: "progressive",
            brackets: [
                [15705, 0.15],
                [55867, 0.15],
                [111733, 0.205],
                [173205, 0.26],
                [246752, 0.29],
                [Infinity, 0.33],
            ],
        },
        capGains: { type: "inclusion", inclusionRate: 0.5 },
        propertyTax: { type: "flat", rate: 0.01 },
        dividendTax: { type: "credit", rate: 0.15 },
    },

    CH: {
        currency: "CHF",
        reference: "Federal + Cantonal Avg (Est.)",
        incomeTax: {
            type: "progressive",
            brackets: [
                [14000, 0],
                [Infinity, 0.115],
            ],
        },
        capGains: { type: "flat", rate: 0.0 },
        propertyTax: { type: "flat", rate: 0.002 },
        dividendTax: { type: "linked", correlation: "incomeTax" },
    },
};

// Country display names for UI
export const COUNTRY_NAMES: Record<CountryCode, string> = {
    US: "United States (Federal)",
    US_TX: "United States (Texas)",
    US_CA: "United States (California)",
    US_NY: "United States (New York)",
    UK: "United Kingdom",
    IE: "Ireland",
    AU: "Australia",
    DE: "Germany",
    FR: "France",
    ES: "Spain",
    AE: "UAE",
    SG: "Singapore",
    CY: "Cyprus",
    CA: "Canada",
    CH: "Switzerland",
};
