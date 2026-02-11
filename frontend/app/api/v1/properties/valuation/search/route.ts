/**
 * GET /api/v1/properties/valuation/search?q=<address>
 *   Search for a property address via RentCast. Uses 1 API call.
 */
import { NextRequest, NextResponse } from 'next/server';
import { searchAddress } from '@/lib/services/property-valuation';

export async function GET(request: NextRequest) {
    try {
        const q = request.nextUrl.searchParams.get('q');
        if (!q || q.trim().length === 0) {
            return NextResponse.json(
                { detail: 'Query parameter "q" is required' },
                { status: 400 },
            );
        }

        const results = await searchAddress(q);
        return NextResponse.json({ results });
    } catch (error) {
        console.error('Error searching property address:', error);
        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 },
        );
    }
}
