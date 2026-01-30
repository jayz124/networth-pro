/**
 * Auto-population logic for Retirement Essential Mode
 * Aggregates data from Portfolio, Assets, Real Estate, and Liabilities tabs
 */

import { fetchHoldings, fetchAccounts, fetchProperties, fetchLiabilities, Holding, Account, Property, Liability, Mortgage } from "./api"

export interface AutoPopulateData {
    // Current Investments (from Portfolio)
    totalStocks: number
    totalBonds: number
    totalCash: number
    otherInvestments: number

    // Real Estate (from Properties)
    primaryHomeValue: number
    totalMortgageBalance: number
    mortgageInterestRate: number  // weighted average
    mortgageRemainingYears: number  // weighted average

    // Other Debts (from Liabilities)
    otherDebts: number

    // Data availability flags
    hasPortfolioData: boolean
    hasAccountsData: boolean
    hasPropertiesData: boolean
    hasLiabilitiesData: boolean
}

export async function fetchAutoPopulateData(): Promise<AutoPopulateData> {
    // Fetch all data in parallel
    const [holdings, accounts, properties, liabilities] = await Promise.all([
        fetchHoldings(),
        fetchAccounts(),
        fetchProperties(),
        fetchLiabilities(),
    ])

    // Categorize portfolio holdings by asset class
    const stockAssetTypes = ["stock", "etf", "mutual_fund"]
    const totalStocks = holdings
        .filter(h => stockAssetTypes.includes(h.asset_type.toLowerCase()))
        .reduce((sum, h) => sum + (h.current_value || 0), 0)

    const totalBonds = holdings
        .filter(h => h.asset_type.toLowerCase() === "bond")
        .reduce((sum, h) => sum + (h.current_value || 0), 0)

    // Other investments: crypto, commodities, alternatives, etc.
    const otherInvestmentTypes = ["crypto", "cryptocurrency", "commodity", "other", "alternative"]
    const otherInvestments = holdings
        .filter(h => otherInvestmentTypes.includes(h.asset_type.toLowerCase()))
        .reduce((sum, h) => sum + (h.current_value || 0), 0)

    // Cash from Accounts tab (checking, savings, cash, money_market types)
    const cashAccountTypes = ["checking", "savings", "cash", "money_market"]
    const totalCash = accounts
        .filter(a => cashAccountTypes.includes(a.type.toLowerCase()))
        .reduce((sum, a) => sum + (a.current_balance || 0), 0)

    // Real estate: find primary home
    const primaryHome = properties.find(
        p => p.property_type.toLowerCase().includes("primary") ||
             p.property_type.toLowerCase().includes("residence") ||
             p.property_type.toLowerCase() === "home"
    )
    const primaryHomeValue = primaryHome?.current_value || 0

    // Calculate total mortgage balance and weighted average interest rate
    const allMortgages: (Mortgage & { propertyValue: number })[] = []
    properties.forEach(p => {
        if (p.mortgages && p.mortgages.length > 0) {
            p.mortgages.forEach(m => {
                if (m.is_active && m.current_balance > 0) {
                    allMortgages.push({ ...m, propertyValue: p.current_value })
                }
            })
        }
    })

    const totalMortgageBalance = allMortgages.reduce((sum, m) => sum + m.current_balance, 0)

    // Weighted average interest rate (weighted by balance)
    // Note: interest_rate from Real Estate is stored as percentage (e.g., 6.2 for 6.2%)
    // Convert to decimal (e.g., 0.062) for retirement calculations
    let mortgageInterestRate = 0.06 // default 6%
    if (totalMortgageBalance > 0) {
        const weightedSum = allMortgages.reduce(
            (sum, m) => sum + ((m.interest_rate / 100) * m.current_balance),
            0
        )
        mortgageInterestRate = weightedSum / totalMortgageBalance
    }

    // Weighted average remaining years
    let mortgageRemainingYears = 25 // default
    if (totalMortgageBalance > 0) {
        const weightedYears = allMortgages.reduce(
            (sum, m) => sum + (m.term_years * m.current_balance),
            0
        )
        mortgageRemainingYears = Math.round(weightedYears / totalMortgageBalance)
    }

    // Other debts from Liabilities tab
    const otherDebts = liabilities.reduce((sum, l) => sum + (l.current_balance || 0), 0)

    return {
        totalStocks,
        totalBonds,
        totalCash,
        otherInvestments,
        primaryHomeValue,
        totalMortgageBalance,
        mortgageInterestRate,
        mortgageRemainingYears,
        otherDebts,
        hasPortfolioData: holdings.length > 0,
        hasAccountsData: accounts.length > 0,
        hasPropertiesData: properties.length > 0,
        hasLiabilitiesData: liabilities.length > 0,
    }
}

