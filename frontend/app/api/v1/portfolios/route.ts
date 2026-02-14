import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { createPortfolioSchema } from '@/lib/validators/shared';

/**
 * GET /api/v1/portfolios — List all portfolios for the authenticated user.
 */
export async function GET() {
    const { userId } = await auth();
    if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const portfolios = await prisma.portfolio.findMany({
            where: { user_id: userId },
            orderBy: { created_at: 'desc' },
        });

        return NextResponse.json(
            portfolios.map((p) => ({
                id: p.id,
                name: p.name,
                description: p.description,
                currency: p.currency,
                is_active: p.is_active,
            })),
        );
    } catch (error) {
        console.error('Error listing portfolios:', error);
        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 },
        );
    }
}

/**
 * POST /api/v1/portfolios — Create a new portfolio for the authenticated user.
 */
export async function POST(request: NextRequest) {
    const { userId } = await auth();
    if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await request.json();
        const parsed = createPortfolioSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json(
                { detail: parsed.error.issues.map((i) => i.message).join(', ') },
                { status: 400 },
            );
        }

        const { name, description, currency } = parsed.data;

        const portfolio = await prisma.portfolio.create({
            data: { name, description, currency, user_id: userId },
        });

        return NextResponse.json(
            {
                id: portfolio.id,
                name: portfolio.name,
                description: portfolio.description,
                currency: portfolio.currency,
                is_active: portfolio.is_active,
            },
            { status: 201 },
        );
    } catch (error) {
        console.error('Error creating portfolio:', error);
        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 },
        );
    }
}
