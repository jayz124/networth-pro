import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getNetWorthHistory } from '@/lib/services/networth';

export async function GET() {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const data = await getNetWorthHistory(userId);
        return NextResponse.json(data);
    } catch (error) {
        console.error('Error fetching net worth history:', error);
        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 }
        );
    }
}
