// ============================================
// RETIREMENT PLANNER - COMPREHENSIVE LOGIC
// ============================================

// Account Types for Asset Allocation
export type AccountAssets = {
    stocks: number;
    bonds: number;
    cash: number;
}

export type TaxableAccount = AccountAssets & {
    stockCostBasis: number;
    bondCostBasis: number;
}

// Liabilities
export type MortgageConfig = {
    balance: number;
    interestRate: number; // decimal, e.g., 0.055 for 5.5%
    remainingYears: number;
}

export type OtherLoanConfig = {
    balance: number;
    interestRate: number;
    paybackStrategy: 'interest_only' | 'pay_at_retirement' | 'amortized';
}

// Inheritance
export type InheritanceConfig = {
    receiveAmount: number;
    receiveAge: number;
    receiveAssetType: 'liquid' | 'property';
    giveAmount: number;
    giveAge: number;
    giveAssetType: 'liquid' | 'home' | 'other';
}

// Tax Strategy
export type TaxStrategyConfig = {
    withdrawalStrategy: 'standard' | 'tax_sensitive' | 'pro_rata';
    rothConversionStrategy: 'none' | 'fill_bracket' | 'fixed_amount';
    rothConversionAmount?: number;
    country: string;  // Country code for tax profile (US, UK, IE, AU, etc.)
}

// Stress Test
export type StressTestConfig = {
    enabled: boolean;
    crashAge: number;
    marketDropPercent: number;
    recoveryYears: number;
    flexibleSpending: boolean;
}

// Main Configuration
export type RetirementConfig = {
    // Personal
    currentAge: number;
    retirementAge: number;
    lifeExpectancy: number;

    // Assets - Taxable
    taxableAccount: TaxableAccount;

    // Assets - Tax-Deferred (401k/IRA)
    taxDeferredAccount: AccountAssets;

    // Assets - Tax-Free (Roth)
    rothAccount: AccountAssets;

    // Assets - Real Estate & Other
    primaryHome: number;
    investmentProperty: number;
    otherAssets: number;

    // Liabilities
    mortgage: MortgageConfig;
    otherLoan: OtherLoanConfig;

    // Cash Flow - Pre-Retirement
    annualIncome: number;
    annualSpending: number;
    savingsToTaxable: number;
    savingsTo401k: number;
    savingsToRoth: number;

    // Cash Flow - Post-Retirement
    goGoSpending: number;
    slowGoSpending: number;
    transitionAge: number;

    // Pension / Social Security
    pensionStartAge: number;
    pensionAmount: number;

    // Inheritance
    inheritance: InheritanceConfig;

    // Market Assumptions
    stockReturn: number;
    bondReturn: number;
    cashReturn: number;
    inflationRate: number;
    dividendYield: number;
    homeAppreciation: number;
    propertyAppreciation: number;
    rentalYield: number;

    // Tax Strategy
    taxStrategy: TaxStrategyConfig;

    // Stress Test
    stressTest: StressTestConfig;
}

// Projection Data Point - Enhanced
export type ProjectionPoint = {
    age: number;
    year: number;
    isRetired: boolean;

    // Net Worth Components
    netWorth: number;
    liquidAssets: number;
    realEstateValue: number;
    totalLiabilities: number;

    // Account Balances
    taxableStocks: number;
    taxableBonds: number;
    taxableCash: number;
    deferredStocks: number;
    deferredBonds: number;
    deferredCash: number;
    rothStocks: number;
    rothBonds: number;
    rothCash: number;

    // Real Estate
    primaryHomeValue: number;
    investmentPropertyValue: number;
    otherAssetsValue: number;

    // Liabilities
    mortgageBalance: number;
    otherLoanBalance: number;

    // Cash Flow
    income: number;
    savings: number;
    spending: number;
    pensionIncome: number;
    rentalIncome: number;
    dividendIncome: number;
    portfolioDrawdown: number;
    taxPaid: number;
    mortgagePayment: number;
    loanPayment: number;
    netSpendable: number;

    // Debt Breakdown
    mortgageInterest: number;
    mortgagePrincipal: number;
    loanInterest: number;
    loanPrincipal: number;

    // Status
    shortfall: number;
}

