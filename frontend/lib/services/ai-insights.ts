/**
 * AI-powered insights service.
 * Supports multiple providers via the ai-service abstraction layer.
 * Features:
 * - Robust error handling with retries
 * - Structured JSON responses
 * - Caching for common patterns
 * - Rule-based fallbacks when AI is unavailable
 */
import {
  chatCompletionWithRetry,
  parseJsonResponse,
  resolveProvider,
} from '@/lib/services/ai-service';
import crypto from 'crypto';

// ============================================
// Types
// ============================================

export interface Insight {
  type: 'warning' | 'tip' | 'positive' | 'anomaly' | 'milestone' | 'trend';
  title: string;
  description: string;
}

export interface Story {
  type: string;
  emoji: string;
  headline: string;
  narrative: string;
  data_points: string[];
}

export interface TrendAnalysis {
  trend: string;
  trend_description: string;
  next_month_prediction?: { income: number; expenses: number };
  key_observations: string[];
  recommendations: string[];
}

// ============================================
// Simple in-memory cache for categorizations
// ============================================

const _categorizationCache = new Map<string, { result: Record<string, unknown>; cachedAt: number }>();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

function getCacheKey(description: string, merchant: string | null, amount: number): string {
  const normalized = `${description.toLowerCase().trim()}|${(merchant || '').toLowerCase().trim()}|${amount > 0}`;
  return crypto.createHash('md5').update(normalized).digest('hex');
}

function getCachedCategorization(cacheKey: string): Record<string, unknown> | null {
  const entry = _categorizationCache.get(cacheKey);
  if (entry && Date.now() - entry.cachedAt < CACHE_TTL) {
    return entry.result;
  }
  if (entry) _categorizationCache.delete(cacheKey);
  return null;
}

function cacheCategorization(cacheKey: string, result: Record<string, unknown>): void {
  _categorizationCache.set(cacheKey, { result, cachedAt: Date.now() });
  if (_categorizationCache.size > 1000) {
    const entries = Array.from(_categorizationCache.entries());
    entries.sort((a, b) => a[1].cachedAt - b[1].cachedAt);
    for (let i = 0; i < 100; i++) {
      _categorizationCache.delete(entries[i][0]);
    }
  }
}

// ============================================
// AI availability check
// ============================================

export async function isAIAvailable(userId?: string): Promise<boolean> {
  const { apiKey } = await resolveProvider(userId);
  return Boolean(apiKey);
}

// ============================================
// AI Categorize Transaction
// ============================================

export async function aiCategorizeTransaction(
  description: string,
  merchant: string | null,
  amount: number,
  availableCategories: string[],
): Promise<{ category_name: string; confidence: number; reasoning: string } | null> {
  const cacheKey = getCacheKey(description, merchant, amount);
  const cached = getCachedCategorization(cacheKey);
  if (cached) return cached as { category_name: string; confidence: number; reasoning: string };

  const safeDescription = JSON.stringify(description).slice(1, -1);
  const safeMerchant = JSON.stringify(merchant || 'Unknown').slice(1, -1);

  const systemPrompt = `You are a financial transaction categorizer. Your task is to categorize transactions into one of the provided categories.

Rules:
- Consider the transaction description, merchant name, and amount
- Positive amounts are income, negative amounts are expenses
- Be precise - only use categories from the provided list
- Return valid JSON only, no other text`;

  const userPrompt = `Categorize this transaction:
- Description: ${safeDescription}
- Merchant: ${safeMerchant}
- Amount: $${Math.abs(amount).toFixed(2)} (${amount > 0 ? 'income' : 'expense'})

Available categories: ${availableCategories.join(', ')}

Respond with JSON: {"category": "exact_category_name", "confidence": 0.0-1.0, "reasoning": "brief explanation"}`;

  try {
    const resultText = await chatCompletionWithRetry(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      { temperature: 0.2, maxTokens: 150, jsonMode: true },
    );

    if (!resultText) return null;

    const parsed = parseJsonResponse(resultText) as Record<string, unknown>;
    const category = parsed.category as string;
    if (category && availableCategories.includes(category)) {
      const result = {
        category_name: category,
        confidence: Math.min(1.0, Math.max(0.0, Number(parsed.confidence ?? 0.8))),
        reasoning: String(parsed.reasoning ?? ''),
      };
      cacheCategorization(cacheKey, result);
      return result;
    }
    return null;
  } catch {
    return null;
  }
}

// ============================================
// Generate Spending Insights
// ============================================

export async function generateSpendingInsights(
  summary: Record<string, unknown>,
  transactions: Array<Record<string, unknown>>,
  previousMonthSummary?: Record<string, unknown> | null,
): Promise<Insight[]> {
  const available = await isAIAvailable();
  if (!available) {
    return generateBasicInsights(summary, previousMonthSummary, transactions);
  }

  const categoryBreakdown = (summary.by_category || []) as Array<Record<string, unknown>>;
  const totalIncome = (summary.total_income || 0) as number;
  const totalExpenses = (summary.total_expenses || 0) as number;
  const net = totalIncome - totalExpenses;
  const savingsRate = totalIncome > 0 ? (net / totalIncome) * 100 : 0;

  const categoryText = categoryBreakdown
    .slice(0, 10)
    .map(
      (c) =>
        `- ${c.category_name}: $${(c.expenses as number).toFixed(2)} (${c.transactions} transactions)` +
        (c.budget_limit ? ` [Budget: $${(c.budget_limit as number).toFixed(2)}]` : ''),
    )
    .join('\n');

  let comparisonText = '';
  if (previousMonthSummary) {
    const prevExpenses = (previousMonthSummary.total_expenses || 0) as number;
    const prevIncome = (previousMonthSummary.total_income || 0) as number;
    const expenseChange = totalExpenses - prevExpenses;
    const incomeChange = totalIncome - prevIncome;
    comparisonText = `
Month-over-Month:
- Expenses: ${expenseChange > 0 ? 'up' : 'down'} $${Math.abs(expenseChange).toFixed(2)} (${prevExpenses > 0 ? ((expenseChange / prevExpenses) * 100).toFixed(1) : 0}%)
- Income: ${incomeChange > 0 ? 'up' : 'down'} $${Math.abs(incomeChange).toFixed(2)}`;
  }

  const systemPrompt = `You are a personal finance advisor analyzing spending patterns. Provide actionable, specific insights.

Guidelines:
- Be encouraging but honest about concerning patterns
- Give specific, actionable advice (not generic tips)
- Reference actual numbers from the data
- Consider budget limits when mentioned
- Identify trends and patterns`;

  const userPrompt = `Analyze this monthly financial summary and provide 5-8 personalized insights.

SUMMARY:
- Total Income: $${totalIncome.toFixed(2)}
- Total Expenses: $${totalExpenses.toFixed(2)}
- Net Savings: $${net.toFixed(2)}
- Savings Rate: ${savingsRate.toFixed(1)}%
${comparisonText}

SPENDING BY CATEGORY:
${categoryText}

Provide insights as a JSON array with this exact format:
[
  {"type": "warning", "title": "Brief Title", "description": "Detailed explanation with specific numbers"},
  {"type": "tip", "title": "Brief Title", "description": "Actionable suggestion"},
  {"type": "positive", "title": "Brief Title", "description": "Encouragement for good behavior"}
]

Types: "warning", "tip", "positive", "anomaly", "milestone", "trend"

Return ONLY the JSON array.`;

  try {
    const resultText = await chatCompletionWithRetry(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      { temperature: 0.7, maxTokens: 1200, jsonMode: true },
    );

    if (!resultText) return generateBasicInsights(summary, previousMonthSummary, transactions);

    let parsed = parseJsonResponse(resultText);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      parsed = (parsed as Record<string, unknown>).insights || [];
    }

    const insights = parsed as Array<Record<string, unknown>>;
    const validated: Insight[] = [];
    for (const insight of insights) {
      if (typeof insight === 'object' && insight) {
        let type = (insight.type || 'tip') as string;
        if (!['warning', 'tip', 'positive', 'anomaly', 'milestone', 'trend'].includes(type)) {
          type = 'tip';
        }
        validated.push({
          type: type as Insight['type'],
          title: String(insight.title || 'Insight').slice(0, 50),
          description: String(insight.description || '').slice(0, 300),
        });
      }
    }
    if (validated.length) return validated.slice(0, 8);
    return generateBasicInsights(summary, previousMonthSummary, transactions);
  } catch {
    return generateBasicInsights(summary, previousMonthSummary, transactions);
  }
}

