import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { balanceUpdateSchema } from '@/lib/validators/shared';

type RouteParams = { params: Promise<{ id: string }> };

/**
 * POST /api/v1/accounts/:id/balance
 * Record a new balance snapshot for an account.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = await params;
        const accountId = parseInt(id, 10);

        if (isNaN(accountId)) {
            return NextResponse.json(
                { detail: 'Invalid account ID' },
                { status: 400 },
            );
        }

        const body = await request.json();
        const parsed = balanceUpdateSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json(
                { detail: parsed.error.issues[0]?.message ?? 'Validation error' },
                { status: 400 },
            );
        }

        const data = parsed.data;

        const account = await prisma.account.findUnique({
            where: { id: accountId },
        });
        if (!account) {
            return NextResponse.json(
                { detail: 'Account not found' },
                { status: 404 },
            );
        }
        if (account.user_id !== userId) {
            return NextResponse.json(
                { detail: 'Account not found' },
                { status: 404 },
            );
        }

        const now = new Date();

        // Create balance snapshot and update account's updated_at in a transaction
        const [snapshot] = await prisma.$transaction([
            prisma.balanceSnapshot.create({
                data: {
                    date: now,
                    account_id: accountId,
                    amount: data.amount,
                    currency: account.currency,
                },
            }),
            prisma.account.update({
                where: { id: accountId },
                data: { updated_at: now },
            }),
        ]);

        return NextResponse.json({
            id: account.id,
            name: account.name,
            current_balance: data.amount,
            last_updated: snapshot.date.toISOString(),
        });
    } catch (error) {
        console.error('Error updating account balance:', error);
        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 },
        );
    }
}
