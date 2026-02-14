import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { updateCategorySchema } from '@/lib/validators/shared';

// PUT /api/v1/budget/categories/[id]
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const catId = parseInt(id, 10);
  if (isNaN(catId)) {
    return NextResponse.json({ detail: 'Invalid category ID' }, { status: 400 });
  }

  try {
    const existing = await prisma.budgetCategory.findFirst({ where: { id: catId, user_id: userId } });
    if (!existing) {
      return NextResponse.json({ detail: 'Category not found' }, { status: 404 });
    }

    const body = await request.json();
    const parsed = updateCategorySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { detail: parsed.error.issues.map((e: { message: string }) => e.message).join(', ') },
        { status: 422 },
      );
    }

    const updated = await prisma.budgetCategory.update({
      where: { id: catId },
      data: parsed.data,
    });

    return NextResponse.json(updated);
  } catch (e) {
    const msg = String(e);
    if (msg.includes('Unique constraint')) {
      return NextResponse.json({ detail: 'A category with that name already exists' }, { status: 409 });
    }
    console.error('Failed to update budget category:', e);
    return NextResponse.json({ error: 'Failed to update budget category' }, { status: 500 });
  }
}

// DELETE /api/v1/budget/categories/[id]
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const catId = parseInt(id, 10);
  if (isNaN(catId)) {
    return NextResponse.json({ detail: 'Invalid category ID' }, { status: 400 });
  }

  try {
    const existing = await prisma.budgetCategory.findFirst({ where: { id: catId, user_id: userId } });
    if (!existing) {
      return NextResponse.json({ detail: 'Category not found' }, { status: 404 });
    }

    await prisma.budgetCategory.delete({ where: { id: catId } });
    return NextResponse.json({ status: 'deleted' });
  } catch (e) {
    console.error('Failed to delete budget category:', e);
    return NextResponse.json({ error: 'Failed to delete budget category' }, { status: 500 });
  }
}