export const DEFAULT_CONFIG: RetirementConfig = {
    // Personal
    currentAge: 35,
    retirementAge: 60,
    lifeExpectancy: 85,

    // Assets - Taxable
    taxableAccount: {
        stocks: 100000,
        bonds: 30000,
        cash: 20000,
        stockCostBasis: 50000,
        bondCostBasis: 30000,
    },

    // Assets - Tax-Deferred (401k/IRA)
    taxDeferredAccount: {
        stocks: 150000,
        bonds: 50000,
        cash: 10000,
    },

    // Assets - Tax-Free (Roth)
    rothAccount: {
        stocks: 50000,
        bonds: 15000,
        cash: 5000,
    },

    // Assets - Real Estate & Other
    primaryHome: 500000,
    investmentProperty: 0,
    otherAssets: 25000,

    // Liabilities
    mortgage: {
        balance: 300000,
        interestRate: 0.055,
        remainingYears: 25,
    },
    otherLoan: {
        balance: 0,
        interestRate: 0.08,
        paybackStrategy: 'interest_only',
    },

    // Cash Flow - Pre-Retirement
    annualIncome: 106500,
    annualSpending: 70000,
    savingsToTaxable: 10000,
    savingsTo401k: 20000,
    savingsToRoth: 6500,

    // Cash Flow - Post-Retirement
    goGoSpending: 70000,
    slowGoSpending: 50000,
    transitionAge: 75,

    // Pension / Social Security
    pensionStartAge: 67,
    pensionAmount: 20000,

    // Inheritance
    inheritance: {
        receiveAmount: 0,
        receiveAge: 0,
        receiveAssetType: 'liquid',
        giveAmount: 0,
        giveAge: 0,
        giveAssetType: 'liquid',
    },

    // Market Assumptions
    stockReturn: 0.07,
    bondReturn: 0.04,
    cashReturn: 0.02,
    inflationRate: 0.025,
    dividendYield: 0.02,
    homeAppreciation: 0.03,
    propertyAppreciation: 0.03,
    rentalYield: 0.05,

    // Tax Strategy
    taxStrategy: {
        withdrawalStrategy: 'standard',
        rothConversionStrategy: 'none',
        country: 'US',
    },

    // Stress Test
    stressTest: {
        enabled: false,
        crashAge: 55,
        marketDropPercent: 40,
        recoveryYears: 5,
        flexibleSpending: false,
    },
}

// Helper: Calculate mortgage payment (PMT formula)
function calculateMortgagePayment(principal: number, annualRate: number, years: number): number {
    if (principal <= 0 || years <= 0) return 0;
    const monthlyRate = annualRate / 12;
    const numPayments = years * 12;
    if (monthlyRate === 0) return principal / numPayments;
    const payment = principal * (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) / (Math.pow(1 + monthlyRate, numPayments) - 1);
    return payment * 12; // Return annual payment
}

// Helper: Simple tax estimate (federal US brackets simplified)
function estimateTax(income: number): number {
    if (income <= 0) return 0;
    // Simplified 2024 brackets - single filer
    let tax = 0;
    const brackets = [
        { limit: 11600, rate: 0.10 },
        { limit: 47150, rate: 0.12 },
        { limit: 100525, rate: 0.22 },
        { limit: 191950, rate: 0.24 },
        { limit: 243725, rate: 0.32 },
        { limit: 609350, rate: 0.35 },
        { limit: Infinity, rate: 0.37 },
    ];

    let remaining = income;
    let prevLimit = 0;

    for (const bracket of brackets) {
        const taxableInBracket = Math.min(remaining, bracket.limit - prevLimit);
        if (taxableInBracket <= 0) break;
        tax += taxableInBracket * bracket.rate;
        remaining -= taxableInBracket;
        prevLimit = bracket.limit;
    }

    return tax;
}