// ============================================
// Basic (rule-based) spending insights
// ============================================

export function generateBasicInsights(
  summary: Record<string, unknown>,
  previousMonthSummary?: Record<string, unknown> | null,
  transactions?: Array<Record<string, unknown>> | null,
): Insight[] {
  const insights: Insight[] = [];
  const totalIncome = (summary.total_income || 0) as number;
  const totalExpenses = (summary.total_expenses || 0) as number;
  const net = totalIncome - totalExpenses;

  // Savings rate insight
  if (totalIncome > 0) {
    const savingsRate = (net / totalIncome) * 100;
    if (savingsRate >= 20) {
      insights.push({
        type: 'positive',
        title: 'Excellent Savings Rate',
        description: `You're saving ${savingsRate.toFixed(1)}% of your income, which exceeds the recommended 20%. Keep up the great work!`,
      });
    } else if (savingsRate < 0) {
      insights.push({
        type: 'warning',
        title: 'Spending Exceeds Income',
        description: `Your expenses exceed your income by $${Math.abs(net).toFixed(2)}. Review your spending to identify areas to cut back.`,
      });
    } else if (savingsRate < 10) {
      insights.push({
        type: 'tip',
        title: 'Boost Your Savings',
        description: `Your savings rate is ${savingsRate.toFixed(1)}%. Try to increase it to 20% by reducing discretionary spending.`,
      });
    } else if (savingsRate < 20) {
      insights.push({
        type: 'tip',
        title: 'Good Progress on Savings',
        description: `You're saving ${savingsRate.toFixed(1)}% - aim for 20% to build a stronger financial cushion.`,
      });
    }

    if (savingsRate >= 30) {
      insights.push({
        type: 'milestone',
        title: 'Savings Superstar',
        description: `Your savings rate of ${savingsRate.toFixed(1)}% is in the top tier. You're saving nearly a third of your income!`,
      });
    }
  }

  // Milestone: positive net after deficit
  if (net > 0 && totalIncome > 0 && previousMonthSummary) {
    const prevNet =
      ((previousMonthSummary.total_income || 0) as number) -
      ((previousMonthSummary.total_expenses || 0) as number);
    if (prevNet <= 0) {
      insights.push({
        type: 'milestone',
        title: 'Back in the Green',
        description: `You've achieved positive net savings of $${net.toFixed(2)} this month after a deficit last month.`,
      });
    }
  }

  // Budget analysis
  const categories = (summary.by_category || []) as Array<Record<string, unknown>>;
  const overBudgetCategories: Array<[string, number, number]> = [];
  for (const cat of categories) {
    const expenses = (cat.expenses || 0) as number;
    const budget = cat.budget_limit as number | undefined;
    if (budget && expenses > budget) {
      const pctOver = ((expenses - budget) / budget) * 100;
      overBudgetCategories.push([cat.category_name as string, pctOver, expenses - budget]);
    }
  }

  if (overBudgetCategories.length > 0) {
    const worst = overBudgetCategories.reduce((a, b) => (a[2] > b[2] ? a : b));
    insights.push({
      type: 'warning',
      title: `Over Budget: ${worst[0]}`,
      description: `You've exceeded your ${worst[0]} budget by $${worst[2].toFixed(2)} (${worst[1].toFixed(0)}%). Consider adjusting your spending or budget.`,
    });
  }

  // Top spending category
  if (categories.length > 0) {
    const topCat = categories.reduce((a, b) =>
      ((a.expenses || 0) as number) > ((b.expenses || 0) as number) ? a : b,
    );
    const topExpenses = (topCat.expenses || 0) as number;
    if (topExpenses > 0 && totalExpenses > 0) {
      const pctOfTotal = (topExpenses / totalExpenses) * 100;
      if (pctOfTotal > 40) {
        insights.push({
          type: 'tip',
          title: `High Spending on ${topCat.category_name}`,
          description: `${topCat.category_name} accounts for ${pctOfTotal.toFixed(0)}% of your spending ($${topExpenses.toFixed(2)}). Look for ways to reduce this.`,
        });
      }
    }
  }

  // Anomaly detection
  if (categories.length > 0) {
    const expenseCats = categories.filter((c) => ((c.expenses || 0) as number) > 0);
    if (expenseCats.length >= 2) {
      const avgExpense =
        expenseCats.reduce((sum, c) => sum + ((c.expenses || 0) as number), 0) / expenseCats.length;
      for (const cat of expenseCats) {
        if (((cat.expenses || 0) as number) > avgExpense * 2) {
          insights.push({
            type: 'anomaly',
            title: `Unusual Spending: ${cat.category_name}`,
            description: `Spending on ${cat.category_name} ($${((cat.expenses || 0) as number).toFixed(2)}) is more than double the category average ($${avgExpense.toFixed(2)}).`,
          });
        }
      }
    }
  }

  // Trend: month-over-month direction
  if (previousMonthSummary) {
    const prevExpenses = (previousMonthSummary.total_expenses || 0) as number;
    if (prevExpenses > 0) {
      const changePct = ((totalExpenses - prevExpenses) / prevExpenses) * 100;
      if (changePct > 10) {
        insights.push({
          type: 'trend',
          title: 'Spending Trending Up',
          description: `Your expenses increased ${changePct.toFixed(1)}% compared to last month ($${prevExpenses.toFixed(2)} -> $${totalExpenses.toFixed(2)}).`,
        });
      } else if (changePct < -10) {
        insights.push({
          type: 'trend',
          title: 'Spending Trending Down',
          description: `Your expenses decreased ${Math.abs(changePct).toFixed(1)}% compared to last month ($${prevExpenses.toFixed(2)} -> $${totalExpenses.toFixed(2)}).`,
        });
      }
    }
  }

  // Subscription check
  for (const cat of categories) {
    if ((cat.category_name as string) === 'Subscriptions' && ((cat.expenses || 0) as number) > 100) {
      insights.push({
        type: 'tip',
        title: 'Review Your Subscriptions',
        description: `You're spending $${((cat.expenses || 0) as number).toFixed(2)}/month on subscriptions. Review for unused services you could cancel.`,
      });
      break;
    }
  }

  // 50/30/20 Rule
  if (totalIncome > 0 && totalExpenses > 0) {
    const needsKeywords = new Set([
      'housing', 'rent', 'mortgage', 'groceries', 'utilities', 'transportation',
      'insurance', 'health', 'medical', 'childcare', 'education',
    ]);
    const wantsKeywords = new Set([
      'dining', 'entertainment', 'shopping', 'subscriptions', 'travel',
      'personal', 'clothing', 'recreation', 'hobbies',
    ]);

    let needsTotal = 0;
    let wantsTotal = 0;
    for (const cat of categories) {
      const catName = ((cat.category_name || '') as string).toLowerCase();
      const catExpenses = (cat.expenses || 0) as number;
      if ([...needsKeywords].some((k) => catName.includes(k))) needsTotal += catExpenses;
      else if ([...wantsKeywords].some((k) => catName.includes(k))) wantsTotal += catExpenses;
    }

    const needsPct = totalIncome > 0 ? (needsTotal / totalIncome) * 100 : 0;
    const wantsPct = totalIncome > 0 ? (wantsTotal / totalIncome) * 100 : 0;
    const savingsPct = totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome) * 100 : 0;

    if (needsPct > 0 || wantsPct > 0) {
      const statusParts: string[] = [];
      if (needsPct > 50) statusParts.push(`needs at ${needsPct.toFixed(0)}% (target 50%)`);
      if (wantsPct > 30) statusParts.push(`wants at ${wantsPct.toFixed(0)}% (target 30%)`);

      if (statusParts.length > 0) {
        insights.push({
          type: 'tip',
          title: '50/30/20 Rule Check',
          description: `Your spending split: needs ${needsPct.toFixed(0)}%, wants ${wantsPct.toFixed(0)}%, savings ${savingsPct.toFixed(0)}%. Adjust ${statusParts.join(', ')} to get closer to the ideal 50/30/20 balance.`,
        });
      } else {
        insights.push({
          type: 'positive',
          title: '50/30/20 Rule: On Track',
          description: `Your spending split: needs ${needsPct.toFixed(0)}%, wants ${wantsPct.toFixed(0)}%, savings ${savingsPct.toFixed(0)}%. You're within healthy budgeting guidelines.`,
        });
      }
    }
  }

  // Biggest single expense
  if (transactions && transactions.length > 0) {
    const expenseTxns = transactions.filter((t) => ((t.amount || 0) as number) < 0);
    if (expenseTxns.length > 0) {
      const biggest = expenseTxns.reduce((a, b) =>
        Math.abs((a.amount || 0) as number) > Math.abs((b.amount || 0) as number) ? a : b,
      );
      const biggestAmt = Math.abs((biggest.amount || 0) as number);
      const biggestDesc = String(biggest.description || 'Unknown').slice(0, 40);
      if (totalExpenses > 0) {
        const pctOfTotal = (biggestAmt / totalExpenses) * 100;
        if (pctOfTotal > 15) {
          insights.push({
            type: 'anomaly',
            title: 'Biggest Single Expense',
            description: `"${biggestDesc}" at $${biggestAmt.toFixed(2)} accounts for ${pctOfTotal.toFixed(0)}% of your total spending this month. Make sure large one-time expenses don't become a pattern.`,
          });
        }
      }
    }
  }

  // Spending diversity
  if (categories.length > 0) {
    const expenseCats = categories.filter((c) => ((c.expenses || 0) as number) > 0);
    if (expenseCats.length >= 3 && totalExpenses > 0) {
      const shares = expenseCats.map((c) => ((c.expenses || 0) as number) / totalExpenses);
      const hhi = shares.reduce((sum, s) => sum + s * s, 0);
      const minHhi = 1.0 / expenseCats.length;
      const diversity =
        expenseCats.length > 1 ? Math.max(0, ((1.0 - hhi) / (1.0 - minHhi)) * 100) : 0;

      if (diversity < 40) {
        const topNames = expenseCats
          .sort((a, b) => ((b.expenses || 0) as number) - ((a.expenses || 0) as number))
          .slice(0, 2)
          .map((c) => c.category_name)
          .join(', ');
        insights.push({
          type: 'trend',
          title: 'Spending Is Concentrated',
          description: `Your spending diversity score is ${diversity.toFixed(0)}/100. Most of your money goes to ${topNames}. A more balanced spread can reveal savings opportunities.`,
        });
      } else if (diversity > 75) {
        insights.push({
          type: 'positive',
          title: 'Well-Balanced Spending',
          description: `Your spending diversity score is ${diversity.toFixed(0)}/100. Expenses are spread across ${expenseCats.length} categories, suggesting a balanced lifestyle.`,
        });
      }
    }
  }

  if (insights.length === 0) {
    insights.push({
      type: 'positive',
      title: 'Finances Looking Good',
      description:
        'Your spending is within reasonable limits. Keep monitoring your budget to maintain good financial health.',
    });
  }

  return insights.slice(0, 8);
}

