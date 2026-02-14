/**
 * GET /api/v1/properties/:id/value-history — Get historical value data (no API call)
 */
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { getValueHistory } from '@/lib/services/property-valuation';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(
    _request: NextRequest,
    context: RouteContext,
) {
    const { userId } = await auth();
    if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { id: rawId } = await context.params;
        const propertyId = Number(rawId);
        if (isNaN(propertyId)) {
            return NextResponse.json(
                { detail: 'Invalid property id' },
                { status: 400 },
            );
        }

        const prop = await prisma.property.findUnique({
            where: { id: propertyId },
        });
        if (!prop || prop.user_id !== userId) {
            return NextResponse.json(
                { detail: 'Property not found' },
                { status: 404 },
            );
        }

        const history = await getValueHistory(propertyId);

        // Prepend purchase price as the first data point if it isn't already there
        if (prop.purchase_date && prop.purchase_price) {
            const hasPurchase = history.some((h) => h.date === prop.purchase_date);
            if (!hasPurchase) {
                history.unshift({
                    date: prop.purchase_date,
                    estimated_value: prop.purchase_price,
                    source: 'purchase',
                });
            }
        }

        return NextResponse.json({
            property_id: propertyId,
            history,
        });
    } catch (error) {
        console.error('Error getting property value history:', error);
        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 },
        );
    }
}
