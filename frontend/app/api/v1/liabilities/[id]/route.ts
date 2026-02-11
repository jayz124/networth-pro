import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { updateLiabilitySchema } from '@/lib/validators/shared';

type RouteParams = { params: Promise<{ id: string }> };

/**
 * GET /api/v1/liabilities/:id
 * Get liability details with balance history.
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
    try {
        const { id } = await params;
        const liabilityId = parseInt(id, 10);

        if (isNaN(liabilityId)) {
            return NextResponse.json(
                { detail: 'Invalid liability ID' },
                { status: 400 },
            );
        }

        const liability = await prisma.liability.findUnique({
            where: { id: liabilityId },
            include: {
                balance_snapshots: {
                    orderBy: { date: 'desc' },
                    take: 30,
                },
            },
        });

        if (!liability) {
            return NextResponse.json(
                { detail: 'Liability not found' },
                { status: 404 },
            );
        }

        const snapshots = liability.balance_snapshots;
        const current_balance = snapshots[0]?.amount ?? 0.0;
        const last_updated = snapshots[0]?.date ?? null;

        return NextResponse.json({
            id: liability.id,
            name: liability.name,
            category: liability.category,
            currency: liability.currency,
            tags: liability.tags,
            current_balance,
            last_updated: last_updated ? last_updated.toISOString() : null,
            created_at: liability.created_at.toISOString(),
            updated_at: liability.updated_at.toISOString(),
            balance_history: snapshots.map((s) => ({
                date: s.date.toISOString(),
                amount: s.amount,
                currency: s.currency,
            })),
        });
    } catch (error) {
        console.error('Error fetching liability:', error);
        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 },
        );
    }
}

/**
 * PUT /api/v1/liabilities/:id
 * Update liability details (not balance).
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
    try {
        const { id } = await params;
        const liabilityId = parseInt(id, 10);

        if (isNaN(liabilityId)) {
            return NextResponse.json(
                { detail: 'Invalid liability ID' },
                { status: 400 },
            );
        }

        const body = await request.json();
        const parsed = updateLiabilitySchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json(
                { detail: parsed.error.issues[0]?.message ?? 'Validation error' },
                { status: 400 },
            );
        }

        const data = parsed.data;

        // Verify liability exists
        const existing = await prisma.liability.findUnique({
            where: { id: liabilityId },
        });
        if (!existing) {
            return NextResponse.json(
                { detail: 'Liability not found' },
                { status: 404 },
            );
        }

        // Check for duplicate name if name is being changed
        if (data.name !== undefined) {
            const duplicate = await prisma.liability.findFirst({
                where: {
                    name: data.name,
                    id: { not: liabilityId },
                },
            });
            if (duplicate) {
                return NextResponse.json(
                    { detail: 'Liability with this name already exists' },
                    { status: 400 },
                );
            }
        }

        // Build update payload, only including fields that were provided
        const updateData: Record<string, unknown> = {
            updated_at: new Date(),
        };
        if (data.name !== undefined) updateData.name = data.name;
        if (data.category !== undefined) updateData.category = data.category;
        if (data.currency !== undefined) updateData.currency = data.currency;
        if (data.tags !== undefined) updateData.tags = data.tags;

        const liability = await prisma.liability.update({
            where: { id: liabilityId },
            data: updateData,
        });

        // Get latest snapshot for current_balance
        const latestSnapshot = await prisma.balanceSnapshot.findFirst({
            where: { liability_id: liabilityId },
            orderBy: { date: 'desc' },
        });

        return NextResponse.json({
            id: liability.id,
            name: liability.name,
            category: liability.category,
            currency: liability.currency,
            tags: liability.tags,
            current_balance: latestSnapshot?.amount ?? 0.0,
            last_updated: latestSnapshot?.date
                ? latestSnapshot.date.toISOString()
                : null,
            created_at: liability.created_at.toISOString(),
            updated_at: liability.updated_at.toISOString(),
        });
    } catch (error) {
        console.error('Error updating liability:', error);
        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 },
        );
    }
}

/**
 * DELETE /api/v1/liabilities/:id
 * Delete liability and all its balance history.
 */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
    try {
        const { id } = await params;
        const liabilityId = parseInt(id, 10);

        if (isNaN(liabilityId)) {
            return NextResponse.json(
                { detail: 'Invalid liability ID' },
                { status: 400 },
            );
        }

        const liability = await prisma.liability.findUnique({
            where: { id: liabilityId },
        });
        if (!liability) {
            return NextResponse.json(
                { detail: 'Liability not found' },
                { status: 404 },
            );
        }

        // Cascade delete handles snapshots via schema onDelete: Cascade
        await prisma.liability.delete({
            where: { id: liabilityId },
        });

        return NextResponse.json({ message: 'Liability deleted', id: liabilityId });
    } catch (error) {
        console.error('Error deleting liability:', error);
        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 },
        );
    }
}