// ============================================
// AI Review Transactions
// ============================================

export async function aiReviewTransactions(
  transactions: Array<Record<string, unknown>>,
  availableCategories: Array<{ id: number; name: string; is_income: boolean }>,
): Promise<Array<Record<string, unknown>>> {
  const available = await isAIAvailable();
  if (!available || !transactions.length) return transactions;

  const incomeCategories = availableCategories.filter((c) => c.is_income);
  const expenseCategories = availableCategories.filter((c) => !c.is_income);

  const categoryInfo = `INCOME CATEGORIES:
${incomeCategories.map((c) => `- ${c.name} (id: ${c.id})`).join('\n')}

EXPENSE CATEGORIES:
${expenseCategories.map((c) => `- ${c.name} (id: ${c.id})`).join('\n')}`;

  const BATCH_SIZE = 30;
  const enhancedTransactions: Array<Record<string, unknown>> = [];

  for (let batchStart = 0; batchStart < transactions.length; batchStart += BATCH_SIZE) {
    const batch = transactions.slice(batchStart, batchStart + BATCH_SIZE);

    const txnList = batch.map((t, i) => ({
      idx: batchStart + i,
      date: t.date || '',
      desc: String(t.description || '').slice(0, 200),
      amt: t.amount || 0,
    }));

    const systemPrompt = `You are a financial transaction analyzer. Your job is to:
1. Identify the correct category based on context
2. Clean up messy bank descriptions into readable text
3. Extract merchant/payee names

Important rules:
- Large regular deposits (>$3000) are usually SALARY, not subscriptions
- Company names with large amounts often indicate employers
- Small recurring charges are likely subscriptions
- Return ONLY valid JSON`;

    const userPrompt = `Analyze these transactions and categorize each one:

${categoryInfo}

TRANSACTIONS:
${JSON.stringify(txnList, null, 2)}

For each transaction, return:
- idx: the transaction index
- cat_id: category ID from the list above
- clean: cleaned-up description (human-readable, remove codes/references)
- merchant: extracted merchant/payee name

Return a JSON object with a "results" array:
{"results": [{"idx": 0, "cat_id": 1, "clean": "Salary from Company", "merchant": "Company Name"}, ...]}`;

    try {
      const resultText = await chatCompletionWithRetry(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        { temperature: 0.2, maxTokens: 2000, jsonMode: true },
      );

      if (!resultText) {
        for (const t of batch) {
          enhancedTransactions.push({ ...t, ai_reviewed: false });
        }
        continue;
      }

      let parsed = parseJsonResponse(resultText);
      let aiResults: Array<Record<string, unknown>>;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        aiResults = ((parsed as Record<string, unknown>).results || []) as Array<Record<string, unknown>>;
      } else {
        aiResults = (parsed || []) as Array<Record<string, unknown>>;
      }

      const aiLookup = new Map<number, Record<string, unknown>>();
      for (const r of aiResults) {
        const idx = (r.idx ?? r.index) as number;
        if (idx !== undefined) aiLookup.set(idx, r);
      }

      const validCatIds = new Set(availableCategories.map((c) => c.id));

      for (let i = 0; i < batch.length; i++) {
        const enhanced = { ...batch[i] };
        const globalIdx = batchStart + i;

        if (aiLookup.has(globalIdx)) {
          const aiData = aiLookup.get(globalIdx)!;
          const catId = (aiData.cat_id ?? aiData.category_id) as number;
          if (validCatIds.has(catId)) {
            enhanced.suggested_category_id = catId;
          }
          enhanced.clean_description = aiData.clean || aiData.clean_description || batch[i].description;
          enhanced.merchant = aiData.merchant;
          enhanced.ai_reviewed = true;
        }

        enhancedTransactions.push(enhanced);
      }
    } catch {
      for (const t of batch) {
        enhancedTransactions.push({ ...t, ai_reviewed: false });
      }
    }
  }

  return enhancedTransactions;
}

