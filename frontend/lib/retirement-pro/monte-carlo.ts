/**
 * Monte Carlo Simulation Engine
 * Uses Historical Bootstrapping for realistic sequence-of-returns risk modeling
 *
 * Key Features:
 * - Historical bootstrapping from 1928-2023 data
 * - Preserves correlations between asset classes and inflation
 * - Configurable iterations (default 1000)
 * - Returns success rate, percentile distribution, and fan paths
 */

import type { SimulationInput, MonteCarloResult, TaxProfile } from "./types";
import { runSimulation } from "./engine";
import { HISTORICAL_RETURNS } from "./historical-returns";

/**
 * Run a single Monte Carlo iteration using Historical Bootstrapping
 */
function runSingleIteration(
    input: SimulationInput,
    applyCrash: boolean,
    taxProfiles?: Record<string, TaxProfile>
): { path: number[]; legacy: number } {
    // Clone input to avoid mutation
    const mcInput: SimulationInput = JSON.parse(JSON.stringify(input));

    const years = input.assumptions.yearsToProject;

    // Generate bootstrapped returns from history
    const stockReturns: number[] = [];
    const bondReturns: number[] = [];
    const cashReturns: number[] = [];
    const inflationSequence: number[] = [];

    const n = HISTORICAL_RETURNS.length;
    for (let i = 0; i < years; i++) {
        const randomIndex = Math.floor(Math.random() * n);
        const yearData = HISTORICAL_RETURNS[randomIndex];

        stockReturns.push(yearData.stockReturn);
        bondReturns.push(yearData.bondReturn);

        // Cash return approximation: Inflation + 0.5% real return
        cashReturns.push(Math.max(0, yearData.inflation + 0.005));

        inflationSequence.push(yearData.inflation);
    }

    // Attach return sequence for simulation engine
    mcInput.returnSequence = {
        stock: stockReturns,
        bond: bondReturns,
        cash: cashReturns,
        inflation: inflationSequence
    };

    // Optionally apply crash scenario
    if (!applyCrash) {
        mcInput.stressTest = {
            ...mcInput.stressTest,
            crashAge: undefined,
            crashMagnitude: undefined,
            recoveryYears: undefined,
        };
    }

    // Run the simulation with per-year randomized returns
    const result = runSimulation(mcInput, taxProfiles);

    // Extract net worth path for fan chart calculation
    const path = result.yearlyData.map((d) => d.netWorth);
    const legacy = path[path.length - 1] ?? 0;

    return { path, legacy };
}

/**
 * Run Monte Carlo simulation with multiple iterations
 * Uses Historical Bootstrapping Method (Resampling 1928-2023 data)
 *
 * @param input - Base simulation input
 * @param iterations - Number of simulations to run (default 1000)
 * @returns MonteCarloResult with success rate, percentile distribution, and fan paths
 */
export function runMonteCarlo(
    input: SimulationInput,
    iterations: number = 1000,
    taxProfiles?: Record<string, TaxProfile>
): MonteCarloResult {
    const applyCrash = input.stressTest?.applyToMonteCarlo ?? false;
    const legacies: number[] = [];
    const allPaths: number[][] = [];
    let successCount = 0;

    // Run iterations
    for (let i = 0; i < iterations; i++) {
        const { path, legacy } = runSingleIteration(input, applyCrash, taxProfiles);
        legacies.push(legacy);
        allPaths.push(path);

        // Success = positive final net worth
        if (legacy > 0) {
            successCount++;
        }
    }

    // Sort legacies for percentile calculations
    const sortedLegacies = [...legacies].sort((a, b) => a - b);

    // Calculate percentiles
    const getPercentile = (arr: number[], p: number): number => {
        const index = Math.floor((p / 100) * arr.length);
        return arr[Math.min(index, arr.length - 1)];
    };

    // Generate fan paths (P10, P50, and P90 at each time step)
    const pathLength = allPaths[0]?.length ?? 0;
    const p10Path: number[] = [];
    const p50Path: number[] = [];
    const p90Path: number[] = [];

    for (let t = 0; t < pathLength; t++) {
        const valuesAtT = allPaths.map((p) => p[t]).sort((a, b) => a - b);
        p10Path.push(getPercentile(valuesAtT, 10));
        p50Path.push(getPercentile(valuesAtT, 50));
        p90Path.push(getPercentile(valuesAtT, 90));
    }

    return {
        successRate: (successCount / iterations) * 100,
        medianLegacy: getPercentile(sortedLegacies, 50),
        percentile5: getPercentile(sortedLegacies, 5),
        percentile25: getPercentile(sortedLegacies, 25),
        percentile75: getPercentile(sortedLegacies, 75),
        percentile95: getPercentile(sortedLegacies, 95),
        iterations,
        fanPaths: {
            p10: p10Path,
            p90: p90Path,
            median: p50Path,
        },
    };
}

export default runMonteCarlo;
