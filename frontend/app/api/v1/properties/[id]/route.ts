/**
 * GET    /api/v1/properties/:id — Get a single property with mortgages + equity
 * PUT    /api/v1/properties/:id — Update a property
 * DELETE /api/v1/properties/:id — Delete a property and its mortgages
 */
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { updatePropertySchema } from '@/lib/validators/shared';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(
    _request: NextRequest,
    context: RouteContext,
) {
    const { userId } = await auth();
    if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { id: rawId } = await context.params;
        const id = Number(rawId);
        if (isNaN(id)) {
            return NextResponse.json(
                { detail: 'Invalid property id' },
                { status: 400 },
            );
        }

        const prop = await prisma.property.findUnique({
            where: { id },
            include: { mortgages: true },
        });

        if (!prop || prop.user_id !== userId) {
            return NextResponse.json(
                { detail: 'Property not found' },
                { status: 404 },
            );
        }

        const activeMortgages = prop.mortgages.filter((m) => m.is_active);
        const totalMortgageBalance = activeMortgages.reduce(
            (sum, m) => sum + m.current_balance,
            0,
        );
        const equity = prop.current_value - totalMortgageBalance;
        const monthlyPayments = activeMortgages.reduce(
            (sum, m) => sum + m.monthly_payment,
            0,
        );
        const appreciation = prop.current_value - prop.purchase_price;
        const appreciationPercent =
            prop.purchase_price > 0
                ? (appreciation / prop.purchase_price) * 100
                : 0;

        return NextResponse.json({
            id: prop.id,
            name: prop.name,
            address: prop.address,
            property_type: prop.property_type,
            purchase_price: prop.purchase_price,
            purchase_date: prop.purchase_date,
            current_value: prop.current_value,
            currency: prop.currency,
            provider_property_id: prop.provider_property_id,
            valuation_provider: prop.valuation_provider,
            created_at: prop.created_at.toISOString(),
            updated_at: prop.updated_at.toISOString(),
            mortgages: prop.mortgages.map(mortgageToJson),
            total_mortgage_balance: totalMortgageBalance,
            equity,
            monthly_payments: monthlyPayments,
            appreciation,
            appreciation_percent: appreciationPercent,
        });
    } catch (error) {
        console.error('Error getting property:', error);
        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 },
        );
    }
}

export async function PUT(
    request: NextRequest,
    context: RouteContext,
) {
    const { userId } = await auth();
    if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { id: rawId } = await context.params;
        const id = Number(rawId);
        if (isNaN(id)) {
            return NextResponse.json(
                { detail: 'Invalid property id' },
                { status: 400 },
            );
        }

        const existing = await prisma.property.findUnique({ where: { id } });
        if (!existing || existing.user_id !== userId) {
            return NextResponse.json(
                { detail: 'Property not found' },
                { status: 404 },
            );
        }

        const body = await request.json();
        const parsed = updatePropertySchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { detail: parsed.error.issues[0]?.message ?? 'Validation error' },
                { status: 400 },
            );
        }

        const data = parsed.data;

        // Build an update object with only the provided fields
        const updateData: Record<string, unknown> = {};
        if (data.name !== undefined) updateData.name = data.name;
        if (data.address !== undefined) updateData.address = data.address;
        if (data.property_type !== undefined) updateData.property_type = data.property_type;
        if (data.purchase_price !== undefined) updateData.purchase_price = data.purchase_price;
        if (data.purchase_date !== undefined) updateData.purchase_date = data.purchase_date;
        if (data.current_value !== undefined) updateData.current_value = data.current_value;
        if (data.provider_property_id !== undefined) updateData.provider_property_id = data.provider_property_id;
        if (data.valuation_provider !== undefined) updateData.valuation_provider = data.valuation_provider;

        const prop = await prisma.property.update({
            where: { id },
            data: updateData,
            include: { mortgages: true },
        });

        const activeMortgages = prop.mortgages.filter((m) => m.is_active);
        const totalMortgageBalance = activeMortgages.reduce(
            (sum, m) => sum + m.current_balance,
            0,
        );
        const equity = prop.current_value - totalMortgageBalance;

        return NextResponse.json({
            id: prop.id,
            name: prop.name,
            address: prop.address,
            property_type: prop.property_type,
            purchase_price: prop.purchase_price,
            purchase_date: prop.purchase_date,
            current_value: prop.current_value,
            currency: prop.currency,
            provider_property_id: prop.provider_property_id,
            valuation_provider: prop.valuation_provider,
            created_at: prop.created_at.toISOString(),
            updated_at: prop.updated_at.toISOString(),
            mortgages: prop.mortgages.map(mortgageToJson),
            total_mortgage_balance: totalMortgageBalance,
            equity,
        });
    } catch (error) {
        console.error('Error updating property:', error);
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
    const { userId } = await auth();
    if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { id: rawId } = await context.params;
        const id = Number(rawId);
        if (isNaN(id)) {
            return NextResponse.json(
                { detail: 'Invalid property id' },
                { status: 400 },
            );
        }

        const existing = await prisma.property.findUnique({ where: { id } });
        if (!existing || existing.user_id !== userId) {
            return NextResponse.json(
                { detail: 'Property not found' },
                { status: 404 },
            );
        }

        // Delete mortgages first (cascade should handle it, but be explicit)
        await prisma.mortgage.deleteMany({ where: { property_id: id } });
        await prisma.property.delete({ where: { id } });

        return NextResponse.json({ message: 'Property deleted', id });
    } catch (error) {
        console.error('Error deleting property:', error);
        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 },
        );
    }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface MortgageRow {
    id: number;
    property_id: number;
    lender: string | null;
    original_principal: number;
    current_balance: number;
    interest_rate: number;
    monthly_payment: number;
    term_years: number;
    is_active: boolean;
    created_at: Date;
    updated_at: Date;
}

function mortgageToJson(m: MortgageRow) {
    return {
        id: m.id,
        property_id: m.property_id,
        lender: m.lender,
        original_principal: m.original_principal,
        current_balance: m.current_balance,
        interest_rate: m.interest_rate,
        monthly_payment: m.monthly_payment,
        term_years: m.term_years,
        is_active: m.is_active,
        created_at: m.created_at.toISOString(),
        updated_at: m.updated_at.toISOString(),
    };
}
