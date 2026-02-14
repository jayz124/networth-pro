import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { balanceUpdateSchema } from '@/lib/validators/shared';

type RouteParams = { params: Promise<{ id: string }> };

/**
 * POST /api/v1/liabilities/:id/balance
 * Record a new balance snapshot for a liability.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = await params;
        const liabilityId = parseInt(id, 10);

        if (isNaN(liabilityId)) {
            return NextResponse.json(
                { detail: 'Invalid liability ID' },
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

        const liability = await prisma.liability.findUnique({
            where: { id: liabilityId },
        });
        if (!liability) {
            return NextResponse.json(
                { detail: 'Liability not found' },
                { status: 404 },
            );
        }
        if (liability.user_id !== userId) {
            return NextResponse.json(
                { detail: 'Liability not found' },
                { status: 404 },
            );
        }

        const now = new Date();

        // Create balance snapshot and update liability's updated_at in a transaction
        const [snapshot] = await prisma.$transaction([
            prisma.balanceSnapshot.create({
                data: {
                    date: now,
                    liability_id: liabilityId,
                    amount: data.amount,
                    currency: liability.currency,
                },
            }),
            prisma.liability.update({
                where: { id: liabilityId },
                data: { updated_at: now },
            }),
        ]);

        return NextResponse.json({
            id: liability.id,
            name: liability.name,
            current_balance: data.amount,
            last_updated: snapshot.date.toISOString(),
        });
    } catch (error) {
        console.error('Error updating liability balance:', error);
        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 },
        );
    }
}
