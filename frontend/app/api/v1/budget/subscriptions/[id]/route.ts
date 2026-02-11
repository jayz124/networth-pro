import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { updateSubscriptionSchema } from '@/lib/validators/shared';

// PUT /api/v1/budget/subscriptions/[id]
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const subId = parseInt(id, 10);
  if (isNaN(subId)) {
    return NextResponse.json({ detail: 'Invalid subscription ID' }, { status: 400 });
  }

  try {
    const existing = await prisma.subscription.findUnique({ where: { id: subId } });
    if (!existing) {
      return NextResponse.json({ detail: 'Subscription not found' }, { status: 404 });
    }

    const body = await request.json();
    const parsed = updateSubscriptionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { detail: parsed.error.issues.map((e: { message: string }) => e.message).join(', ') },
        { status: 422 },
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: Record<string, any> = { ...parsed.data };
    if (parsed.data.next_billing_date) {
      updateData.next_billing_date = new Date(parsed.data.next_billing_date);
    }

    const updated = await prisma.subscription.update({
      where: { id: subId },
      data: updateData,
      include: {
        category: { select: { id: true, name: true, icon: true, color: true } },
      },
    });

    return NextResponse.json(updated);
  } catch (e) {
    console.error('Failed to update subscription:', e);
    return NextResponse.json({ error: 'Failed to update subscription' }, { status: 500 });
  }
}

// DELETE /api/v1/budget/subscriptions/[id]
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const subId = parseInt(id, 10);
  if (isNaN(subId)) {
    return NextResponse.json({ detail: 'Invalid subscription ID' }, { status: 400 });
  }

  try {
    const existing = await prisma.subscription.findUnique({ where: { id: subId } });
    if (!existing) {
      return NextResponse.json({ detail: 'Subscription not found' }, { status: 404 });
    }

    await prisma.subscription.delete({ where: { id: subId } });
    return NextResponse.json({ status: 'deleted' });
  } catch (e) {
    console.error('Failed to delete subscription:', e);
    return NextResponse.json({ error: 'Failed to delete subscription' }, { status: 500 });
  }
}