// ============================================
// Enhanced Spending Insights
// ============================================

export async function generateEnhancedSpendingInsights(
  summary: Record<string, unknown>,
  transactions: Array<Record<string, unknown>>,
  previousMonthSummary?: Record<string, unknown> | null,
  cashFlowData?: Array<Record<string, unknown>> | null,
  subscriptions?: Array<Record<string, unknown>> | null,
): Promise<Record<string, unknown>> {
  const insights = await generateSpendingInsights(summary, transactions, previousMonthSummary);
  const result: Record<string, unknown> = { insights };

  // Trend analysis
  if (cashFlowData && cashFlowData.length >= 2) {
    const trend = await aiAnalyzeSpendingTrends(cashFlowData);
    if (trend) result.trend_analysis = trend;
  }

  // Subscription optimization
  if (subscriptions) {
    const activeSubs = subscriptions.filter((s) => s.is_active !== false);
    if (activeSubs.length > 0) {
      let totalMonthly = 0;
      const suggestions: Insight[] = [];

      for (const sub of activeSubs) {
        const amount = Math.abs((sub.amount || 0) as number);
        const freq = (sub.frequency || 'monthly') as string;
        const monthly = freq === 'monthly' ? amount : freq === 'yearly' ? amount / 12 : amount;
        totalMonthly += monthly;
      }

      if (totalMonthly > 50) {
        suggestions.push({
          type: 'tip',
          title: 'Subscription Audit',
          description: `You're spending $${totalMonthly.toFixed(2)}/month on ${activeSubs.length} subscriptions ($${(totalMonthly * 12).toFixed(2)}/year). Review each for value.`,
        });
      }

      for (const sub of activeSubs) {
        const amount = Math.abs((sub.amount || 0) as number);
        if (amount > 30) {
          suggestions.push({
            type: 'tip',
            title: `Review ${sub.name || 'Subscription'}`,
            description: `At $${amount.toFixed(2)}/${sub.frequency || 'month'}, check if you're fully utilizing this service.`,
          });
        }
      }

      if (suggestions.length > 0) {
        result.subscription_suggestions = suggestions.slice(0, 5);
      }
    }
  }

  return result;
}

// ============================================
// Dashboard Insights
// ============================================

