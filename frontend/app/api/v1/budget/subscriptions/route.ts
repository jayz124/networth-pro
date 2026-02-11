import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createSubscriptionSchema } from '@/lib/validators/shared';

// GET /api/v1/budget/subscriptions — list all subscriptions
export async function GET() {
  try {
    const subscriptions = await prisma.subscription.findMany({
      include: {
        category: { select: { id: true, name: true, icon: true, color: true } },
      },
      orderBy: { name: 'asc' },
    });
    return NextResponse.json(subscriptions);
  } catch (e) {
    console.error('Failed to list subscriptions:', e);
    return NextResponse.json({ error: 'Failed to list subscriptions' }, { status: 500 });
  }
}

// POST /api/v1/budget/subscriptions — create a new subscription
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = createSubscriptionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { detail: parsed.error.issues.map((e: { message: string }) => e.message).join(', ') },
        { status: 422 },
      );
    }

    // Validate category exists if provided
    if (parsed.data.category_id) {
      const cat = await prisma.budgetCategory.findUnique({ where: { id: parsed.data.category_id } });
      if (!cat) {
        return NextResponse.json({ detail: 'Category not found' }, { status: 404 });
      }
    }

    const subscription = await prisma.subscription.create({
      data: {
        name: parsed.data.name,
        amount: parsed.data.amount,
        frequency: parsed.data.frequency,
        category_id: parsed.data.category_id || null,
        next_billing_date: parsed.data.next_billing_date
          ? new Date(parsed.data.next_billing_date)
          : null,
        is_active: parsed.data.is_active,
      },
      include: {
        category: { select: { id: true, name: true, icon: true, color: true } },
      },
    });

    return NextResponse.json(subscription, { status: 201 });
  } catch (e) {
    console.error('Failed to create subscription:', e);
    return NextResponse.json({ error: 'Failed to create subscription' }, { status: 500 });
  }
}
