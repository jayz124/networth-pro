import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// POST /api/v1/settings/reset-database — clear all data
export async function POST() {
  try {
    // Delete in reverse dependency order
    await prisma.$transaction([
      prisma.transaction.deleteMany(),
      prisma.subscription.deleteMany(),
      prisma.budgetCategory.deleteMany(),
      prisma.balanceSnapshot.deleteMany(),
      prisma.portfolioHolding.deleteMany(),
      prisma.portfolio.deleteMany(),
      prisma.propertyValuationCache.deleteMany(),
      prisma.propertyValueHistory.deleteMany(),
      prisma.mortgage.deleteMany(),
      prisma.property.deleteMany(),
      prisma.account.deleteMany(),
      prisma.liability.deleteMany(),
      prisma.retirementPlan.deleteMany(),
      prisma.netWorthSnapshot.deleteMany(),
      prisma.securityInfo.deleteMany(),
      prisma.priceCache.deleteMany(),
      prisma.appSettings.deleteMany(),
    ]);

    return NextResponse.json({ status: 'database_reset' });
  } catch (e) {
    console.error('Failed to reset database:', e);
    return NextResponse.json({ error: 'Failed to reset database' }, { status: 500 });
  }
}