export async function generateDashboardInsights(
  networthData: Record<string, unknown>,
  networthHistory: Array<Record<string, unknown>>,
  portfolioData: Array<Record<string, unknown>>,
  propertyData: Array<Record<string, unknown>>,
  liabilityData: Array<Record<string, unknown>>,
  accountSummary: Record<string, unknown>,
): Promise<Insight[]> {
  const available = await isAIAvailable();
  if (!available) {
    return generateBasicDashboardInsights(
      networthData, portfolioData, propertyData, liabilityData, accountSummary,
    );
  }

  const netWorth = (networthData.net_worth || 0) as number;
  const totalAssets = (networthData.total_assets || 0) as number;
  const totalLiabilities = (networthData.total_liabilities || 0) as number;
  const breakdown = (networthData.breakdown || {}) as Record<string, number>;

  let portfolioText = '';
  if (portfolioData.length > 0) {
    const topHoldings = [...portfolioData]
      .sort((a, b) => Math.abs((b.current_value || 0) as number) - Math.abs((a.current_value || 0) as number))
      .slice(0, 5);
    portfolioText =
      'Top Holdings:\n' +
      topHoldings
        .map((h) => `- ${h.ticker || '?'}: $${((h.current_value || 0) as number).toFixed(2)} (P&L: ${((h.gain_percent || 0) as number).toFixed(1)}%)`)
        .join('\n');
  }

  let propertyText = '';
  if (propertyData.length > 0) {
    propertyText =
      'Properties:\n' +
      propertyData
        .map((p) => `- ${p.name || '?'}: Value $${((p.current_value || 0) as number).toFixed(2)}, Equity $${((p.equity || 0) as number).toFixed(2)}`)
        .join('\n');
  }

  let historyText = '';
  if (networthHistory.length >= 2) {
    const recent = networthHistory[networthHistory.length - 1];
    const older = networthHistory[0];
    const change = ((recent.net_worth || 0) as number) - ((older.net_worth || 0) as number);
    historyText = `Net worth change over ${networthHistory.length} data points: $${change >= 0 ? '+' : ''}${change.toFixed(2)}`;
  }

  let liabilityText = '';
  if (liabilityData.length > 0) {
    liabilityText =
      'Liabilities:\n' +
      liabilityData
        .map((l) => `- ${l.name || '?'}: $${((l.balance || 0) as number).toLocaleString()} (${l.category || 'other'})`)
        .join('\n');
  }

  const systemPrompt = `You are a sharp personal finance advisor reviewing someone's complete financial picture.
Your insights should feel like advice from a smart friend who happens to be a financial planner.

Rules:
- Reference SPECIFIC numbers, percentages, and dollar amounts from the data
- Each insight should be ACTIONABLE
- Mix tone: celebrate wins, flag real risks, give practical next steps
- Compare ratios to benchmarks (debt-to-asset < 30% is healthy, emergency fund = 3-6 months, etc.)`;

  const userPrompt = `Analyze this financial snapshot and provide 5-7 specific, actionable insights.

NET WORTH: $${netWorth.toLocaleString()}
- Total Assets: $${totalAssets.toLocaleString()}
- Total Liabilities: $${totalLiabilities.toLocaleString()}
- Cash & Bank Accounts: $${(breakdown.cash_accounts || 0).toLocaleString()}
- Investment Portfolio: $${(breakdown.investments || 0).toLocaleString()}
- Real Estate Value: $${(breakdown.real_estate || 0).toLocaleString()}
- Mortgage Balance: $${(breakdown.mortgages || 0).toLocaleString()}

${portfolioText}
${propertyText}
${liabilityText}
${historyText}

Accounts: ${accountSummary.count || 0} accounts across types: ${((accountSummary.types || []) as string[]).join(', ')}

Provide insights as JSON:
{"insights": [
  {"type": "warning|tip|positive|milestone|trend", "title": "Concise title", "description": "2-3 sentences with specific numbers and actionable advice"}
]}

Return ONLY the JSON object.`;

  try {
    const resultText = await chatCompletionWithRetry(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      { temperature: 0.7, maxTokens: 1200, jsonMode: true },
    );

    if (!resultText) {
      return generateBasicDashboardInsights(networthData, portfolioData, propertyData, liabilityData, accountSummary);
    }

    let parsed = parseJsonResponse(resultText);
    let insightsArr: Array<Record<string, unknown>>;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      insightsArr = ((parsed as Record<string, unknown>).insights || []) as Array<Record<string, unknown>>;
    } else {
      insightsArr = (parsed || []) as Array<Record<string, unknown>>;
    }

    const validated: Insight[] = [];
    for (const insight of insightsArr) {
      if (typeof insight === 'object' && insight) {
        let type = (insight.type || 'tip') as string;
        if (!['warning', 'tip', 'positive', 'milestone', 'trend'].includes(type)) type = 'tip';
        validated.push({
          type: type as Insight['type'],
          title: String(insight.title || 'Insight').slice(0, 50),
          description: String(insight.description || '').slice(0, 300),
        });
      }
    }

    if (validated.length) return validated.slice(0, 6);
    return generateBasicDashboardInsights(networthData, portfolioData, propertyData, liabilityData, accountSummary);
  } catch {
    return generateBasicDashboardInsights(networthData, portfolioData, propertyData, liabilityData, accountSummary);
  }
}

// ============================================
// Basic (rule-based) Dashboard Insights
// ============================================

