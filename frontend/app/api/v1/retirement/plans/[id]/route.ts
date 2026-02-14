import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { updateRetirementPlanSchema } from '@/lib/validators/shared';

// GET /api/v1/retirement/plans/[id]
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const planId = parseInt(id, 10);
  if (isNaN(planId)) {
    return NextResponse.json({ detail: 'Invalid plan ID' }, { status: 400 });
  }

  try {
    const plan = await prisma.retirementPlan.findUnique({ where: { id: planId } });
    if (!plan || plan.user_id !== userId) {
      return NextResponse.json({ detail: 'Retirement plan not found' }, { status: 404 });
    }
    return NextResponse.json(plan);
  } catch (e) {
    console.error('Failed to get retirement plan:', e);
    return NextResponse.json({ error: 'Failed to get retirement plan' }, { status: 500 });
  }
}

// PUT /api/v1/retirement/plans/[id]
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const planId = parseInt(id, 10);
  if (isNaN(planId)) {
    return NextResponse.json({ detail: 'Invalid plan ID' }, { status: 400 });
  }

  try {
    const existing = await prisma.retirementPlan.findUnique({ where: { id: planId } });
    if (!existing || existing.user_id !== userId) {
      return NextResponse.json({ detail: 'Retirement plan not found' }, { status: 404 });
    }

    const body = await request.json();
    const parsed = updateRetirementPlanSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { detail: parsed.error.issues.map((e: { message: string }) => e.message).join(', ') },
        { status: 422 },
      );
    }

    // Validate config_json if provided
    if (parsed.data.config_json) {
      try {
        JSON.parse(parsed.data.config_json);
      } catch {
        return NextResponse.json({ detail: 'config_json must be valid JSON' }, { status: 422 });
      }
    }

    const updated = await prisma.retirementPlan.update({
      where: { id: planId },
      data: parsed.data,
    });

    return NextResponse.json(updated);
  } catch (e) {
    const msg = String(e);
    if (msg.includes('Unique constraint')) {
      return NextResponse.json({ detail: 'A plan with that name already exists' }, { status: 409 });
    }
    console.error('Failed to update retirement plan:', e);
    return NextResponse.json({ error: 'Failed to update retirement plan' }, { status: 500 });
  }
}

// DELETE /api/v1/retirement/plans/[id]
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const planId = parseInt(id, 10);
  if (isNaN(planId)) {
    return NextResponse.json({ detail: 'Invalid plan ID' }, { status: 400 });
  }

  try {
    const existing = await prisma.retirementPlan.findUnique({ where: { id: planId } });
    if (!existing || existing.user_id !== userId) {
      return NextResponse.json({ detail: 'Retirement plan not found' }, { status: 404 });
    }

    await prisma.retirementPlan.delete({ where: { id: planId } });
    return NextResponse.json({ status: 'deleted' });
  } catch (e) {
    console.error('Failed to delete retirement plan:', e);
    return NextResponse.json({ error: 'Failed to delete retirement plan' }, { status: 500 });
  }
}
