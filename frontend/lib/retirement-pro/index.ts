/**
 * Retirement Pro Simulation Engine
 * Barrel exports for all simulation modules
 */

// Types
export * from "./types";

// Tax System
export { calculateTax, getAnnualTax, TaxEngine } from "./tax-engine";
export { TAX_PROFILES, COUNTRY_NAMES } from "./tax-profiles";

// RMD Tables
export { calculateRMD, isRMDRequired, getRMDFactor, RMD_TABLES } from "./rmd-tables";

// Historical Data
export { HISTORICAL_RETURNS } from "./historical-returns";

// Simulation Engine
export { runSimulation } from "./engine";

// Monte Carlo
export { runMonteCarlo } from "./monte-carlo";

// Config Converter
export { configToSimulationInput, yearlyDataToProjectionPoints } from "./config-converter";
