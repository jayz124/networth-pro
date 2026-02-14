/**
 * Data Migration Script: SQLite -> Supabase (PostgreSQL)
 *
 * Reads all data from the local SQLite database and inserts it into Supabase.
 * Run with: npx tsx scripts/migrate-data.ts <clerk-user-id>
 *
 * The userId argument is required — all migrated records will be assigned to this user.
 */

import Database from 'better-sqlite3';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import path from 'path';
import dotenv from 'dotenv';

// Load .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const userId = process.argv[2];
if (!userId) {
  console.error('Usage: npx tsx scripts/migrate-data.ts <clerk-user-id>');
  console.error('  Get your Clerk user ID from the Clerk dashboard (starts with user_)');
  process.exit(1);
}

const SQLITE_PATH = path.resolve(process.cwd(), 'data/networth_v2.db');
const sqlite = new Database(SQLITE_PATH, { readonly: true });

const connectionString = process.env.DATABASE_URL!;
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

type IdMap = Map<number, number>;

async function migrate() {
  console.log(`Migrating data from ${SQLITE_PATH}`);
  console.log(`Assigning all records to user: ${userId}`);
  console.log('---');

  // Track old ID -> new ID mappings for foreign keys
  const accountIdMap: IdMap = new Map();
  const liabilityIdMap: IdMap = new Map();
  const portfolioIdMap: IdMap = new Map();
  const propertyIdMap: IdMap = new Map();
  const categoryIdMap: IdMap = new Map();

  // 1. Accounts
  const accounts = sqlite.prepare('SELECT * FROM account').all() as Record<string, unknown>[];
  console.log(`Accounts: ${accounts.length}`);
  for (const a of accounts) {
    const created = await prisma.account.create({
      data: {
        user_id: userId,
        name: a.name as string,
        institution: a.institution as string | null,
        type: a.type as string,
        currency: (a.currency as string) || 'USD',
        tags: a.tags as string | null,
      },
    });
    accountIdMap.set(a.id as number, created.id);
  }

  // 2. Liabilities
  const liabilities = sqlite.prepare('SELECT * FROM liability').all() as Record<string, unknown>[];
  console.log(`Liabilities: ${liabilities.length}`);
  for (const l of liabilities) {
    const created = await prisma.liability.create({
      data: {
        user_id: userId,
        name: l.name as string,
        category: l.category as string | null,
        currency: (l.currency as string) || 'USD',
        tags: l.tags as string | null,
      },
    });
    liabilityIdMap.set(l.id as number, created.id);
  }

  // 3. Balance Snapshots
  const snapshots = sqlite.prepare('SELECT * FROM balancesnapshot').all() as Record<string, unknown>[];
  console.log(`Balance Snapshots: ${snapshots.length}`);
  for (const s of snapshots) {
    const newAccountId = s.account_id ? accountIdMap.get(s.account_id as number) : null;
    const newLiabilityId = s.liability_id ? liabilityIdMap.get(s.liability_id as number) : null;
    // Skip orphaned snapshots
    if (s.account_id && !newAccountId) continue;
    if (s.liability_id && !newLiabilityId) continue;
    await prisma.balanceSnapshot.create({
      data: {
        date: new Date(s.date as string),
        account_id: newAccountId || null,
        liability_id: newLiabilityId || null,
        amount: s.amount as number,
        currency: (s.currency as string) || 'USD',
      },
    });
  }

  // 4. Portfolios
  const portfolios = sqlite.prepare('SELECT * FROM portfolio').all() as Record<string, unknown>[];
  console.log(`Portfolios: ${portfolios.length}`);
  for (const p of portfolios) {
    const created = await prisma.portfolio.create({
      data: {
        user_id: userId,
        name: p.name as string,
        description: p.description as string | null,
        currency: (p.currency as string) || 'USD',
        is_active: Boolean(p.is_active),
      },
    });
    portfolioIdMap.set(p.id as number, created.id);
  }

  // 5. Portfolio Holdings
  const holdings = sqlite.prepare('SELECT * FROM portfolioholding').all() as Record<string, unknown>[];
  console.log(`Holdings: ${holdings.length}`);
  for (const h of holdings) {
    const newPortfolioId = portfolioIdMap.get(h.portfolio_id as number);
    if (!newPortfolioId) continue;
    await prisma.portfolioHolding.create({
      data: {
        portfolio_id: newPortfolioId,
        ticker: h.ticker as string,
        asset_type: h.asset_type as string,
        quantity: h.quantity as number,
        purchase_price: h.purchase_price as number | null,
        purchase_date: h.purchase_date as string | null,
        currency: (h.currency as string) || 'USD',
        current_price: h.current_price as number | null,
        current_value: h.current_value as number | null,
      },
    });
  }

  // 6. Securities (shared, no user_id)
  const securities = sqlite.prepare('SELECT * FROM securityinfo').all() as Record<string, unknown>[];
  console.log(`Securities: ${securities.length}`);
  for (const s of securities) {
    await prisma.securityInfo.upsert({
      where: { ticker: s.ticker as string },
      create: {
        ticker: s.ticker as string,
        name: s.name as string,
        asset_type: s.asset_type as string,
        exchange: s.exchange as string | null,
        currency: (s.currency as string) || 'USD',
        sector: s.sector as string | null,
        last_updated: new Date(s.last_updated as string),
      },
      update: {},
    });
  }

  // 7. Price Cache (shared, no user_id)
  const prices = sqlite.prepare('SELECT * FROM pricecache').all() as Record<string, unknown>[];
  console.log(`Price Cache: ${prices.length}`);
  for (const p of prices) {
    await prisma.priceCache.create({
      data: {
        ticker: p.ticker as string,
        current_price: p.current_price as number,
        previous_close: p.previous_close as number | null,
        change_percent: p.change_percent as number | null,
        fetched_at: new Date(p.fetched_at as string),
      },
    });
  }

  // 8. Properties
  const properties = sqlite.prepare('SELECT * FROM property').all() as Record<string, unknown>[];
  console.log(`Properties: ${properties.length}`);
  for (const p of properties) {
    const created = await prisma.property.create({
      data: {
        user_id: userId,
        name: p.name as string,
        address: p.address as string,
        property_type: p.property_type as string,
        purchase_price: p.purchase_price as number,
        purchase_date: p.purchase_date as string | null,
        current_value: p.current_value as number,
        currency: (p.currency as string) || 'USD',
        provider_property_id: p.provider_property_id as string | null,
        valuation_provider: p.valuation_provider as string | null,
      },
    });
    propertyIdMap.set(p.id as number, created.id);
  }

  // 9. Mortgages
  const mortgages = sqlite.prepare('SELECT * FROM mortgage').all() as Record<string, unknown>[];
  console.log(`Mortgages: ${mortgages.length}`);
  for (const m of mortgages) {
    const newPropertyId = propertyIdMap.get(m.property_id as number);
    if (!newPropertyId) continue;
    await prisma.mortgage.create({
      data: {
        property_id: newPropertyId,
        lender: m.lender as string | null,
        original_principal: m.original_principal as number,
        current_balance: m.current_balance as number,
        interest_rate: m.interest_rate as number,
        monthly_payment: m.monthly_payment as number,
        term_years: m.term_years as number,
        is_active: Boolean(m.is_active),
      },
    });
  }

  // 10. Property Valuations
  const valuations = sqlite.prepare('SELECT * FROM propertyvaluationcache').all() as Record<string, unknown>[];
  console.log(`Property Valuations: ${valuations.length}`);
  for (const v of valuations) {
    const newPropertyId = propertyIdMap.get(v.property_id as number);
    if (!newPropertyId) continue;
    await prisma.propertyValuationCache.create({
      data: {
        property_id: newPropertyId,
        provider: (v.provider as string) || 'rentcast',
        provider_property_id: v.provider_property_id as string | null,
        estimated_value: v.estimated_value as number,
        estimated_rent_monthly: v.estimated_rent_monthly as number | null,
        confidence: v.confidence as string | null,
        value_range_low: v.value_range_low as number | null,
        value_range_high: v.value_range_high as number | null,
        rent_range_low: v.rent_range_low as number | null,
        rent_range_high: v.rent_range_high as number | null,
        bedrooms: v.bedrooms as number | null,
        bathrooms: v.bathrooms as number | null,
        square_footage: v.square_footage as number | null,
        year_built: v.year_built as number | null,
        currency: (v.currency as string) || 'USD',
        fetched_at: new Date(v.fetched_at as string),
      },
    });
  }

  // 11. Property Value History
  const valueHistory = sqlite.prepare('SELECT * FROM propertyvaluehistory').all() as Record<string, unknown>[];
  console.log(`Property Value History: ${valueHistory.length}`);
  for (const h of valueHistory) {
    const newPropertyId = propertyIdMap.get(h.property_id as number);
    if (!newPropertyId) continue;
    await prisma.propertyValueHistory.create({
      data: {
        property_id: newPropertyId,
        date: new Date(h.date as string),
        estimated_value: h.estimated_value as number,
        source: (h.source as string) || 'rentcast',
        currency: (h.currency as string) || 'USD',
      },
    });
  }

  // 12. Budget Categories
  const categories = sqlite.prepare('SELECT * FROM budgetcategory').all() as Record<string, unknown>[];
  console.log(`Budget Categories: ${categories.length}`);
  for (const c of categories) {
    const created = await prisma.budgetCategory.create({
      data: {
        user_id: userId,
        name: c.name as string,
        icon: c.icon as string | null,
        color: c.color as string | null,
        budget_limit: c.budget_limit as number | null,
        is_income: Boolean(c.is_income),
      },
    });
    categoryIdMap.set(c.id as number, created.id);
  }

  // 13. Transactions
  const transactions = sqlite.prepare('SELECT * FROM "transaction"').all() as Record<string, unknown>[];
  console.log(`Transactions: ${transactions.length}`);
  for (const t of transactions) {
    const newCategoryId = t.category_id ? categoryIdMap.get(t.category_id as number) : null;
    const newAccountId = t.account_id ? accountIdMap.get(t.account_id as number) : null;
    await prisma.transaction.create({
      data: {
        user_id: userId,
        date: new Date(t.date as string),
        description: t.description as string,
        amount: t.amount as number,
        category_id: newCategoryId || null,
        account_id: newAccountId || null,
        is_recurring: Boolean(t.is_recurring),
        merchant: t.merchant as string | null,
        notes: t.notes as string | null,
        ai_categorized: Boolean(t.ai_categorized),
        recurrence_frequency: t.recurrence_frequency as string | null,
      },
    });
  }

  // 14. Subscriptions
  const subscriptions = sqlite.prepare('SELECT * FROM subscription').all() as Record<string, unknown>[];
  console.log(`Subscriptions: ${subscriptions.length}`);
  for (const s of subscriptions) {
    const newCategoryId = s.category_id ? categoryIdMap.get(s.category_id as number) : null;
    await prisma.subscription.create({
      data: {
        user_id: userId,
        name: s.name as string,
        amount: s.amount as number,
        frequency: s.frequency as string,
        category_id: newCategoryId || null,
        next_billing_date: s.next_billing_date ? new Date(s.next_billing_date as string) : null,
        is_active: Boolean(s.is_active),
      },
    });
  }

  // 15. Net Worth Snapshots
  const nwSnapshots = sqlite.prepare('SELECT * FROM networthsnapshot').all() as Record<string, unknown>[];
  console.log(`Net Worth Snapshots: ${nwSnapshots.length}`);
  for (const s of nwSnapshots) {
    await prisma.netWorthSnapshot.create({
      data: {
        user_id: userId,
        date: s.date as string,
        total_cash: (s.total_cash as number) || 0,
        total_investments: (s.total_investments as number) || 0,
        total_real_estate: (s.total_real_estate as number) || 0,
        total_liabilities: (s.total_liabilities as number) || 0,
        total_mortgages: (s.total_mortgages as number) || 0,
        net_worth: (s.net_worth as number) || 0,
      },
    });
  }

  // 16. Retirement Plans
  const plans = sqlite.prepare('SELECT * FROM retirementplan').all() as Record<string, unknown>[];
  console.log(`Retirement Plans: ${plans.length}`);
  for (const p of plans) {
    await prisma.retirementPlan.create({
      data: {
        user_id: userId,
        name: p.name as string,
        description: p.description as string | null,
        mode: p.mode as string,
        config_json: p.config_json as string,
        is_active: Boolean(p.is_active),
      },
    });
  }

  // 17. App Settings
  const settings = sqlite.prepare('SELECT * FROM appsettings').all() as Record<string, unknown>[];
  console.log(`App Settings: ${settings.length}`);
  for (const s of settings) {
    await prisma.appSettings.create({
      data: {
        user_id: userId,
        key: s.key as string,
        value: s.value as string | null,
        is_secret: Boolean(s.is_secret),
      },
    });
  }

  // 18. Plaid Items (if any)
  try {
    const plaidItems = sqlite.prepare('SELECT * FROM plaiditem').all() as Record<string, unknown>[];
    console.log(`Plaid Items: ${plaidItems.length}`);
    for (const p of plaidItems) {
      await prisma.plaidItem.create({
        data: {
          user_id: userId,
          item_id: p.item_id as string,
          access_token: p.access_token as string,
          institution_name: p.institution_name as string | null,
        },
      });
    }
  } catch {
    console.log('Plaid Items: 0 (table may not exist)');
  }

  console.log('---');
  console.log('Migration complete!');
}

migrate()
  .catch((e) => {
    console.error('Migration failed:', e);
    process.exit(1);
  })
  .finally(() => {
    sqlite.close();
    prisma.$disconnect();
  });
