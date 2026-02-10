/**
 * Retirement Pro Simulation Engine
 * Comprehensive year-by-year projection with tax-efficient withdrawal ordering,
 * property appreciation, mortgage amortization, RMD, Roth conversions, and stress testing.
 */

import type {
    SimulationInput,
    SimulationResult,
    YearlyData,
    AssetPot,
    TaxProfile,
    CountryCode,
    ReturnSequence,
} from "./types";
import { TAX_PROFILES } from "./tax-profiles";
import { getAnnualTax, calculateTax } from "./tax-engine";
import { calculateRMD, isRMDRequired } from "./rmd-tables";

// ============================================================
// Simulation Constants
// ============================================================

const SIMULATION_CONSTANTS = {
    TAXABLE_WITHDRAWAL_GROSSUP: 1.15,
    DEFERRED_WITHDRAWAL_GROSSUP: 1.25,
    DEFAULT_UNREALIZED_GAINS_RATIO: 0.5,
};

// ============================================================
// Helper Functions
// ============================================================

function getPotTotal(pot: AssetPot): number {
    return (pot.stock || 0) + (pot.bond || 0) + (pot.cash || 0);
}

function getRatio(pot: AssetPot, type: keyof AssetPot): number {
    const total = getPotTotal(pot);
    return total > 0 ? (Number(pot[type]) || 0) / total : 0;
}

function clonePot(pot: AssetPot): AssetPot {
    return {
        stock: pot.stock,
        bond: pot.bond,
        cash: pot.cash,
        stockBasis: pot.stockBasis ?? pot.stock * (1 - SIMULATION_CONSTANTS.DEFAULT_UNREALIZED_GAINS_RATIO),
        bondBasis: pot.bondBasis ?? pot.bond,
        cashBasis: pot.cashBasis ?? pot.cash,
    };
}

interface WithdrawResult {
    actuallyTaken: number;
    longTermGains: number;
}

function withdrawFromPot(pot: AssetPot, amount: number): WithdrawResult {
    const total = getPotTotal(pot);
    if (total <= 0 || amount <= 0) {
        return { actuallyTaken: 0, longTermGains: 0 };
    }

    const take = Math.min(total, amount);
    const ratio = take / total;

    // Calculate gains BEFORE reducing values
    const stockProceeds = (pot.stock || 0) * ratio;
    const stockBasis = (pot.stockBasis ?? pot.stock * 0.5) * ratio;
    const stockGains = Math.max(0, stockProceeds - stockBasis);

    const bondProceeds = (pot.bond || 0) * ratio;
    const bondBasis = (pot.bondBasis ?? pot.bond) * ratio;
    const bondGains = Math.max(0, bondProceeds - bondBasis);

    const longTermGains = stockGains + bondGains;

    // Reduce values
    pot.stock -= pot.stock * ratio;
    pot.bond -= pot.bond * ratio;
    pot.cash -= pot.cash * ratio;

    // Reduce basis proportionally
    if (pot.stockBasis !== undefined) pot.stockBasis -= pot.stockBasis * ratio;
    if (pot.bondBasis !== undefined) pot.bondBasis -= pot.bondBasis * ratio;
    if (pot.cashBasis !== undefined) pot.cashBasis -= pot.cashBasis * ratio;

    return { actuallyTaken: take, longTermGains };
}

// ============================================================
// Main Simulation Function
// ============================================================