// Main Projection Calculator
export function calculateProjection(config: RetirementConfig): ProjectionPoint[] {
    const points: ProjectionPoint[] = [];
    const currentYear = new Date().getFullYear();

    // Initialize account balances
    let taxableStocks = config.taxableAccount.stocks;
    let taxableBonds = config.taxableAccount.bonds;
    let taxableCash = config.taxableAccount.cash;

    let deferredStocks = config.taxDeferredAccount.stocks;
    let deferredBonds = config.taxDeferredAccount.bonds;
    let deferredCash = config.taxDeferredAccount.cash;

    let rothStocks = config.rothAccount.stocks;
    let rothBonds = config.rothAccount.bonds;
    let rothCash = config.rothAccount.cash;

    let primaryHomeValue = config.primaryHome;
    let investmentPropertyValue = config.investmentProperty;
    let otherAssetsValue = config.otherAssets;

    let mortgageBalance = config.mortgage.balance;
    let otherLoanBalance = config.otherLoan.balance;

    // Calculate initial mortgage payment
    const baseMortgagePayment = calculateMortgagePayment(
        config.mortgage.balance,
        config.mortgage.interestRate,
        config.mortgage.remainingYears
    );

    for (let age = config.currentAge; age <= config.lifeExpectancy; age++) {
        const year = currentYear + (age - config.currentAge);
        const yearsFromNow = age - config.currentAge;
        const isRetired = age >= config.retirementAge;
        const inflationFactor = Math.pow(1 + config.inflationRate, yearsFromNow);

        // Apply stress test if enabled
        let stockReturnThisYear = config.stockReturn;
        let bondReturnThisYear = config.bondReturn;

        if (config.stressTest.enabled && age === config.stressTest.crashAge) {
            stockReturnThisYear = -config.stressTest.marketDropPercent / 100;
            bondReturnThisYear = -config.stressTest.marketDropPercent / 200; // Bonds drop less
        } else if (config.stressTest.enabled &&
            age > config.stressTest.crashAge &&
            age <= config.stressTest.crashAge + config.stressTest.recoveryYears) {
            // Recovery period - higher returns
            const recoveryBoost = 0.05;
            stockReturnThisYear = config.stockReturn + recoveryBoost;
            bondReturnThisYear = config.bondReturn + recoveryBoost / 2;
        }

        // ============ INCOME PHASE ============
        let income = 0;
        let savings = 0;
        let spending = 0;
        let pensionIncome = 0;
        let rentalIncome = 0;
        let dividendIncome = 0;
        let portfolioDrawdown = 0;
        let taxPaid = 0;
        let mortgagePayment = 0;
        let loanPayment = 0;

        // Dividends from taxable stocks
        dividendIncome = taxableStocks * config.dividendYield;

        // Rental income from investment property
        if (investmentPropertyValue > 0) {
            rentalIncome = investmentPropertyValue * config.rentalYield;
        }

        // Handle inheritance
        if (config.inheritance.receiveAmount > 0 && age === config.inheritance.receiveAge) {
            const inheritedAmount = config.inheritance.receiveAmount * inflationFactor;
            if (config.inheritance.receiveAssetType === 'liquid') {
                taxableCash += inheritedAmount;
            } else {
                investmentPropertyValue += inheritedAmount;
            }
        }

        if (config.inheritance.giveAmount > 0 && age === config.inheritance.giveAge) {
            const giftAmount = config.inheritance.giveAmount * inflationFactor;
            // Deduct from appropriate asset
            if (config.inheritance.giveAssetType === 'liquid') {
                const totalLiquid = taxableCash + taxableBonds + taxableStocks;
                if (totalLiquid >= giftAmount) {
                    const ratio = giftAmount / totalLiquid;
                    taxableCash -= taxableCash * ratio;
                    taxableBonds -= taxableBonds * ratio;
                    taxableStocks -= taxableStocks * ratio;
                }
            } else if (config.inheritance.giveAssetType === 'home') {
                primaryHomeValue -= giftAmount;
            } else {
                otherAssetsValue -= giftAmount;
            }
        }

        if (!isRetired) {
            // Working Phase
            income = config.annualIncome * Math.pow(1 + 0.02, yearsFromNow); // 2% salary growth
            spending = config.annualSpending * inflationFactor;

            // Calculate savings allocation
            const totalSavings = config.savingsToTaxable + config.savingsTo401k + config.savingsToRoth;
            savings = Math.min(totalSavings, income - spending);

            if (savings > 0) {
                const savingsRatio = savings / totalSavings;
                // Allocate savings to accounts (simplified: all to stocks for growth)
                taxableStocks += config.savingsToTaxable * savingsRatio;
                deferredStocks += config.savingsTo401k * savingsRatio;
                rothStocks += config.savingsToRoth * savingsRatio;
            }

            // Tax on income (simplified)
            taxPaid = estimateTax(income + dividendIncome + rentalIncome);

        } else {
            // Retirement Phase
            // Determine spending based on age
            if (age < config.transitionAge) {
                spending = config.goGoSpending * inflationFactor;
            } else {
                spending = config.slowGoSpending * inflationFactor;
            }

            // Flexible spending during stress test
            if (config.stressTest.enabled && config.stressTest.flexibleSpending) {
                if (age >= config.stressTest.crashAge && age <= config.stressTest.crashAge + config.stressTest.recoveryYears) {
                    spending *= 0.8; // Reduce spending by 20% during crash recovery
                }
            }

            // Pension income
            if (age >= config.pensionStartAge) {
                pensionIncome = config.pensionAmount * inflationFactor;
            }

            // Total income available before drawdown
            const incomeBeforeDrawdown = pensionIncome + dividendIncome + rentalIncome;

            // Calculate needed drawdown
            const neededForSpending = spending - incomeBeforeDrawdown;
            portfolioDrawdown = Math.max(0, neededForSpending);

            // Withdrawal order based on strategy
            if (portfolioDrawdown > 0) {
                let remaining = portfolioDrawdown;

                if (config.taxStrategy.withdrawalStrategy === 'standard') {
                    // Taxable -> Deferred -> Roth
                    // Draw from taxable first
                    if (remaining > 0 && taxableCash > 0) {
                        const draw = Math.min(remaining, taxableCash);
                        taxableCash -= draw;
                        remaining -= draw;
                    }
                    if (remaining > 0 && taxableBonds > 0) {
                        const draw = Math.min(remaining, taxableBonds);
                        taxableBonds -= draw;
                        remaining -= draw;
                    }
                    if (remaining > 0 && taxableStocks > 0) {
                        const draw = Math.min(remaining, taxableStocks);
                        taxableStocks -= draw;
                        remaining -= draw;
                    }
                    // Then deferred
                    if (remaining > 0 && deferredCash > 0) {
                        const draw = Math.min(remaining, deferredCash);
                        deferredCash -= draw;
                        remaining -= draw;
                    }
                    if (remaining > 0 && deferredBonds > 0) {
                        const draw = Math.min(remaining, deferredBonds);
                        deferredBonds -= draw;
                        remaining -= draw;
                    }
                    if (remaining > 0 && deferredStocks > 0) {
                        const draw = Math.min(remaining, deferredStocks);
                        deferredStocks -= draw;
                        remaining -= draw;
                    }
                    // Finally Roth
                    if (remaining > 0 && rothCash > 0) {
                        const draw = Math.min(remaining, rothCash);
                        rothCash -= draw;
                        remaining -= draw;
                    }
                    if (remaining > 0 && rothBonds > 0) {
                        const draw = Math.min(remaining, rothBonds);
                        rothBonds -= draw;
                        remaining -= draw;
                    }
                    if (remaining > 0 && rothStocks > 0) {
                        const draw = Math.min(remaining, rothStocks);
                        rothStocks -= draw;
                        remaining -= draw;
                    }
                } else if (config.taxStrategy.withdrawalStrategy === 'pro_rata') {
                    // Proportional withdrawal
                    const totalTaxable = taxableStocks + taxableBonds + taxableCash;
                    const totalDeferred = deferredStocks + deferredBonds + deferredCash;
                    const totalRoth = rothStocks + rothBonds + rothCash;
                    const totalLiquid = totalTaxable + totalDeferred + totalRoth;

                    if (totalLiquid > 0) {
                        const taxableRatio = totalTaxable / totalLiquid;
                        const deferredRatio = totalDeferred / totalLiquid;
                        const rothRatio = totalRoth / totalLiquid;

                        const fromTaxable = remaining * taxableRatio;
                        const fromDeferred = remaining * deferredRatio;
                        const fromRoth = remaining * rothRatio;

                        // Deduct proportionally from each account type
                        if (totalTaxable > 0) {
                            const accountRatio = fromTaxable / totalTaxable;
                            taxableStocks -= taxableStocks * accountRatio;
                            taxableBonds -= taxableBonds * accountRatio;
                            taxableCash -= taxableCash * accountRatio;
                        }
                        if (totalDeferred > 0) {
                            const accountRatio = fromDeferred / totalDeferred;
                            deferredStocks -= deferredStocks * accountRatio;
                            deferredBonds -= deferredBonds * accountRatio;
                            deferredCash -= deferredCash * accountRatio;
                        }
                        if (totalRoth > 0) {
                            const accountRatio = fromRoth / totalRoth;
                            rothStocks -= rothStocks * accountRatio;
                            rothBonds -= rothBonds * accountRatio;
                            rothCash -= rothCash * accountRatio;
                        }
                        remaining = 0;
                    }
                }
                // Tax-sensitive would require more complex optimization
            }

            // Estimate tax on retirement income
            taxPaid = estimateTax(pensionIncome + portfolioDrawdown * 0.5 + dividendIncome + rentalIncome);
        }

        // ============ MORTGAGE PAYMENTS ============
        let mortgageInterest = 0;
        let mortgagePrincipal = 0;

        if (mortgageBalance > 0) {
            const yearsRemaining = config.mortgage.remainingYears - yearsFromNow;
            if (yearsRemaining > 0) {
                mortgagePayment = baseMortgagePayment;
                mortgageInterest = mortgageBalance * config.mortgage.interestRate;
                mortgagePrincipal = Math.min(mortgagePayment - mortgageInterest, mortgageBalance);
                mortgageBalance = Math.max(0, mortgageBalance - mortgagePrincipal);
            } else {
                mortgageBalance = 0;
            }
        }

        // ============ OTHER LOAN PAYMENTS ============
        let loanInterest = 0;
        let loanPrincipal = 0;

        if (otherLoanBalance > 0) {
            loanInterest = otherLoanBalance * config.otherLoan.interestRate;

            if (config.otherLoan.paybackStrategy === 'interest_only') {
                loanPayment = loanInterest;
            } else if (config.otherLoan.paybackStrategy === 'pay_at_retirement' && isRetired) {
                loanPayment = otherLoanBalance + loanInterest;
                loanPrincipal = otherLoanBalance;
                otherLoanBalance = 0;
            } else if (config.otherLoan.paybackStrategy === 'amortized') {
                // Assume 10-year amortization
                const annualPayment = calculateMortgagePayment(config.otherLoan.balance, config.otherLoan.interestRate, 10);
                loanPayment = Math.min(annualPayment, otherLoanBalance + loanInterest);
                loanPrincipal = loanPayment - loanInterest;
                otherLoanBalance = Math.max(0, otherLoanBalance - loanPrincipal);
            } else {
                loanPayment = loanInterest;
            }
        }

        // ============ INVESTMENT GROWTH ============
        // Grow accounts by their respective returns
        taxableStocks *= (1 + stockReturnThisYear);
        taxableBonds *= (1 + bondReturnThisYear);
        taxableCash *= (1 + config.cashReturn);

        deferredStocks *= (1 + stockReturnThisYear);
        deferredBonds *= (1 + bondReturnThisYear);
        deferredCash *= (1 + config.cashReturn);

        rothStocks *= (1 + stockReturnThisYear);
        rothBonds *= (1 + bondReturnThisYear);
        rothCash *= (1 + config.cashReturn);

        // Real estate appreciation
        primaryHomeValue *= (1 + config.homeAppreciation);
        investmentPropertyValue *= (1 + config.propertyAppreciation);
        otherAssetsValue *= (1 + config.inflationRate); // Other assets grow with inflation

        // ============ CALCULATE TOTALS ============
        const liquidAssets = taxableStocks + taxableBonds + taxableCash +
            deferredStocks + deferredBonds + deferredCash +
            rothStocks + rothBonds + rothCash;

        const realEstateValue = primaryHomeValue + investmentPropertyValue + otherAssetsValue;
        const totalLiabilities = mortgageBalance + otherLoanBalance;
        const netWorth = liquidAssets + realEstateValue - totalLiabilities;

        // Calculate shortfall
        const shortfall = netWorth < 0 ? Math.abs(netWorth) : 0;

        // Net spendable (what's left after all expenses)
        const netSpendable = (income || pensionIncome + dividendIncome + rentalIncome + portfolioDrawdown) -
            spending - taxPaid - mortgagePayment - loanPayment;

        points.push({
            age,
            year,
            isRetired,
            netWorth,
            liquidAssets,
            realEstateValue,
            totalLiabilities,
            taxableStocks,
            taxableBonds,
            taxableCash,
            deferredStocks,
            deferredBonds,
            deferredCash,
            rothStocks,
            rothBonds,
            rothCash,
            primaryHomeValue,
            investmentPropertyValue,
            otherAssetsValue,
            mortgageBalance,
            otherLoanBalance,
            income,
            savings,
            spending,
            pensionIncome,
            rentalIncome,
            dividendIncome,
            portfolioDrawdown,
            taxPaid,
            mortgagePayment,
            loanPayment,
            netSpendable,
            mortgageInterest,
            mortgagePrincipal,
            loanInterest,
            loanPrincipal,
            shortfall,
        });
    }

    return points;
}

