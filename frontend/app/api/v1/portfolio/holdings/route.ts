import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/v1/portfolio/holdings — List ALL holdings across all of the user's portfolios with computed fields.
 */
export async function GET() {
    const { userId } = await auth();
    if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        // First get all portfolios belonging to the user
        const userPortfolios = await prisma.portfolio.findMany({
            where: { user_id: userId },
            select: { id: true },
        });
        const portfolioIds = userPortfolios.map((p) => p.id);

        const holdings = await prisma.portfolioHolding.findMany({
            where: { portfolio_id: { in: portfolioIds } },
            include: {
                portfolio: { select: { name: true } },
            },
        });

        // Fetch all security info for name lookup
        const tickers = [...new Set(holdings.map((h) => h.ticker))];
        const securityInfos = tickers.length > 0
            ? await prisma.securityInfo.findMany({
                  where: { ticker: { in: tickers } },
              })
            : [];
        const securityMap = Object.fromEntries(
            securityInfos.map((s) => [s.ticker, s.name]),
        );

        const results = holdings.map((h) => {
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
                purchase_price: h.purchase_price,
                purchase_date: h.purchase_date,
                currency: h.currency,
                current_price: h.current_price,
                current_value: currentValue,
                cost_basis: costBasis,
                unrealized_gain: unrealizedGain,
                gain_percent: gainPercent,
                name: securityMap[h.ticker] ?? null,
            };
        });

        return NextResponse.json(results);
    } catch (error) {
        console.error('Error fetching all holdings:', error);
        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 },
        );
    }
}
