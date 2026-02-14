import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { createRetirementPlanSchema } from '@/lib/validators/shared';

// GET /api/v1/retirement/plans — list all plans
export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const plans = await prisma.retirementPlan.findMany({
      where: { user_id: userId },
      orderBy: { created_at: 'desc' },
    });
    return NextResponse.json(plans);
  } catch (e) {
    console.error('Failed to list retirement plans:', e);
    return NextResponse.json({ error: 'Failed to list retirement plans' }, { status: 500 });
  }
}

// POST /api/v1/retirement/plans — create a new plan
export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = createRetirementPlanSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { detail: parsed.error.issues.map((e: { message: string }) => e.message).join(', ') },
        { status: 422 },
      );
    }

    // Validate config_json is valid JSON
    try {
      JSON.parse(parsed.data.config_json);
    } catch {
      return NextResponse.json({ detail: 'config_json must be valid JSON' }, { status: 422 });
    }

    const plan = await prisma.retirementPlan.create({
      data: {
        user_id: userId,
        name: parsed.data.name,
        description: parsed.data.description || null,
        mode: parsed.data.mode,
        config_json: parsed.data.config_json,
        is_active: false,
      },
    });

    return NextResponse.json(plan, { status: 201 });
  } catch (e) {
    const msg = String(e);
    if (msg.includes('Unique constraint')) {
      return NextResponse.json({ detail: 'A plan with that name already exists' }, { status: 409 });
    }
    console.error('Failed to create retirement plan:', e);
    return NextResponse.json({ error: 'Failed to create retirement plan' }, { status: 500 });
  }
}
