/**
 * POST /api/v1/properties/:id/mortgage — Add a mortgage to a property
 */
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { createMortgageSchema } from '@/lib/validators/shared';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(
    request: NextRequest,
    context: RouteContext,
) {
    const { userId } = await auth();
    if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { id: rawId } = await context.params;
        const propertyId = Number(rawId);
        if (isNaN(propertyId)) {
            return NextResponse.json(
                { detail: 'Invalid property id' },
                { status: 400 },
            );
        }

        const prop = await prisma.property.findUnique({
            where: { id: propertyId },
        });
        if (!prop || prop.user_id !== userId) {
            return NextResponse.json(
                { detail: 'Property not found' },
                { status: 404 },
            );
        }

        const body = await request.json();
        const parsed = createMortgageSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { detail: parsed.error.issues[0]?.message ?? 'Validation error' },
                { status: 400 },
            );
        }

        const data = parsed.data;

        const mortgage = await prisma.mortgage.create({
            data: {
                property_id: propertyId,
                lender: data.lender ?? null,
                original_principal: data.original_principal,
                current_balance: data.current_balance,
                interest_rate: data.interest_rate,
                monthly_payment: data.monthly_payment,
                term_years: data.term_years,
                is_active: data.is_active,
            },
        });

        return NextResponse.json(
            {
                id: mortgage.id,
                property_id: mortgage.property_id,
                lender: mortgage.lender,
                original_principal: mortgage.original_principal,
                current_balance: mortgage.current_balance,
                interest_rate: mortgage.interest_rate,
                monthly_payment: mortgage.monthly_payment,
                term_years: mortgage.term_years,
                is_active: mortgage.is_active,
                created_at: mortgage.created_at.toISOString(),
                updated_at: mortgage.updated_at.toISOString(),
            },
            { status: 201 },
        );
    } catch (error) {
        console.error('Error adding mortgage:', error);
        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 },
        );
    }
}