// Helper to calculate current net worth from config
export function calculateCurrentNetWorth(config: RetirementConfig): number {
    const taxableTotal = config.taxableAccount.stocks + config.taxableAccount.bonds + config.taxableAccount.cash;
    const deferredTotal = config.taxDeferredAccount.stocks + config.taxDeferredAccount.bonds + config.taxDeferredAccount.cash;
    const rothTotal = config.rothAccount.stocks + config.rothAccount.bonds + config.rothAccount.cash;
    const realEstateTotal = config.primaryHome + config.investmentProperty + config.otherAssets;
    const liabilitiesTotal = config.mortgage.balance + config.otherLoan.balance;

    return taxableTotal + deferredTotal + rothTotal + realEstateTotal - liabilitiesTotal;
}

// Calculate lifetime effective tax rate
export function calculateEffectiveTaxRate(data: ProjectionPoint[]): number {
    const totalIncome = data.reduce((sum, p) => sum + p.income + p.pensionIncome + p.portfolioDrawdown + p.dividendIncome + p.rentalIncome, 0);
    const totalTax = data.reduce((sum, p) => sum + p.taxPaid, 0);

    if (totalIncome === 0) return 0;
    return (totalTax / totalIncome) * 100;
}

// ============================================
// ESSENTIAL MODE CONFIGURATION
// ============================================

