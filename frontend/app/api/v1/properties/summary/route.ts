/**
 * GET /api/v1/properties/summary — Portfolio-wide real estate summary
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
    try {
        const properties = await prisma.property.findMany();
        const mortgages = await prisma.mortgage.findMany();

        // Group mortgages by property
        const mortgagesByProperty = new Map<number, typeof mortgages>();
        for (const m of mortgages) {
            const list = mortgagesByProperty.get(m.property_id) ?? [];
            list.push(m);
            mortgagesByProperty.set(m.property_id, list);
        }

        let totalPropertyValue = 0;
        let totalMortgageBalance = 0;
        let totalEquity = 0;
        let totalMonthlyPayments = 0;
        let totalAppreciation = 0;

        const propertyBreakdown = properties.map((prop) => {
            const propMortgages = mortgagesByProperty.get(prop.id) ?? [];
            const active = propMortgages.filter((m) => m.is_active);
            const mortgageBalance = active.reduce(
                (sum, m) => sum + m.current_balance,
                0,
            );
            const monthlyPayment = active.reduce(
                (sum, m) => sum + m.monthly_payment,
                0,
            );
            const equity = prop.current_value - mortgageBalance;
            const appreciation = prop.current_value - prop.purchase_price;

            totalPropertyValue += prop.current_value;
            totalMortgageBalance += mortgageBalance;
            totalEquity += equity;
            totalMonthlyPayments += monthlyPayment;
            totalAppreciation += appreciation;

            return {
                id: prop.id,
                name: prop.name,
                property_type: prop.property_type,
                current_value: prop.current_value,
                mortgage_balance: mortgageBalance,
                equity,
                appreciation,
            };
        });

        return NextResponse.json({
            total_property_value: totalPropertyValue,
            total_mortgage_balance: totalMortgageBalance,
            total_equity: totalEquity,
            total_monthly_payments: totalMonthlyPayments,
            total_appreciation: totalAppreciation,
            properties_count: properties.length,
            properties: propertyBreakdown,
        });
    } catch (error) {
        console.error('Error fetching real estate summary:', error);
        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 },
        );
    }
}
