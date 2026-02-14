/**
 * GET /api/v1/properties/:id/valuation?refresh=true|false
 *   Get valuation for a property. Returns cached data by default.
 *   Set refresh=true to force a fresh API call (uses 2 API calls).
 */
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import {
    getCachedValuation,
    getFullValuation,
} from '@/lib/services/property-valuation';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(
    request: NextRequest,
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

        const refresh =
            request.nextUrl.searchParams.get('refresh') === 'true';

        if (!refresh) {
            const cached = await getCachedValuation(propertyId);
            if (cached && !cached.is_stale) {
                return NextResponse.json(cached);
            }
        }

        // Attempt a fresh valuation
        const result = await getFullValuation(prop.address, propertyId);

        if (!result) {
            // Fall back to stale cache if available
            const cached = await getCachedValuation(propertyId);
            if (cached) {
                return NextResponse.json(cached);
            }
            return NextResponse.json({
                error: 'Could not fetch valuation. Check API key in Settings.',
            });
        }

        return NextResponse.json(result);
    } catch (error) {
        console.error('Error getting property valuation:', error);
        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 },
        );
    }
}
