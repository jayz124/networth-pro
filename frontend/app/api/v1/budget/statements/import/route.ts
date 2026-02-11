import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

interface ImportTransaction {
  date: string;
  description: string;
  amount: number;
  category_id?: number | null;
  account_id?: number | null;
  merchant?: string | null;
  notes?: string | null;
  is_recurring?: boolean;
}

// POST /api/v1/budget/statements/import — import parsed transactions
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { transactions, account_id, skip_duplicates } = body as {
      transactions: ImportTransaction[];
      account_id?: number;
      skip_duplicates?: boolean;
    };

    if (!transactions || !Array.isArray(transactions) || transactions.length === 0) {
      return NextResponse.json({ detail: 'No transactions to import' }, { status: 400 });
    }

    // Validate account if provided
    if (account_id) {
      const acct = await prisma.account.findUnique({ where: { id: account_id } });
      if (!acct) {
        return NextResponse.json({ detail: 'Account not found' }, { status: 404 });
      }
    }

    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (let i = 0; i < transactions.length; i++) {
      const txn = transactions[i];

      if (!txn.date || !txn.description || txn.amount === undefined) {
        errors.push(`Transaction ${i}: missing required fields (date, description, amount)`);
        continue;
      }

      try {
        const txnDate = new Date(txn.date);
        if (isNaN(txnDate.getTime())) {
          errors.push(`Transaction ${i}: invalid date '${txn.date}'`);
          continue;
        }

        // Duplicate check
        if (skip_duplicates !== false) {
          const existing = await prisma.transaction.findFirst({
            where: {
              date: txnDate,
              description: txn.description,
              amount: txn.amount,
            },
          });
          if (existing) {
            skipped++;
            continue;
          }
        }

        await prisma.transaction.create({
          data: {
            date: txnDate,
            description: txn.description.slice(0, 500),
            amount: txn.amount,
            category_id: txn.category_id || null,
            account_id: account_id || txn.account_id || null,
            merchant: txn.merchant?.slice(0, 200) || null,
            notes: txn.notes?.slice(0, 1000) || null,
            is_recurring: txn.is_recurring || false,
          },
        });
        imported++;
      } catch (e) {
        errors.push(`Transaction ${i}: ${String(e)}`);
      }
    }

    return NextResponse.json({
      imported,
      skipped,
      total: transactions.length,
      errors: errors.slice(0, 20), // Limit error messages
    });
  } catch (e) {
    console.error('Failed to import transactions:', e);
    return NextResponse.json({ error: 'Failed to import transactions' }, { status: 500 });
  }
}
