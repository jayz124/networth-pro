import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { searchSecurities } from '@/lib/services/market-data';

/**
 * GET /api/v1/securities/search?q=&limit= — Search securities by ticker or company name.
 */
export async function GET(request: NextRequest) {
    const { userId } = await auth();
    if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { searchParams } = new URL(request.url);
        const q = searchParams.get('q');
        const limitParam = searchParams.get('limit');
        const limit = limitParam ? Math.min(Math.max(parseInt(limitParam, 10) || 10, 1), 50) : 10;

        if (!q || q.length < 1) {
            return NextResponse.json(
                { detail: 'Query parameter "q" is required and must be at least 1 character' },
                { status: 400 },
            );
        }

        const results = await searchSecurities(q, limit);

        return NextResponse.json({ results, query: q });
    } catch (error) {
        console.error('Error searching securities:', error);
        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 },
        );
    }
}
