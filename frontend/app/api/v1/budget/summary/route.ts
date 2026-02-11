import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/v1/budget/summary — budget summary for a date range
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');

    // Default to current month
    const now = new Date();
    const start = startDate
      ? new Date(startDate)
      : new Date(now.getFullYear(), now.getMonth(), 1);

    let end;
    if (endDate) {
      end = new Date(endDate);
      if (!endDate.includes('T')) {
        end.setHours(23, 59, 59, 999);
      }
    } else {
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    }

    const transactions = await prisma.transaction.findMany({
      where: {
        date: { gte: start, lte: end },
      },
      include: {
        category: { select: { id: true, name: true, icon: true, color: true, budget_limit: true, is_income: true } },
      },
    });

    let totalIncome = 0;
    let totalExpenses = 0;
    const byCategory: Record<
      number,
      {
        category_id: number;
        category_name: string;
        category_icon: string | null;
        category_color: string | null;
        is_income: boolean;
        budget_limit: number | null;
        income: number;
        expenses: number;
        net: number;
        transactions: number;
      }
    > = {};
    const uncategorized = {
      category_id: 0,
      category_name: 'Uncategorized',
      category_icon: null as string | null,
      category_color: null as string | null,
      is_income: false,
      budget_limit: null as number | null,
      income: 0,
      expenses: 0,
      net: 0,
      transactions: 0,
    };

    for (const txn of transactions) {
      if (txn.amount > 0) {
        totalIncome += txn.amount;
      } else {
        totalExpenses += Math.abs(txn.amount);
      }

      if (txn.category) {
        const catId = txn.category.id;
        if (!byCategory[catId]) {
          byCategory[catId] = {
            category_id: catId,
            category_name: txn.category.name,
            category_icon: txn.category.icon,
            category_color: txn.category.color,
            is_income: txn.category.is_income,
            budget_limit: txn.category.budget_limit,
            income: 0,
            expenses: 0,
            net: 0,
            transactions: 0,
          };
        }
        if (txn.amount > 0) {
          byCategory[catId].income += txn.amount;
        } else {
          byCategory[catId].expenses += Math.abs(txn.amount);
        }
        byCategory[catId].transactions += 1;
      } else {
        if (txn.amount > 0) {
          uncategorized.income += txn.amount;
        } else {
          uncategorized.expenses += Math.abs(txn.amount);
        }
        uncategorized.transactions += 1;
      }
    }

    // Compute net per category
    for (const cat of Object.values(byCategory)) {
      cat.net = Math.round((cat.income - cat.expenses) * 100) / 100;
      cat.income = Math.round(cat.income * 100) / 100;
      cat.expenses = Math.round(cat.expenses * 100) / 100;
    }
    uncategorized.net = Math.round((uncategorized.income - uncategorized.expenses) * 100) / 100;
    uncategorized.income = Math.round(uncategorized.income * 100) / 100;
    uncategorized.expenses = Math.round(uncategorized.expenses * 100) / 100;

    const categoryList = Object.values(byCategory).sort((a, b) => b.expenses - a.expenses);
    if (uncategorized.transactions > 0) {
      categoryList.push(uncategorized);
    }

    return NextResponse.json({
      period: {
        start: start.toISOString().split('T')[0],
        end: end.toISOString().split('T')[0],
      },
      total_income: Math.round(totalIncome * 100) / 100,
      total_expenses: Math.round(totalExpenses * 100) / 100,
      net: Math.round((totalIncome - totalExpenses) * 100) / 100,
      transaction_count: transactions.length,
      by_category: categoryList,
    });
  } catch (e) {
    console.error('Failed to get budget summary:', e);
    return NextResponse.json({ error: 'Failed to get budget summary' }, { status: 500 });
  }
}