// Essential mode config type (simplified ~22 fields)
export type EssentialConfig = {
    // Personal Information (3)
    currentAge: number;
    retirementAge: number;
    lifeExpectancy: number;

    // Current Investments (4) - auto-synced from Portfolio/Assets
    totalStocks: number;
    totalBonds: number;
    totalCash: number;
    otherInvestments: number;

    // Real Estate & Debt (4) - auto-synced
    primaryHomeValue: number;
    totalMortgageBalance: number;
    mortgageInterestRate: number;
    otherDebts: number;

    // Annual Cash Flow (3)
    annualIncome: number;
    annualSpending: number;
    // annualSavings is calculated: income - spending

    // Retirement Spending (3)
    goGoSpending: number;
    slowGoSpending: number;
    transitionAge: number;

    // Pension/Retirement Income (2)
    pensionStartAge: number;
    pensionAmount: number;

    // Assumptions (3)
    expectedReturn: number;  // single blended rate
    inflationRate: number;
    withdrawalTaxRate: number;  // single % applied to all withdrawals
}

export const ESSENTIAL_DEFAULT_CONFIG: EssentialConfig = {
    // Personal
    currentAge: 35,
    retirementAge: 60,
    lifeExpectancy: 85,

    // Investments
    totalStocks: 300000,
    totalBonds: 95000,
    totalCash: 35000,
    otherInvestments: 25000,

    // Real Estate & Debt
    primaryHomeValue: 500000,
    totalMortgageBalance: 300000,
    mortgageInterestRate: 0.055,
    otherDebts: 0,

    // Cash Flow
    annualIncome: 106500,
    annualSpending: 70000,

    // Retirement Spending
    goGoSpending: 70000,
    slowGoSpending: 50000,
    transitionAge: 75,

    // Pension
    pensionStartAge: 67,
    pensionAmount: 20000,

    // Assumptions
    expectedReturn: 0.06,  // blended 6%
    inflationRate: 0.025,
    withdrawalTaxRate: 0.25,  // 25% effective tax on withdrawals
}