export function generateBasicDashboardInsights(
  networthData: Record<string, unknown>,
  portfolioData: Array<Record<string, unknown>>,
  propertyData: Array<Record<string, unknown>>,
  liabilityData: Array<Record<string, unknown>>,
  accountSummary: Record<string, unknown>,
): Insight[] {
  const insights: Insight[] = [];
  const totalAssets = (networthData.total_assets || 0) as number;
  const totalLiabilities = (networthData.total_liabilities || 0) as number;
  const netWorth = (networthData.net_worth || 0) as number;
  const breakdown = (networthData.breakdown || {}) as Record<string, number>;
  const cash = breakdown.cash_accounts || 0;
  const investments = breakdown.investments || 0;
  const realEstate = breakdown.real_estate || 0;
  const mortgages = breakdown.mortgages || 0;

  // Asset allocation
  if (totalAssets > 0) {
    const cashPct = (cash / totalAssets) * 100;
    const rePct = (realEstate / totalAssets) * 100;

    if (cashPct > 60 && cash > 50000) {
      insights.push({
        type: 'tip',
        title: 'Cash-Heavy Allocation',
        description: `${cashPct.toFixed(0)}% of your assets ($${cash.toLocaleString()}) sit in cash. Consider investing some for long-term growth.`,
      });
    }
    if (rePct > 70 && realEstate > 0) {
      insights.push({
        type: 'warning',
        title: 'Real Estate Concentration',
        description: `Real estate makes up ${rePct.toFixed(0)}% of your total assets. This illiquidity could be a risk if you need funds quickly.`,
      });
    }
  }

  // Debt-to-asset ratio
  if (totalAssets > 0) {
    const debtRatio = totalLiabilities / totalAssets;
    if (debtRatio > 0.5) {
      insights.push({
        type: 'warning',
        title: 'High Debt-to-Asset Ratio',
        description: `Liabilities are ${(debtRatio * 100).toFixed(0)}% of your assets ($${totalLiabilities.toLocaleString()} / $${totalAssets.toLocaleString()}). Prioritize paying down high-interest debt.`,
      });
    } else if (debtRatio < 0.1 && totalLiabilities > 0) {
      insights.push({
        type: 'positive',
        title: 'Excellent Debt Position',
        description: `Your debt is just ${(debtRatio * 100).toFixed(0)}% of total assets -- well below the 30% threshold. This gives you strong financial flexibility.`,
      });
    }
  }

  // Portfolio analysis
  if (portfolioData.length > 0) {
    const totalPortfolio = portfolioData.reduce((sum, h) => sum + Math.abs((h.current_value || 0) as number), 0);
    const totalGain = portfolioData.reduce((sum, h) => sum + ((h.unrealized_gain || 0) as number), 0);
    const winners = portfolioData.filter((h) => ((h.unrealized_gain || 0) as number) > 0);
    const losers = portfolioData.filter((h) => ((h.unrealized_gain || 0) as number) < 0);

    if (totalPortfolio > 0) {
      const sorted = [...portfolioData].sort((a, b) => Math.abs((b.current_value || 0) as number) - Math.abs((a.current_value || 0) as number));
      const top = sorted[0];
      if (top) {
        const pct = (Math.abs((top.current_value || 0) as number) / totalPortfolio) * 100;
        if (pct > 40) {
          insights.push({
            type: 'warning',
            title: `Portfolio Concentrated in ${top.ticker || '?'}`,
            description: `${top.ticker || '?'} is ${pct.toFixed(0)}% of your portfolio ($${Math.abs((top.current_value || 0) as number).toLocaleString()}). Diversification reduces this risk.`,
          });
        }
      }

      if (totalGain > 0) {
        const costBasis = totalPortfolio - totalGain;
        const gainPct = costBasis > 0 ? (totalGain / costBasis) * 100 : 0;
        insights.push({
          type: 'positive',
          title: `Portfolio Up $${totalGain.toLocaleString()}`,
          description: `Your investments have gained $${totalGain.toLocaleString()} (${gainPct.toFixed(1)}%) overall. ${winners.length} of ${portfolioData.length} positions are profitable.`,
        });
      } else if (totalGain < 0) {
        const costBasis = totalPortfolio - totalGain;
        const lossPct = costBasis > 0 ? (totalGain / costBasis) * 100 : 0;
        insights.push({
          type: 'warning',
          title: `Portfolio Down $${Math.abs(totalGain).toLocaleString()}`,
          description: `Your investments are down $${Math.abs(totalGain).toLocaleString()} (${lossPct.toFixed(1)}%). ${losers.length} of ${portfolioData.length} positions are underwater.`,
        });
      }

      if (portfolioData.length >= 3) {
        const best = portfolioData.reduce((a, b) =>
          ((a.gain_percent || 0) as number) > ((b.gain_percent || 0) as number) ? a : b,
        );
        const worst = portfolioData.reduce((a, b) =>
          ((a.gain_percent || 0) as number) < ((b.gain_percent || 0) as number) ? a : b,
        );
        if (((best.gain_percent || 0) as number) > 10) {
          insights.push({
            type: 'trend',
            title: `Top Performer: ${best.ticker || '?'}`,
            description: `${best.ticker || '?'} leads your portfolio at ${((best.gain_percent || 0) as number) >= 0 ? '+' : ''}${((best.gain_percent || 0) as number).toFixed(1)}%. Consider whether it's time to take some profits.`,
          });
        }
        if (((worst.gain_percent || 0) as number) < -10) {
          insights.push({
            type: 'warning',
            title: `Underperformer: ${worst.ticker || '?'}`,
            description: `${worst.ticker || '?'} is down ${((worst.gain_percent || 0) as number).toFixed(1)}%. Evaluate if your thesis still holds.`,
          });
        }
      }
    }
  }

  // Liability analysis
  if (liabilityData.length > 0) {
    const highBalance = liabilityData.filter((l) => ((l.balance || 0) as number) > 10000);
    if (highBalance.length > 0) {
      const largest = highBalance.reduce((a, b) =>
        ((a.balance || 0) as number) > ((b.balance || 0) as number) ? a : b,
      );
      insights.push({
        type: 'tip',
        title: `Largest Debt: ${largest.name || 'Unknown'}`,
        description: `${largest.name || 'This liability'} has a balance of $${((largest.balance || 0) as number).toLocaleString()}. Increasing payments by even 10% can significantly reduce total interest paid.`,
      });
    }
  }

  // Real estate equity
  for (const prop of propertyData) {
    const equity = (prop.equity || 0) as number;
    const currentValue = (prop.current_value || 0) as number;
    const purchase = (prop.purchase_price || 0) as number;
    if (purchase > 0 && currentValue > 0) {
      const appreciation = ((currentValue - purchase) / purchase) * 100;
      const ltv = currentValue > 0 ? ((currentValue - equity) / currentValue) * 100 : 0;
      if (appreciation > 0) {
        insights.push({
          type: 'positive',
          title: `${prop.name || 'Property'}: ${appreciation.toFixed(0)}% Appreciation`,
          description: `This property has appreciated from $${purchase.toLocaleString()} to $${currentValue.toLocaleString()}. Your equity stands at $${equity.toLocaleString()} with a ${ltv.toFixed(0)}% loan-to-value ratio.`,
        });
      } else if (ltv > 80) {
        insights.push({
          type: 'tip',
          title: `High LTV on ${prop.name || 'Property'}`,
          description: `Your loan-to-value ratio is ${ltv.toFixed(0)}% -- above the 80% threshold. Extra principal payments could help.`,
        });
      }
    }
  }

  // Net worth milestones
  const milestones = [10_000_000, 5_000_000, 1_000_000, 500_000, 100_000, 50_000];
  for (const milestone of milestones) {
    if (netWorth >= milestone) {
      const label = milestone >= 1_000_000 ? `$${milestone / 1_000_000}M` : `$${milestone / 1000}K`;
      const nextMilestones = milestones.filter((m) => m > milestone);
      const nextMs = nextMilestones.length > 0 ? nextMilestones[nextMilestones.length - 1] : null;
      let nextText = '';
      if (nextMs) {
        const remaining = nextMs - netWorth;
        const nextLabel = nextMs >= 1_000_000 ? `$${nextMs / 1_000_000}M` : `$${nextMs / 1000}K`;
        const pctThere = (netWorth / nextMs) * 100;
        nextText = ` You're ${pctThere.toFixed(0)}% of the way to ${nextLabel} -- $${remaining.toLocaleString()} to go.`;
      }
      insights.push({
        type: 'milestone',
        title: `Net Worth: ${label}+`,
        description: `Your net worth of $${netWorth.toLocaleString()} has passed the ${label} mark.${nextText}`,
      });
      break;
    }
  }

  // Emergency fund
  if (cash > 0 && totalAssets > 0) {
    const estMonthly = Math.max(3000, totalLiabilities * 0.02 + cash * 0.05);
    const monthsCovered = estMonthly > 0 ? cash / estMonthly : 0;
    if (monthsCovered >= 6) {
      insights.push({
        type: 'positive',
        title: `${monthsCovered.toFixed(0)} Months Cash Runway`,
        description: `Your cash reserves of $${cash.toLocaleString()} could cover an estimated ${monthsCovered.toFixed(0)} months of expenses. This is a strong safety net.`,
      });
    } else if (monthsCovered < 3) {
      insights.push({
        type: 'tip',
        title: 'Build Your Cash Buffer',
        description: `Your cash of $${cash.toLocaleString()} covers roughly ${monthsCovered.toFixed(1)} months. Financial experts recommend 3-6 months in liquid reserves.`,
      });
    }
  }

  if (insights.length === 0) {
    insights.push({
      type: 'positive',
      title: 'Financial Overview',
      description: `Your net worth is $${netWorth.toLocaleString()} across ${accountSummary.count || 0} accounts. Keep tracking to identify trends and opportunities.`,
    });
  }

  return insights.slice(0, 8);
}

