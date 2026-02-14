/**
 * POST /api/v1/properties/refresh-values — Refresh valuations for all properties
 *   with a valuation provider set. Uses 2 API calls per property.
 */
import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import {
    isRentCastAvailable,
    refreshAllValuations,
} from '@/lib/services/property-valuation';

export async function POST() {
    const { userId } = await auth();
    if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const available = await isRentCastAvailable();
        if (!available) {
            return NextResponse.json(
                { detail: 'RentCast API key not configured. Add it in Settings.' },
                { status: 400 },
            );
        }

        const result = await refreshAllValuations(userId);
        return NextResponse.json(result);
    } catch (error) {
        console.error('Error refreshing all property values:', error);
        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 },
        );
    }
}