// Convert Essential config to full RetirementConfig for projection
export function essentialToFullConfig(essential: EssentialConfig): RetirementConfig {
    // Calculate annual savings
    const annualSavings = Math.max(0, essential.annualIncome - essential.annualSpending);

    // Distribute investments across account types (simplified: all taxable)
    // In Essential mode, we don't track tax account types
    const totalInvestments = essential.totalStocks + essential.totalBonds + essential.totalCash + essential.otherInvestments;

    // Calculate remaining mortgage years (estimate based on balance and typical terms)
    const estimatedRemainingYears = essential.totalMortgageBalance > 0 ? 25 : 0;

    // Derive stock/bond returns from blended expected return
    // Assume 70/30 stock/bond split for blended rate derivation
    // If expected return is 6%, stocks ~7%, bonds ~4%
    const stockReturn = essential.expectedReturn + 0.01;
    const bondReturn = essential.expectedReturn - 0.02;

    return {
        // Personal
        currentAge: essential.currentAge,
        retirementAge: essential.retirementAge,
        lifeExpectancy: essential.lifeExpectancy,

        // Assets - Put all in taxable for Essential mode simplicity
        taxableAccount: {
            stocks: essential.totalStocks + essential.otherInvestments,
            bonds: essential.totalBonds,
            cash: essential.totalCash,
            stockCostBasis: Math.round((essential.totalStocks + essential.otherInvestments) * 0.6),
            bondCostBasis: Math.round(essential.totalBonds * 0.95),
        },

        // Empty tax-advantaged accounts in Essential mode
        taxDeferredAccount: { stocks: 0, bonds: 0, cash: 0 },
        rothAccount: { stocks: 0, bonds: 0, cash: 0 },

        // Real Estate
        primaryHome: essential.primaryHomeValue,
        investmentProperty: 0,
        otherAssets: 0,

        // Liabilities
        mortgage: {
            balance: essential.totalMortgageBalance,
            interestRate: essential.mortgageInterestRate,
            remainingYears: estimatedRemainingYears,
        },
        otherLoan: {
            balance: essential.otherDebts,
            interestRate: 0.08,
            paybackStrategy: 'interest_only',
        },

        // Cash Flow - Pre-Retirement
        annualIncome: essential.annualIncome,
        annualSpending: essential.annualSpending,
        savingsToTaxable: annualSavings,
        savingsTo401k: 0,
        savingsToRoth: 0,

        // Cash Flow - Post-Retirement
        goGoSpending: essential.goGoSpending,
        slowGoSpending: essential.slowGoSpending,
        transitionAge: essential.transitionAge,

        // Pension
        pensionStartAge: essential.pensionStartAge,
        pensionAmount: essential.pensionAmount,

        // Inheritance (none in Essential)
        inheritance: {
            receiveAmount: 0,
            receiveAge: 0,
            receiveAssetType: 'liquid',
            giveAmount: 0,
            giveAge: 0,
            giveAssetType: 'liquid',
        },

        // Market Assumptions
        stockReturn,
        bondReturn,
        cashReturn: 0.02,
        inflationRate: essential.inflationRate,
        dividendYield: 0.02,
        homeAppreciation: 0.03,
        propertyAppreciation: 0.03,
        rentalYield: 0.05,

        // Tax Strategy (simple in Essential)
        taxStrategy: {
            withdrawalStrategy: 'standard',
            rothConversionStrategy: 'none',
            country: 'US',
        },

        // Stress Test (disabled in Essential)
        stressTest: {
            enabled: false,
            crashAge: 55,
            marketDropPercent: 40,
            recoveryYears: 5,
            flexibleSpending: false,
        },
    };
}

