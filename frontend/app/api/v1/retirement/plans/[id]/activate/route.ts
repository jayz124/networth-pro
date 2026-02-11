import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// POST /api/v1/retirement/plans/[id]/activate — activate a plan (deactivating all others)
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const planId = parseInt(id, 10);
  if (isNaN(planId)) {
    return NextResponse.json({ detail: 'Invalid plan ID' }, { status: 400 });
  }

  try {
    const plan = await prisma.retirementPlan.findUnique({ where: { id: planId } });
    if (!plan) {
      return NextResponse.json({ detail: 'Retirement plan not found' }, { status: 404 });
    }

    // Deactivate all plans, then activate the selected one
    await prisma.$transaction([
      prisma.retirementPlan.updateMany({
        where: { is_active: true },
        data: { is_active: false },
      }),
      prisma.retirementPlan.update({
        where: { id: planId },
        data: { is_active: true },
      }),
    ]);

    const updated = await prisma.retirementPlan.findUnique({ where: { id: planId } });
    return NextResponse.json(updated);
  } catch (e) {
    console.error('Failed to activate retirement plan:', e);
    return NextResponse.json({ error: 'Failed to activate retirement plan' }, { status: 500 });
  }
}
