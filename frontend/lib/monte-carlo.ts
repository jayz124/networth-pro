import { RetirementConfig, ProjectionPoint, calculateCurrentNetWorth } from "./retirement-logic";

export type SimulationResult = {
    percentile10: ProjectionPoint[];
    percentile50: ProjectionPoint[];
    percentile90: ProjectionPoint[];
    successRate: number; // % of runs that didn't run out of money
    runs: ProjectionPoint[][];
}

// Box-Muller transform for normal distribution
function randn_bm() {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

export function runMonteCarlo(config: RetirementConfig, iterations: number = 1000): SimulationResult {
    const runs: ProjectionPoint[][] = [];
    const stockVolatility = 0.18; // S&P 500 historical volatility
    const bondVolatility = 0.06;

    let successCount = 0;
    const currentYear = new Date().getFullYear();

    for (let i = 0; i < iterations; i++) {
        const points: ProjectionPoint[] = [];

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

        for (let age = config.currentAge; age <= config.lifeExpectancy; age++) {
            const year = currentYear + (age - config.currentAge);
            const yearsFromNow = age - config.currentAge;
            const isRetired = age >= config.retirementAge;
            const inflationFactor = Math.pow(1 + config.inflationRate, yearsFromNow);

            // Randomized returns with correlation
            const stockReturn = config.stockReturn + (stockVolatility * randn_bm());
            const bondReturn = config.bondReturn + (bondVolatility * randn_bm());

            // Apply stress test if enabled
            let effectiveStockReturn = stockReturn;
            let effectiveBondReturn = bondReturn;

            if (config.stressTest.enabled && age === config.stressTest.crashAge) {
                effectiveStockReturn = -config.stressTest.marketDropPercent / 100;
                effectiveBondReturn = -config.stressTest.marketDropPercent / 200;
            }

            // Dividends and rental income
            const dividendIncome = taxableStocks * config.dividendYield;
            const rentalIncome = investmentPropertyValue > 0 ? investmentPropertyValue * config.rentalYield : 0;

            let income = 0;
            let savings = 0;
            let spending = 0;
            let pensionIncome = 0;
            let portfolioDrawdown = 0;
            let taxPaid = 0;
            let mortgagePayment = 0;
            let loanPayment = 0;

            if (!isRetired) {
                income = config.annualIncome * Math.pow(1 + 0.02, yearsFromNow);
                spending = config.annualSpending * inflationFactor;
                savings = Math.max(0, income - spending);

                // Allocate savings
                const totalSavings = config.savingsToTaxable + config.savingsTo401k + config.savingsToRoth;
                if (totalSavings > 0 && savings > 0) {
                    const ratio = Math.min(1, savings / totalSavings);
                    taxableStocks += config.savingsToTaxable * ratio;
                    deferredStocks += config.savingsTo401k * ratio;
                    rothStocks += config.savingsToRoth * ratio;
                }

                taxPaid = income * 0.22; // Simplified tax
            } else {
                // Retirement spending
                if (age < config.transitionAge) {
                    spending = config.goGoSpending * inflationFactor;
                } else {
                    spending = config.slowGoSpending * inflationFactor;
                }

                // Pension
                if (age >= config.pensionStartAge) {
                    pensionIncome = config.pensionAmount * inflationFactor;
                }

                // Drawdown needed
                const incomeBeforeDrawdown = pensionIncome + dividendIncome + rentalIncome;
                portfolioDrawdown = Math.max(0, spending - incomeBeforeDrawdown);

                // Withdraw from accounts
                let remaining = portfolioDrawdown;

                // Taxable first
                if (remaining > 0) {
                    const taxableTotal = taxableStocks + taxableBonds + taxableCash;
                    if (taxableTotal > 0) {
                        const draw = Math.min(remaining, taxableTotal);
                        const ratio = draw / taxableTotal;
                        taxableStocks -= taxableStocks * ratio;
                        taxableBonds -= taxableBonds * ratio;
                        taxableCash -= taxableCash * ratio;
                        remaining -= draw;
                    }
                }

                // Then deferred
                if (remaining > 0) {
                    const deferredTotal = deferredStocks + deferredBonds + deferredCash;
                    if (deferredTotal > 0) {
                        const draw = Math.min(remaining, deferredTotal);
                        const ratio = draw / deferredTotal;
                        deferredStocks -= deferredStocks * ratio;
                        deferredBonds -= deferredBonds * ratio;
                        deferredCash -= deferredCash * ratio;
                        remaining -= draw;
                    }
                }

                // Finally Roth
                if (remaining > 0) {
                    const rothTotal = rothStocks + rothBonds + rothCash;
                    if (rothTotal > 0) {
                        const draw = Math.min(remaining, rothTotal);
                        const ratio = draw / rothTotal;
                        rothStocks -= rothStocks * ratio;
                        rothBonds -= rothBonds * ratio;
                        rothCash -= rothCash * ratio;
                        remaining -= draw;
                    }
                }

                taxPaid = (pensionIncome + portfolioDrawdown * 0.5) * 0.15;
            }

            // Mortgage payments (simplified)
            if (mortgageBalance > 0) {
                const yearsRemaining = config.mortgage.remainingYears - yearsFromNow;
                if (yearsRemaining > 0) {
                    const monthlyRate = config.mortgage.interestRate / 12;
                    const numPayments = yearsRemaining * 12;
                    const payment = mortgageBalance * (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) / (Math.pow(1 + monthlyRate, numPayments) - 1);
                    mortgagePayment = payment * 12;
                    const interest = mortgageBalance * config.mortgage.interestRate;
                    const principal = Math.min(mortgagePayment - interest, mortgageBalance);
                    mortgageBalance = Math.max(0, mortgageBalance - principal);
                }
            }

            // Investment growth
            taxableStocks *= (1 + effectiveStockReturn);
            taxableBonds *= (1 + effectiveBondReturn);
            taxableCash *= (1 + config.cashReturn);

            deferredStocks *= (1 + effectiveStockReturn);
            deferredBonds *= (1 + effectiveBondReturn);
            deferredCash *= (1 + config.cashReturn);

            rothStocks *= (1 + effectiveStockReturn);
            rothBonds *= (1 + effectiveBondReturn);
            rothCash *= (1 + config.cashReturn);

            // Real estate appreciation
            primaryHomeValue *= (1 + config.homeAppreciation);
            investmentPropertyValue *= (1 + config.propertyAppreciation);
            otherAssetsValue *= (1 + config.inflationRate);

            // Calculate totals
            const liquidAssets = taxableStocks + taxableBonds + taxableCash +
                deferredStocks + deferredBonds + deferredCash +
                rothStocks + rothBonds + rothCash;

            const realEstateValue = primaryHomeValue + investmentPropertyValue + otherAssetsValue;
            const totalLiabilities = mortgageBalance + otherLoanBalance;
            const netWorth = liquidAssets + realEstateValue - totalLiabilities;
            const shortfall = netWorth < 0 ? Math.abs(netWorth) : 0;

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
                netSpendable: 0,
                mortgageInterest: 0,
                mortgagePrincipal: 0,
                loanInterest: 0,
                loanPrincipal: 0,
                shortfall,
            });
        }

        runs.push(points);
        if (points[points.length - 1].netWorth > 0) successCount++;
    }

    // Sort runs by ending net worth to find percentiles
    runs.sort((a, b) => a[a.length - 1].netWorth - b[b.length - 1].netWorth);

    return {
        runs: runs.slice(0, 50),
        percentile10: runs[Math.floor(iterations * 0.1)],
        percentile50: runs[Math.floor(iterations * 0.5)],
        percentile90: runs[Math.floor(iterations * 0.9)],
        successRate: (successCount / iterations) * 100
    };
}