// Convert full RetirementConfig to Essential config (for switching modes)
export function fullToEssentialConfig(full: RetirementConfig): EssentialConfig {
    // Aggregate all stocks across account types
    const totalStocks = full.taxableAccount.stocks +
                       full.taxDeferredAccount.stocks +
                       full.rothAccount.stocks;

    // Aggregate all bonds
    const totalBonds = full.taxableAccount.bonds +
                      full.taxDeferredAccount.bonds +
                      full.rothAccount.bonds;

    // Aggregate all cash
    const totalCash = full.taxableAccount.cash +
                     full.taxDeferredAccount.cash +
                     full.rothAccount.cash;

    // Other investments (from other assets in Pro mode)
    const otherInvestments = full.otherAssets;

    // Calculate blended expected return from stock/bond allocation
    const totalInvestments = totalStocks + totalBonds + totalCash + otherInvestments;
    const stockAllocation = totalInvestments > 0 ? (totalStocks + otherInvestments) / totalInvestments : 0.7;
    const bondAllocation = totalInvestments > 0 ? totalBonds / totalInvestments : 0.2;
    const cashAllocation = totalInvestments > 0 ? totalCash / totalInvestments : 0.1;

    const expectedReturn = stockAllocation * full.stockReturn +
                          bondAllocation * full.bondReturn +
                          cashAllocation * full.cashReturn;

    // Estimate effective withdrawal tax rate (simplified)
    const withdrawalTaxRate = 0.25; // Default 25%

    return {
        currentAge: full.currentAge,
        retirementAge: full.retirementAge,
        lifeExpectancy: full.lifeExpectancy,
        totalStocks,
        totalBonds,
        totalCash,
        otherInvestments,
        primaryHomeValue: full.primaryHome,
        totalMortgageBalance: full.mortgage.balance,
        mortgageInterestRate: full.mortgage.interestRate,
        otherDebts: full.otherLoan.balance,
        annualIncome: full.annualIncome,
        annualSpending: full.annualSpending,
        goGoSpending: full.goGoSpending,
        slowGoSpending: full.slowGoSpending,
        transitionAge: full.transitionAge,
        pensionStartAge: full.pensionStartAge,
        pensionAmount: full.pensionAmount,
        expectedReturn: Math.round(expectedReturn * 1000) / 1000, // Round to 3 decimals
        inflationRate: full.inflationRate,
        withdrawalTaxRate,
    };
}
