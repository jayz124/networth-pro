import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';

// GET /api/v1/retirement/plans/active — get the active plan
export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const plan = await prisma.retirementPlan.findFirst({
      where: { is_active: true, user_id: userId },
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
