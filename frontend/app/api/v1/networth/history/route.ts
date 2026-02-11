import { NextResponse } from 'next/server';
import { getNetWorthHistory } from '@/lib/services/networth';

export async function GET() {
    try {
        const data = await getNetWorthHistory();
        return NextResponse.json(data);
    } catch (error) {
        console.error('Error fetching net worth history:', error);
        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 }
        );
    }
}
