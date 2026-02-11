/**
 * GET  /api/v1/properties  — List all properties with mortgages + computed fields
 * POST /api/v1/properties  — Create a new property
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createPropertySchema } from '@/lib/validators/shared';

export async function GET() {
    try {
        const properties = await prisma.property.findMany({
            include: {
                mortgages: true,
                valuations: true,
            },
        });

        const results = properties.map((prop) => {
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

            const cachedVal = prop.valuations[0] ?? null;

            const entry: Record<string, unknown> = {
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
                total_mortgage_balance: totalMortgageBalance,
                equity,
                monthly_payments: monthlyPayments,
                mortgages: prop.mortgages.map(mortgageToJson),
                appreciation,
                appreciation_percent: appreciationPercent,
            };

            if (cachedVal) {
                entry.estimated_rent_monthly = cachedVal.estimated_rent_monthly;
                entry.value_range_low = cachedVal.value_range_low;
                entry.value_range_high = cachedVal.value_range_high;
                entry.rent_range_low = cachedVal.rent_range_low;
                entry.rent_range_high = cachedVal.rent_range_high;
                entry.bedrooms = cachedVal.bedrooms;
                entry.bathrooms = cachedVal.bathrooms;
                entry.square_footage = cachedVal.square_footage;
                entry.year_built = cachedVal.year_built;
                entry.valuation_fetched_at = cachedVal.fetched_at
                    ? cachedVal.fetched_at.toISOString()
                    : null;
            }

            return entry;
        });

        return NextResponse.json(results);
    } catch (error) {
        console.error('Error listing properties:', error);
        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 },
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const parsed = createPropertySchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { detail: parsed.error.issues[0]?.message ?? 'Validation error' },
                { status: 400 },
            );
        }

        const data = parsed.data;

        const prop = await prisma.property.create({
            data: {
                name: data.name,
                address: data.address,
                property_type: data.property_type,
                purchase_price: data.purchase_price,
                purchase_date: data.purchase_date ?? null,
                current_value: data.current_value,
                currency: data.currency,
                provider_property_id: data.provider_property_id ?? null,
                valuation_provider: data.valuation_provider ?? null,
            },
        });

        return NextResponse.json(
            {
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
                mortgages: [],
                total_mortgage_balance: 0,
                equity: prop.current_value,
                monthly_payments: 0,
            },
            { status: 201 },
        );
    } catch (error) {
        console.error('Error creating property:', error);
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
