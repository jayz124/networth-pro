/**
 * GET /api/v1/properties/valuation/status — Check if RentCast is configured
 */
import { NextResponse } from 'next/server';
import { isRentCastAvailable } from '@/lib/services/property-valuation';

export async function GET() {
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
