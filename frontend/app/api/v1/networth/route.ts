import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getNetWorth } from '@/lib/services/networth';

export async function GET() {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const data = await getNetWorth(userId);
        return NextResponse.json(data);
    } catch (error) {
        console.error('Error calculating net worth:', error);
        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 }
        );
    }
}
