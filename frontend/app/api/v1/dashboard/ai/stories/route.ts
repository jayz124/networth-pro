import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateFinancialStories } from '@/lib/services/ai-insights';
import { fetchRelevantNews } from '@/lib/services/news-fetcher';

// Simple in-memory cache for stories + news
let _cachedStoriesData: { data: unknown; cachedAt: number } | null = null;
const STORIES_CACHE_TTL = 1800 * 1000; // 30 minutes

// GET /api/v1/dashboard/ai/stories — financial stories + news
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const refresh = searchParams.get('refresh') === 'true';
    const now = Date.now();

    // Return cache if fresh
    if (!refresh && _cachedStoriesData && now - _cachedStoriesData.cachedAt < STORIES_CACHE_TTL) {
      return NextResponse.json(_cachedStoriesData.data);
    }

    // Gather data
    const [accounts, liabilities, holdings, properties, mortgages, transactions] = await Promise.all(
      [
        prisma.account.findMany(),
        prisma.liability.findMany(),
        prisma.portfolioHolding.findMany(),
        prisma.property.findMany(),
        prisma.mortgage.findMany(),
        prisma.transaction.findMany({
          where: {
            date: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
          },
          orderBy: { date: 'desc' },
          take: 20,
        }),
      ],
    );

    // Build net worth data
    const totalCash = accounts.reduce((s, a) => s + (a.current_balance || 0), 0);
    const totalInvestments = holdings.reduce((s, h) => s + (h.current_value || 0), 0);
    const totalRealEstate = properties.reduce((s, p) => s + p.current_value, 0);
    const totalMortgages = mortgages.reduce((s, m) => s + m.current_balance, 0);
    const totalLiabilities = liabilities.reduce((s, l) => s + (l.current_balance || 0), 0) + totalMortgages;
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

    // Cache result
    _cachedStoriesData = { data: result, cachedAt: now };

    return NextResponse.json(result);
  } catch (e) {
    console.error('Failed to generate stories:', e);
    return NextResponse.json({ error: 'Failed to generate stories' }, { status: 500 });
  }
}
