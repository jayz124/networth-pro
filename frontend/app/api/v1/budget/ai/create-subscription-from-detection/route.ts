import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// POST /api/v1/budget/ai/create-subscription — create subscription from detected pattern
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, amount, frequency, category_id } = body;

    if (!name || !amount || !frequency) {
      return NextResponse.json(
        { detail: 'name, amount, and frequency are required' },
        { status: 422 },
      );
    }

    if (!['monthly', 'yearly'].includes(frequency)) {
      return NextResponse.json(
        { detail: 'frequency must be "monthly" or "yearly"' },
        { status: 422 },
      );
    }

    // Validate category if provided
    if (category_id) {
      const cat = await prisma.budgetCategory.findUnique({ where: { id: category_id } });
      if (!cat) {
        return NextResponse.json({ detail: 'Category not found' }, { status: 404 });
      }
    }

    // Calculate next billing date (assume next month for monthly, next year for yearly)
    const nextBilling = new Date();
    if (frequency === 'monthly') {
      nextBilling.setMonth(nextBilling.getMonth() + 1);
    } else {
      nextBilling.setFullYear(nextBilling.getFullYear() + 1);
    }

    const subscription = await prisma.subscription.create({
      data: {
        name: String(name).slice(0, 200),
        amount: Math.abs(Number(amount)),
        frequency,
        category_id: category_id || null,
        next_billing_date: nextBilling,
        is_active: true,
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
