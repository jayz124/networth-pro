import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  generateSpendingInsights,
  generateEnhancedSpendingInsights,
  isAIAvailable,
} from '@/lib/services/ai-insights';
import { resolveProvider } from '@/lib/services/ai-service';

// GET /api/v1/budget/ai/insights — spending insights
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const enhanced = searchParams.get('enhanced') === 'true';

    // Get current month summary
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    const transactions = await prisma.transaction.findMany({
      where: { date: { gte: startOfMonth, lte: endOfMonth } },
      include: {
        category: { select: { id: true, name: true, icon: true, color: true, budget_limit: true, is_income: true } },
      },
    });

    // Build summary
    let totalIncome = 0;
    let totalExpenses = 0;
    const byCategory: Record<number, {
      category_name: string;
      income: number;
      expenses: number;
      transactions: number;
      budget_limit?: number | null;
    }> = {};

    for (const txn of transactions) {
      if (txn.amount > 0) totalIncome += txn.amount;
      else totalExpenses += Math.abs(txn.amount);

      if (txn.category) {
        if (!byCategory[txn.category.id]) {
          byCategory[txn.category.id] = {
            category_name: txn.category.name,
            income: 0,
            expenses: 0,
            transactions: 0,
            budget_limit: txn.category.budget_limit,
          };
        }
        if (txn.amount > 0) byCategory[txn.category.id].income += txn.amount;
        else byCategory[txn.category.id].expenses += Math.abs(txn.amount);
        byCategory[txn.category.id].transactions++;
      }
    }

    const summary: Record<string, unknown> = {
      total_income: totalIncome,
      total_expenses: totalExpenses,
      net: totalIncome - totalExpenses,
      by_category: Object.values(byCategory),
    };

    // Get previous month summary for comparison
    const prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

    const prevTransactions = await prisma.transaction.findMany({
      where: { date: { gte: prevStart, lte: prevEnd } },
      select: { amount: true },
    });

    let prevIncome = 0;
    let prevExpenses = 0;
    for (const txn of prevTransactions) {
      if (txn.amount > 0) prevIncome += txn.amount;
      else prevExpenses += Math.abs(txn.amount);
    }

    const prevSummary = prevTransactions.length > 0
      ? { total_income: prevIncome, total_expenses: prevExpenses }
      : null;

    // Determine AI availability for response metadata
    const aiAvailable = await isAIAvailable();
    let providerName: string | null = null;
    if (aiAvailable) {
      try {
        const { provider } = await resolveProvider();
        providerName = provider;
      } catch { /* ignore */ }
    }

    const period = {
      start: startOfMonth.toISOString().split('T')[0],
      end: endOfMonth.toISOString().split('T')[0],
    };

    if (enhanced) {
      // Get cash flow data
      const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, 1);
      const allTxns = await prisma.transaction.findMany({
        where: { date: { gte: sixMonthsAgo } },
        select: { date: true, amount: true },
      });

      const monthlyData: Record<string, { month: string; total_income: number; total_expenses: number; net: number }> = {};
      for (const txn of allTxns) {
        const dt = new Date(txn.date);
        const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
        if (!monthlyData[key]) monthlyData[key] = { month: key, total_income: 0, total_expenses: 0, net: 0 };
        if (txn.amount > 0) monthlyData[key].total_income += txn.amount;
        else monthlyData[key].total_expenses += Math.abs(txn.amount);
      }
      for (const d of Object.values(monthlyData)) {
        d.net = d.total_income - d.total_expenses;
      }
      const cashFlow = Object.values(monthlyData).sort((a, b) => a.month.localeCompare(b.month));

      // Get subscriptions
      const subscriptions = await prisma.subscription.findMany();

      const txnRecords = transactions.map((t) => ({
        date: t.date.toISOString().split('T')[0],
        description: t.description,
        amount: t.amount,
        merchant: t.merchant,
        category_name: t.category?.name,
      }));

      const result = await generateEnhancedSpendingInsights(
        summary,
        txnRecords,
        prevSummary,
        cashFlow,
        subscriptions,
      );
      return NextResponse.json({
        ...result,
        ai_powered: aiAvailable,
        ai_provider_name: providerName,
        period,
      });
    } else {
      const txnRecords = transactions.map((t) => ({
        date: t.date.toISOString().split('T')[0],
        description: t.description,
        amount: t.amount,
        merchant: t.merchant,
      }));

      const insights = await generateSpendingInsights(summary, txnRecords, prevSummary);
      return NextResponse.json({
        insights,
        ai_powered: aiAvailable,
        ai_provider_name: providerName,
        period,
      });
    }
  } catch (e) {
    console.error('Failed to generate spending insights:', e);
    return NextResponse.json({ error: 'Failed to generate spending insights' }, { status: 500 });
  }
}
