import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { createTransactionSchema } from '@/lib/validators/shared';

// GET /api/v1/budget/transactions — list transactions with optional filters
export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    const categoryId = searchParams.get('category_id');
    const accountId = searchParams.get('account_id');
    const limit = parseInt(searchParams.get('limit') || '500', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const search = searchParams.get('search');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: Record<string, any> = { user_id: userId };

    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        if (!endDate.includes('T')) {
          end.setHours(23, 59, 59, 999);
        }
        where.date.lte = end;
      }
    }
    if (categoryId) where.category_id = parseInt(categoryId, 10);
    if (accountId) where.account_id = parseInt(accountId, 10);
    if (search) {
      where.OR = [
        { description: { contains: search } },
        { merchant: { contains: search } },
        { notes: { contains: search } },
      ];
    }

    const transactions = await prisma.transaction.findMany({
      where,
      include: {
        category: { select: { id: true, name: true, icon: true, color: true, is_income: true } },
        account: { select: { id: true, name: true } },
      },
      orderBy: { date: 'desc' },
      take: limit,
      skip: offset,
    });

    return NextResponse.json(transactions);
  } catch (e) {
    console.error('Failed to list transactions:', e);
    return NextResponse.json({ error: 'Failed to list transactions' }, { status: 500 });
  }
}

// POST /api/v1/budget/transactions — create a new transaction
export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = createTransactionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { detail: parsed.error.issues.map((e: { message: string }) => e.message).join(', ') },
        { status: 422 },
      );
    }

    // Validate category exists if provided
    if (parsed.data.category_id) {
      const cat = await prisma.budgetCategory.findFirst({ where: { id: parsed.data.category_id, user_id: userId } });
      if (!cat) {
        return NextResponse.json({ detail: 'Category not found' }, { status: 404 });
      }
    }

    // Validate account exists if provided
    if (parsed.data.account_id) {
      const acct = await prisma.account.findUnique({ where: { id: parsed.data.account_id } });
      if (!acct) {
        return NextResponse.json({ detail: 'Account not found' }, { status: 404 });
      }
    }

    const transaction = await prisma.transaction.create({
      data: {
        user_id: userId,
        date: new Date(parsed.data.date),
        description: parsed.data.description,
        amount: parsed.data.amount,
        category_id: parsed.data.category_id || null,
        account_id: parsed.data.account_id || null,
        is_recurring: parsed.data.is_recurring,
        recurrence_frequency: parsed.data.recurrence_frequency || null,
        merchant: parsed.data.merchant || null,
        notes: parsed.data.notes || null,
      },
      include: {
        category: { select: { id: true, name: true, icon: true, color: true, is_income: true } },
        account: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json(transaction, { status: 201 });
  } catch (e) {
    console.error('Failed to create transaction:', e);
    return NextResponse.json({ error: 'Failed to create transaction' }, { status: 500 });
  }
}
