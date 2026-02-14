import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { createCategorySchema } from '@/lib/validators/shared';

// GET /api/v1/budget/categories — list all categories
export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const categories = await prisma.budgetCategory.findMany({
      where: { user_id: userId },
      orderBy: { name: 'asc' },
    });
    return NextResponse.json(categories);
  } catch (e) {
    console.error('Failed to list budget categories:', e);
    return NextResponse.json({ error: 'Failed to list budget categories' }, { status: 500 });
  }
}

// POST /api/v1/budget/categories — create a new category
export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = createCategorySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { detail: parsed.error.issues.map((e: { message: string }) => e.message).join(', ') },
        { status: 422 },
      );
    }

    const category = await prisma.budgetCategory.create({
      data: {
        user_id: userId,
        name: parsed.data.name,
        icon: parsed.data.icon || null,
        color: parsed.data.color || null,
        budget_limit: parsed.data.budget_limit || null,
        is_income: parsed.data.is_income,
      },
    });

    return NextResponse.json(category, { status: 201 });
  } catch (e) {
    const msg = String(e);
    if (msg.includes('Unique constraint')) {
      return NextResponse.json({ detail: 'A category with that name already exists' }, { status: 409 });
    }
    console.error('Failed to create budget category:', e);
    return NextResponse.json({ error: 'Failed to create budget category' }, { status: 500 });
  }
}
