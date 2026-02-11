import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { updateAccountSchema } from '@/lib/validators/shared';

type RouteParams = { params: Promise<{ id: string }> };

/**
 * GET /api/v1/accounts/:id
 * Get account details with balance history.
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
    try {
        const { id } = await params;
        const accountId = parseInt(id, 10);

        if (isNaN(accountId)) {
            return NextResponse.json(
                { detail: 'Invalid account ID' },
                { status: 400 },
            );
        }

        const account = await prisma.account.findUnique({
            where: { id: accountId },
            include: {
                balance_snapshots: {
                    orderBy: { date: 'desc' },
                    take: 30,
                },
            },
        });

        if (!account) {
            return NextResponse.json(
                { detail: 'Account not found' },
                { status: 404 },
            );
        }

        const snapshots = account.balance_snapshots;
        const current_balance = snapshots[0]?.amount ?? 0.0;
        const last_updated = snapshots[0]?.date ?? null;

        return NextResponse.json({
            id: account.id,
            name: account.name,
            institution: account.institution,
            type: account.type,
            currency: account.currency,
            tags: account.tags,
            current_balance,
            last_updated: last_updated ? last_updated.toISOString() : null,
            created_at: account.created_at.toISOString(),
            updated_at: account.updated_at.toISOString(),
            balance_history: snapshots.map((s) => ({
                date: s.date.toISOString(),
                amount: s.amount,
                currency: s.currency,
            })),
        });
    } catch (error) {
        console.error('Error fetching account:', error);
        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 },
        );
    }
}

/**
 * PUT /api/v1/accounts/:id
 * Update account details (not balance).
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
    try {
        const { id } = await params;
        const accountId = parseInt(id, 10);

        if (isNaN(accountId)) {
            return NextResponse.json(
                { detail: 'Invalid account ID' },
                { status: 400 },
            );
        }

        const body = await request.json();
        const parsed = updateAccountSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json(
                { detail: parsed.error.issues[0]?.message ?? 'Validation error' },
                { status: 400 },
            );
        }

        const data = parsed.data;

        // Verify account exists
        const existing = await prisma.account.findUnique({
            where: { id: accountId },
        });
        if (!existing) {
            return NextResponse.json(
                { detail: 'Account not found' },
                { status: 404 },
            );
        }

        // Check for duplicate name if name is being changed
        if (data.name !== undefined) {
            const duplicate = await prisma.account.findFirst({
                where: {
                    name: data.name,
                    id: { not: accountId },
                },
            });
            if (duplicate) {
                return NextResponse.json(
                    { detail: 'Account with this name already exists' },
                    { status: 400 },
                );
            }
        }

        // Build update payload, only including fields that were provided
        const updateData: Record<string, unknown> = {};
        if (data.name !== undefined) updateData.name = data.name;
        if (data.institution !== undefined) updateData.institution = data.institution;
        if (data.type !== undefined) updateData.type = data.type;
        if (data.currency !== undefined) updateData.currency = data.currency;
        if (data.tags !== undefined) updateData.tags = data.tags;

        const account = await prisma.account.update({
            where: { id: accountId },
            data: updateData,
        });

        // Get latest snapshot for current_balance
        const latestSnapshot = await prisma.balanceSnapshot.findFirst({
            where: { account_id: accountId },
            orderBy: { date: 'desc' },
        });

        return NextResponse.json({
            id: account.id,
            name: account.name,
            institution: account.institution,
            type: account.type,
            currency: account.currency,
            tags: account.tags,
            current_balance: latestSnapshot?.amount ?? 0.0,
            last_updated: latestSnapshot?.date
                ? latestSnapshot.date.toISOString()
                : null,
            created_at: account.created_at.toISOString(),
            updated_at: account.updated_at.toISOString(),
        });
    } catch (error) {
        console.error('Error updating account:', error);
        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 },
        );
    }
}

/**
 * DELETE /api/v1/accounts/:id
 * Delete account and all its balance history.
 */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
    try {
        const { id } = await params;
        const accountId = parseInt(id, 10);

        if (isNaN(accountId)) {
            return NextResponse.json(
                { detail: 'Invalid account ID' },
                { status: 400 },
            );
        }

        const account = await prisma.account.findUnique({
            where: { id: accountId },
        });
        if (!account) {
            return NextResponse.json(
                { detail: 'Account not found' },
                { status: 404 },
            );
        }

        // Cascade delete handles snapshots via schema onDelete: Cascade
        await prisma.account.delete({
            where: { id: accountId },
        });

        return NextResponse.json({ message: 'Account deleted', id: accountId });
    } catch (error) {
        console.error('Error deleting account:', error);
        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 },
        );
    }
}
