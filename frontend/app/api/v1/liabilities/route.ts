import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createLiabilitySchema } from '@/lib/validators/shared';

/**
 * GET /api/v1/liabilities
 * List all liabilities with their latest balance snapshot.
 */
export async function GET() {
    try {
        const liabilities = await prisma.liability.findMany({
            include: {
                balance_snapshots: {
                    orderBy: { date: 'desc' },
                    take: 1,
                },
            },
        });

        const result = liabilities.map((liability) => {
            const snap = liability.balance_snapshots[0] ?? null;
            return {
                id: liability.id,
                name: liability.name,
                category: liability.category,
                currency: liability.currency,
                tags: liability.tags,
                current_balance: snap ? snap.amount : 0.0,
                last_updated: snap ? snap.date.toISOString() : null,
                created_at: liability.created_at.toISOString(),
                updated_at: liability.updated_at.toISOString(),
            };
        });

        return NextResponse.json(result);
    } catch (error) {
        console.error('Error listing liabilities:', error);
        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 },
        );
    }
}

/**
 * POST /api/v1/liabilities
 * Create a new liability with optional initial balance.
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const parsed = createLiabilitySchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json(
                { detail: parsed.error.issues[0]?.message ?? 'Validation error' },
                { status: 400 },
            );
        }

        const data = parsed.data;

        // Check for duplicate name
        const existing = await prisma.liability.findUnique({
            where: { name: data.name },
        });
        if (existing) {
            return NextResponse.json(
                { detail: 'Liability with this name already exists' },
                { status: 400 },
            );
        }

        const now = new Date();

        const { current_balance, ...liabilityData } = data;

        const liability = await prisma.liability.create({
            data: {
                name: liabilityData.name,
                category: liabilityData.category ?? null,
                currency: liabilityData.currency,
                tags: liabilityData.tags ?? null,
                created_at: now,
                updated_at: now,
            },
        });

        // Create initial balance snapshot if non-zero
        if (current_balance !== 0) {
            await prisma.balanceSnapshot.create({
                data: {
                    date: now,
                    liability_id: liability.id,
                    amount: current_balance,
                    currency: liabilityData.currency,
                },
            });
        }

        return NextResponse.json({
            id: liability.id,
            name: liability.name,
            category: liability.category,
            currency: liability.currency,
            tags: liability.tags,
            current_balance: current_balance,
            last_updated: current_balance !== 0 ? now.toISOString() : null,
            created_at: liability.created_at.toISOString(),
            updated_at: liability.updated_at.toISOString(),
        });
    } catch (error) {
        console.error('Error creating liability:', error);
        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 },
        );
    }
}