// ============================================
// Financial Stories
// ============================================

export async function generateFinancialStories(
  networthData: Record<string, unknown>,
  budgetSummary?: Record<string, unknown> | null,
  portfolioData?: Array<Record<string, unknown>> | null,
  propertyData?: Array<Record<string, unknown>> | null,
  recentTransactions?: Array<Record<string, unknown>> | null,
  seed?: number | null,
): Promise<Story[]> {
  const available = await isAIAvailable();
  if (!available) {
    return generateBasicStories(networthData, budgetSummary, portfolioData, propertyData);
  }

  const netWorth = (networthData.net_worth || 0) as number;
  const breakdown = (networthData.breakdown || {}) as Record<string, number>;

  const contextParts: string[] = [`Net Worth: $${netWorth.toLocaleString()}`];
  contextParts.push(`Cash: $${(breakdown.cash_accounts || 0).toLocaleString()}`);
  contextParts.push(`Investments: $${(breakdown.investments || 0).toLocaleString()}`);
  contextParts.push(`Real Estate: $${(breakdown.real_estate || 0).toLocaleString()}`);

  if (budgetSummary) {
    contextParts.push(`Monthly Income: $${((budgetSummary.total_income || 0) as number).toLocaleString()}`);
    contextParts.push(`Monthly Expenses: $${((budgetSummary.total_expenses || 0) as number).toLocaleString()}`);
  }

  if (portfolioData && portfolioData.length > 0) {
    const top = [...portfolioData]
      .sort((a, b) => Math.abs((b.current_value || 0) as number) - Math.abs((a.current_value || 0) as number))
      .slice(0, 3);
    contextParts.push(
      'Top holdings: ' +
        top.map((h) => `${h.ticker || '?'} ($${((h.current_value || 0) as number).toLocaleString()}, ${((h.gain_percent || 0) as number) >= 0 ? '+' : ''}${((h.gain_percent || 0) as number).toFixed(1)}%)`).join(', '),
    );
  }

  if (propertyData && propertyData.length > 0) {
    contextParts.push(
      'Properties: ' + propertyData.map((p) => `${p.name || '?'} ($${((p.current_value || 0) as number).toLocaleString()})`).join(', '),
    );
  }

  const systemPrompt = `You are a creative financial storyteller who makes people excited about their money.
Turn raw financial data into vivid, memorable narratives.

Style guide:
- Use concrete comparisons people can feel
- Each story should have one "wow moment"
- Reference real numbers
- Vary your angles`;

  const seedText = seed ? `\nVariation seed: ${seed}` : '';

  let txnContext = '';
  if (recentTransactions && recentTransactions.length > 0) {
    txnContext =
      '\nRecent notable transactions:\n' +
      recentTransactions
        .slice(0, 10)
        .map((t) => `- ${t.date || '?'}: ${t.description || '?'} $${((t.amount || 0) as number).toLocaleString()}`)
        .join('\n');
  }

  const userPrompt = `Create 3 engaging financial stories from this data.

${contextParts.join('\n')}
${txnContext}
${seedText}

Return JSON:
{"stories": [
  {
    "type": "comparison|milestone|perspective|growth",
    "emoji": "single emoji",
    "headline": "Punchy 5-8 word headline",
    "narrative": "2-3 sentence engaging narrative with specific dollar amounts.",
    "data_points": ["formatted stat 1", "formatted stat 2", "formatted stat 3"]
  }
]}

Return ONLY the JSON object.`;

  try {
    const resultText = await chatCompletionWithRetry(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      { temperature: 0.85, maxTokens: 1200, jsonMode: true },
    );

    if (!resultText) {
      return generateBasicStories(networthData, budgetSummary, portfolioData, propertyData);
    }

    let parsed = parseJsonResponse(resultText);
    let stories: Array<Record<string, unknown>>;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      stories = ((parsed as Record<string, unknown>).stories || []) as Array<Record<string, unknown>>;
    } else {
      stories = (parsed || []) as Array<Record<string, unknown>>;
    }

    const validated: Story[] = [];
    for (const story of stories) {
      if (typeof story === 'object' && story) {
        validated.push({
          type: String(story.type || 'perspective'),
          emoji: String(story.emoji || '').slice(0, 2),
          headline: String(story.headline || 'Your Financial Story').slice(0, 80),
          narrative: String(story.narrative || '').slice(0, 500),
          data_points: ((story.data_points || []) as string[]).slice(0, 5),
        });
      }
    }

    if (validated.length > 0) return validated.slice(0, 3);
    return generateBasicStories(networthData, budgetSummary, portfolioData, propertyData);
  } catch {
    return generateBasicStories(networthData, budgetSummary, portfolioData, propertyData);
  }
}

// ============================================
// Basic (rule-based) Stories
// ============================================

