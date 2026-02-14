import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';

// POST /api/v1/settings/reset-database — clear all data for the current user
export async function POST() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Delete in reverse dependency order, scoped to this user only
    await prisma.$transaction([
      prisma.transaction.deleteMany({ where: { user_id: userId } }),
      prisma.subscription.deleteMany({ where: { user_id: userId } }),
      prisma.budgetCategory.deleteMany({ where: { user_id: userId } }),
      prisma.balanceSnapshot.deleteMany({ where: { OR: [{ account: { user_id: userId } }, { liability: { user_id: userId } }] } }),
      prisma.portfolioHolding.deleteMany({ where: { portfolio: { user_id: userId } } }),
      prisma.portfolio.deleteMany({ where: { user_id: userId } }),
      prisma.propertyValuationCache.deleteMany({ where: { property: { user_id: userId } } }),
      prisma.propertyValueHistory.deleteMany({ where: { property: { user_id: userId } } }),
      prisma.mortgage.deleteMany({ where: { property: { user_id: userId } } }),
      prisma.property.deleteMany({ where: { user_id: userId } }),
      prisma.account.deleteMany({ where: { user_id: userId } }),
      prisma.liability.deleteMany({ where: { user_id: userId } }),
      prisma.retirementPlan.deleteMany({ where: { user_id: userId } }),
      prisma.netWorthSnapshot.deleteMany({ where: { user_id: userId } }),
      prisma.appSettings.deleteMany({ where: { user_id: userId } }),
    ]);

    return NextResponse.json({ status: 'database_reset' });
  } catch (e) {
    console.error('Failed to reset database:', e);
    return NextResponse.json({ error: 'Failed to reset database' }, { status: 500 });
  }
}
