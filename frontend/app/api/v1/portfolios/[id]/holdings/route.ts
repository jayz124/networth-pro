import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { createHoldingSchema } from '@/lib/validators/shared';

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
 * POST /api/v1/portfolios/[id]/holdings — Add a new holding to a portfolio.
 */
export async function POST(
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

        const portfolio = await prisma.portfolio.findUnique({
            where: { id: portfolioId },
        });

        if (!portfolio || portfolio.user_id !== userId) {
            return NextResponse.json(
                { detail: 'Portfolio not found' },
                { status: 404 },
            );
        }

        const body = await request.json();
        const parsed = createHoldingSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json(
                { detail: parsed.error.issues.map((i) => i.message).join(', ') },
                { status: 400 },
            );
        }

        const { ticker, asset_type, quantity, purchase_price, purchase_date, currency } = parsed.data;

        // Calculate current value if we have price and quantity
        let currentValue: number | null = null;
        if (purchase_price && quantity) {
            currentValue = purchase_price * quantity;
        }

        const holding = await prisma.portfolioHolding.create({
            data: {
                portfolio_id: portfolioId,
                ticker: ticker.toUpperCase(),
                asset_type,
                quantity,
                purchase_price: purchase_price ?? null,
                purchase_date: purchase_date ?? null,
                currency,
                current_price: purchase_price ?? null, // Initially set to purchase price
                current_value: currentValue,
            },
        });

        return NextResponse.json(calculateHoldingPL(holding), { status: 201 });
    } catch (error) {
        console.error('Error adding holding:', error);
        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 },
        );
    }
}
