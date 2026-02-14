import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { aiReviewTransactions, isAIAvailable } from '@/lib/services/ai-insights';

// POST /api/v1/budget/statements/ai-review — AI review parsed transactions
export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { transactions } = body as {
      transactions: Array<Record<string, unknown>>;
    };

    if (!transactions || !Array.isArray(transactions) || transactions.length === 0) {
      return NextResponse.json({ detail: 'No transactions to review' }, { status: 400 });
    }

    const available = await isAIAvailable(userId);
    if (!available) {
      // Return transactions unchanged with a warning
      return NextResponse.json({
        transactions: transactions.map((t) => ({ ...t, ai_reviewed: false })),
        ai_available: false,
        message: 'AI not configured. Transactions returned without AI review.',
      });
    }

    // Get categories for AI to use
    const categories = await prisma.budgetCategory.findMany({
      where: { user_id: userId },
      select: { id: true, name: true, is_income: true },
    });

    if (categories.length === 0) {
      return NextResponse.json({
        transactions: transactions.map((t) => ({ ...t, ai_reviewed: false })),
        ai_available: true,
        message: 'No categories defined. Create budget categories first for AI review.',
      });
    }

    const enhanced = await aiReviewTransactions(transactions, categories);

    return NextResponse.json({
      transactions: enhanced,
      ai_available: true,
      message: `Reviewed ${enhanced.filter((t) => t.ai_reviewed).length} of ${transactions.length} transactions`,
    });
  } catch (e) {
    console.error('Failed to AI review transactions:', e);
    return NextResponse.json({ error: 'Failed to AI review transactions' }, { status: 500 });
  }
}
