import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getNetWorthBreakdown } from '@/lib/services/networth';

export async function GET() {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const data = await getNetWorthBreakdown(userId);
        return NextResponse.json(data);
    } catch (error) {
        console.error('Error fetching net worth breakdown:', error);
        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 }
        );
    }
}
