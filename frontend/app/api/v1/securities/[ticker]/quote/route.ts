import { NextRequest, NextResponse } from 'next/server';
import { getQuote } from '@/lib/services/market-data';

/**
 * GET /api/v1/securities/[ticker]/quote — Get current quote for a specific ticker.
 */
export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ ticker: string }> },
) {
    try {
        const { ticker } = await params;

        const result = await getQuote(ticker);

        if (result === null) {
            return NextResponse.json(
                { error: `Could not find quote for ${ticker}` },
                { status: 200 },
            );
        }

        return NextResponse.json(result);
    } catch (error) {
        console.error('Error fetching quote:', error);
        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 },
        );
    }
}
