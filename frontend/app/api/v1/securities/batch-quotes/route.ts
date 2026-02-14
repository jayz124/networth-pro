import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { z } from 'zod';
import { getBatchQuotes } from '@/lib/services/market-data';

const batchQuoteSchema = z.object({
    tickers: z.array(z.string().min(1)).min(1),
});

/**
 * POST /api/v1/securities/batch-quotes — Get quotes for multiple tickers in a single request.
 */
export async function POST(request: NextRequest) {
    const { userId } = await auth();
    if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await request.json();
        const parsed = batchQuoteSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json(
                { detail: parsed.error.issues.map((i) => i.message).join(', ') },
                { status: 400 },
            );
        }

        const results = await getBatchQuotes(parsed.data.tickers);

        return NextResponse.json({
            quotes: results,
            count: Object.keys(results).length,
        });
    } catch (error) {
        console.error('Error fetching batch quotes:', error);
        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 },
        );
    }
}