export function generateBasicStories(
  networthData: Record<string, unknown>,
  budgetSummary?: Record<string, unknown> | null,
  portfolioData?: Array<Record<string, unknown>> | null,
  propertyData?: Array<Record<string, unknown>> | null,
): Story[] {
  const stories: Story[] = [];
  const netWorth = (networthData.net_worth || 0) as number;
  const totalAssets = (networthData.total_assets || 0) as number;
  const totalLiabilities = (networthData.total_liabilities || 0) as number;
  const breakdown = (networthData.breakdown || {}) as Record<string, number>;
  const cash = breakdown.cash_accounts || 0;
  const investments = breakdown.investments || 0;
  const realEstate = breakdown.real_estate || 0;

  // Portfolio story
  if (portfolioData && portfolioData.length > 0) {
    const totalGain = portfolioData.reduce((sum, h) => sum + ((h.unrealized_gain || 0) as number), 0);
    const totalValue = portfolioData.reduce((sum, h) => sum + Math.abs((h.current_value || 0) as number), 0);
    const winners = [...portfolioData].filter((h) => ((h.unrealized_gain || 0) as number) > 0).sort((a, b) => ((b.unrealized_gain || 0) as number) - ((a.unrealized_gain || 0) as number));
    const losers = portfolioData.filter((h) => ((h.unrealized_gain || 0) as number) < 0);

    if (totalGain > 0 && totalValue > 0) {
      const costBasis = totalValue - totalGain;
      const gainPct = costBasis > 0 ? (totalGain / costBasis) * 100 : 0;
      const best = winners[0];
      const bestText = best ? ` ${best.ticker || '?'} leads the pack at ${((best.gain_percent || 0) as number) >= 0 ? '+' : ''}${((best.gain_percent || 0) as number).toFixed(1)}%.` : '';
      stories.push({
        type: 'growth',
        emoji: '\uD83D\uDCC8',
        headline: 'Your Money Is Making Money',
        narrative: `Your portfolio has earned $${totalGain.toLocaleString()} in unrealized gains (${gainPct.toFixed(1)}% return).${bestText} That's money working for you while you sleep.`,
        data_points: [
          `$${totalGain.toLocaleString()} total gains`,
          `${winners.length} winners, ${losers.length} losers`,
          `$${totalValue.toLocaleString()} portfolio value`,
        ],
      });
    }
  }

  // Gains vs spending
  if (budgetSummary && portfolioData && portfolioData.length > 0) {
    const totalGain = portfolioData.reduce((sum, h) => sum + ((h.unrealized_gain || 0) as number), 0);
    const expenses = (budgetSummary.total_expenses || 0) as number;
    const income = (budgetSummary.total_income || 0) as number;
    if (totalGain > 0 && expenses > 0) {
      const monthsCovered = totalGain / expenses;
      stories.push({
        type: 'comparison',
        emoji: '\u2696\uFE0F',
        headline: 'Gains vs. Spending: The Scoreboard',
        narrative: `Your investment gains of $${totalGain.toLocaleString()} could fund ${monthsCovered.toFixed(1)} months of your current lifestyle ($${expenses.toLocaleString()}/month). That's passive wealth building in action.`,
        data_points: [`$${totalGain.toLocaleString()} in gains`, `${monthsCovered.toFixed(1)} months funded`],
      });
    }
    if (income > 0 && expenses > 0) {
      const savings = income - expenses;
      if (savings > 0) {
        const savingsRate = (savings / income) * 100;
        const dailyCost = expenses / 30;
        const freedomDays = dailyCost > 0 ? savings / dailyCost : 0;
        stories.push({
          type: 'perspective',
          emoji: '\uD83C\uDFD6\uFE0F',
          headline: `Saving ${savingsRate.toFixed(0)}% of Your Income`,
          narrative:
            cash > 0 && expenses > 0
              ? `You're keeping $${savings.toLocaleString()} each month -- that buys you ${freedomDays.toFixed(0)} extra days of financial runway. At this pace, your cash reserves alone could sustain you for ${(cash / expenses).toFixed(1)} months.`
              : `You're keeping $${savings.toLocaleString()} each month -- that buys you ${freedomDays.toFixed(0)} extra days of financial runway every single month.`,
          data_points: [
            `${savingsRate.toFixed(0)}% savings rate`,
            `$${savings.toLocaleString()}/month saved`,
            `${freedomDays.toFixed(0)} days of freedom`,
          ],
        });
      }
    }
  }

  // Wealth composition
  if (netWorth > 0 && totalAssets > 0) {
    const parts: Array<[string, number, number]> = [];
    if (cash > 0) parts.push(['cash', cash, (cash / totalAssets) * 100]);
    if (investments > 0) parts.push(['investments', investments, (investments / totalAssets) * 100]);
    if (realEstate > 0) parts.push(['real estate', realEstate, (realEstate / totalAssets) * 100]);

    parts.sort((a, b) => b[1] - a[1]);
    const biggest = parts[0];

    let leverageText = '';
    if (totalLiabilities > 0) {
      const ratio = totalAssets / totalLiabilities;
      leverageText = ` For every $1 of debt, you have $${ratio.toFixed(2)} in assets.`;
    }

    if (biggest) {
      stories.push({
        type: 'milestone',
        emoji: '\uD83C\uDFAF',
        headline: `$${netWorth.toLocaleString()} and Growing`,
        narrative: `Your wealth is anchored by ${biggest[0]} (${biggest[2].toFixed(0)}% of assets at $${biggest[1].toLocaleString()}).${leverageText} Diversification across ${parts.length} asset classes helps protect against downturns.`,
        data_points: [
          `$${netWorth.toLocaleString()} net worth`,
          ...parts.slice(0, 3).map((p) => `${p[0].charAt(0).toUpperCase() + p[0].slice(1)}: $${p[1].toLocaleString()}`),
        ],
      });
    }
  }

  // Real estate equity
  if (propertyData && propertyData.length > 0) {
    const totalEquity = propertyData.reduce((sum, p) => sum + ((p.equity || 0) as number), 0);
    const totalPropValue = propertyData.reduce((sum, p) => sum + ((p.current_value || 0) as number), 0);
    if (totalEquity > 0 && totalPropValue > 0) {
      const equityPct = (totalEquity / totalPropValue) * 100;
      stories.push({
        type: 'growth',
        emoji: '\uD83C\uDFE0',
        headline: `$${totalEquity.toLocaleString()} in Home Equity`,
        narrative: `You own ${equityPct.toFixed(0)}% of your $${totalPropValue.toLocaleString()} in real estate. Every mortgage payment builds this equity -- it's forced savings that grows with property values.`,
        data_points: [
          `$${totalEquity.toLocaleString()} equity`,
          `${equityPct.toFixed(0)}% ownership`,
          `${propertyData.length} properties`,
        ],
      });
    }
  }

  if (stories.length === 0) {
    stories.push({
      type: 'growth',
      emoji: '\uD83C\uDF31',
      headline: 'Your Financial Journey Begins',
      narrative:
        'Every great fortune started with a single step -- tracking it. Add accounts, investments, and property to unlock personalized financial stories and insights.',
      data_points: [],
    });
  }

  return stories.slice(0, 3);
}

// ============================================
// AI Analyze Spending Trends
// ============================================

export async function aiAnalyzeSpendingTrends(
  monthlyData: Array<Record<string, unknown>>,
): Promise<TrendAnalysis | null> {
  const available = await isAIAvailable();
  if (!available || monthlyData.length < 2) return null;

  const monthsText = monthlyData
    .slice(-6)
    .map(
      (m) =>
        `- ${m.month || 'Unknown'}: Income $${((m.total_income || 0) as number).toFixed(2)}, Expenses $${((m.total_expenses || 0) as number).toFixed(2)}, Net $${((m.net || 0) as number).toFixed(2)}`,
    )
    .join('\n');

  const systemPrompt = `You are a financial analyst. Analyze spending trends and provide insights.`;

  const userPrompt = `Analyze these monthly financial summaries:

${monthsText}

Provide analysis as JSON:
{
  "trend": "improving|stable|declining",
  "trend_description": "One sentence summary",
  "next_month_prediction": {"income": number, "expenses": number},
  "key_observations": ["observation 1", "observation 2"],
  "recommendations": ["specific action 1", "specific action 2"]
}`;

  try {
    const resultText = await chatCompletionWithRetry(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      { temperature: 0.5, maxTokens: 500, jsonMode: true },
    );

    if (!resultText) return null;
    return parseJsonResponse(resultText) as TrendAnalysis;
  } catch {
    return null;
  }
}
