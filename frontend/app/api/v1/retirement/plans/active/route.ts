import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/v1/retirement/plans/active — get the active plan
export async function GET() {
  try {
    const plan = await prisma.retirementPlan.findFirst({
      where: { is_active: true },
    });

    if (!plan) {
      return NextResponse.json({ detail: 'No active retirement plan' }, { status: 404 });
    }

    return NextResponse.json(plan);
  } catch (e) {
    console.error('Failed to get active retirement plan:', e);
    return NextResponse.json({ error: 'Failed to get active retirement plan' }, { status: 500 });
  }
}
