import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/v1/settings/export — export all data as JSON backup
export async function GET() {
  try {
    const [
      accounts,
      liabilities,
      portfolios,
      holdings,
      balanceSnapshots,
      properties,
      mortgages,
      propertyValuations,
      propertyHistory,
      retirementPlans,
      categories,
      transactions,
      subscriptions,
      networthSnapshots,
      settings,
      securityInfo,
      priceCache,
    ] = await Promise.all([
      prisma.account.findMany(),
      prisma.liability.findMany(),
      prisma.portfolio.findMany(),
      prisma.portfolioHolding.findMany(),
      prisma.balanceSnapshot.findMany(),
      prisma.property.findMany(),
      prisma.mortgage.findMany(),
      prisma.propertyValuationCache.findMany(),
      prisma.propertyValueHistory.findMany(),
      prisma.retirementPlan.findMany(),
      prisma.budgetCategory.findMany(),
      prisma.transaction.findMany(),
      prisma.subscription.findMany(),
      prisma.netWorthSnapshot.findMany(),
      prisma.appSettings.findMany(),
      prisma.securityInfo.findMany(),
      prisma.priceCache.findMany(),
    ]);

    // Exclude secret values from export for security
    const safeSettings = settings.map((s) => ({
      ...s,
      value: s.is_secret ? null : s.value,
    }));

    const exportData = {
      export_version: '1.0',
      exported_at: new Date().toISOString(),
      data: {
        accounts,
        liabilities,
        portfolios,
        holdings,
        balance_snapshots: balanceSnapshots,
        properties,
        mortgages,
        property_valuations: propertyValuations,
        property_value_history: propertyHistory,
        retirement_plans: retirementPlans,
        budget_categories: categories,
        transactions,
        subscriptions,
        networth_snapshots: networthSnapshots,
        settings: safeSettings,
        security_info: securityInfo,
        price_cache: priceCache,
      },
    };

    return new NextResponse(JSON.stringify(exportData, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="networth-pro-backup-${new Date().toISOString().split('T')[0]}.json"`,
      },
    });
  } catch (e) {
    console.error('Failed to export data:', e);
    return NextResponse.json({ error: 'Failed to export data' }, { status: 500 });
  }
}
