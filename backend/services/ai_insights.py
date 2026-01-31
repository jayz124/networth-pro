"""
AI-powered insights service using OpenAI.
Used as a fallback for uncertain categorizations and for generating insights.
"""
import os
import re
import json
from typing import Optional, List, Dict, Any

# Module-level API key cache (set from database on first use)
_cached_api_key: Optional[str] = None


def set_api_key(api_key: Optional[str]):
    """Set the API key from database settings."""
    global _cached_api_key
    _cached_api_key = api_key


def get_openai_client(api_key: Optional[str] = None):
    """Get OpenAI client if API key is available.

    Args:
        api_key: Optional API key to use. If not provided, uses cached key or env var.
    """
    # Priority: passed key > cached key > env var
    key = api_key or _cached_api_key or os.environ.get("OPENAI_API_KEY")
    if not key:
        return None

    try:
        from openai import OpenAI
        return OpenAI(api_key=key)
    except ImportError:
        return None


def ai_categorize_transaction(
    description: str,
    merchant: Optional[str],
    amount: float,
    available_categories: List[str]
) -> Optional[Dict[str, Any]]:
    """
    Use OpenAI to categorize a transaction when rule-based fails.

    Returns:
        Dict with category_name and confidence, or None if AI unavailable
    """
    client = get_openai_client()
    if not client:
        return None

    prompt = f"""Categorize this transaction into one of the available categories.

Transaction:
- Description: {description}
- Merchant: {merchant or 'Unknown'}
- Amount: ${abs(amount):.2f} ({'income' if amount > 0 else 'expense'})

Available categories: {', '.join(available_categories)}

Respond with JSON only:
{{"category": "category_name", "confidence": 0.0-1.0}}"""

    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "You are a financial transaction categorizer. Respond only with valid JSON."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.3,
            max_tokens=100
        )

        result = response.choices[0].message.content.strip()
        # Parse JSON response
        parsed = json.loads(result)
        return {
            "category_name": parsed.get("category"),
            "confidence": parsed.get("confidence", 0.8)
        }
    except Exception as e:
        print(f"OpenAI categorization error: {e}")
        return None


def generate_spending_insights(
    summary: Dict[str, Any],
    transactions: List[Dict[str, Any]],
    previous_month_summary: Optional[Dict[str, Any]] = None
) -> List[Dict[str, str]]:
    """
    Generate AI-powered spending insights and recommendations.

    Returns:
        List of insight dicts with 'type', 'title', 'description'
    """
    client = get_openai_client()
    if not client:
        # Return basic rule-based insights if AI unavailable
        return _generate_basic_insights(summary)

    # Build context
    category_breakdown = summary.get("by_category", [])
    total_income = summary.get("total_income", 0)
    total_expenses = summary.get("total_expenses", 0)

    # Format for prompt
    category_text = "\n".join([
        f"- {c['category_name']}: ${c['expenses']:.2f} ({c['transactions']} transactions)"
        for c in category_breakdown[:10]
    ])

    comparison_text = ""
    if previous_month_summary:
        prev_expenses = previous_month_summary.get("total_expenses", 0)
        diff = total_expenses - prev_expenses
        comparison_text = f"\nCompared to last month: {'up' if diff > 0 else 'down'} ${abs(diff):.2f}"

    prompt = f"""Analyze this monthly spending and provide 3-5 actionable insights.

Summary:
- Total Income: ${total_income:.2f}
- Total Expenses: ${total_expenses:.2f}
- Net: ${total_income - total_expenses:.2f}
{comparison_text}

Spending by Category:
{category_text}

Provide insights as JSON array:
[{{"type": "warning|tip|positive", "title": "short title", "description": "explanation"}}]

Types:
- warning: Concerning spending patterns
- tip: Money-saving suggestions
- positive: Good financial behaviors to highlight"""

    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "You are a personal finance advisor. Provide concise, actionable insights."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.7,
            max_tokens=500
        )

        result = response.choices[0].message.content.strip()
        # Try to parse JSON
        try:
            insights = json.loads(result)
            return insights
        except json.JSONDecodeError:
            # Try to extract JSON from markdown code blocks
            import re
            json_match = re.search(r'\[.*\]', result, re.DOTALL)
            if json_match:
                return json.loads(json_match.group())
            return _generate_basic_insights(summary)
    except Exception as e:
        print(f"OpenAI insights error: {e}")
        return _generate_basic_insights(summary)


