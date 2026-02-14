import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';

// GET /api/v1/budget/forecast — forecast future income/expenses from recurring transactions
export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const forecastMonths = Math.min(parseInt(searchParams.get('months') || '6', 10), 12);

    // Get all recurring transactions
    const recurringTxns = await prisma.transaction.findMany({
      where: {
        user_id: userId,
        is_recurring: true,
        recurrence_frequency: { not: null },
      },
      include: {
        category: { select: { id: true, name: true } },
      },
    });

    // Get active subscriptions
    const subscriptions = await prisma.subscription.findMany({
      where: { user_id: userId, is_active: true },
      include: {
        category: { select: { id: true, name: true } },
      },
    });

    const now = new Date();
    const forecastData = [];

    for (let monthOffset = 0; monthOffset < forecastMonths; monthOffset++) {
      let forecastMonth = now.getMonth() + monthOffset;
      let forecastYear = now.getFullYear();
      while (forecastMonth > 11) {
        forecastMonth -= 12;
        forecastYear += 1;
      }

      const monthStart = new Date(forecastYear, forecastMonth, 1);
      const monthKey = `${forecastYear}-${String(forecastMonth + 1).padStart(2, '0')}`;
      const monthName = monthStart.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

      let monthIncome = 0;
      let monthExpenses = 0;
      const projectedTransactions: Array<{
        description: string;
        amount: number;
        frequency: string;
        category_name: string | null;
        occurrences: number;
        total: number;
        type: string;
      }> = [];

      // Project recurring transactions
      for (const txn of recurringTxns) {
        const frequency = txn.recurrence_frequency!;
        let occurrences = 0;

        if (frequency === 'monthly') {
          occurrences = 1;
        } else if (frequency === 'yearly') {
          const txnDate = new Date(txn.date);
          occurrences = txnDate.getMonth() === forecastMonth ? 1 : 0;
        } else if (frequency === 'daily') {
          const monthEnd = new Date(forecastYear, forecastMonth + 1, 0);
          occurrences = monthEnd.getDate();
        } else if (frequency === 'weekly') {
          occurrences = 4;
        } else if (frequency === 'bi-weekly' || frequency === 'biweekly') {
          occurrences = 2;
        } else {
          occurrences = 1;
        }

        if (occurrences > 0) {
          const totalAmount = txn.amount * occurrences;
          if (totalAmount >= 0) {
            monthIncome += totalAmount;
          } else {
            monthExpenses += Math.abs(totalAmount);
          }

          projectedTransactions.push({
            description: txn.description,
            amount: txn.amount,
            occurrences,
            total: totalAmount,
            category_name: txn.category?.name || null,
            frequency,
            type: txn.amount >= 0 ? 'income' : 'expense',
          });
        }
      }

      // Project subscriptions (always expenses)
      for (const sub of subscriptions) {
        let occurrences = 0;

        if (sub.frequency === 'monthly') {
          occurrences = 1;
        } else if (sub.frequency === 'yearly') {
          if (sub.next_billing_date) {
            const billingDate = new Date(sub.next_billing_date);
            occurrences = billingDate.getMonth() === forecastMonth ? 1 : 0;
          } else {
            occurrences = 0;
          }
        } else if (sub.frequency === 'weekly') {
          occurrences = 4;
        } else if (sub.frequency === 'biweekly') {
          occurrences = 2;
        } else {
          occurrences = 1;
        }

        if (occurrences > 0) {
          const totalAmount = -sub.amount * occurrences;
          monthExpenses += Math.abs(totalAmount);

          projectedTransactions.push({
            description: `Subscription: ${sub.name}`,
            amount: -sub.amount,
            occurrences,
            total: totalAmount,
            category_name: sub.category?.name || 'Subscriptions',
            frequency: sub.frequency,
            type: 'expense',
          });
        }
      }

      forecastData.push({
        month: monthKey,
        month_name: monthName,
        income: Math.round(monthIncome * 100) / 100,
        expenses: Math.round(monthExpenses * 100) / 100,
        net: Math.round((monthIncome - monthExpenses) * 100) / 100,
        transactions: projectedTransactions,
      });
    }

    const totalIncome = forecastData.reduce((s, m) => s + m.income, 0);
    const totalExpenses = forecastData.reduce((s, m) => s + m.expenses, 0);

    return NextResponse.json({
      months: forecastMonths,
      total_projected_income: Math.round(totalIncome * 100) / 100,
      total_projected_expenses: Math.round(totalExpenses * 100) / 100,
      total_projected_net: Math.round((totalIncome - totalExpenses) * 100) / 100,
      monthly_average_income: Math.round((totalIncome / forecastMonths) * 100) / 100,
      monthly_average_expenses: Math.round((totalExpenses / forecastMonths) * 100) / 100,
      forecast: forecastData,
      recurring_count: recurringTxns.length,
      subscription_count: subscriptions.length,
    });
  } catch (e) {
    console.error('Failed to generate forecast:', e);
    return NextResponse.json({ error: 'Failed to generate forecast' }, { status: 500 });
  }
}
