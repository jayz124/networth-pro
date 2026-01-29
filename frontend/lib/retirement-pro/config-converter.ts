/**
 * Config Converter
 * Converts between the app's RetirementConfig and the Pro engine's SimulationInput
 */

import type { SimulationInput, YearlyData } from "./types";
import type { RetirementConfig, ProjectionPoint } from "../retirement-logic";

/**
 * Convert the app's RetirementConfig to the Pro engine's SimulationInput
 */
export function configToSimulationInput(config: RetirementConfig): SimulationInput {
    const yearsToProject = config.lifeExpectancy - config.currentAge;

    return {
        age: config.currentAge,
        retireAge: config.retirementAge,
        assets: {
            taxable: {
                stock: config.taxableAccount.stocks,
                bond: config.taxableAccount.bonds,
                cash: config.taxableAccount.cash,
                stockBasis: config.taxableAccount.stockCostBasis,
                bondBasis: config.taxableAccount.bondCostBasis,
                cashBasis: config.taxableAccount.cash,
            },
            deferred: {
                stock: config.taxDeferredAccount.stocks,
                bond: config.taxDeferredAccount.bonds,
                cash: config.taxDeferredAccount.cash,
            },
            free: {
                stock: config.rothAccount.stocks,
                bond: config.rothAccount.bonds,
                cash: config.rothAccount.cash,
            },
            primaryProperty: config.primaryHome,
            investProperty: config.investmentProperty,
            other: config.otherAssets,
        },
        liabilities: {
            mortgage: {
                balance: config.mortgage.balance,
                rate: config.mortgage.interestRate * 100, // Convert decimal to percent
                term: config.mortgage.remainingYears,
            },
            margin: {
                balance: config.otherLoan.balance,
                rate: config.otherLoan.interestRate * 100,
                paybackStrategy: config.otherLoan.paybackStrategy === 'pay_at_retirement'
                    ? 'at_retirement'
                    : config.otherLoan.paybackStrategy,
            },
        },
        cashflow: {
            annualSavingsTaxable: config.savingsToTaxable,
            annualSavingsDeferred: config.savingsTo401k,
            annualSavingsFree: config.savingsToRoth,
            expenses: config.goGoSpending,
            sustenanceExpense: config.slowGoSpending,
            sustenanceAge: config.transitionAge,
            pensionAge: config.pensionStartAge,
            pensionAmount: config.pensionAmount,
            giftAge: config.inheritance.giveAge || undefined,
            giftAmount: config.inheritance.giveAmount || undefined,
            giftAssetType: config.inheritance.giveAssetType === 'liquid'
                ? 'liquid'
                : config.inheritance.giveAssetType === 'home'
                    ? 'property'
                    : 'other',
            preRetirementNetIncome: config.annualIncome,
            preRetirementSpending: config.annualSpending,
        },
        assumptions: {
            inflation: config.inflationRate * 100,
            stockReturn: config.stockReturn * 100,
            bondReturn: config.bondReturn * 100,
            cashReturn: config.cashReturn * 100,
            dividendYield: config.dividendYield * 100,
            primaryAppreciation: config.homeAppreciation * 100,
            invPropAppreciation: config.propertyAppreciation * 100,
            invPropYield: config.rentalYield * 100,
            yearsToProject,
            country: config.taxStrategy.country || 'US',
        },
        stressTest: config.stressTest.enabled
            ? {
                crashAge: config.stressTest.crashAge,
                crashMagnitude: config.stressTest.marketDropPercent,
                recoveryYears: config.stressTest.recoveryYears,
                flexibleSpending: config.stressTest.flexibleSpending,
                spendingCut: 20, // Default 20% spending cut
            }
            : {},
        inheritance: config.inheritance.receiveAmount > 0
            ? {
                age: config.inheritance.receiveAge,
                amount: config.inheritance.receiveAmount,
                type: config.inheritance.receiveAssetType === 'property' ? 'property' : 'portfolio',
            }
            : undefined,
        withdrawalStrategy: config.taxStrategy.withdrawalStrategy,
        rothConversion: config.taxStrategy.rothConversionStrategy !== 'none'
            ? {
                strategy: config.taxStrategy.rothConversionStrategy,
                fixedAmount: config.taxStrategy.rothConversionAmount,
                startAge: config.retirementAge,
                endAge: 72, // Before RMD age
            }
            : undefined,
    };
}

/**
 * Convert Pro engine's YearlyData to the app's ProjectionPoint format
 */
export function yearlyDataToProjectionPoints(
    yearlyData: YearlyData[],
    config: RetirementConfig
): ProjectionPoint[] {
    const currentYear = new Date().getFullYear();

    return yearlyData.map((yd, index) => {
        // Calculate breakdown for taxable account (estimate from total)
        const taxableTotal = yd.taxable;
        const deferredTotal = yd.deferred;
        const freeTotal = yd.free;
        const portfolio = yd.portfolio;

        // Estimate stock/bond/cash split based on original ratios or use total allocation
        const stockRatio = portfolio > 0 ? yd.stock / portfolio : 0;
        const bondRatio = portfolio > 0 ? yd.bonds / portfolio : 0;
        const cashRatio = portfolio > 0 ? yd.cash / portfolio : 0;

        return {
            age: yd.age,
            year: currentYear + index,
            isRetired: yd.isRetired,

            // Net Worth Components
            netWorth: yd.netWorth,
            liquidAssets: portfolio,
            realEstateValue: yd.primaryProperty + yd.investProperty + yd.other,
            totalLiabilities: yd.mortgageBalance + yd.marginBalance,

            // Account Balances (estimate breakdown)
            taxableStocks: taxableTotal * stockRatio,
            taxableBonds: taxableTotal * bondRatio,
            taxableCash: taxableTotal * cashRatio,
            deferredStocks: deferredTotal * stockRatio,
            deferredBonds: deferredTotal * bondRatio,
            deferredCash: deferredTotal * cashRatio,
            rothStocks: freeTotal * stockRatio,
            rothBonds: freeTotal * bondRatio,
            rothCash: freeTotal * cashRatio,

            // Real Estate
            primaryHomeValue: yd.primaryProperty,
            investmentPropertyValue: yd.investProperty,
            otherAssetsValue: yd.other,

            // Liabilities
            mortgageBalance: yd.mortgageBalance,
            otherLoanBalance: yd.marginBalance,

            // Cash Flow
            income: yd.employmentIncome,
            savings: yd.totalSavings,
            spending: yd.expenses,
            pensionIncome: yd.pension,
            rentalIncome: yd.rentalIncome,
            dividendIncome: yd.dividends,
            portfolioDrawdown: yd.totalWithdrawals,
            taxPaid: yd.annualTax,
            mortgagePayment: yd.mortgagePayment,
            loanPayment: yd.marginPrincipalPaid + yd.marginInterestPaid,
            netSpendable: yd.totalCashFlow - yd.expenses - yd.annualTax,

            // Debt Breakdown
            mortgageInterest: yd.mortgageInterestPaid,
            mortgagePrincipal: yd.mortgagePrincipalPaid,
            loanInterest: yd.marginInterestPaid,
            loanPrincipal: yd.marginPrincipalPaid,

            // Status
            shortfall: yd.shortfall,
        };
    });
}
