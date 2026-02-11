/**
 * Shared Zod validators for API route request bodies.
 */
import { z } from 'zod';

// ============================================
// Accounts
// ============================================

export const createAccountSchema = z.object({
    name: z.string().min(1).max(200),
    institution: z.string().max(200).optional(),
    type: z.enum(['checking', 'savings', 'investment', 'cash']),
    currency: z.string().length(3).default('USD'),
    current_balance: z.number().default(0),
    tags: z.string().max(500).optional(),
});

export const updateAccountSchema = z.object({
    name: z.string().min(1).max(200).optional(),
    institution: z.string().max(200).optional().nullable(),
    type: z.enum(['checking', 'savings', 'investment', 'cash']).optional(),
    currency: z.string().length(3).optional(),
    tags: z.string().max(500).optional().nullable(),
});

export const balanceUpdateSchema = z.object({
    amount: z.number(),
});

// ============================================
// Liabilities
// ============================================

export const createLiabilitySchema = z.object({
    name: z.string().min(1).max(200),
    category: z.enum(['credit_card', 'student_loan', 'auto_loan', 'personal_loan', 'other']).optional(),
    currency: z.string().length(3).default('USD'),
    current_balance: z.number().default(0),
    tags: z.string().max(500).optional(),
});

export const updateLiabilitySchema = z.object({
    name: z.string().min(1).max(200).optional(),
    category: z.enum(['credit_card', 'student_loan', 'auto_loan', 'personal_loan', 'other']).optional().nullable(),
    currency: z.string().length(3).optional(),
    tags: z.string().max(500).optional().nullable(),
});

// ============================================
// Portfolios
// ============================================

export const createPortfolioSchema = z.object({
    name: z.string().min(1).max(200),
    description: z.string().max(1000).optional(),
    currency: z.string().length(3).default('USD'),
});

export const updatePortfolioSchema = z.object({
    name: z.string().min(1).max(200).optional(),
    description: z.string().max(1000).optional().nullable(),
    currency: z.string().length(3).optional(),
    is_active: z.boolean().optional(),
});

// ============================================
// Holdings
// ============================================

export const createHoldingSchema = z.object({
    ticker: z.string().min(1).max(20),
    asset_type: z.string().min(1).max(50),
    quantity: z.number().positive(),
    purchase_price: z.number().optional(),
    purchase_date: z.string().optional(),
    currency: z.string().length(3).default('USD'),
});

export const updateHoldingSchema = z.object({
    ticker: z.string().min(1).max(20).optional(),
    asset_type: z.string().min(1).max(50).optional(),
    quantity: z.number().positive().optional(),
    purchase_price: z.number().optional().nullable(),
    purchase_date: z.string().optional().nullable(),
    current_price: z.number().optional().nullable(),
});

// ============================================
// Properties
// ============================================

export const createPropertySchema = z.object({
    name: z.string().min(1).max(200),
    address: z.string().min(1).max(500),
    property_type: z.enum(['residential', 'commercial', 'rental', 'land']),
    purchase_price: z.number().nonnegative(),
    purchase_date: z.string().optional(),
    current_value: z.number().nonnegative(),
    currency: z.string().length(3).default('USD'),
    provider_property_id: z.string().optional(),
    valuation_provider: z.string().optional(),
});

export const updatePropertySchema = z.object({
    name: z.string().min(1).max(200).optional(),
    address: z.string().min(1).max(500).optional(),
    property_type: z.enum(['residential', 'commercial', 'rental', 'land']).optional(),
    purchase_price: z.number().nonnegative().optional(),
    purchase_date: z.string().optional().nullable(),
    current_value: z.number().nonnegative().optional(),
    provider_property_id: z.string().optional().nullable(),
    valuation_provider: z.string().optional().nullable(),
});

// ============================================
// Mortgages
// ============================================

export const createMortgageSchema = z.object({
    lender: z.string().max(200).optional(),
    original_principal: z.number().positive(),
    current_balance: z.number().nonnegative(),
    interest_rate: z.number().nonnegative().max(100),
    monthly_payment: z.number().nonnegative(),
    term_years: z.number().int().positive().max(50),
    is_active: z.boolean().default(true),
});

export const updateMortgageSchema = z.object({
    lender: z.string().max(200).optional().nullable(),
    current_balance: z.number().nonnegative().optional(),
    interest_rate: z.number().nonnegative().max(100).optional(),
    monthly_payment: z.number().nonnegative().optional(),
    is_active: z.boolean().optional(),
});

// ============================================
// Retirement Plans
// ============================================

export const createRetirementPlanSchema = z.object({
    name: z.string().min(1).max(200),
    description: z.string().max(1000).optional(),
    mode: z.enum(['pro', 'essential']),
    config_json: z.string().min(2), // Must be at least "{}"
});

export const updateRetirementPlanSchema = z.object({
    name: z.string().min(1).max(200).optional(),
    description: z.string().max(1000).optional().nullable(),
    mode: z.enum(['pro', 'essential']).optional(),
    config_json: z.string().min(2).optional(),
});

// ============================================
// Budget Categories
// ============================================

export const createCategorySchema = z.object({
    name: z.string().min(1).max(100),
    icon: z.string().max(50).optional(),
    color: z.string().max(50).optional(),
    budget_limit: z.number().nonnegative().optional(),
    is_income: z.boolean().default(false),
});

export const updateCategorySchema = z.object({
    name: z.string().min(1).max(100).optional(),
    icon: z.string().max(50).optional().nullable(),
    color: z.string().max(50).optional().nullable(),
    budget_limit: z.number().nonnegative().optional().nullable(),
    is_income: z.boolean().optional(),
});

// ============================================
// Transactions
// ============================================

export const createTransactionSchema = z.object({
    date: z.string().min(1),
    description: z.string().min(1).max(500),
    amount: z.number(),
    category_id: z.number().int().optional(),
    account_id: z.number().int().optional(),
    is_recurring: z.boolean().default(false),
    recurrence_frequency: z.enum(['daily', 'weekly', 'bi-weekly', 'monthly', 'yearly']).optional(),
    merchant: z.string().max(200).optional(),
    notes: z.string().max(1000).optional(),
});

export const updateTransactionSchema = z.object({
    date: z.string().optional(),
    description: z.string().min(1).max(500).optional(),
    amount: z.number().optional(),
    category_id: z.number().int().optional().nullable(),
    account_id: z.number().int().optional().nullable(),
    is_recurring: z.boolean().optional(),
    recurrence_frequency: z.enum(['daily', 'weekly', 'bi-weekly', 'monthly', 'yearly']).optional().nullable(),
    merchant: z.string().max(200).optional().nullable(),
    notes: z.string().max(1000).optional().nullable(),
});

// ============================================
// Subscriptions
// ============================================

export const createSubscriptionSchema = z.object({
    name: z.string().min(1).max(200),
    amount: z.number(),
    frequency: z.enum(['monthly', 'yearly']),
    category_id: z.number().int().optional(),
    next_billing_date: z.string().optional(),
    is_active: z.boolean().default(true),
});

export const updateSubscriptionSchema = z.object({
    name: z.string().min(1).max(200).optional(),
    amount: z.number().optional(),
    frequency: z.enum(['monthly', 'yearly']).optional(),
    category_id: z.number().int().optional().nullable(),
    next_billing_date: z.string().optional().nullable(),
    is_active: z.boolean().optional(),
});

// ============================================
// Settings
// ============================================

export const settingUpdateSchema = z.object({
    value: z.string().nullable().optional(),
});