export function runSimulation(input: SimulationInput, taxProfiles?: Record<string, TaxProfile>): SimulationResult {
    const {
        age,
        retireAge,
        assets,
        liabilities,
        cashflow,
        assumptions,
        stressTest,
        inheritance,
        returnSequence,
    } = input;

    // Get tax profile
    const profiles = taxProfiles || TAX_PROFILES;
    const taxProfile = profiles[(assumptions?.country as CountryCode) || 'US'] || profiles.US;

    // Inflation
    const inflation = assumptions.inflation / 100;
    const useVariableInflation = !!returnSequence?.inflation;

    // Initialize state copies
    let curMortgageBalance = liabilities.mortgage.balance;
    let curMortgageTerm = liabilities.mortgage.term;
    let curMarginBalance = liabilities.margin.balance;
    let curMarginTerm = liabilities.margin.amortizationTerm || 0;

    let curTaxable = clonePot(assets.taxable);
    let curDeferred = clonePot(assets.deferred);
    let curFree = clonePot(assets.free);

    let curPrimary = assets.primaryProperty;
    let curInvProp = assets.investProperty;
    let curOther = assets.other;

    // Asset allocation ratios (for contributions)
    const taxStockRatio = getRatio(assets.taxable, "stock");
    const taxBondRatio = getRatio(assets.taxable, "bond");
    const taxCashRatio = getRatio(assets.taxable, "cash");

    const defStockRatio = getRatio(assets.deferred, "stock");
    const defBondRatio = getRatio(assets.deferred, "bond");
    const defCashRatio = getRatio(assets.deferred, "cash");

    const freeStockRatio = getRatio(assets.free, "stock");
    const freeBondRatio = getRatio(assets.free, "bond");
    const freeCashRatio = getRatio(assets.free, "cash");

    // Return rates
    const rStock = assumptions.stockReturn / 100;
    const rBond = assumptions.bondReturn / 100;
    const rCash = (assumptions.cashReturn || 0) / 100;

    // Tracking variables
    let cumulativeShortfall = 0;
    let totalTaxPaid = 0;
    let totalRealTaxPaid = 0;
    let totalWithdrawals = 0;
    let totalGrossIncome = 0;
    let runwayYears = 0;

    // Fixed mortgage payment (PMT formula)
    let fixedMortgagePayment = 0;
    if (liabilities.mortgage.balance > 0 && liabilities.mortgage.term > 0) {
        const P = liabilities.mortgage.balance;
        const r = liabilities.mortgage.rate / 100;
        const n = liabilities.mortgage.term;
        fixedMortgagePayment = r === 0 ? P / n : (P * (r * Math.pow(1 + r, n))) / (Math.pow(1 + r, n) - 1);
    }

    // Fixed margin payment
    let fixedMarginPayment = 0;
    if (liabilities.margin.balance > 0 && liabilities.margin.paybackStrategy === 'amortized' && (liabilities.margin.amortizationTerm || 0) > 0) {
        const P = liabilities.margin.balance;
        const r = liabilities.margin.rate / 100;
        const n = liabilities.margin.amortizationTerm || 0;
        fixedMarginPayment = r === 0 ? P / n : (P * (r * Math.pow(1 + r, n))) / (Math.pow(1 + r, n) - 1);
    }

    // Results array
    const yearlyData: YearlyData[] = [];

    // ============================================================
    // Year 0 - Initial State
    // ============================================================

    const initialLiquid = getPotTotal(curTaxable) + getPotTotal(curDeferred) + getPotTotal(curFree);
    const initialNetWorth = initialLiquid + curPrimary + curInvProp + curOther - (curMortgageBalance + curMarginBalance);

    const initialStock = (curTaxable.stock || 0) + (curDeferred.stock || 0) + (curFree.stock || 0);
    const initialBond = (curTaxable.bond || 0) + (curDeferred.bond || 0) + (curFree.bond || 0);
    const initialCash = (curTaxable.cash || 0) + (curDeferred.cash || 0) + (curFree.cash || 0);

    const initialRental = curInvProp * ((assumptions.invPropYield ?? 0) / 100);
    const initialDividends = (curTaxable.stock || 0) * (assumptions.dividendYield / 100);
    const initialPension = (cashflow.pensionAge && age >= cashflow.pensionAge) ? (cashflow.pensionAmount || 0) : 0;
    const initialExpenses = cashflow.expenses;

    yearlyData.push({
        year: 0,
        age: age,
        netWorth: initialNetWorth,
        portfolio: initialLiquid,
        taxable: getPotTotal(curTaxable),
        deferred: getPotTotal(curDeferred),
        free: getPotTotal(curFree),
        stock: initialStock,
        bonds: initialBond,
        cash: initialCash,
        primaryProperty: curPrimary,
        investProperty: curInvProp,
        other: curOther,
        mortgageBalance: curMortgageBalance,
        marginBalance: curMarginBalance,
        shortfall: 0,
        grossIncome: 0,
        netIncome: initialRental + initialPension + (age >= retireAge ? initialDividends : 0),
        annualTax: 0,
        dividends: initialDividends,
        pension: initialPension,
        totalWithdrawals: 0,
        totalCashFlow: 0,
        isRetired: age >= retireAge,
        rmdRequired: 0,
        rmdTaken: 0,
        isRMDYear: false,
        mortgagePayment: 0,
        mortgagePrincipalPaid: 0,
        mortgageInterestPaid: 0,
        marginPrincipalPaid: 0,
        marginInterestPaid: 0,
        rothConversionAmount: 0,
        totalSavings: 0,
        rentalIncome: initialRental,
        employmentIncome: (age < retireAge && cashflow.preRetirementNetIncome) ? cashflow.preRetirementNetIncome : 0,
        expenses: initialExpenses,
    });

    // ============================================================
    // Main Simulation Loop
    // ============================================================

    let accumulatedInflation = 1.0;

    for (let year = 0; year < assumptions.yearsToProject; year++) {
        const currentAge = age + year + 1;
        const isRetired = currentAge >= retireAge;

        // Calculate Inflation Index
        const currentYearInflation = useVariableInflation
            ? (returnSequence?.inflation?.[year] ?? inflation)
            : inflation;

        accumulatedInflation *= (1 + currentYearInflation);
        const inflationIndex = accumulatedInflation;

        // --------------------------------------------------------
        // Stress Test: Market Crash
        // --------------------------------------------------------

        if (stressTest.crashAge && currentAge === stressTest.crashAge) {
            const dropFactor = 1 - (stressTest.crashMagnitude || 0) / 100;
            curTaxable.stock *= dropFactor;
            curTaxable.bond *= dropFactor;
            curDeferred.stock *= dropFactor;
            curDeferred.bond *= dropFactor;
            curFree.stock *= dropFactor;
            curFree.bond *= dropFactor;
        }

        // --------------------------------------------------------
        // Growth
        // --------------------------------------------------------

        let yearStock = returnSequence?.stock?.[year] ?? rStock;
        let yearBond = returnSequence?.bond?.[year] ?? rBond;
        let yearCash = returnSequence?.cash?.[year] ?? rCash;

        // Recovery rate override
        if (
            !returnSequence &&
            stressTest.crashAge &&
            stressTest.recoveryYears &&
            stressTest.crashMagnitude &&
            currentAge > stressTest.crashAge &&
            currentAge <= stressTest.crashAge + stressTest.recoveryYears
        ) {
            const dropPct = stressTest.crashMagnitude / 100;
            if (dropPct < 1) {
                const recoveryRate = Math.pow(1 / (1 - dropPct), 1 / stressTest.recoveryYears) - 1;
                yearStock = recoveryRate;
                yearBond = recoveryRate;
                yearCash = recoveryRate;
            }
        }

        // Dividend separation for retirement
        if (isRetired) {
            const dividendYieldRate = (assumptions.dividendYield || 0) / 100;
            const taxablePriceAppreciation = yearStock - dividendYieldRate;
            curTaxable.stock *= 1 + taxablePriceAppreciation;
        } else {
            curTaxable.stock *= 1 + yearStock;
        }

        curTaxable.bond *= 1 + yearBond;
        curTaxable.cash *= 1 + yearCash;

        curDeferred.stock *= 1 + yearStock;
        curDeferred.bond *= 1 + yearBond;
        curDeferred.cash *= 1 + yearCash;

        curFree.stock *= 1 + yearStock;
        curFree.bond *= 1 + yearBond;
        curFree.cash *= 1 + yearCash;

        curPrimary *= 1 + (assumptions.primaryAppreciation || 0) / 100;
        curInvProp *= 1 + (assumptions.invPropAppreciation || 0) / 100;

        // Track runway
        if (cumulativeShortfall === 0) {
            runwayYears = year + 1;
        }

        // Annual counters
        let annualTax = 0;
        let annualWithdrawal = 0;
        let totalOrdinaryIncome = 0;
        let taxableDividends = 0;
        let totalLongTermGains = 0;
        let annualSavings = 0;

        // --------------------------------------------------------
        // Income
        // --------------------------------------------------------

        let pensionIncome = 0;
        if (cashflow.pensionAge && currentAge >= cashflow.pensionAge) {
            pensionIncome = (cashflow.pensionAmount || 0) * inflationIndex;
            totalOrdinaryIncome += pensionIncome;
        }

        let rentalIncome = 0;
        if (curInvProp > 0) {
            const yieldRate = (assumptions.invPropYield ?? 0) / 100;
            rentalIncome = curInvProp * yieldRate;
            totalOrdinaryIncome += rentalIncome;
        }

        // Dividend income
        const taxableTotal = getPotTotal(curTaxable);
        const yieldTaxable = taxableTotal > 0 ? (assumptions.dividendYield / 100) * (curTaxable.stock / taxableTotal) : 0;
        const annualDividendAmount = taxableTotal * yieldTaxable;
        taxableDividends = annualDividendAmount;
        const dividendsAsIncome = isRetired ? annualDividendAmount : 0;

        // --------------------------------------------------------
        // Expenses
        // --------------------------------------------------------

        const nominalExpenses = cashflow.expenses * inflationIndex;
        const nominalSustenance = cashflow.sustenanceExpense * inflationIndex;

        let targetExpense = 0;
        if (!isRetired) {
            targetExpense = nominalExpenses;
        } else if (currentAge < cashflow.sustenanceAge) {
            targetExpense = nominalExpenses;
        } else {
            targetExpense = nominalSustenance;
        }

        // Flexible Spending during recovery
        if (
            stressTest.flexibleSpending &&
            stressTest.crashAge &&
            stressTest.recoveryYears &&
            currentAge >= stressTest.crashAge &&
            currentAge < stressTest.crashAge + stressTest.recoveryYears
        ) {
            const cutPercent = (stressTest.spendingCut || 0) / 100;
            targetExpense = targetExpense * (1 - cutPercent);
        }

        // Mortgage payment
        let annualMortgagePayment = 0;
        let annualMortgagePrincipal = 0;
        let annualMortgageInterest = 0;

        if (curMortgageBalance > 0 && curMortgageTerm > 0) {
            const interestPortion = curMortgageBalance * (liabilities.mortgage.rate / 100);
            const payoffAmount = curMortgageBalance + interestPortion;

            let calculatedPrincipal = 0;

            if (curMortgageTerm === 1 || fixedMortgagePayment >= payoffAmount - 0.01) {
                annualMortgagePayment = payoffAmount;
                calculatedPrincipal = curMortgageBalance;
            } else {
                annualMortgagePayment = fixedMortgagePayment;
                calculatedPrincipal = annualMortgagePayment - interestPortion;
            }

            annualMortgageInterest = interestPortion;
            annualMortgagePrincipal = calculatedPrincipal;

            curMortgageBalance = Math.max(0, curMortgageBalance - calculatedPrincipal);
            if (curMortgageBalance < 1) curMortgageBalance = 0;
            curMortgageTerm--;
        }

        // Margin payment
        let annualMarginPayment = 0;
        let annualMarginPrincipal = 0;
        let annualMarginInterest = 0;

        if (curMarginBalance > 0) {
            const strategy = liabilities.margin.paybackStrategy || 'interest_only';

            if (strategy === 'at_retirement' && currentAge === retireAge) {
                annualMarginInterest = curMarginBalance * (liabilities.margin.rate / 100);
                annualMarginPrincipal = curMarginBalance;
                curMarginBalance = 0;
            } else if (strategy === 'amortized' && curMarginTerm > 0) {
                annualMarginPayment = Math.min(fixedMarginPayment, curMarginBalance + (curMarginBalance * (liabilities.margin.rate / 100)));
                annualMarginInterest = curMarginBalance * (liabilities.margin.rate / 100);
                annualMarginPrincipal = Math.min(curMarginBalance, Math.max(0, annualMarginPayment - annualMarginInterest));
                curMarginBalance = Math.max(0, curMarginBalance - annualMarginPrincipal);
                curMarginTerm--;
            } else {
                annualMarginInterest = curMarginBalance * (liabilities.margin.rate / 100);
                annualMarginPrincipal = 0;
            }
        }

        // --------------------------------------------------------
        // Contributions (Pre-Retirement)
        // --------------------------------------------------------

        let preRetirementDrawdownNeeded = 0;

        if (!isRetired) {
            const empIncome = (cashflow.preRetirementNetIncome || 0) * inflationIndex;
            const cashIn = empIncome + rentalIncome + pensionIncome;
            const cashOut = targetExpense + annualMortgagePayment + annualMarginPrincipal + annualMarginInterest;
            const operationalBalance = cashIn - cashOut;

            if (operationalBalance >= 0) {
                const savingsTaxable = (cashflow.annualSavingsTaxable || 0) * inflationIndex;
                const savingsDeferred = (cashflow.annualSavingsDeferred || 0) * inflationIndex;
                const savingsFree = (cashflow.annualSavingsFree || 0) * inflationIndex;

                annualSavings = savingsTaxable + savingsDeferred + savingsFree;

                // Taxable contributions
                const taxableStockContrib = savingsTaxable * taxStockRatio;
                const taxableBondContrib = savingsTaxable * taxBondRatio;
                const taxableCashContrib = savingsTaxable * taxCashRatio;
                curTaxable.stock += taxableStockContrib;
                curTaxable.bond += taxableBondContrib;
                curTaxable.cash += taxableCashContrib;
                if (curTaxable.stockBasis !== undefined) curTaxable.stockBasis += taxableStockContrib;
                if (curTaxable.bondBasis !== undefined) curTaxable.bondBasis += taxableBondContrib;
                if (curTaxable.cashBasis !== undefined) curTaxable.cashBasis += taxableCashContrib;

                // Deferred contributions
                curDeferred.stock += savingsDeferred * defStockRatio;
                curDeferred.bond += savingsDeferred * defBondRatio;
                curDeferred.cash += savingsDeferred * defCashRatio;

                // Tax-Free contributions
                curFree.stock += savingsFree * freeStockRatio;
                curFree.bond += savingsFree * freeBondRatio;
                curFree.cash += savingsFree * freeCashRatio;
            } else {
                preRetirementDrawdownNeeded = cashOut;
            }
        }

        // --------------------------------------------------------
        // RMD & Withdrawals
        // --------------------------------------------------------

        let rmdRequired = 0;
        let rmdTaken = 0;
        let isRMDYear = false;

        if (isRetired || preRetirementDrawdownNeeded > 0) {
            const passiveIncome = pensionIncome + rentalIncome + dividendsAsIncome;

            // RMD Calculation
            rmdRequired = calculateRMD(getPotTotal(curDeferred), currentAge, assumptions.country);
            isRMDYear = isRMDRequired(currentAge, assumptions.country);

            if (rmdRequired > 0) {
                const result = withdrawFromPot(curDeferred, rmdRequired);
                rmdTaken = result.actuallyTaken;
                totalOrdinaryIncome += result.actuallyTaken;
            }

            let baseNeed = 0;

            if (isRetired) {
                const propertyTaxIndexFactor = taxProfile.indexBrackets === false ? 1.0 : inflationIndex;
                const annualPropertyTax = calculateTax(curPrimary + curInvProp, taxProfile.propertyTax as any, taxProfile, propertyTaxIndexFactor);
                baseNeed = targetExpense + annualMortgagePayment + annualPropertyTax + annualMarginInterest + annualMarginPrincipal;
            } else {
                baseNeed = preRetirementDrawdownNeeded;
            }

            // Withdrawal solver loop
            let iterations = 0;
            const MAX_ITERATIONS = 5;

            let withdrawnTaxable = 0;
            let withdrawnDeferred = rmdTaken;
            let withdrawnFree = 0;
            let withdrawnHome = 0;

            let currentLongTermGains = 0;
            let currentOrdinaryIncome = totalOrdinaryIncome;

            while (iterations < MAX_ITERATIONS) {
                const currentTax = getAnnualTax(
                    currentOrdinaryIncome,
                    taxableDividends,
                    currentLongTermGains,
                    taxProfile,
                    inflationIndex
                );

                const totalCashRequired = baseNeed + currentTax;
                const totalCashAvailable = passiveIncome + withdrawnTaxable + withdrawnDeferred + withdrawnFree + withdrawnHome;

                let gap = totalCashRequired - totalCashAvailable;

                if (gap <= 10) break;

                let remainingGap = gap;
                const strategy = input.withdrawalStrategy || 'standard';

                if (strategy === 'standard') {
                    // Taxable -> Deferred -> Free
                    if (remainingGap > 0) {
                        const available = getPotTotal(curTaxable);
                        if (available > 0) {
                            const take = Math.min(available, remainingGap);
                            const result = withdrawFromPot(curTaxable, take);
                            withdrawnTaxable += result.actuallyTaken;
                            currentLongTermGains += result.longTermGains;
                            remainingGap -= result.actuallyTaken;
                        }
                    }

                    if (remainingGap > 0) {
                        const available = getPotTotal(curDeferred);
                        if (available > 0) {
                            const take = Math.min(available, remainingGap);
                            const result = withdrawFromPot(curDeferred, take);
                            withdrawnDeferred += result.actuallyTaken;
                            currentOrdinaryIncome += result.actuallyTaken;
                            remainingGap -= result.actuallyTaken;
                        }
                    }

                    if (remainingGap > 0) {
                        const available = getPotTotal(curFree);
                        if (available > 0) {
                            const take = Math.min(available, remainingGap);
                            const result = withdrawFromPot(curFree, take);
                            withdrawnFree += result.actuallyTaken;
                            remainingGap -= result.actuallyTaken;
                        }
                    }
                } else if (strategy === 'tax_sensitive') {
                    // Taxable -> Free -> Deferred
                    if (remainingGap > 0) {
                        const available = getPotTotal(curTaxable);
                        if (available > 0) {
                            const take = Math.min(available, remainingGap);
                            const result = withdrawFromPot(curTaxable, take);
                            withdrawnTaxable += result.actuallyTaken;
                            currentLongTermGains += result.longTermGains;
                            remainingGap -= result.actuallyTaken;
                        }
                    }

                    if (remainingGap > 0) {
                        const available = getPotTotal(curFree);
                        if (available > 0) {
                            const take = Math.min(available, remainingGap);
                            const result = withdrawFromPot(curFree, take);
                            withdrawnFree += result.actuallyTaken;
                            remainingGap -= result.actuallyTaken;
                        }
                    }

                    if (remainingGap > 0) {
                        const available = getPotTotal(curDeferred);
                        if (available > 0) {
                            const take = Math.min(available, remainingGap);
                            const result = withdrawFromPot(curDeferred, take);
                            withdrawnDeferred += result.actuallyTaken;
                            currentOrdinaryIncome += result.actuallyTaken;
                            remainingGap -= result.actuallyTaken;
                        }
                    }
                } else if (strategy === 'pro_rata') {
                    // Proportional withdrawal
                    const totalLiquid = getPotTotal(curTaxable) + getPotTotal(curDeferred) + getPotTotal(curFree);

                    if (totalLiquid > 0 && remainingGap > 0) {
                        const taxableShare = getPotTotal(curTaxable) / totalLiquid;
                        const deferredShare = getPotTotal(curDeferred) / totalLiquid;
                        const freeShare = getPotTotal(curFree) / totalLiquid;

                        const takeTaxable = Math.min(getPotTotal(curTaxable), remainingGap * taxableShare);
                        const takeDeferred = Math.min(getPotTotal(curDeferred), remainingGap * deferredShare);
                        const takeFree = Math.min(getPotTotal(curFree), remainingGap * freeShare);

                        if (takeTaxable > 0) {
                            const res = withdrawFromPot(curTaxable, takeTaxable);
                            withdrawnTaxable += res.actuallyTaken;
                            currentLongTermGains += res.longTermGains;
                            remainingGap -= res.actuallyTaken;
                        }
                        if (takeDeferred > 0) {
                            const res = withdrawFromPot(curDeferred, takeDeferred);
                            withdrawnDeferred += res.actuallyTaken;
                            currentOrdinaryIncome += res.actuallyTaken;
                            remainingGap -= res.actuallyTaken;
                        }
                        if (takeFree > 0) {
                            const res = withdrawFromPot(curFree, takeFree);
                            withdrawnFree += res.actuallyTaken;
                            remainingGap -= res.actuallyTaken;
                        }
                    }
                }

                // Home Equity as last resort
                if (remainingGap > 0 && curPrimary > 0 && assumptions.unlockEquity) {
                    const take = Math.min(curPrimary, remainingGap);
                    curPrimary -= take;
                    withdrawnHome += take;
                    remainingGap -= take;
                }

                if (remainingGap > 1) {
                    cumulativeShortfall += remainingGap;
                    break;
                }

                iterations++;
            }

            annualWithdrawal = withdrawnTaxable + withdrawnDeferred + withdrawnFree + withdrawnHome;
            totalLongTermGains += currentLongTermGains;
            totalOrdinaryIncome = currentOrdinaryIncome;
        }

        // --------------------------------------------------------
        // Roth Conversions
        // --------------------------------------------------------

        let rothConversionAmount = 0;
        const rothParams = input.rothConversion;

        if (
            rothParams &&
            rothParams.strategy !== 'none' &&
            currentAge >= (rothParams.startAge || 0) &&
            currentAge <= (rothParams.endAge || 100) &&
            getPotTotal(curDeferred) > 0
        ) {
            let conversionTarget = 0;

            if (rothParams.strategy === 'fixed_amount') {
                conversionTarget = rothParams.fixedAmount || 0;
            } else if (rothParams.strategy === 'fill_bracket') {
                const brackets = (taxProfile.incomeTax as any).brackets as [number, number][];

                if (brackets && rothParams.targetBracket !== undefined) {
                    const targetBracketIndex = brackets.findIndex(b => Math.abs(b[1] - rothParams.targetBracket!) < 0.001);

                    if (targetBracketIndex !== -1) {
                        const limit = brackets[targetBracketIndex][0];
                        const adjLimit = (limit === null || limit === Infinity) ? Infinity : limit * inflationIndex;
                        const currentAGI = totalOrdinaryIncome;
                        const headroom = Math.max(0, adjLimit - currentAGI);
                        conversionTarget = headroom;
                    }
                }
            }

            if (conversionTarget > 0) {
                const actualConversion = Math.min(conversionTarget, getPotTotal(curDeferred));

                if (actualConversion > 0 && getPotTotal(curDeferred) > 0) {
                    const totalDef = getPotTotal(curDeferred);
                    const ratio = actualConversion / totalDef;
                    const moveStock = (curDeferred.stock || 0) * ratio;
                    const moveBond = (curDeferred.bond || 0) * ratio;
                    const moveCash = (curDeferred.cash || 0) * ratio;

                    withdrawFromPot(curDeferred, actualConversion);

                    curFree.stock += moveStock;
                    curFree.bond += moveBond;
                    curFree.cash += moveCash;

                    rothConversionAmount = actualConversion;

                    const preConversionTax = getAnnualTax(totalOrdinaryIncome, taxableDividends, totalLongTermGains, taxProfile, inflationIndex);
                    totalOrdinaryIncome += actualConversion;
                    const postConversionTax = getAnnualTax(totalOrdinaryIncome, taxableDividends, totalLongTermGains, taxProfile, inflationIndex);
                    const taxDelta = postConversionTax - preConversionTax;

                    let remainingTax = taxDelta;

                    if (getPotTotal(curTaxable) > 0) {
                        const take = Math.min(getPotTotal(curTaxable), remainingTax);
                        const res = withdrawFromPot(curTaxable, take);
                        remainingTax -= res.actuallyTaken;
                        annualWithdrawal += res.actuallyTaken;
                    }

                    if (remainingTax > 0 && getPotTotal(curFree) > 0) {
                        const take = Math.min(getPotTotal(curFree), remainingTax);
                        const res = withdrawFromPot(curFree, take);
                        remainingTax -= res.actuallyTaken;
                        annualWithdrawal += res.actuallyTaken;
                    }
                }
            }
        }

        // --------------------------------------------------------
        // Tax Calculation
        // --------------------------------------------------------

        annualTax = getAnnualTax(totalOrdinaryIncome, taxableDividends, totalLongTermGains, taxProfile, inflationIndex);

        if (isRetired) {
            const propertyTaxIndexFactor = taxProfile.indexBrackets === false ? 1.0 : inflationIndex;
            const annualPropertyTax = calculateTax(curPrimary + curInvProp, taxProfile.propertyTax as any, taxProfile, propertyTaxIndexFactor);
            annualTax += annualPropertyTax;
        }

        totalTaxPaid += annualTax;
        totalRealTaxPaid += annualTax / inflationIndex;
        totalWithdrawals += annualWithdrawal;

        const annualAGI = totalOrdinaryIncome + taxableDividends + totalLongTermGains;
        totalGrossIncome += annualAGI;

        // --------------------------------------------------------
        // Inheritance Received
        // --------------------------------------------------------

        if (inheritance?.amount && currentAge === inheritance.age) {
            const inheritNominal = inheritance.amount * inflationIndex;
            if (inheritance.type === "property") {
                curInvProp += inheritNominal;
            } else {
                curTaxable.stock += inheritNominal * taxStockRatio;
                curTaxable.bond += inheritNominal * taxBondRatio;
                curTaxable.cash += inheritNominal * taxCashRatio;
            }
        }

        // --------------------------------------------------------
        // Gift to Children
        // --------------------------------------------------------

        if (cashflow.giftAmount && currentAge === cashflow.giftAge) {
            const giftNominal = cashflow.giftAmount * inflationIndex;
            if (cashflow.giftAssetType === "property") {
                curPrimary = Math.max(0, curPrimary - giftNominal);
            } else {
                curTaxable.stock = Math.max(0, curTaxable.stock - giftNominal * taxStockRatio);
                curTaxable.bond = Math.max(0, curTaxable.bond - giftNominal * taxBondRatio);
                curTaxable.cash = Math.max(0, curTaxable.cash - giftNominal * taxCashRatio);
            }
        }

        // --------------------------------------------------------
        // Calculate Net Worth
        // --------------------------------------------------------

        const currentLiquid = getPotTotal(curTaxable) + getPotTotal(curDeferred) + getPotTotal(curFree);
        const currentNetWorth =
            currentLiquid +
            curPrimary +
            curInvProp +
            curOther -
            (curMortgageBalance + curMarginBalance + cumulativeShortfall);

        // --------------------------------------------------------
        // Record Year Data
        // --------------------------------------------------------

        const totalStock = (curTaxable.stock || 0) + (curDeferred.stock || 0) + (curFree.stock || 0);
        const totalBond = (curTaxable.bond || 0) + (curDeferred.bond || 0) + (curFree.bond || 0);
        const totalCash = (curTaxable.cash || 0) + (curDeferred.cash || 0) + (curFree.cash || 0);

        yearlyData.push({
            year: year + 1,
            age: currentAge,
            netWorth: currentNetWorth,
            portfolio: currentLiquid,
            taxable: getPotTotal(curTaxable),
            deferred: getPotTotal(curDeferred),
            free: getPotTotal(curFree),
            stock: totalStock,
            bonds: totalBond,
            cash: totalCash,
            primaryProperty: curPrimary,
            investProperty: curInvProp,
            other: curOther,
            mortgageBalance: curMortgageBalance,
            marginBalance: curMarginBalance,
            mortgagePayment: annualMortgagePayment,
            mortgagePrincipalPaid: annualMortgagePrincipal,
            mortgageInterestPaid: annualMortgageInterest,
            marginPrincipalPaid: annualMarginPrincipal,
            marginInterestPaid: annualMarginInterest,
            shortfall: cumulativeShortfall,
            grossIncome: annualAGI,
            netIncome: annualWithdrawal + dividendsAsIncome + pensionIncome + rentalIncome,
            annualTax: annualTax,
            dividends: taxableDividends,
            pension: pensionIncome,
            rentalIncome: rentalIncome,
            employmentIncome: (!isRetired && cashflow.preRetirementNetIncome) ? cashflow.preRetirementNetIncome * inflationIndex : 0,
            expenses: targetExpense,
            rothConversionAmount,
            totalWithdrawals: annualWithdrawal,
            totalSavings: annualSavings,
            totalCashFlow: annualWithdrawal + dividendsAsIncome + pensionIncome + rentalIncome,
            isRetired: isRetired,
            rmdRequired: rmdRequired,
            rmdTaken: rmdTaken,
            isRMDYear: isRMDYear,
        });
    }

    // ============================================================
    // Summary Stats
    // ============================================================

    const finalData = yearlyData[yearlyData.length - 1];
    const effectiveTaxRate = totalGrossIncome > 0 ? totalTaxPaid / totalGrossIncome : 0;

    return {
        yearlyData,
        summary: {
            runwayYears,
            finalNetWorth: finalData?.netWorth || 0,
            totalTaxPaid,
            totalRealTaxPaid,
            totalWithdrawals,
            totalGrossIncome,
            effectiveTaxRate,
            maxShortfall: Math.max(...yearlyData.map((y) => y.shortfall)),
            retireAge,
        },
    };
}

export default runSimulation;
