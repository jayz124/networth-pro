import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// POST /api/v1/budget/ai/detect-subscriptions — detect recurring transactions
export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const months = Math.min(parseInt(searchParams.get('months') || '6', 10), 24);

    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);

    const transactions = await prisma.transaction.findMany({
      where: {
        date: { gte: startDate },
        amount: { lt: 0 }, // Only expenses
      },
      select: {
        description: true,
        merchant: true,
        amount: true,
        date: true,
      },
      orderBy: { date: 'asc' },
    });

    if (transactions.length === 0) {
      return NextResponse.json({ detected: [] });
    }

    // Group by similar description/merchant
    const groups: Record<string, Array<{ description: string; merchant: string | null; amount: number; date: Date }>> = {};

    for (const txn of transactions) {
      const desc = txn.description.toLowerCase();
      const merchant = txn.merchant?.toLowerCase() || '';
      // Normalize key: remove numbers and special chars
      let key = `${merchant} ${desc}`.replace(/[0-9#*\-_]+/g, '').trim();
      key = key.replace(/\s+/g, ' ');
      if (key.length >= 3) {
        if (!groups[key]) groups[key] = [];
        groups[key].push(txn);
      }
    }

    const detected: Array<{
      name: string;
      amount: number;
      frequency: string;
      occurrences: number;
      last_date: string;
      sample_description: string;
    }> = [];

    for (const [, txns] of Object.entries(groups)) {
      if (txns.length < 2) continue;

      // Check amounts are similar
      const amounts = txns.map((t) => Math.abs(t.amount));
      const avgAmount = amounts.reduce((s, a) => s + a, 0) / amounts.length;
      if (avgAmount === 0) continue;

      const variance = Math.max(...amounts) - Math.min(...amounts);
      if (variance / avgAmount > 0.1) continue; // More than 10% variance

      // Determine frequency by date intervals
      const dates = txns.map((t) => new Date(t.date)).sort((a, b) => a.getTime() - b.getTime());
      if (dates.length < 2) continue;

      const intervals: number[] = [];
      for (let i = 1; i < dates.length; i++) {
        intervals.push(Math.round((dates[i].getTime() - dates[i - 1].getTime()) / (1000 * 60 * 60 * 24)));
      }

      const avgInterval = intervals.reduce((s, i) => s + i, 0) / intervals.length;
      let frequency: string;

      if (avgInterval >= 25 && avgInterval <= 35) frequency = 'monthly';
      else if (avgInterval >= 350 && avgInterval <= 380) frequency = 'yearly';
      else if (avgInterval >= 12 && avgInterval <= 16) frequency = 'biweekly';
      else if (avgInterval >= 6 && avgInterval <= 8) frequency = 'weekly';
      else continue; // Irregular

      const latest = txns[txns.length - 1];
      detected.push({
        name: latest.merchant || latest.description.slice(0, 50),
        amount: Math.round(avgAmount * 100) / 100,
        frequency,
        occurrences: txns.length,
        last_date: new Date(dates[dates.length - 1]).toISOString().split('T')[0],
        sample_description: latest.description,
      });
    }

    // Sort by amount descending
    detected.sort((a, b) => b.amount - a.amount);

    return NextResponse.json({ detected });
  } catch (e) {
    console.error('Failed to detect subscriptions:', e);
    return NextResponse.json({ error: 'Failed to detect subscriptions' }, { status: 500 });
  }
}
