import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { updateTransactionSchema } from '@/lib/validators/shared';

// PUT /api/v1/budget/transactions/[id]
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const txnId = parseInt(id, 10);
  if (isNaN(txnId)) {
    return NextResponse.json({ detail: 'Invalid transaction ID' }, { status: 400 });
  }

  try {
    const existing = await prisma.transaction.findUnique({ where: { id: txnId } });
    if (!existing) {
      return NextResponse.json({ detail: 'Transaction not found' }, { status: 404 });
    }

    const body = await request.json();
    const parsed = updateTransactionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { detail: parsed.error.issues.map((e: { message: string }) => e.message).join(', ') },
        { status: 422 },
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: Record<string, any> = { ...parsed.data };
    if (parsed.data.date) {
      updateData.date = new Date(parsed.data.date);
    }

    const updated = await prisma.transaction.update({
      where: { id: txnId },
      data: updateData,
      include: {
        category: { select: { id: true, name: true, icon: true, color: true, is_income: true } },
        account: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json(updated);
  } catch (e) {
    console.error('Failed to update transaction:', e);
    return NextResponse.json({ error: 'Failed to update transaction' }, { status: 500 });
  }
}

// DELETE /api/v1/budget/transactions/[id]
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const txnId = parseInt(id, 10);
  if (isNaN(txnId)) {
    return NextResponse.json({ detail: 'Invalid transaction ID' }, { status: 400 });
  }

  try {
    const existing = await prisma.transaction.findUnique({ where: { id: txnId } });
    if (!existing) {
      return NextResponse.json({ detail: 'Transaction not found' }, { status: 404 });
    }

    await prisma.transaction.delete({ where: { id: txnId } });
    return NextResponse.json({ status: 'deleted' });
  } catch (e) {
    console.error('Failed to delete transaction:', e);
    return NextResponse.json({ error: 'Failed to delete transaction' }, { status: 500 });
  }
}
