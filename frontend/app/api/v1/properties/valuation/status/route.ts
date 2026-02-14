/**
 * GET /api/v1/properties/valuation/status — Check if RentCast is configured
 */
import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { isRentCastAvailable } from '@/lib/services/property-valuation';

export async function GET() {
    const { userId } = await auth();
    if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const available = await isRentCastAvailable();
        return NextResponse.json({ rentcast_available: available });
    } catch (error) {
        console.error('Error checking valuation status:', error);
        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 },
        );
    }
}
