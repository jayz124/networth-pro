import { NextResponse } from 'next/server';
import { getNetWorthBreakdown } from '@/lib/services/networth';

export async function GET() {
    try {
        const data = await getNetWorthBreakdown();
        return NextResponse.json(data);
    } catch (error) {
        console.error('Error fetching net worth breakdown:', error);
        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 }
        );
    }
}
