import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/v1/accounts/summary
 * Aggregate summary of all accounts: total balance, grouped by type and institution.
 */
export async function GET() {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const accounts = await prisma.account.findMany({
            where: { user_id: userId },
            include: {
                balance_snapshots: {
                    orderBy: { date: 'desc' },
                    take: 1,
                },
            },
        });

        let total_balance = 0.0;
        const byType: Record<string, number> = {};
        const byInstitution: Record<string, number> = {};

        for (const account of accounts) {
            const balance = account.balance_snapshots[0]?.amount ?? 0.0;
            total_balance += balance;

            // Group by type
            byType[account.type] = (byType[account.type] ?? 0) + balance;

            // Group by institution
            const inst = account.institution || 'Other';
            byInstitution[inst] = (byInstitution[inst] ?? 0) + balance;
        }

        return NextResponse.json({
            total_balance,
            accounts_count: accounts.length,
            by_type: Object.entries(byType).map(([type, balance]) => ({
                type,
                balance,
            })),
            by_institution: Object.entries(byInstitution).map(
                ([institution, balance]) => ({
                    institution,
                    balance,
                }),
            ),
        });
    } catch (error) {
        console.error('Error fetching accounts summary:', error);
        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 },
        );
    }
}
