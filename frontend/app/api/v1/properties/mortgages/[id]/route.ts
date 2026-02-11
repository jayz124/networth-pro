/**
 * PUT    /api/v1/properties/mortgages/:id — Update a mortgage
 * DELETE /api/v1/properties/mortgages/:id — Delete a mortgage
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { updateMortgageSchema } from '@/lib/validators/shared';

type RouteContext = { params: Promise<{ id: string }> };

export async function PUT(
    request: NextRequest,
    context: RouteContext,
) {
    try {
        const { id: rawId } = await context.params;
        const mortgageId = Number(rawId);
        if (isNaN(mortgageId)) {
            return NextResponse.json(
                { detail: 'Invalid mortgage id' },
                { status: 400 },
            );
        }

        const existing = await prisma.mortgage.findUnique({
            where: { id: mortgageId },
        });
        if (!existing) {
            return NextResponse.json(
                { detail: 'Mortgage not found' },
                { status: 404 },
            );
        }

        const body = await request.json();
        const parsed = updateMortgageSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { detail: parsed.error.issues[0]?.message ?? 'Validation error' },
                { status: 400 },
            );
        }

        const data = parsed.data;

        const updateData: Record<string, unknown> = {};
        if (data.lender !== undefined) updateData.lender = data.lender;
        if (data.current_balance !== undefined) updateData.current_balance = data.current_balance;
        if (data.interest_rate !== undefined) updateData.interest_rate = data.interest_rate;
        if (data.monthly_payment !== undefined) updateData.monthly_payment = data.monthly_payment;
        if (data.is_active !== undefined) updateData.is_active = data.is_active;

        const mortgage = await prisma.mortgage.update({
            where: { id: mortgageId },
            data: updateData,
        });

        return NextResponse.json({
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
        });
    } catch (error) {
        console.error('Error updating mortgage:', error);
        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 },
        );
    }
}

export async function DELETE(
    _request: NextRequest,
    context: RouteContext,
) {
    try {
        const { id: rawId } = await context.params;
        const mortgageId = Number(rawId);
        if (isNaN(mortgageId)) {
            return NextResponse.json(
                { detail: 'Invalid mortgage id' },
                { status: 400 },
            );
        }

        const existing = await prisma.mortgage.findUnique({
            where: { id: mortgageId },
        });
        if (!existing) {
            return NextResponse.json(
                { detail: 'Mortgage not found' },
                { status: 404 },
            );
        }

        await prisma.mortgage.delete({ where: { id: mortgageId } });

        return NextResponse.json({ message: 'Mortgage deleted', id: mortgageId });
    } catch (error) {
        console.error('Error deleting mortgage:', error);
        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 },
        );
    }
}
