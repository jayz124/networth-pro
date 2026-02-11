import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createAccountSchema } from '@/lib/validators/shared';

/**
 * GET /api/v1/accounts
 * List all accounts with their latest balance snapshot.
 */
export async function GET() {
    try {
        const accounts = await prisma.account.findMany({
            include: {
                balance_snapshots: {
                    orderBy: { date: 'desc' },
                    take: 1,
                },
            },
        });

        const result = accounts.map((account) => {
            const snap = account.balance_snapshots[0] ?? null;
            return {
                id: account.id,
                name: account.name,
                institution: account.institution,
                type: account.type,
                currency: account.currency,
                tags: account.tags,
                current_balance: snap ? snap.amount : 0.0,
                last_updated: snap ? snap.date.toISOString() : null,
                created_at: account.created_at.toISOString(),
                updated_at: account.updated_at.toISOString(),
            };
        });

        return NextResponse.json(result);
    } catch (error) {
        console.error('Error listing accounts:', error);
        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 },
        );
    }
}

/**
 * POST /api/v1/accounts
 * Create a new account with optional initial balance.
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const parsed = createAccountSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json(
                { detail: parsed.error.issues[0]?.message ?? 'Validation error' },
                { status: 400 },
            );
        }

        const data = parsed.data;

        // Check for duplicate name
        const existing = await prisma.account.findUnique({
            where: { name: data.name },
        });
        if (existing) {
            return NextResponse.json(
                { detail: 'Account with this name already exists' },
                { status: 400 },
            );
        }

        const now = new Date();

        const account = await prisma.account.create({
            data: {
                name: data.name,
                institution: data.institution ?? null,
                type: data.type,
                currency: data.currency,
                tags: data.tags ?? null,
                current_balance: data.current_balance,
            },
        });

        // Create initial balance snapshot if non-zero
        if (data.current_balance !== 0) {
            await prisma.balanceSnapshot.create({
                data: {
                    date: now,
                    account_id: account.id,
                    amount: data.current_balance,
                    currency: data.currency,
                },
            });
        }

        return NextResponse.json({
            id: account.id,
            name: account.name,
            institution: account.institution,
            type: account.type,
            currency: account.currency,
            tags: account.tags,
            current_balance: data.current_balance,
            last_updated: data.current_balance !== 0 ? now.toISOString() : null,
            created_at: account.created_at.toISOString(),
            updated_at: account.updated_at.toISOString(),
        });
    } catch (error) {
        console.error('Error creating account:', error);
        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 },
        );
    }
}
