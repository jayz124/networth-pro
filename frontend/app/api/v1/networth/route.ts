import { NextResponse } from 'next/server';
import { getNetWorth } from '@/lib/services/networth';

export async function GET() {
    try {
        const data = await getNetWorth();
        return NextResponse.json(data);
    } catch (error) {
        console.error('Error calculating net worth:', error);
        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 }
        );
    }
}
