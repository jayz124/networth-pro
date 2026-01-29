/**
 * Retirement Pro Simulation Engine - Type Definitions
 * Ported from retirement-planner reference implementation
 */

// ============================================================
// Asset Types
// ============================================================

export interface AssetPot {
    stock: number;
    bond: number;
    cash: number;
    /** Cost basis for stock holdings (for capital gains calculation) */
    stockBasis?: number;
    /** Cost basis for bond holdings */
    bondBasis?: number;
    /** Cost basis for cash (typically equals value) */
    cashBasis?: number;
}

export interface Assets {
    taxable: AssetPot;
    deferred: AssetPot;
    free: AssetPot;
    primaryProperty: number;
    investProperty: number;
    other: number;
}

// ============================================================
// Liability Types
// ============================================================

export interface Mortgage {
    balance: number;
    rate: number;
    term: number;
}

export interface MarginDebt {
    balance: number;
    rate: number;
    paybackStrategy?: "interest_only" | "at_retirement" | "amortized";
    amortizationTerm?: number;
}

export interface Liabilities {
    mortgage: Mortgage;
    margin: MarginDebt;
}

// ============================================================
// Cash Flow Types
// ============================================================

export interface CashFlow {
    annualSavingsTaxable: number;
    annualSavingsDeferred: number;
    annualSavingsFree: number;
    expenses: number;
    sustenanceExpense: number;
    sustenanceAge: number;
    pensionAge?: number;
    pensionAmount?: number;
    giftAge?: number;
    giftAmount?: number;
    giftAssetType?: "liquid" | "property" | "other";
    preRetirementNetIncome?: number;
    preRetirementSpending?: number;
}

// ============================================================
// Assumptions Types
// ============================================================

export interface Assumptions {
    inflation: number;
    stockReturn: number;
    bondReturn: number;
    cashReturn: number;
    dividendYield: number;
    primaryAppreciation: number;
    invPropAppreciation: number;
    invPropYield: number;
    yearsToProject: number;
    country: string;
    unlockEquity?: boolean;
}

// ============================================================
// Stress Test Types
// ============================================================

export interface StressTest {
    crashAge?: number;
    crashMagnitude?: number;
    recoveryYears?: number;
    flexibleSpending?: boolean;
    spendingCut?: number;
    applyToMonteCarlo?: boolean;
}

// ============================================================
// Inheritance Types
// ============================================================

export interface Inheritance {
    age?: number;
    amount?: number;
    type?: "portfolio" | "property";
}

// ============================================================
// Roth Conversion Types
// ============================================================

export interface RothConversionParams {
    strategy: "none" | "fill_bracket" | "fixed_amount";
    targetBracket?: number;
    fixedAmount?: number;
    startAge?: number;
    endAge?: number;
}

// ============================================================
// Monte Carlo Return Sequence Type
// ============================================================

export interface ReturnSequence {
    stock: number[];
    bond: number[];
    cash: number[];
    inflation?: number[];
}

// ============================================================
// Simulation Options
// ============================================================

export type WithdrawalStrategy =
    | "standard"
    | "tax_sensitive"
    | "pro_rata";

// ============================================================
// Simulation Input State
// ============================================================

export interface SimulationInput {
    age: number;
    retireAge: number;
    assets: Assets;
    liabilities: Liabilities;
    cashflow: CashFlow;
    assumptions: Assumptions;
    stressTest: StressTest;
    inheritance?: Inheritance;
    returnSequence?: ReturnSequence;
    withdrawalStrategy?: WithdrawalStrategy;
    rothConversion?: RothConversionParams;
}

// ============================================================
// Simulation Output Types
// ============================================================

export interface YearlyData {
    year: number;
    age: number;
    netWorth: number;
    portfolio: number;
    taxable: number;
    deferred: number;
    free: number;
    primaryProperty: number;
    investProperty: number;
    other: number;
    mortgageBalance: number;
    marginBalance: number;
    stock: number;
    bonds: number;
    cash: number;
    shortfall: number;
    grossIncome: number;
    netIncome: number;
    annualTax: number;
    dividends: number;
    pension: number;
    rentalIncome: number;
    employmentIncome: number;
    expenses: number;
    rothConversionAmount?: number;
    totalWithdrawals: number;
    totalSavings: number;
    totalCashFlow: number;
    isRetired: boolean;
    rmdRequired: number;
    rmdTaken: number;
    isRMDYear: boolean;
    mortgagePayment: number;
    mortgagePrincipalPaid: number;
    mortgageInterestPaid: number;
    marginPrincipalPaid: number;
    marginInterestPaid: number;
}

export interface SimulationResult {
    yearlyData: YearlyData[];
    summary: {
        runwayYears: number;
        finalNetWorth: number;
        totalTaxPaid: number;
        totalRealTaxPaid: number;
        totalWithdrawals: number;
        totalGrossIncome: number;
        effectiveTaxRate: number;
        maxShortfall: number;
        retireAge: number;
    };
}

// ============================================================
// Monte Carlo Types
// ============================================================

export interface MonteCarloResult {
    successRate: number;
    medianLegacy: number;
    percentile5: number;
    percentile25: number;
    percentile75: number;
    percentile95: number;
    iterations: number;
    fanPaths?: {
        p10: number[];
        p90: number[];
        median: number[];
    };
}

// ============================================================
// Tax System Types
// ============================================================

export type TaxRuleType = "progressive" | "flat" | "fixed" | "linked" | "inclusion" | "credit";

export interface ProgressiveTaxRule {
    type: "progressive";
    allowance?: number;
    brackets: [number, number][];
}

export interface FlatTaxRule {
    type: "flat";
    rate: number;
    allowance?: number;
}

export interface FixedTaxRule {
    type: "fixed";
    amount: number;
}

export interface LinkedTaxRule {
    type: "linked";
    correlation: "capGains" | "incomeTax";
}

export interface InclusionTaxRule {
    type: "inclusion";
    inclusionRate: number;
}

export interface CreditTaxRule {
    type: "credit";
    rate: number;
}

export type TaxRule =
    | ProgressiveTaxRule
    | FlatTaxRule
    | FixedTaxRule
    | LinkedTaxRule
    | InclusionTaxRule
    | CreditTaxRule;

export interface PropertyTaxRule {
    type: "flat" | "assessed" | "fixed";
    rate?: number;
    amount?: number;
}

export interface TaxProfile {
    currency: string;
    reference: string;
    indexBrackets?: boolean;
    incomeTax: TaxRule;
    capGains: TaxRule;
    propertyTax: PropertyTaxRule;
    dividendTax: TaxRule;
}

export type CountryCode =
    | "US"
    | "US_TX"
    | "US_CA"
    | "US_NY"
    | "UK"
    | "IE"
    | "AU"
    | "DE"
    | "FR"
    | "ES"
    | "AE"
    | "SG"
    | "CY"
    | "CA"
    | "CH";

// ============================================================
// Historical Returns Type
// ============================================================

export interface HistoricalYear {
    year: number;
    stockReturn: number;
    bondReturn: number;
    inflation: number;
}