/**
 * Apply auto-populate data to Essential mode fields, converting to RetirementConfig format
 */
export function applyAutoPopulateToConfig(
    data: AutoPopulateData,
    existingConfig: {
        currentAge: number
        retirementAge: number
        lifeExpectancy: number
        annualIncome: number
        annualSpending: number
        goGoSpending: number
        slowGoSpending: number
        transitionAge: number
        pensionStartAge: number
        pensionAmount: number
        inflationRate: number
        withdrawalTaxRate?: number  // Essential mode simplified tax
    }
) {
    // Map Essential mode's simple investment breakdown to Pro mode's account structure
    // For Essential mode, we put everything in taxable account (simplified)
    const totalInvestments = data.totalStocks + data.totalBonds + data.totalCash + data.otherInvestments

    return {
        // Personal (kept from existing)
        currentAge: existingConfig.currentAge,
        retirementAge: existingConfig.retirementAge,
        lifeExpectancy: existingConfig.lifeExpectancy,

        // Assets - Taxable (simplified: all investments here)
        taxableAccount: {
            stocks: data.totalStocks + data.otherInvestments, // stocks + other
            bonds: data.totalBonds,
            cash: data.totalCash,
            stockCostBasis: Math.round((data.totalStocks + data.otherInvestments) * 0.6), // assume 60% cost basis
            bondCostBasis: Math.round(data.totalBonds * 0.95), // bonds typically near cost
        },

        // Assets - Tax-Deferred (empty in Essential mode - simplified)
        taxDeferredAccount: {
            stocks: 0,
            bonds: 0,
            cash: 0,
        },

        // Assets - Tax-Free (empty in Essential mode - simplified)
        rothAccount: {
            stocks: 0,
            bonds: 0,
            cash: 0,
        },

        // Real Estate
        primaryHome: data.primaryHomeValue,
        investmentProperty: 0,
        otherAssets: 0,

        // Liabilities
        mortgage: {
            balance: data.totalMortgageBalance,
            interestRate: data.mortgageInterestRate,
            remainingYears: data.mortgageRemainingYears,
        },
        otherLoan: {
            balance: data.otherDebts,
            interestRate: 0.08, // default 8% for other debt
            paybackStrategy: "interest_only" as const,
        },

        // Cash Flow - Pre-Retirement
        annualIncome: existingConfig.annualIncome,
        annualSpending: existingConfig.annualSpending,
        savingsToTaxable: Math.max(0, existingConfig.annualIncome - existingConfig.annualSpending),
        savingsTo401k: 0,
        savingsToRoth: 0,

        // Cash Flow - Post-Retirement
        goGoSpending: existingConfig.goGoSpending,
        slowGoSpending: existingConfig.slowGoSpending,
        transitionAge: existingConfig.transitionAge,

        // Pension / Social Security
        pensionStartAge: existingConfig.pensionStartAge,
        pensionAmount: existingConfig.pensionAmount,

        // Inheritance (default to none in Essential)
        inheritance: {
            receiveAmount: 0,
            receiveAge: 0,
            receiveAssetType: "liquid" as const,
            giveAmount: 0,
            giveAge: 0,
            giveAssetType: "liquid" as const,
        },

        // Market Assumptions (use expected return as blended rate)
        stockReturn: 0.07,
        bondReturn: 0.04,
        cashReturn: 0.02,
        inflationRate: existingConfig.inflationRate,
        dividendYield: 0.02,
        homeAppreciation: 0.03,
        propertyAppreciation: 0.03,
        rentalYield: 0.05,

        // Tax Strategy (simplified in Essential)
        taxStrategy: {
            withdrawalStrategy: "standard" as const,
            rothConversionStrategy: "none" as const,
        },

        // Stress Test (disabled in Essential)
        stressTest: {
            enabled: false,
            crashAge: 55,
            marketDropPercent: 40,
            recoveryYears: 5,
            flexibleSpending: false,
        },
    }
}
