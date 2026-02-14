import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { aiCategorizeTransaction, isAIAvailable } from '@/lib/services/ai-insights';

// POST /api/v1/budget/ai/categorize — auto-categorize uncategorized transactions
export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const available = await isAIAvailable(userId);
    if (!available) {
      return NextResponse.json(
        { detail: 'No AI provider configured. Set an API key in Settings.' },
        { status: 400 },
      );
    }

    const body = await request.json().catch(() => ({}));
    const limit = (body.limit as number) || 50;
    const transactionIds = body.transaction_ids as number[] | undefined;

    // Get categories
    const categories = await prisma.budgetCategory.findMany({
      where: { user_id: userId },
    });
    if (categories.length === 0) {
      return NextResponse.json(
        { detail: 'No budget categories defined. Create some categories first.' },
        { status: 400 },
      );
    }

    const categoryNames = categories.map((c) => c.name);

    // Get uncategorized transactions (or specific IDs)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: Record<string, any> = { user_id: userId };
    if (transactionIds && transactionIds.length > 0) {
      where.id = { in: transactionIds };
    } else {
      where.category_id = null;
    }

    const transactions = await prisma.transaction.findMany({
      where,
      take: limit,
      orderBy: { date: 'desc' },
    });

    if (transactions.length === 0) {
      return NextResponse.json({
        processed: 0,
        updated: 0,
        results: [],
      });
    }

    // Categorize each transaction
    const results: Array<{
      transaction_id: number;
      category_name: string | null;
      confidence: number;
      reasoning: string;
      applied: boolean;
    }> = [];

    const categoryMap = new Map(categories.map((c) => [c.name, c.id]));
    let categorized = 0;

    for (const txn of transactions) {
      const result = await aiCategorizeTransaction(
        txn.description,
        txn.merchant,
        txn.amount,
        categoryNames,
      );

      if (result && result.confidence >= 0.7) {
        const catId = categoryMap.get(result.category_name);
        if (catId) {
          await prisma.transaction.update({
            where: { id: txn.id },
            data: {
              category_id: catId,
              ai_categorized: true,
            },
          });
          categorized++;
          results.push({
            transaction_id: txn.id,
            category_name: result.category_name,
            confidence: result.confidence,
            reasoning: result.reasoning,
            applied: true,
          });
        }
      } else if (result) {
        results.push({
          transaction_id: txn.id,
          category_name: result.category_name,
          confidence: result.confidence,
          reasoning: result.reasoning,
          applied: false,
        });
      }
    }

    return NextResponse.json({
      processed: transactions.length,
      updated: categorized,
      results,
    });
  } catch (e) {
    console.error('Failed to AI categorize:', e);
    return NextResponse.json({ error: 'Failed to categorize transactions' }, { status: 500 });
  }
}
