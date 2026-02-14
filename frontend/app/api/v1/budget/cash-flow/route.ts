import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';

// GET /api/v1/budget/cash-flow — monthly cash flow breakdown
export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const months = Math.min(parseInt(searchParams.get('months') || '6', 10), 24);

    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth() - months + 1, 1);

    const transactions = await prisma.transaction.findMany({
      where: {
        user_id: userId,
        date: { gte: startDate },
      },
      select: {
        date: true,
        amount: true,
      },
      orderBy: { date: 'asc' },
    });

    // Group by month
    const monthlyData: Record<
      string,
      { month: string; income: number; expenses: number; net: number; transaction_count: number }
    > = {};

    for (const txn of transactions) {
      const dt = new Date(txn.date);
      const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;

      if (!monthlyData[key]) {
        monthlyData[key] = {
          month: key,
          income: 0,
          expenses: 0,
          net: 0,
          transaction_count: 0,
        };
      }

      if (txn.amount > 0) {
        monthlyData[key].income += txn.amount;
      } else {
        monthlyData[key].expenses += Math.abs(txn.amount);
      }
      monthlyData[key].transaction_count += 1;
    }

    // Calculate net for each month
    for (const data of Object.values(monthlyData)) {
      data.income = Math.round(data.income * 100) / 100;
      data.expenses = Math.round(data.expenses * 100) / 100;
      data.net = Math.round((data.income - data.expenses) * 100) / 100;
    }

    // Sort by month and return
    const result = Object.values(monthlyData).sort((a, b) => a.month.localeCompare(b.month));

    return NextResponse.json(result);
  } catch (e) {
    console.error('Failed to get cash flow:', e);
    return NextResponse.json({ error: 'Failed to get cash flow' }, { status: 500 });
  }
}
