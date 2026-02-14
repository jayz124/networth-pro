import { prisma } from '@/lib/prisma';
import type { Holding, Portfolio } from '@/lib/api';

/**
 * List all portfolios for a user.
 */
export async function getPortfolios(userId: string): Promise<Portfolio[]> {
    const portfolios = await prisma.portfolio.findMany({
        where: { user_id: userId },
        orderBy: { created_at: 'desc' },
    });

    return portfolios.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description ?? undefined,
        currency: p.currency,
        is_active: p.is_active,
    }));
}

/**
 * List ALL holdings across all of a user's portfolios with computed fields.
 */
export async function getHoldings(userId: string): Promise<Holding[]> {
    const userPortfolios = await prisma.portfolio.findMany({
        where: { user_id: userId },
        select: { id: true },
    });
    const portfolioIds = userPortfolios.map((p) => p.id);

    if (portfolioIds.length === 0) return [];

    const holdings = await prisma.portfolioHolding.findMany({
        where: { portfolio_id: { in: portfolioIds } },
        include: {
            portfolio: { select: { name: true } },
        },
    });

    const tickers = [...new Set(holdings.map((h) => h.ticker))];
    const securityInfos = tickers.length > 0
        ? await prisma.securityInfo.findMany({
              where: { ticker: { in: tickers } },
          })
        : [];
    const securityMap = Object.fromEntries(
        securityInfos.map((s) => [s.ticker, s.name]),
    );

    return holdings.map((h) => {
        const costBasis = (h.purchase_price ?? 0) * h.quantity;
        const currentValue = h.current_value ?? 0;
        const unrealizedGain = costBasis > 0 ? currentValue - costBasis : 0;
        const gainPercent = costBasis > 0 ? (unrealizedGain / costBasis) * 100 : 0;

        return {
            id: h.id,
            portfolio_id: h.portfolio_id,
            portfolio_name: h.portfolio.name,
            ticker: h.ticker,
            asset_type: h.asset_type,
            quantity: h.quantity,
            purchase_price: h.purchase_price ?? undefined,
            purchase_date: h.purchase_date ?? undefined,
            currency: h.currency,
            current_price: h.current_price ?? undefined,
            current_value: currentValue,
            cost_basis: costBasis,
            unrealized_gain: unrealizedGain,
            gain_percent: gainPercent,
            name: securityMap[h.ticker] ?? undefined,
        };
    });
}
