import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/v1/budget/forecast — budget forecast based on historical data
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const forecastMonths = Math.min(parseInt(searchParams.get('months') || '3', 10), 12);

    // Get last 6 months of data for forecasting
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth() - 6, 1);

    const transactions = await prisma.transaction.findMany({
      where: { date: { gte: startDate } },
      select: { date: true, amount: true },
      orderBy: { date: 'asc' },
    });

    // Group by month
    const monthlyData: Record<string, { income: number; expenses: number }> = {};

    for (const txn of transactions) {
      const dt = new Date(txn.date);
      const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;

      if (!monthlyData[key]) {
        monthlyData[key] = { income: 0, expenses: 0 };
      }

      if (txn.amount > 0) {
        monthlyData[key].income += txn.amount;
      } else {
        monthlyData[key].expenses += Math.abs(txn.amount);
      }
    }

    const months = Object.values(monthlyData);
    const monthCount = months.length;

    if (monthCount === 0) {
      return NextResponse.json({
        historical_months: 0,
        forecast: [],
        avg_income: 0,
        avg_expenses: 0,
      });
    }

    // Calculate averages
    const avgIncome = months.reduce((s, m) => s + m.income, 0) / monthCount;
    const avgExpenses = months.reduce((s, m) => s + m.expenses, 0) / monthCount;

    // Calculate trends (simple linear regression on expenses)
    let expenseTrend = 0;
    let incomeTrend = 0;
    if (monthCount >= 3) {
      const incomes = months.map((m) => m.income);
      const expenses = months.map((m) => m.expenses);

      // Simple linear slope
      const n = months.length;
      const xMean = (n - 1) / 2;
      const yMeanInc = incomes.reduce((s, v) => s + v, 0) / n;
      const yMeanExp = expenses.reduce((s, v) => s + v, 0) / n;

      let numInc = 0, numExp = 0, denom = 0;
      for (let i = 0; i < n; i++) {
        numInc += (i - xMean) * (incomes[i] - yMeanInc);
        numExp += (i - xMean) * (expenses[i] - yMeanExp);
        denom += (i - xMean) * (i - xMean);
      }

      if (denom > 0) {
        incomeTrend = numInc / denom;
        expenseTrend = numExp / denom;
      }
    }

    // Generate forecast
    const forecast = [];
    for (let i = 1; i <= forecastMonths; i++) {
      const forecastDate = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const monthKey = `${forecastDate.getFullYear()}-${String(forecastDate.getMonth() + 1).padStart(2, '0')}`;

      const projectedIncome = Math.max(0, avgIncome + incomeTrend * (monthCount + i));
      const projectedExpenses = Math.max(0, avgExpenses + expenseTrend * (monthCount + i));

      forecast.push({
        month: monthKey,
        projected_income: Math.round(projectedIncome * 100) / 100,
        projected_expenses: Math.round(projectedExpenses * 100) / 100,
        projected_net: Math.round((projectedIncome - projectedExpenses) * 100) / 100,
      });
    }

    // Get subscriptions for recurring cost estimate
    const subscriptions = await prisma.subscription.findMany({
      where: { is_active: true },
    });

    let monthlySubscriptions = 0;
    for (const sub of subscriptions) {
      const amt = Math.abs(sub.amount);
      monthlySubscriptions += sub.frequency === 'yearly' ? amt / 12 : amt;
    }

    return NextResponse.json({
      historical_months: monthCount,
      forecast,
      avg_income: Math.round(avgIncome * 100) / 100,
      avg_expenses: Math.round(avgExpenses * 100) / 100,
      monthly_subscriptions: Math.round(monthlySubscriptions * 100) / 100,
      income_trend: incomeTrend > 50 ? 'increasing' : incomeTrend < -50 ? 'decreasing' : 'stable',
      expense_trend: expenseTrend > 50 ? 'increasing' : expenseTrend < -50 ? 'decreasing' : 'stable',
    });
  } catch (e) {
    console.error('Failed to generate forecast:', e);
    return NextResponse.json({ error: 'Failed to generate forecast' }, { status: 500 });
  }
}