def _generate_basic_insights(summary: Dict[str, Any]) -> List[Dict[str, str]]:
    """Generate basic rule-based insights when AI is unavailable."""
    insights = []

    total_income = summary.get("total_income", 0)
    total_expenses = summary.get("total_expenses", 0)
    net = total_income - total_expenses

    # Savings rate insight
    if total_income > 0:
        savings_rate = (net / total_income) * 100
        if savings_rate >= 20:
            insights.append({
                "type": "positive",
                "title": "Great Savings Rate",
                "description": f"You're saving {savings_rate:.1f}% of your income. Keep it up!"
            })
        elif savings_rate < 0:
            insights.append({
                "type": "warning",
                "title": "Spending Exceeds Income",
                "description": "Your expenses exceed your income this period. Review your spending."
            })
        elif savings_rate < 10:
            insights.append({
                "type": "tip",
                "title": "Increase Savings",
                "description": f"Your savings rate is {savings_rate:.1f}%. Consider aiming for 20%."
            })

    # Category-specific insights
    for cat in summary.get("by_category", []):
        expenses = cat.get("expenses", 0)
        budget = cat.get("budget_limit")

        if budget and expenses > budget:
            pct_over = ((expenses - budget) / budget) * 100
            insights.append({
                "type": "warning",
                "title": f"Over Budget: {cat['category_name']}",
                "description": f"You've exceeded your {cat['category_name']} budget by {pct_over:.0f}%."
            })

    # Subscription check
    for cat in summary.get("by_category", []):
        if cat.get("category_name") == "Subscriptions" and cat.get("expenses", 0) > 100:
            insights.append({
                "type": "tip",
                "title": "Review Subscriptions",
                "description": f"You're spending ${cat['expenses']:.2f} on subscriptions. Review for unused services."
            })
            break

    return insights[:5]  # Limit to 5 insights


def is_ai_available(api_key: Optional[str] = None) -> bool:
    """Check if OpenAI API is configured.

    Args:
        api_key: Optional API key to check. If not provided, uses cached key or env var.
    """
    return get_openai_client(api_key) is not None


def ai_review_transactions(
    transactions: List[Dict[str, Any]],
    available_categories: List[Dict[str, Any]],
    api_key: Optional[str] = None
) -> List[Dict[str, Any]]:
    """
    Use AI to review and enhance parsed transactions:
    - Assign appropriate categories (understanding context like large deposits = salary)
    - Clean up messy descriptions
    - Extract merchant names

    Args:
        transactions: List of parsed transactions with date, description, amount
        available_categories: List of category dicts with id, name, is_income
        api_key: Optional OpenAI API key

    Returns:
        Enhanced transactions with suggested_category, clean_description, merchant
    """
    client = get_openai_client(api_key)
    if not client or not transactions:
        return transactions

    # Build category info for the prompt
    income_categories = [c for c in available_categories if c.get('is_income')]
    expense_categories = [c for c in available_categories if not c.get('is_income')]

    category_info = "Income categories: " + ", ".join([f"{c['name']} (id:{c['id']})" for c in income_categories])
    category_info += "\nExpense categories: " + ", ".join([f"{c['name']} (id:{c['id']})" for c in expense_categories])

    # Format transactions for the prompt (limit to avoid token limits)
    txn_list = []
    for i, t in enumerate(transactions[:100]):  # Limit to 100 transactions
        txn_list.append({
            "index": i,
            "date": t.get("date", ""),
            "description": t.get("description", ""),
            "amount": t.get("amount", 0)
        })

    prompt = f"""Analyze these bank transactions and enhance each one:

TRANSACTIONS:
{json.dumps(txn_list, indent=2)}

AVAILABLE CATEGORIES:
{category_info}

For EACH transaction, determine:
1. **category_id**: The most appropriate category ID based on context:
   - Large regular deposits (£5,000+) are likely SALARY, not subscriptions
   - "APPLE UK LTD" with large amounts is likely salary from Apple (employer), not Apple subscriptions
   - Small recurring charges are likely subscriptions
   - Transfers out are usually expenses unless clearly labeled as income

2. **clean_description**: A cleaned-up, human-readable description (remove reference numbers, codes, "INTERNET BANKING", etc.)

3. **merchant**: Extract the merchant/payee name if identifiable

Return a JSON array with objects containing: index, category_id, clean_description, merchant

Example output:
[
  {{"index": 0, "category_id": 1, "clean_description": "Salary from Apple UK", "merchant": "Apple UK Ltd"}},
  {{"index": 1, "category_id": 5, "clean_description": "International Transfer", "merchant": "Global Transfer"}}
]

Only return the JSON array, no other text."""

    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "You are a financial transaction analyzer. Categorize transactions intelligently based on patterns and context. Return only valid JSON."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.3,
            max_tokens=4000
        )

        result_text = response.choices[0].message.content.strip()

        # Handle markdown code blocks
        if result_text.startswith('```'):
            json_match = re.search(r'```(?:json)?\s*([\s\S]*?)\s*```', result_text)
            if json_match:
                result_text = json_match.group(1)

        ai_results = json.loads(result_text)

        # Create a lookup by index
        ai_lookup = {r["index"]: r for r in ai_results}

        # Enhance original transactions
        enhanced = []
        for i, t in enumerate(transactions):
            enhanced_txn = dict(t)
            if i in ai_lookup:
                ai_data = ai_lookup[i]
                enhanced_txn["suggested_category_id"] = ai_data.get("category_id")
                enhanced_txn["clean_description"] = ai_data.get("clean_description", t.get("description"))
                enhanced_txn["merchant"] = ai_data.get("merchant")
                enhanced_txn["ai_reviewed"] = True
            enhanced.append(enhanced_txn)

        return enhanced

    except Exception as e:
        print(f"AI review error: {e}")
        # Return original transactions if AI fails
        return transactions
