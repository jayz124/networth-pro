import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateDashboardInsights } from '@/lib/services/ai-insights';

// GET /api/v1/dashboard/ai/insights — dashboard-level AI insights
export async function GET() {
  try {
    // Gather all financial data
    const [accounts, liabilities, portfolioHoldings, properties, mortgages, networthSnapshots] =
      await Promise.all([
        prisma.account.findMany(),
        prisma.liability.findMany(),
        prisma.portfolioHolding.findMany(),
        prisma.property.findMany(),
        prisma.mortgage.findMany(),
        prisma.netWorthSnapshot.findMany({ orderBy: { date: 'desc' }, take: 12 }),
      ]);

    // Build net worth data
    const totalCash = accounts.reduce((s, a) => s + (a.current_balance || 0), 0);
    const totalInvestments = portfolioHoldings.reduce((s, h) => s + (h.current_value || 0), 0);
    const totalRealEstate = properties.reduce((s, p) => s + (p.current_value || 0), 0);
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

    // Net worth history
    const networthHistory = networthSnapshots
      .reverse()
      .map((s) => ({
        date: s.date,
        net_worth: s.net_worth,
        total_cash: s.total_cash,
        total_investments: s.total_investments,
        total_real_estate: s.total_real_estate,
      }));

    // Portfolio data with gain/loss
    const portfolioData = portfolioHoldings.map((h) => {
      const currentValue = h.current_value || (h.quantity * (h.current_price || 0));
      const costBasis = h.quantity * (h.purchase_price || 0);
      const unrealizedGain = costBasis > 0 ? currentValue - costBasis : 0;
      const gainPercent = costBasis > 0 ? (unrealizedGain / costBasis) * 100 : 0;
      return {
        ticker: h.ticker,
        asset_type: h.asset_type,
        quantity: h.quantity,
        current_price: h.current_price,
        current_value: currentValue,
        purchase_price: h.purchase_price,
        unrealized_gain: unrealizedGain,
        gain_percent: gainPercent,
      };
    });

    // Property data with equity
    const mortgageByProperty = new Map<number, number>();
    for (const m of mortgages) {
      mortgageByProperty.set(
        m.property_id,
        (mortgageByProperty.get(m.property_id) || 0) + m.current_balance,
      );
    }

    const propertyData = properties.map((p) => ({
      name: p.name,
      address: p.address,
      property_type: p.property_type,
      current_value: p.current_value,
      purchase_price: p.purchase_price,
      equity: p.current_value - (mortgageByProperty.get(p.id) || 0),
    }));

    // Liability data
    const liabilityData = liabilities.map((l) => ({
      name: l.name,
      category: l.category,
      balance: l.current_balance || 0,
    }));

    // Account summary
    const accountTypes = [...new Set(accounts.map((a) => a.type))];
    const accountSummary = {
      count: accounts.length,
      types: accountTypes,
    };

    const insights = await generateDashboardInsights(
      networthData,
      networthHistory,
      portfolioData,
      propertyData,
      liabilityData,
      accountSummary,
    );

    return NextResponse.json({ insights });
  } catch (e) {
    console.error('Failed to generate dashboard insights:', e);
    return NextResponse.json({ error: 'Failed to generate dashboard insights' }, { status: 500 });
  }
}
