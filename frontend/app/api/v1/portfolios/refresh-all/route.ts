import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { getBatchQuotes } from '@/lib/services/market-data';

/**
 * POST /api/v1/portfolios/refresh-all — Refresh prices for all holdings across all of the user's portfolios.
 */
export async function POST() {
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
        });

        if (holdings.length === 0) {
            return NextResponse.json({
                message: 'No holdings to refresh',
                updated: 0,
            });
        }

        // Get unique tickers
        const tickers = [...new Set(holdings.map((h) => h.ticker))];

        // Batch fetch quotes
        const quotes = await getBatchQuotes(tickers);

        // Update holdings
        let updatedCount = 0;
        for (const holding of holdings) {
            const quote = quotes[holding.ticker];
            if (quote && quote.current_price) {
                await prisma.portfolioHolding.update({
                    where: { id: holding.id },
                    data: {
                        current_price: quote.current_price,
                        current_value: quote.current_price * holding.quantity,
                    },
                });
                updatedCount++;
            }
        }

        return NextResponse.json({
            message: `Refreshed ${updatedCount} holdings`,
            updated: updatedCount,
        });
    } catch (error) {
        console.error('Error refreshing all portfolio prices:', error);
        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 },
        );
    }
}
