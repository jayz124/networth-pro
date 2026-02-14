import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { updatePortfolioSchema } from '@/lib/validators/shared';

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
 * GET /api/v1/portfolios/[id] — Get portfolio with all holdings and P&L calculations.
 */
export async function GET(
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

        const holdingsWithPL = holdings.map(calculateHoldingPL);
        const totalValue = holdingsWithPL.reduce(
            (sum, h) => sum + (h.current_value ?? 0),
            0,
        );
        const totalCost = holdingsWithPL.reduce(
            (sum, h) => sum + (h.cost_basis ?? 0),
            0,
        );
        const totalGain = totalCost > 0 ? totalValue - totalCost : 0;
        const totalGainPercent = totalCost > 0 ? (totalGain / totalCost) * 100 : 0;

        return NextResponse.json({
            id: portfolio.id,
            name: portfolio.name,
            description: portfolio.description,
            currency: portfolio.currency,
            is_active: portfolio.is_active,
            holdings: holdingsWithPL,
            summary: {
                total_value: totalValue,
                total_cost: totalCost,
                total_gain: totalGain,
                total_gain_percent: totalGainPercent,
                holdings_count: holdings.length,
            },
        });
    } catch (error) {
        console.error('Error fetching portfolio:', error);
        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 },
        );
    }
}

/**
 * PUT /api/v1/portfolios/[id] — Update portfolio details.
 */
export async function PUT(
    request: NextRequest,
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

        const existing = await prisma.portfolio.findUnique({
            where: { id: portfolioId },
        });

        if (!existing || existing.user_id !== userId) {
            return NextResponse.json(
                { detail: 'Portfolio not found' },
                { status: 404 },
            );
        }

        const body = await request.json();
        const parsed = updatePortfolioSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json(
                { detail: parsed.error.issues.map((i) => i.message).join(', ') },
                { status: 400 },
            );
        }

        const data: Record<string, unknown> = {};
        if (parsed.data.name !== undefined) data.name = parsed.data.name;
        if (parsed.data.description !== undefined) data.description = parsed.data.description;
        if (parsed.data.currency !== undefined) data.currency = parsed.data.currency;
        if (parsed.data.is_active !== undefined) data.is_active = parsed.data.is_active;

        const portfolio = await prisma.portfolio.update({
            where: { id: portfolioId },
            data,
        });

        return NextResponse.json({
            id: portfolio.id,
            name: portfolio.name,
            description: portfolio.description,
            currency: portfolio.currency,
            is_active: portfolio.is_active,
        });
    } catch (error) {
        console.error('Error updating portfolio:', error);
        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 },
        );
    }
}

/**
 * DELETE /api/v1/portfolios/[id] — Delete portfolio and all its holdings.
 */
export async function DELETE(
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

        const existing = await prisma.portfolio.findUnique({
            where: { id: portfolioId },
        });

        if (!existing || existing.user_id !== userId) {
            return NextResponse.json(
                { detail: 'Portfolio not found' },
                { status: 404 },
            );
        }

        // Cascade delete is configured in Prisma schema, so holdings are auto-deleted
        await prisma.portfolio.delete({
            where: { id: portfolioId },
        });

        return NextResponse.json({ message: 'Portfolio deleted', id: portfolioId });
    } catch (error) {
        console.error('Error deleting portfolio:', error);
        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 },
        );
    }
}
