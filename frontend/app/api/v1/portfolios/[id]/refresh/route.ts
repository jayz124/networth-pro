import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { getBatchQuotes } from '@/lib/services/market-data';

function calculateHoldingPL(h: {
    id: number;
    portfolio_id: number;
    ticker: string;
    asset_type: string;
    quantity: number;
    purchase_price: number | null;
    purchase_date: string | null;
    currency: string;
    current_price: number | null;
    current_value: number | null;
}) {
    const costBasis = (h.purchase_price ?? 0) * h.quantity;
    const currentValue = h.current_value ?? 0;
    const unrealizedGain = costBasis > 0 ? currentValue - costBasis : 0;
    const gainPercent = costBasis > 0 ? (unrealizedGain / costBasis) * 100 : 0;

    return {
        id: h.id,
        portfolio_id: h.portfolio_id,
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
    };
}

/**
 * POST /api/v1/portfolios/[id]/refresh — Refresh prices for all holdings in a portfolio.
 */
export async function POST(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    const { userId } = await auth();
    if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { id } = await params;
        const portfolioId = parseInt(id, 10);

        if (isNaN(portfolioId)) {
            return NextResponse.json(
                { detail: 'Invalid portfolio ID' },
                { status: 400 },
            );
        }

        const portfolio = await prisma.portfolio.findUnique({
            where: { id: portfolioId },
        });

        if (!portfolio || portfolio.user_id !== userId) {
            return NextResponse.json(
                { detail: 'Portfolio not found' },
                { status: 404 },
            );
        }

        const holdings = await prisma.portfolioHolding.findMany({
            where: { portfolio_id: portfolioId },
        });

        if (holdings.length === 0) {
            return NextResponse.json({
                message: 'No holdings to refresh',
                updated: 0,
                holdings: [],
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

        // Return updated holdings with P&L
        const updatedHoldings = await prisma.portfolioHolding.findMany({
            where: { portfolio_id: portfolioId },
        });

        return NextResponse.json({
            message: `Refreshed ${updatedCount} holdings`,
            updated: updatedCount,
            holdings: updatedHoldings.map(calculateHoldingPL),
        });
    } catch (error) {
        console.error('Error refreshing portfolio prices:', error);
        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 },
        );
    }
}
