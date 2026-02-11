import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// POST /api/v1/settings/import — import JSON backup
export async function POST(request: NextRequest) {
  try {
    let importData: Record<string, unknown>;

    const contentType = request.headers.get('content-type') || '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file') as File | null;
      if (!file) {
        return NextResponse.json({ detail: 'No file provided' }, { status: 400 });
      }
      const text = await file.text();
      importData = JSON.parse(text);
    } else {
      importData = await request.json();
    }

    if (!importData.data || typeof importData.data !== 'object') {
      return NextResponse.json({ detail: 'Invalid backup format: missing "data" key' }, { status: 400 });
    }

    const data = importData.data as Record<string, unknown[]>;
    const imported: Record<string, number> = {};

    // Import in dependency order using a transaction
    await prisma.$transaction(async (tx) => {
      // Accounts
      if (Array.isArray(data.accounts)) {
        for (const item of data.accounts) {
          const rec = item as Record<string, unknown>;
          try {
            await tx.account.upsert({
              where: { name: rec.name as string },
              create: {
                name: rec.name as string,
                institution: (rec.institution as string) || null,
                type: (rec.type as string) || 'checking',
                currency: (rec.currency as string) || 'USD',
                current_balance: (rec.current_balance as number) || 0,
                tags: (rec.tags as string) || null,
              },
              update: {
                institution: (rec.institution as string) || null,
                type: (rec.type as string) || 'checking',
                currency: (rec.currency as string) || 'USD',
                current_balance: (rec.current_balance as number) || 0,
                tags: (rec.tags as string) || null,
              },
            });
          } catch { /* skip duplicates */ }
        }
        imported.accounts = data.accounts.length;
      }

      // Liabilities
      if (Array.isArray(data.liabilities)) {
        for (const item of data.liabilities) {
          const rec = item as Record<string, unknown>;
          try {
            await tx.liability.upsert({
              where: { name: rec.name as string },
              create: {
                name: rec.name as string,
                category: (rec.category as string) || null,
                currency: (rec.currency as string) || 'USD',
                current_balance: (rec.current_balance as number) || 0,
                tags: (rec.tags as string) || null,
              },
              update: {
                category: (rec.category as string) || null,
                currency: (rec.currency as string) || 'USD',
                current_balance: (rec.current_balance as number) || 0,
                tags: (rec.tags as string) || null,
              },
            });
          } catch { /* skip */ }
        }
        imported.liabilities = data.liabilities.length;
      }

      // Portfolios
      if (Array.isArray(data.portfolios)) {
        for (const item of data.portfolios) {
          const rec = item as Record<string, unknown>;
          try {
            await tx.portfolio.upsert({
              where: { name: rec.name as string },
              create: {
                name: rec.name as string,
                description: (rec.description as string) || null,
                currency: (rec.currency as string) || 'USD',
                is_active: rec.is_active !== false,
              },
              update: {
                description: (rec.description as string) || null,
                currency: (rec.currency as string) || 'USD',
                is_active: rec.is_active !== false,
              },
            });
          } catch { /* skip */ }
        }
        imported.portfolios = data.portfolios.length;
      }

      // Budget categories
      if (Array.isArray(data.budget_categories)) {
        for (const item of data.budget_categories) {
          const rec = item as Record<string, unknown>;
          try {
            await tx.budgetCategory.upsert({
              where: { name: rec.name as string },
              create: {
                name: rec.name as string,
                icon: (rec.icon as string) || null,
                color: (rec.color as string) || null,
                budget_limit: (rec.budget_limit as number) || null,
                is_income: rec.is_income === true,
              },
              update: {
                icon: (rec.icon as string) || null,
                color: (rec.color as string) || null,
                budget_limit: (rec.budget_limit as number) || null,
                is_income: rec.is_income === true,
              },
            });
          } catch { /* skip */ }
        }
        imported.budget_categories = data.budget_categories.length;
      }

      // Retirement plans
      if (Array.isArray(data.retirement_plans)) {
        for (const item of data.retirement_plans) {
          const rec = item as Record<string, unknown>;
          try {
            await tx.retirementPlan.upsert({
              where: { name: rec.name as string },
              create: {
                name: rec.name as string,
                description: (rec.description as string) || null,
                mode: (rec.mode as string) || 'essential',
                config_json: (rec.config_json as string) || '{}',
                is_active: rec.is_active === true,
              },
              update: {
                description: (rec.description as string) || null,
                mode: (rec.mode as string) || 'essential',
                config_json: (rec.config_json as string) || '{}',
                is_active: rec.is_active === true,
              },
            });
          } catch { /* skip */ }
        }
        imported.retirement_plans = data.retirement_plans.length;
      }

      // Settings (skip secrets)
      if (Array.isArray(data.settings)) {
        for (const item of data.settings) {
          const rec = item as Record<string, unknown>;
          if (rec.is_secret || !rec.value) continue; // Skip secrets in import
          try {
            await tx.appSettings.upsert({
              where: { key: rec.key as string },
              create: {
                key: rec.key as string,
                value: rec.value as string,
                is_secret: false,
              },
              update: {
                value: rec.value as string,
              },
            });
          } catch { /* skip */ }
        }
        imported.settings = data.settings.length;
      }
    });

    return NextResponse.json({
      status: 'imported',
      imported,
    });
  } catch (e) {
    console.error('Failed to import data:', e);
    if (e instanceof SyntaxError) {
      return NextResponse.json({ detail: 'Invalid JSON in backup file' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to import data' }, { status: 500 });
  }
}
