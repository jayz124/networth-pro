/**
 * Tax Engine
 * Calculates taxes for various income types using country-specific profiles.
 */

import type { TaxRule, TaxProfile, ProgressiveTaxRule, FlatTaxRule, InclusionTaxRule, CreditTaxRule } from "./types";

/**
 * Calculate tax for a specific component based on a tax rule.
 *
 * @param amount - The amount to be taxed
 * @param taxRule - The rule object defining tax calculation method
 * @param profile - The full tax profile (for linked lookups)
 * @param indexingFactor - Inflation index for bracket adjustments
 * @param stackedIncome - Income already earned (for progressive stacking)
 */
export function calculateTax(
    amount: number,
    taxRule: TaxRule,
    profile: TaxProfile,
    indexingFactor = 1.0,
    stackedIncome = 0
): number {
    if (amount <= 0) return 0;

    // 1. Flat Rate (or Assessed Property Tax)
    if (taxRule.type === "flat" || (taxRule as any).type === "assessed") {
        const flatRule = taxRule as FlatTaxRule;
        let taxable = amount;
        if (flatRule.allowance) {
            const adjAllowance = flatRule.allowance * indexingFactor;
            taxable = Math.max(0, amount - adjAllowance);
        }
        return taxable * flatRule.rate;
    }

    // 2. Fixed Amount
    if (taxRule.type === "fixed") {
        return taxRule.amount * indexingFactor;
    }

    // 3. Progressive Brackets (Marginal Stacking Logic)
    if (taxRule.type === "progressive") {
        const progressiveRule = taxRule as ProgressiveTaxRule;

        const getTaxForTotal = (totalVal: number): number => {
            let t = 0;
            let prevCap = 0;

            // Allowance handling
            let taxableBasis = totalVal;
            if (progressiveRule.allowance) {
                const adjAllowance = progressiveRule.allowance * indexingFactor;
                taxableBasis = Math.max(0, totalVal - adjAllowance);
            }

            for (const [cap, rate] of progressiveRule.brackets) {
                const adjCap = (cap === null || cap === Infinity) ? Infinity : cap * indexingFactor;

                if (taxableBasis > prevCap) {
                    const incomeInBracket = Math.min(taxableBasis, adjCap) - prevCap;
                    t += incomeInBracket * rate;
                    prevCap = adjCap;
                }
            }
            return t;
        };

        const taxExisting = getTaxForTotal(stackedIncome);
        const taxTotal = getTaxForTotal(stackedIncome + amount);

        return taxTotal - taxExisting;
    }

    // 4. Linked (e.g., Dividends use Capital Gains rates)
    if (taxRule.type === "linked") {
        const linkedRule = profile[taxRule.correlation as keyof TaxProfile] as TaxRule;
        return calculateTax(amount, linkedRule, profile, indexingFactor, stackedIncome);
    }

    // 5. Inclusion (Canada style - 50% of gains taxed as income)
    if (taxRule.type === "inclusion") {
        const inclusionRule = taxRule as InclusionTaxRule;
        const taxablePart = amount * inclusionRule.inclusionRate;
        return calculateTax(taxablePart, profile.incomeTax, profile, indexingFactor, stackedIncome);
    }

    // 6. Credit (Simple effective rate approximation)
    if (taxRule.type === "credit") {
        const creditRule = taxRule as CreditTaxRule;
        return amount * creditRule.rate;
    }

    return 0;
}

/**
 * Calculate total annual tax across all income categories.
 *
 * @param ordinary - Ordinary Income (Work, Pension, Rent)
 * @param dividends - Dividend Income
 * @param gains - Realized Capital Gains
 * @param profile - Tax Profile Object
 * @param inflationIndex - Current inflation index for bracket adjustment
 */
export function getAnnualTax(
    ordinary: number,
    dividends: number,
    gains: number,
    profile: TaxProfile,
    inflationIndex = 1.0
): number {
    let totalTax = 0;

    // Apply indexing based on profile setting
    const indexFactor = profile.indexBrackets === false ? 1.0 : inflationIndex;

    // 1. Ordinary Income
    totalTax += calculateTax(ordinary, profile.incomeTax, profile, indexFactor);

    // 2. Dividends (Stacked on Ordinary)
    totalTax += calculateTax(dividends, profile.dividendTax, profile, indexFactor, ordinary);

    // 3. Capital Gains (Stacked on Ordinary + Dividends)
    const gainsStack = ordinary + dividends;
    totalTax += calculateTax(gains, profile.capGains, profile, indexFactor, gainsStack);

    return totalTax;
}

/**
 * Tax Engine object for backwards compatibility
 */
export const TaxEngine = {
    calculateTax,
    getAnnualTax,
};

export default TaxEngine;
