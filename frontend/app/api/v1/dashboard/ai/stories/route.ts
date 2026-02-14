import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { generateFinancialStories } from '@/lib/services/ai-insights';
import { fetchRelevantNews } from '@/lib/services/news-fetcher';

// Simple in-memory cache for stories + news (keyed by userId)
const _cachedStoriesData = new Map<string, { data: unknown; cachedAt: number }>();
const STORIES_CACHE_TTL = 1800 * 1000; // 30 minutes

// GET /api/v1/dashboard/ai/stories — financial stories + news
export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const refresh = searchParams.get('refresh') === 'true';
    const now = Date.now();

    // Return cache if fresh
    const cached = _cachedStoriesData.get(userId);
    if (!refresh && cached && now - cached.cachedAt < STORIES_CACHE_TTL) {
      return NextResponse.json(cached.data);
    }

    // Gather data for this user
    const [accounts, liabilities, holdings, properties, mortgages, transactions] = await Promise.all(
      [
        prisma.account.findMany({
          where: { user_id: userId },
          include: { balance_snapshots: { orderBy: { date: 'desc' }, take: 1 } },
        }),
        prisma.liability.findMany({
          where: { user_id: userId },
          include: { balance_snapshots: { orderBy: { date: 'desc' }, take: 1 } },
        }),
        prisma.portfolioHolding.findMany({ where: { portfolio: { user_id: userId } } }),
        prisma.property.findMany({ where: { user_id: userId } }),
        prisma.mortgage.findMany({ where: { property: { user_id: userId } } }),
        prisma.transaction.findMany({
          where: {
            user_id: userId,
            date: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
          },
          orderBy: { date: 'desc' },
          take: 20,
        }),
      ],
    );

    // Build net worth data
    const totalCash = accounts.reduce((s, a) => s + (a.balance_snapshots[0]?.amount ?? 0), 0);
    const totalInvestments = holdings.reduce((s, h) => s + (h.current_value || 0), 0);
    const totalRealEstate = properties.reduce((s, p) => s + p.current_value, 0);
    const totalMortgages = mortgages.reduce((s, m) => s + m.current_balance, 0);
    const totalLiabilities = liabilities.reduce((s, l) => s + (l.balance_snapshots[0]?.amount ?? 0), 0) + totalMortgages;
    const totalAssets = totalCash + totalInvestments + totalRealEstate;
    const netWorth = totalAssets - totalLiabilities;

    const networthData: Record<string, unknown> = {
      net_worth: netWorth,
      total_assets: totalAssets,
      total_liabilities: totalLiabilities,
      breakdown: {
        cash_accounts: totalCash,
        investments: totalInvestments,
        real_estate: totalRealEstate,
        mortgages: totalMortgages,
      },
    };

    // Budget summary for current month
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const monthTxns = transactions.filter((t) => new Date(t.date) >= monthStart);
    let income = 0;
    let expenses = 0;
    for (const t of monthTxns) {
      if (t.amount > 0) income += t.amount;
      else expenses += Math.abs(t.amount);
    }
    const budgetSummary =
      monthTxns.length > 0 ? { total_income: income, total_expenses: expenses } : null;

    // Portfolio data
    const portfolioData = holdings.map((h) => {
      const currentValue = h.current_value || h.quantity * (h.current_price || 0);
      const costBasis = h.quantity * (h.purchase_price || 0);
      const unrealizedGain = costBasis > 0 ? currentValue - costBasis : 0;
      const gainPercent = costBasis > 0 ? (unrealizedGain / costBasis) * 100 : 0;
      return {
        ticker: h.ticker,
        current_value: currentValue,
        unrealized_gain: unrealizedGain,
        gain_percent: gainPercent,
      };
    });

    // Property data
    const mortgageByProp = new Map<number, number>();
    for (const m of mortgages) {
      mortgageByProp.set(m.property_id, (mortgageByProp.get(m.property_id) || 0) + m.current_balance);
    }
    const propertyData = properties.map((p) => ({
      name: p.name,
      current_value: p.current_value,
      purchase_price: p.purchase_price,
      equity: p.current_value - (mortgageByProp.get(p.id) || 0),
    }));

    // Recent notable transactions
    const recentTxns = transactions.slice(0, 10).map((t) => ({
      date: new Date(t.date).toISOString().split('T')[0],
      description: t.description,
      amount: t.amount,
    }));

    // Generate stories and fetch news in parallel
    const seed = refresh ? Math.floor(Math.random() * 10000) : null;

    const tickers = holdings.map((h) => h.ticker);
    const propertyTypes = properties.map((p) => p.property_type);
    const liabilityCategories = liabilities.map((l) => l.category).filter(Boolean) as string[];
    const accountTypes = [...new Set(accounts.map((a) => a.type))];

    const [stories, news] = await Promise.all([
      generateFinancialStories(
        networthData,
        budgetSummary,
        portfolioData,
        propertyData,
        recentTxns,
        seed,
      ),
      fetchRelevantNews(tickers, propertyTypes, liabilityCategories, accountTypes),
    ]);

    const result = { stories, news };

    // Cache result per user
    _cachedStoriesData.set(userId, { data: result, cachedAt: now });

    return NextResponse.json(result);
  } catch (e) {
    console.error('Failed to generate stories:', e);
    return NextResponse.json({ error: 'Failed to generate stories' }, { status: 500 });
  }
}
