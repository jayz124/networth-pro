import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { updateHoldingSchema } from '@/lib/validators/shared';

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
 * PUT /api/v1/holdings/[id] — Update a holding.
 */
export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    try {
        const { id } = await params;
        const holdingId = parseInt(id, 10);

        if (isNaN(holdingId)) {
            return NextResponse.json(
                { detail: 'Invalid holding ID' },
                { status: 400 },
            );
        }

        const existing = await prisma.portfolioHolding.findUnique({
            where: { id: holdingId },
        });

        if (!existing) {
            return NextResponse.json(
                { detail: 'Holding not found' },
                { status: 404 },
            );
        }

        const body = await request.json();
        const parsed = updateHoldingSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json(
                { detail: parsed.error.issues.map((i) => i.message).join(', ') },
                { status: 400 },
            );
        }

        const data: Record<string, unknown> = {};
        if (parsed.data.ticker !== undefined) data.ticker = parsed.data.ticker.toUpperCase();
        if (parsed.data.asset_type !== undefined) data.asset_type = parsed.data.asset_type;
        if (parsed.data.quantity !== undefined) data.quantity = parsed.data.quantity;
        if (parsed.data.purchase_price !== undefined) data.purchase_price = parsed.data.purchase_price;
        if (parsed.data.purchase_date !== undefined) data.purchase_date = parsed.data.purchase_date;
        if (parsed.data.current_price !== undefined) data.current_price = parsed.data.current_price;

        // Determine effective values for recalculation
        const effectiveQuantity = (data.quantity as number | undefined) ?? existing.quantity;
        const effectiveCurrentPrice = (data.current_price as number | null | undefined) !== undefined
            ? (data.current_price as number | null)
            : existing.current_price;

        // Recalculate current value
        if (effectiveCurrentPrice && effectiveQuantity) {
            data.current_value = effectiveCurrentPrice * effectiveQuantity;
        }

        const holding = await prisma.portfolioHolding.update({
            where: { id: holdingId },
            data,
        });

        return NextResponse.json(calculateHoldingPL(holding));
    } catch (error) {
        console.error('Error updating holding:', error);
        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 },
        );
    }
}

/**
 * DELETE /api/v1/holdings/[id] — Delete a holding.
 */
export async function DELETE(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    try {
        const { id } = await params;
        const holdingId = parseInt(id, 10);

        if (isNaN(holdingId)) {
            return NextResponse.json(
                { detail: 'Invalid holding ID' },
                { status: 400 },
            );
        }

        const existing = await prisma.portfolioHolding.findUnique({
            where: { id: holdingId },
        });

        if (!existing) {
            return NextResponse.json(
                { detail: 'Holding not found' },
                { status: 404 },
            );
        }

        await prisma.portfolioHolding.delete({
            where: { id: holdingId },
        });

        return NextResponse.json({ message: 'Holding deleted', id: holdingId });
    } catch (error) {
        console.error('Error deleting holding:', error);
        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 },
        );
    }
}
