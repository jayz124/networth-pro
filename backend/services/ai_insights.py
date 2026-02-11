"""
AI-powered insights service.
Supports multiple providers via the ai_provider abstraction layer.
Features:
- Robust error handling with retries
- Timeout protection
- Structured JSON responses
- Rate limit handling
- Caching for common patterns
- Detailed logging
"""
import os
import re
import json
import logging
import hashlib
from typing import Optional, List, Dict, Any, Tuple
from datetime import datetime, timedelta, timezone
from functools import lru_cache
import time

from services.ai_provider import (
    get_ai_client,
    is_ai_available,
    get_active_model,
    get_active_provider,
    get_provider_info,
    set_provider_config,
    AIProvider,
    PROVIDER_CONFIG,
    BaseAIClient,
)

# Configure logging
logger = logging.getLogger(__name__)

# Simple in-memory cache for categorizations
_categorization_cache: Dict[str, Tuple[Dict, datetime]] = {}
_CACHE_TTL = timedelta(hours=24)

# Configuration
MAX_RETRIES = 3
INITIAL_RETRY_DELAY = 1  # seconds


def set_api_key(api_key: Optional[str]):
    """Set the API key from database settings (backward compat)."""
    if api_key:
        set_provider_config(get_active_provider(), api_key)


def _retry_with_backoff(func, *args, max_retries: int = MAX_RETRIES, **kwargs):
    """Execute a function with exponential backoff retry logic."""
    last_exception = None
    delay = INITIAL_RETRY_DELAY

    for attempt in range(max_retries):
        try:
            return func(*args, **kwargs)
        except Exception as e:
            last_exception = e
            error_str = str(e).lower()

            # Don't retry on authentication errors (cross-provider)
            if any(k in error_str for k in [
                "authentication", "invalid api key", "invalid_api_key",
                "permission_denied", "unauthorized", "invalid x-api-key",
                "api key not valid",
            ]):
                logger.error(f"Authentication error, not retrying: {e}")
                raise

            # Don't retry on quota/billing errors - these won't resolve with retries
            if any(k in error_str for k in [
                "insufficient_quota", "resource_exhausted", "billing",
            ]) or ("exceeded" in error_str and "quota" in error_str):
                logger.error(f"Quota exceeded: {e}")
                raise

            # Handle rate limits (temporary, can retry)
            if "rate_limit" in error_str or ("429" in error_str and "insufficient_quota" not in error_str):
                # Only wait/retry for actual rate limits, not quota issues
                retry_after = 5  # Reduced from 60 - rate limits usually clear quickly
                logger.warning(f"Rate limited, waiting {retry_after}s before retry")
                time.sleep(retry_after)
                continue

            # Don't retry on the last attempt
            if attempt == max_retries - 1:
                break

            logger.warning(f"Attempt {attempt + 1} failed: {e}. Retrying in {delay}s...")
            time.sleep(delay)
            delay *= 2  # Exponential backoff

    logger.error(f"All {max_retries} attempts failed. Last error: {last_exception}")
    raise last_exception


def _get_cache_key(description: str, merchant: Optional[str], amount: float) -> str:
    """Generate a cache key for categorization."""
    # Normalize the input
    normalized = f"{description.lower().strip()}|{(merchant or '').lower().strip()}|{amount > 0}"
    return hashlib.md5(normalized.encode()).hexdigest()


def _get_cached_categorization(cache_key: str) -> Optional[Dict]:
    """Get cached categorization if available and not expired."""
    if cache_key in _categorization_cache:
        result, cached_at = _categorization_cache[cache_key]
        if datetime.now(timezone.utc) - cached_at < _CACHE_TTL:
            logger.debug(f"Cache hit for key {cache_key[:8]}...")
            return result
        else:
            del _categorization_cache[cache_key]
    return None


def _cache_categorization(cache_key: str, result: Dict):
    """Cache a categorization result."""
    _categorization_cache[cache_key] = (result, datetime.now(timezone.utc))

    # Limit cache size
    if len(_categorization_cache) > 1000:
        # Remove oldest entries
        sorted_items = sorted(_categorization_cache.items(), key=lambda x: x[1][1])
        for key, _ in sorted_items[:100]:
            del _categorization_cache[key]


def _parse_json_response(text: str) -> Any:
    """Parse JSON from OpenAI response, handling markdown code blocks."""
    text = text.strip()

    # Remove markdown code blocks
    if text.startswith('```'):
        match = re.search(r'```(?:json)?\s*([\s\S]*?)\s*```', text)
        if match:
            text = match.group(1)

    # Try direct parse
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # Try to find JSON array or object
    for pattern in [r'\[[\s\S]*\]', r'\{[\s\S]*\}']:
        match = re.search(pattern, text)
        if match:
            try:
                return json.loads(match.group())
            except json.JSONDecodeError:
                continue

    raise ValueError(f"Could not parse JSON from response: {text[:200]}...")


def _make_ai_request(
    client: BaseAIClient,
    messages: List[Dict],
    model: Optional[str] = None,
    temperature: float = 0.3,
    max_tokens: int = 1000,
    json_mode: bool = False,
) -> str:
    """Make an AI API request via the provider abstraction with retry logic."""

    def _call():
        return client.chat_completion(
            messages=messages,
            model=model,
            temperature=temperature,
            max_tokens=max_tokens,
            json_mode=json_mode,
        )

    return _retry_with_backoff(_call)


def ai_categorize_transaction(
    description: str,
    merchant: Optional[str],
    amount: float,
    available_categories: List[str],
    api_key: Optional[str] = None
) -> Optional[Dict[str, Any]]:
    """
    Use OpenAI to categorize a transaction when rule-based fails.

    Returns:
        Dict with category_name and confidence, or None if AI unavailable/fails
    """
    # Check cache first
    cache_key = _get_cache_key(description, merchant, amount)
    cached = _get_cached_categorization(cache_key)
    if cached:
        return cached

    client = get_ai_client(api_key=api_key)
    if not client:
        return None

    # Escape user input for safety
    safe_description = json.dumps(description)[1:-1]  # Remove quotes
    safe_merchant = json.dumps(merchant or "Unknown")[1:-1]

    system_prompt = """You are a financial transaction categorizer. Your task is to categorize transactions into one of the provided categories.

Rules:
- Consider the transaction description, merchant name, and amount
- Positive amounts are income, negative amounts are expenses
- Be precise - only use categories from the provided list
- Return valid JSON only, no other text"""

    user_prompt = f"""Categorize this transaction:
- Description: {safe_description}
- Merchant: {safe_merchant}
- Amount: ${abs(amount):.2f} ({'income' if amount > 0 else 'expense'})

Available categories: {', '.join(available_categories)}

Respond with JSON: {{"category": "exact_category_name", "confidence": 0.0-1.0, "reasoning": "brief explanation"}}"""

    try:
        result_text = _make_ai_request(
            client,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            temperature=0.2,
            max_tokens=150,
            json_mode=True,
        )

        parsed = _parse_json_response(result_text)

        # Validate the response
        category = parsed.get("category")
        if category and category in available_categories:
            result = {
                "category_name": category,
                "confidence": min(1.0, max(0.0, float(parsed.get("confidence", 0.8)))),
                "reasoning": parsed.get("reasoning", "")
            }
            _cache_categorization(cache_key, result)
            return result
        else:
            logger.warning(f"AI returned invalid category '{category}'. Available: {available_categories}")
            return None

    except Exception as e:
        logger.error(f"AI categorization error: {e}")
        return None


def generate_spending_insights(
    summary: Dict[str, Any],
    transactions: List[Dict[str, Any]],
    previous_month_summary: Optional[Dict[str, Any]] = None,
    api_key: Optional[str] = None
) -> List[Dict[str, str]]:
    """
    Generate AI-powered spending insights and recommendations.

    Returns:
        List of insight dicts with 'type', 'title', 'description'
    """
    client = get_ai_client(api_key=api_key)
    if not client:
        logger.info("AI not available, using rule-based insights")
        return _generate_basic_insights(summary, previous_month_summary, transactions)

    # Build context
    category_breakdown = summary.get("by_category", [])
    total_income = summary.get("total_income", 0)
    total_expenses = summary.get("total_expenses", 0)
    net = total_income - total_expenses
    savings_rate = (net / total_income * 100) if total_income > 0 else 0

    # Format category spending
    category_text = "\n".join([
        f"- {c['category_name']}: ${c['expenses']:.2f} ({c['transactions']} transactions)"
        + (f" [Budget: ${c['budget_limit']:.2f}]" if c.get('budget_limit') else "")
        for c in category_breakdown[:10]
    ])

    # Month-over-month comparison
    comparison_text = ""
    if previous_month_summary:
        prev_expenses = previous_month_summary.get("total_expenses", 0)
        prev_income = previous_month_summary.get("total_income", 0)
        expense_change = total_expenses - prev_expenses
        income_change = total_income - prev_income
        comparison_text = f"""
Month-over-Month:
- Expenses: {'up' if expense_change > 0 else 'down'} ${abs(expense_change):.2f} ({(expense_change/prev_expenses*100) if prev_expenses > 0 else 0:.1f}%)
- Income: {'up' if income_change > 0 else 'down'} ${abs(income_change):.2f}"""

    system_prompt = """You are a personal finance advisor analyzing spending patterns. Provide actionable, specific insights.

Guidelines:
- Be encouraging but honest about concerning patterns
- Give specific, actionable advice (not generic tips)
- Reference actual numbers from the data
- Consider budget limits when mentioned
- Identify trends and patterns"""

    user_prompt = f"""Analyze this monthly financial summary and provide 5-8 personalized insights.

SUMMARY:
- Total Income: ${total_income:.2f}
- Total Expenses: ${total_expenses:.2f}
- Net Savings: ${net:.2f}
- Savings Rate: {savings_rate:.1f}%
{comparison_text}

SPENDING BY CATEGORY:
{category_text}

Provide insights as a JSON array with this exact format:
[
  {{"type": "warning", "title": "Brief Title", "description": "Detailed explanation with specific numbers"}},
  {{"type": "tip", "title": "Brief Title", "description": "Actionable suggestion"}},
  {{"type": "positive", "title": "Brief Title", "description": "Encouragement for good behavior"}},
  {{"type": "anomaly", "title": "Brief Title", "description": "Unusual spending pattern detected"}},
  {{"type": "milestone", "title": "Brief Title", "description": "Financial milestone reached"}},
  {{"type": "trend", "title": "Brief Title", "description": "Trend observation based on data"}}
]

Types:
- "warning": Concerning patterns requiring attention
- "tip": Money-saving opportunities or suggestions
- "positive": Good financial behaviors to reinforce
- "anomaly": Unusual spending patterns or outliers detected
- "milestone": Financial milestones reached or approaching
- "trend": Spending or income trend observations

Include:
- Trend observations from month-over-month changes
- Spending anomalies (unusually large single transactions or category spikes)
- Milestones like savings rate thresholds
- A 50/30/20 rule assessment (needs/wants/savings split)
- Spending concentration analysis (is money going to just 1-2 categories?)
- Highlight the biggest single expense if it's a significant chunk of total spending

Return ONLY the JSON array."""

    try:
        result_text = _make_ai_request(
            client,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            temperature=0.7,
            max_tokens=1200,
            json_mode=True,
        )

        # Handle potential wrapper object from JSON mode
        parsed = _parse_json_response(result_text)

        # If it's an object with an "insights" key, extract the array
        if isinstance(parsed, dict):
            insights = parsed.get("insights", [])
        else:
            insights = parsed

        # Validate each insight
        validated_insights = []
        for insight in insights:
            if isinstance(insight, dict):
                insight_type = insight.get("type", "tip")
                if insight_type not in ["warning", "tip", "positive", "anomaly", "milestone", "trend"]:
                    insight_type = "tip"

                validated_insights.append({
                    "type": insight_type,
                    "title": str(insight.get("title", "Insight"))[:50],
                    "description": str(insight.get("description", ""))[:300]
                })

        if validated_insights:
            return validated_insights[:8]
        else:
            logger.warning("AI returned no valid insights, using fallback")
            return _generate_basic_insights(summary, previous_month_summary, transactions)

    except Exception as e:
        logger.error(f"AI insights error: {e}")
        return _generate_basic_insights(summary, previous_month_summary, transactions)


def _generate_basic_insights(
    summary: Dict[str, Any],
    previous_month_summary: Optional[Dict[str, Any]] = None,
    transactions: Optional[List[Dict[str, Any]]] = None,
) -> List[Dict[str, str]]:
    """Generate rule-based insights when AI is unavailable."""
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
                "title": "Excellent Savings Rate",
                "description": f"You're saving {savings_rate:.1f}% of your income, which exceeds the recommended 20%. Keep up the great work!"
            })
        elif savings_rate < 0:
            insights.append({
                "type": "warning",
                "title": "Spending Exceeds Income",
                "description": f"Your expenses exceed your income by ${abs(net):.2f}. Review your spending to identify areas to cut back."
            })
        elif savings_rate < 10:
            insights.append({
                "type": "tip",
                "title": "Boost Your Savings",
                "description": f"Your savings rate is {savings_rate:.1f}%. Try to increase it to 20% by reducing discretionary spending."
            })
        elif savings_rate < 20:
            insights.append({
                "type": "tip",
                "title": "Good Progress on Savings",
                "description": f"You're saving {savings_rate:.1f}% - aim for 20% to build a stronger financial cushion."
            })

        # Milestone: savings rate crossing 30%
        if savings_rate >= 30:
            insights.append({
                "type": "milestone",
                "title": "Savings Superstar",
                "description": f"Your savings rate of {savings_rate:.1f}% is in the top tier. You're saving nearly a third of your income!"
            })

    # Milestone: positive net for first time
    if net > 0 and total_income > 0:
        prev_net = (previous_month_summary or {}).get("total_income", 0) - (previous_month_summary or {}).get("total_expenses", 0)
        if previous_month_summary and prev_net <= 0:
            insights.append({
                "type": "milestone",
                "title": "Back in the Green",
                "description": f"You've achieved positive net savings of ${net:.2f} this month after a deficit last month."
            })

    # Budget analysis
    over_budget_categories = []
    for cat in summary.get("by_category", []):
        expenses = cat.get("expenses", 0)
        budget = cat.get("budget_limit")

        if budget and expenses > budget:
            pct_over = ((expenses - budget) / budget) * 100
            over_budget_categories.append((cat['category_name'], pct_over, expenses - budget))

    if over_budget_categories:
        worst = max(over_budget_categories, key=lambda x: x[2])
        insights.append({
            "type": "warning",
            "title": f"Over Budget: {worst[0]}",
            "description": f"You've exceeded your {worst[0]} budget by ${worst[2]:.2f} ({worst[1]:.0f}%). Consider adjusting your spending or budget."
        })

    # Top spending category
    categories = summary.get("by_category", [])
    if categories:
        top_cat = max(categories, key=lambda x: x.get("expenses", 0))
        if top_cat.get("expenses", 0) > 0:
            pct_of_total = (top_cat["expenses"] / total_expenses * 100) if total_expenses > 0 else 0
            if pct_of_total > 40:
                insights.append({
                    "type": "tip",
                    "title": f"High Spending on {top_cat['category_name']}",
                    "description": f"{top_cat['category_name']} accounts for {pct_of_total:.0f}% of your spending (${top_cat['expenses']:.2f}). Look for ways to reduce this."
                })

    # Anomaly detection: flag any category where spending is >2x the average
    if categories:
        expense_cats = [c for c in categories if c.get("expenses", 0) > 0]
        if len(expense_cats) >= 2:
            avg_expense = sum(c["expenses"] for c in expense_cats) / len(expense_cats)
            for cat in expense_cats:
                if cat["expenses"] > avg_expense * 2:
                    insights.append({
                        "type": "anomaly",
                        "title": f"Unusual Spending: {cat['category_name']}",
                        "description": f"Spending on {cat['category_name']} (${cat['expenses']:.2f}) is more than double the category average (${avg_expense:.2f})."
                    })

    # Trend: month-over-month direction
    if previous_month_summary:
        prev_expenses = previous_month_summary.get("total_expenses", 0)
        if prev_expenses > 0:
            change_pct = ((total_expenses - prev_expenses) / prev_expenses) * 100
            if change_pct > 10:
                insights.append({
                    "type": "trend",
                    "title": "Spending Trending Up",
                    "description": f"Your expenses increased {change_pct:.1f}% compared to last month (${prev_expenses:.2f} → ${total_expenses:.2f})."
                })
            elif change_pct < -10:
                insights.append({
                    "type": "trend",
                    "title": "Spending Trending Down",
                    "description": f"Your expenses decreased {abs(change_pct):.1f}% compared to last month (${prev_expenses:.2f} → ${total_expenses:.2f})."
                })

    # Subscription check
    for cat in categories:
        if cat.get("category_name") == "Subscriptions" and cat.get("expenses", 0) > 100:
            insights.append({
                "type": "tip",
                "title": "Review Your Subscriptions",
                "description": f"You're spending ${cat['expenses']:.2f}/month on subscriptions. Review for unused services you could cancel."
            })
            break

    # --- NEW: 50/30/20 Rule Check ---
    if total_income > 0 and total_expenses > 0:
        # Needs = housing, groceries, utilities, transportation, insurance
        # Wants = dining, entertainment, shopping, subscriptions
        # Savings = what's left
        needs_keywords = {"housing", "rent", "mortgage", "groceries", "utilities", "transportation",
                          "insurance", "health", "medical", "childcare", "education"}
        wants_keywords = {"dining", "entertainment", "shopping", "subscriptions", "travel",
                          "personal", "clothing", "recreation", "hobbies"}

        needs_total = 0.0
        wants_total = 0.0
        for cat in categories:
            cat_name = cat.get("category_name", "").lower()
            cat_expenses = cat.get("expenses", 0)
            if any(k in cat_name for k in needs_keywords):
                needs_total += cat_expenses
            elif any(k in cat_name for k in wants_keywords):
                wants_total += cat_expenses

        needs_pct = (needs_total / total_income * 100) if total_income > 0 else 0
        wants_pct = (wants_total / total_income * 100) if total_income > 0 else 0
        savings_pct = ((total_income - total_expenses) / total_income * 100) if total_income > 0 else 0

        if needs_pct > 0 or wants_pct > 0:
            # Only show if we could actually classify some categories
            status_parts = []
            if needs_pct > 50:
                status_parts.append(f"needs at {needs_pct:.0f}% (target 50%)")
            if wants_pct > 30:
                status_parts.append(f"wants at {wants_pct:.0f}% (target 30%)")

            if status_parts:
                insights.append({
                    "type": "tip",
                    "title": "50/30/20 Rule Check",
                    "description": f"Your spending split: needs {needs_pct:.0f}%, wants {wants_pct:.0f}%, savings {savings_pct:.0f}%. Adjust {', '.join(status_parts)} to get closer to the ideal 50/30/20 balance."
                })
            else:
                insights.append({
                    "type": "positive",
                    "title": "50/30/20 Rule: On Track",
                    "description": f"Your spending split: needs {needs_pct:.0f}%, wants {wants_pct:.0f}%, savings {savings_pct:.0f}%. You're within healthy budgeting guidelines."
                })

    # --- NEW: Biggest Single Expense Spotlight ---
    if transactions:
        expense_txns = [t for t in transactions if t.get("amount", 0) < 0]
        if expense_txns:
            biggest = max(expense_txns, key=lambda t: abs(t.get("amount", 0)))
            biggest_amt = abs(biggest.get("amount", 0))
            biggest_desc = biggest.get("description", "Unknown")[:40]
            if total_expenses > 0:
                pct_of_total = (biggest_amt / total_expenses) * 100
                if pct_of_total > 15:
                    insights.append({
                        "type": "anomaly",
                        "title": "Biggest Single Expense",
                        "description": f"\"{biggest_desc}\" at ${biggest_amt:.2f} accounts for {pct_of_total:.0f}% of your total spending this month. Make sure large one-time expenses don't become a pattern."
                    })

    # --- NEW: Spending Diversity Score ---
    if categories:
        expense_cats = [c for c in categories if c.get("expenses", 0) > 0]
        if len(expense_cats) >= 3 and total_expenses > 0:
            # Calculate how concentrated spending is (HHI-style)
            shares = [(c["expenses"] / total_expenses) for c in expense_cats]
            hhi = sum(s * s for s in shares)
            # HHI ranges from 1/n (perfectly spread) to 1.0 (all in one category)
            # Convert to a 0-100 "diversity" score where 100 = perfectly spread
            min_hhi = 1.0 / len(expense_cats)
            diversity = max(0, (1.0 - hhi) / (1.0 - min_hhi)) * 100 if len(expense_cats) > 1 else 0

            if diversity < 40:
                top_names = ", ".join(c["category_name"] for c in sorted(expense_cats, key=lambda x: x["expenses"], reverse=True)[:2])
                insights.append({
                    "type": "trend",
                    "title": "Spending Is Concentrated",
                    "description": f"Your spending diversity score is {diversity:.0f}/100. Most of your money goes to {top_names}. A more balanced spread can reveal savings opportunities."
                })
            elif diversity > 75:
                insights.append({
                    "type": "positive",
                    "title": "Well-Balanced Spending",
                    "description": f"Your spending diversity score is {diversity:.0f}/100. Expenses are spread across {len(expense_cats)} categories, suggesting a balanced lifestyle."
                })

    # Positive if nothing concerning
    if not insights:
        insights.append({
            "type": "positive",
            "title": "Finances Looking Good",
            "description": "Your spending is within reasonable limits. Keep monitoring your budget to maintain good financial health."
        })

    return insights[:8]


def ai_review_transactions(
    transactions: List[Dict[str, Any]],
    available_categories: List[Dict[str, Any]],
    api_key: Optional[str] = None
) -> List[Dict[str, Any]]:
    """
    Use AI to review and enhance parsed transactions:
    - Assign appropriate categories based on context
    - Clean up messy descriptions
    - Extract merchant names
    - Identify patterns (salary, recurring expenses, etc.)

    Args:
        transactions: List of parsed transactions with date, description, amount
        available_categories: List of category dicts with id, name, is_income
        api_key: Optional OpenAI API key

    Returns:
        Enhanced transactions with suggested_category_id, clean_description, merchant
    """
    client = get_ai_client(api_key=api_key)
    if not client or not transactions:
        return transactions

    # Build category info
    income_categories = [c for c in available_categories if c.get('is_income')]
    expense_categories = [c for c in available_categories if not c.get('is_income')]

    category_info = f"""INCOME CATEGORIES:
{chr(10).join([f'- {c["name"]} (id: {c["id"]})' for c in income_categories])}

EXPENSE CATEGORIES:
{chr(10).join([f'- {c["name"]} (id: {c["id"]})' for c in expense_categories])}"""

    # Process in batches to avoid token limits
    BATCH_SIZE = 30
    enhanced_transactions = []

    for batch_start in range(0, len(transactions), BATCH_SIZE):
        batch = transactions[batch_start:batch_start + BATCH_SIZE]

        # Format transactions for the prompt
        txn_list = []
        for i, t in enumerate(batch):
            txn_list.append({
                "idx": batch_start + i,
                "date": t.get("date", ""),
                "desc": t.get("description", "")[:200],  # Limit description length
                "amt": t.get("amount", 0)
            })

        system_prompt = """You are a financial transaction analyzer. Your job is to:
1. Identify the correct category based on context
2. Clean up messy bank descriptions into readable text
3. Extract merchant/payee names

Important rules:
- Large regular deposits (>$3000) are usually SALARY, not subscriptions
- Company names with large amounts often indicate employers
- Small recurring charges are likely subscriptions
- "TRANSFER" usually means expense unless clearly income
- Be smart about context: "APPLE" could be salary (employer) or purchase (small amount)
- Return ONLY valid JSON array"""

        user_prompt = f"""Analyze these transactions and categorize each one:

{category_info}

TRANSACTIONS:
{json.dumps(txn_list, indent=2)}

For each transaction, return:
- idx: the transaction index
- cat_id: category ID from the list above
- clean: cleaned-up description (human-readable, remove codes/references)
- merchant: extracted merchant/payee name

Return a JSON object with an "results" array:
{{"results": [{{"idx": 0, "cat_id": 1, "clean": "Salary from Company", "merchant": "Company Name"}}, ...]}}"""

        try:
            result_text = _make_ai_request(
                client,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.2,
                max_tokens=2000,
                json_mode=True,
            )

            parsed = _parse_json_response(result_text)

            # Handle both direct array and wrapped object
            if isinstance(parsed, dict):
                ai_results = parsed.get("results", [])
            else:
                ai_results = parsed

            # Create lookup by index
            ai_lookup = {r.get("idx", r.get("index")): r for r in ai_results}

            # Enhance batch transactions
            for i, t in enumerate(batch):
                enhanced = dict(t)
                global_idx = batch_start + i

                if global_idx in ai_lookup:
                    ai_data = ai_lookup[global_idx]

                    # Validate category_id exists
                    cat_id = ai_data.get("cat_id", ai_data.get("category_id"))
                    valid_cat_ids = {c["id"] for c in available_categories}

                    if cat_id in valid_cat_ids:
                        enhanced["suggested_category_id"] = cat_id

                    enhanced["clean_description"] = ai_data.get("clean", ai_data.get("clean_description", t.get("description")))
                    enhanced["merchant"] = ai_data.get("merchant")
                    enhanced["ai_reviewed"] = True

                enhanced_transactions.append(enhanced)

        except Exception as e:
            logger.error(f"AI review error for batch starting at {batch_start}: {e}")
            # Return original transactions for this batch
            for t in batch:
                enhanced = dict(t)
                enhanced["ai_reviewed"] = False
                enhanced_transactions.append(enhanced)

    return enhanced_transactions


def generate_enhanced_spending_insights(
    summary: Dict[str, Any],
    transactions: List[Dict[str, Any]],
    previous_month_summary: Optional[Dict[str, Any]] = None,
    cash_flow_data: Optional[List[Dict[str, Any]]] = None,
    subscriptions: Optional[List[Dict[str, Any]]] = None,
    api_key: Optional[str] = None
) -> Dict[str, Any]:
    """
    Enhanced spending insights combining core insights, trend analysis, and subscription tips.

    Returns:
        Dict with 'insights', 'trend_analysis', 'subscription_suggestions'
    """
    # Core insights
    insights = generate_spending_insights(summary, transactions, previous_month_summary, api_key)

    result: Dict[str, Any] = {"insights": insights}

    # Trend analysis if we have enough data
    if cash_flow_data and len(cash_flow_data) >= 2:
        trend = ai_analyze_spending_trends(cash_flow_data, api_key)
        if trend:
            result["trend_analysis"] = trend

    # Subscription optimization suggestions
    if subscriptions:
        active_subs = [s for s in subscriptions if s.get("is_active", True)]
        if active_subs:
            total_monthly = 0.0
            suggestions = []
            for sub in active_subs:
                amount = abs(sub.get("amount", 0))
                freq = sub.get("frequency", "monthly")
                monthly = amount if freq == "monthly" else amount / 12 if freq == "yearly" else amount
                total_monthly += monthly

            if total_monthly > 50:
                suggestions.append({
                    "type": "tip",
                    "title": "Subscription Audit",
                    "description": f"You're spending ${total_monthly:.2f}/month on {len(active_subs)} subscriptions (${total_monthly * 12:.2f}/year). Review each for value."
                })

            # Flag expensive individual subscriptions
            for sub in active_subs:
                amount = abs(sub.get("amount", 0))
                if amount > 30:
                    suggestions.append({
                        "type": "tip",
                        "title": f"Review {sub.get('name', 'Subscription')}",
                        "description": f"At ${amount:.2f}/{sub.get('frequency', 'month')}, check if you're fully utilizing this service."
                    })

            if suggestions:
                result["subscription_suggestions"] = suggestions[:5]

    return result


def generate_dashboard_insights(
    networth_data: Dict[str, Any],
    networth_history: List[Dict[str, Any]],
    portfolio_data: List[Dict[str, Any]],
    property_data: List[Dict[str, Any]],
    liability_data: List[Dict[str, Any]],
    account_summary: Dict[str, Any],
    api_key: Optional[str] = None
) -> List[Dict[str, str]]:
    """
    Generate AI-powered dashboard insights covering the holistic financial picture.

    Returns:
        List of insight dicts with 'type', 'title', 'description'
    """
    client = get_ai_client(api_key=api_key)
    if not client:
        logger.info("AI not available, using rule-based dashboard insights")
        return _generate_basic_dashboard_insights(
            networth_data, portfolio_data, property_data, liability_data, account_summary
        )

    # Build context
    net_worth = networth_data.get("net_worth", 0)
    total_assets = networth_data.get("total_assets", 0)
    total_liabilities = networth_data.get("total_liabilities", 0)
    breakdown = networth_data.get("breakdown", {})

    # Portfolio summary
    portfolio_text = ""
    if portfolio_data:
        top_holdings = sorted(portfolio_data, key=lambda x: abs(x.get("current_value", 0)), reverse=True)[:5]
        portfolio_text = "Top Holdings:\n" + "\n".join([
            f"- {h.get('ticker', '?')}: ${h.get('current_value', 0):.2f} (P&L: {h.get('gain_percent', 0):.1f}%)"
            for h in top_holdings
        ])

    # Property summary
    property_text = ""
    if property_data:
        property_text = "Properties:\n" + "\n".join([
            f"- {p.get('name', '?')}: Value ${p.get('current_value', 0):.2f}, Equity ${p.get('equity', 0):.2f}"
            for p in property_data
        ])

    # Net worth history
    history_text = ""
    if networth_history and len(networth_history) >= 2:
        recent = networth_history[-1]
        older = networth_history[0]
        change = recent.get("net_worth", 0) - older.get("net_worth", 0)
        history_text = f"Net worth change over {len(networth_history)} data points: ${change:+,.2f}"

    # Liability detail
    liability_text = ""
    if liability_data:
        liability_text = "Liabilities:\n" + "\n".join([
            f"- {l.get('name', '?')}: ${l.get('balance', 0):,.2f} ({l.get('category', 'other')})"
            for l in liability_data
        ])

    system_prompt = """You are a sharp personal finance advisor reviewing someone's complete financial picture.
Your insights should feel like advice from a smart friend who happens to be a financial planner.

Rules:
- Reference SPECIFIC numbers, percentages, and dollar amounts from the data
- Each insight should be ACTIONABLE — tell them exactly what to consider doing
- Don't be generic. "Diversify your portfolio" is bad. "BTC-USD is 73% of your portfolio — consider trimming to 30% and spreading across 2-3 index funds" is good.
- Mix tone: celebrate wins, flag real risks, give practical next steps
- Compare ratios to benchmarks (debt-to-asset < 30% is healthy, emergency fund = 3-6 months, etc.)
- If they have unrealized gains, mention tax-loss harvesting or rebalancing
- If they have real estate, discuss equity position and LTV ratios"""

    user_prompt = f"""Analyze this financial snapshot and provide 5-7 specific, actionable insights.

NET WORTH: ${net_worth:,.2f}
- Total Assets: ${total_assets:,.2f}
- Total Liabilities: ${total_liabilities:,.2f}
- Cash & Bank Accounts: ${breakdown.get('cash_accounts', 0):,.2f}
- Investment Portfolio: ${breakdown.get('investments', 0):,.2f}
- Real Estate Value: ${breakdown.get('real_estate', 0):,.2f}
- Mortgage Balance: ${breakdown.get('mortgages', 0):,.2f}

{portfolio_text}
{property_text}
{liability_text}
{history_text}

Accounts: {account_summary.get('count', 0)} accounts across types: {', '.join(account_summary.get('types', []))}

Provide insights as JSON:
{{"insights": [
  {{"type": "warning|tip|positive|milestone|trend", "title": "Concise but specific title", "description": "2-3 sentences with specific numbers and actionable advice"}}
]}}

Types:
- "warning": Real risks that need attention (concentration, high leverage, low cash buffer)
- "tip": Specific optimizations (rebalancing, tax strategies, debt payoff order)
- "positive": Celebrate genuine strengths with context (compare to benchmarks)
- "milestone": Net worth or portfolio milestones with progress to next one
- "trend": Directional observations backed by data

Return ONLY the JSON object."""

    try:
        result_text = _make_ai_request(
            client,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            temperature=0.7,
            max_tokens=1200,
            json_mode=True,
        )

        parsed = _parse_json_response(result_text)
        if isinstance(parsed, dict):
            insights = parsed.get("insights", [])
        else:
            insights = parsed

        validated = []
        for insight in insights:
            if isinstance(insight, dict):
                insight_type = insight.get("type", "tip")
                if insight_type not in ["warning", "tip", "positive", "milestone", "trend"]:
                    insight_type = "tip"
                validated.append({
                    "type": insight_type,
                    "title": str(insight.get("title", "Insight"))[:50],
                    "description": str(insight.get("description", ""))[:300]
                })

        if validated:
            return validated[:6]

        return _generate_basic_dashboard_insights(
            networth_data, portfolio_data, property_data, liability_data, account_summary
        )

    except Exception as e:
        logger.error(f"Dashboard insights error: {e}")
        return _generate_basic_dashboard_insights(
            networth_data, portfolio_data, property_data, liability_data, account_summary
        )


def _generate_basic_dashboard_insights(
    networth_data: Dict[str, Any],
    portfolio_data: List[Dict[str, Any]],
    property_data: List[Dict[str, Any]],
    liability_data: List[Dict[str, Any]],
    account_summary: Dict[str, Any],
) -> List[Dict[str, str]]:
    """Rule-based dashboard insights fallback."""
    insights = []
    total_assets = networth_data.get("total_assets", 0)
    total_liabilities = networth_data.get("total_liabilities", 0)
    net_worth = networth_data.get("net_worth", 0)
    breakdown = networth_data.get("breakdown", {})
    cash = breakdown.get("cash_accounts", 0)
    investments = breakdown.get("investments", 0)
    real_estate = breakdown.get("real_estate", 0)
    mortgages = breakdown.get("mortgages", 0)

    # --- Asset Allocation Analysis ---
    if total_assets > 0:
        cash_pct = cash / total_assets * 100
        invest_pct = investments / total_assets * 100
        re_pct = real_estate / total_assets * 100

        # Flag if too much cash (opportunity cost)
        if cash_pct > 60 and cash > 50000:
            insights.append({
                "type": "tip",
                "title": "Cash-Heavy Allocation",
                "description": f"{cash_pct:.0f}% of your assets (${cash:,.0f}) sit in cash. Consider investing some for long-term growth — even a conservative index fund historically outpaces savings rates."
            })
        # Flag if heavily concentrated in one asset class
        if re_pct > 70 and real_estate > 0:
            insights.append({
                "type": "warning",
                "title": "Real Estate Concentration",
                "description": f"Real estate makes up {re_pct:.0f}% of your total assets. This illiquidity could be a risk if you need funds quickly. Consider building liquid reserves."
            })

    # --- Debt-to-Asset Ratio ---
    if total_assets > 0:
        debt_ratio = total_liabilities / total_assets
        if debt_ratio > 0.5:
            insights.append({
                "type": "warning",
                "title": "High Debt-to-Asset Ratio",
                "description": f"Liabilities are {debt_ratio:.0%} of your assets (${total_liabilities:,.0f} / ${total_assets:,.0f}). Prioritize paying down high-interest debt to improve your financial position."
            })
        elif debt_ratio < 0.1 and total_liabilities > 0:
            insights.append({
                "type": "positive",
                "title": "Excellent Debt Position",
                "description": f"Your debt is just {debt_ratio:.0%} of total assets — well below the 30% threshold. This gives you strong financial flexibility."
            })

    # --- Portfolio Analysis ---
    if portfolio_data:
        total_portfolio = sum(abs(h.get("current_value", 0)) for h in portfolio_data)
        total_gain = sum(h.get("unrealized_gain", 0) for h in portfolio_data)
        winners = [h for h in portfolio_data if h.get("unrealized_gain", 0) > 0]
        losers = [h for h in portfolio_data if h.get("unrealized_gain", 0) < 0]

        if total_portfolio > 0:
            # Concentration risk
            sorted_holdings = sorted(portfolio_data, key=lambda x: abs(x.get("current_value", 0)), reverse=True)
            top = sorted_holdings[0] if sorted_holdings else None
            if top:
                pct = abs(top.get("current_value", 0)) / total_portfolio * 100
                if pct > 40:
                    insights.append({
                        "type": "warning",
                        "title": f"Portfolio Concentrated in {top.get('ticker', '?')}",
                        "description": f"{top.get('ticker', '?')} is {pct:.0f}% of your portfolio (${abs(top.get('current_value', 0)):,.0f}). A single bad day could significantly impact your wealth. Diversification reduces this risk."
                    })

            # Overall P&L
            if total_gain > 0:
                gain_pct = (total_gain / (total_portfolio - total_gain)) * 100 if (total_portfolio - total_gain) > 0 else 0
                insights.append({
                    "type": "positive",
                    "title": f"Portfolio Up ${total_gain:,.0f}",
                    "description": f"Your investments have gained ${total_gain:,.0f} ({gain_pct:.1f}%) overall. {len(winners)} of {len(portfolio_data)} positions are profitable."
                })
            elif total_gain < 0:
                loss_pct = (total_gain / (total_portfolio - total_gain)) * 100 if (total_portfolio - total_gain) > 0 else 0
                insights.append({
                    "type": "warning",
                    "title": f"Portfolio Down ${abs(total_gain):,.0f}",
                    "description": f"Your investments are down ${abs(total_gain):,.0f} ({loss_pct:.1f}%). {len(losers)} of {len(portfolio_data)} positions are underwater. Stay focused on your long-term strategy."
                })

            # Best and worst performers
            if len(portfolio_data) >= 3:
                best = max(portfolio_data, key=lambda h: h.get("gain_percent", 0))
                worst = min(portfolio_data, key=lambda h: h.get("gain_percent", 0))
                if best.get("gain_percent", 0) > 10:
                    insights.append({
                        "type": "trend",
                        "title": f"Top Performer: {best.get('ticker', '?')}",
                        "description": f"{best.get('ticker', '?')} leads your portfolio at {best.get('gain_percent', 0):+.1f}% (${best.get('unrealized_gain', 0):+,.0f}). Consider whether it's time to take some profits."
                    })
                if worst.get("gain_percent", 0) < -10:
                    insights.append({
                        "type": "warning",
                        "title": f"Underperformer: {worst.get('ticker', '?')}",
                        "description": f"{worst.get('ticker', '?')} is down {worst.get('gain_percent', 0):.1f}% (${worst.get('unrealized_gain', 0):,.0f}). Evaluate if your thesis still holds or if it's time to cut losses."
                    })

    # --- Liability Analysis ---
    if liability_data:
        high_balance = [l for l in liability_data if l.get("balance", 0) > 10000]
        if high_balance:
            largest = max(high_balance, key=lambda l: l.get("balance", 0))
            insights.append({
                "type": "tip",
                "title": f"Largest Debt: {largest.get('name', 'Unknown')}",
                "description": f"{largest.get('name', 'This liability')} has a balance of ${largest.get('balance', 0):,.0f}. Increasing payments by even 10% can significantly reduce total interest paid."
            })

    # --- Real Estate Equity ---
    for prop in property_data:
        equity = prop.get("equity", 0)
        current_value = prop.get("current_value", 0)
        purchase = prop.get("purchase_price", 0)
        if purchase > 0 and current_value > 0:
            appreciation = ((current_value - purchase) / purchase) * 100
            ltv = ((current_value - equity) / current_value * 100) if current_value > 0 else 0
            if appreciation > 0:
                insights.append({
                    "type": "positive",
                    "title": f"{prop.get('name', 'Property')}: {appreciation:.0f}% Appreciation",
                    "description": f"This property has appreciated from ${purchase:,.0f} to ${current_value:,.0f}. Your equity stands at ${equity:,.0f} with a {ltv:.0f}% loan-to-value ratio."
                })
            elif ltv > 80:
                insights.append({
                    "type": "tip",
                    "title": f"High LTV on {prop.get('name', 'Property')}",
                    "description": f"Your loan-to-value ratio is {ltv:.0f}% — above the 80% threshold. This may mean you're paying PMI. Extra principal payments could help."
                })

    # --- Net Worth Milestones ---
    milestones = [10_000_000, 5_000_000, 1_000_000, 500_000, 100_000, 50_000]
    for milestone in milestones:
        if net_worth >= milestone:
            if milestone >= 1_000_000:
                label = f"${milestone / 1_000_000:.0f}M"
            else:
                label = f"${milestone / 1000:.0f}K"
            # How close to next milestone?
            next_milestones = [m for m in milestones if m > milestone]
            next_ms = next_milestones[-1] if next_milestones else None
            next_text = ""
            if next_ms:
                remaining = next_ms - net_worth
                if next_ms >= 1_000_000:
                    next_label = f"${next_ms / 1_000_000:.0f}M"
                else:
                    next_label = f"${next_ms / 1000:.0f}K"
                pct_there = (net_worth / next_ms) * 100
                next_text = f" You're {pct_there:.0f}% of the way to {next_label} — ${remaining:,.0f} to go."
            insights.append({
                "type": "milestone",
                "title": f"Net Worth: {label}+",
                "description": f"Your net worth of ${net_worth:,.0f} has passed the {label} mark.{next_text}"
            })
            break

    # --- Emergency Fund Assessment ---
    if cash > 0 and total_assets > 0:
        # Rough monthly expense estimate: liabilities payments + ~2% of non-investment assets
        est_monthly = max(3000, total_liabilities * 0.02 + cash * 0.05)
        months_covered = cash / est_monthly if est_monthly > 0 else 0
        if months_covered >= 6:
            insights.append({
                "type": "positive",
                "title": f"{months_covered:.0f} Months Cash Runway",
                "description": f"Your cash reserves of ${cash:,.0f} could cover an estimated {months_covered:.0f} months of expenses. This is a strong safety net."
            })
        elif months_covered < 3:
            insights.append({
                "type": "tip",
                "title": "Build Your Cash Buffer",
                "description": f"Your cash of ${cash:,.0f} covers roughly {months_covered:.1f} months. Financial experts recommend 3-6 months of expenses in liquid reserves."
            })

    if not insights:
        insights.append({
            "type": "positive",
            "title": "Financial Overview",
            "description": f"Your net worth is ${net_worth:,.0f} across {account_summary.get('count', 0)} accounts. Keep tracking to identify trends and opportunities."
        })

    return insights[:8]


def generate_financial_stories(
    networth_data: Dict[str, Any],
    budget_summary: Optional[Dict[str, Any]] = None,
    portfolio_data: Optional[List[Dict[str, Any]]] = None,
    property_data: Optional[List[Dict[str, Any]]] = None,
    recent_transactions: Optional[List[Dict[str, Any]]] = None,
    seed: Optional[int] = None,
    api_key: Optional[str] = None
) -> List[Dict[str, Any]]:
    """
    Generate engaging financial narratives connecting different data points.

    Returns:
        List of story dicts with 'type', 'emoji', 'headline', 'narrative', 'data_points'
    """
    client = get_ai_client(api_key=api_key)
    if not client:
        logger.info("AI not available, using rule-based financial stories")
        return _generate_basic_stories(networth_data, budget_summary, portfolio_data, property_data)

    # Build context
    net_worth = networth_data.get("net_worth", 0)
    breakdown = networth_data.get("breakdown", {})

    context_parts = [f"Net Worth: ${net_worth:,.2f}"]
    context_parts.append(f"Cash: ${breakdown.get('cash_accounts', 0):,.2f}")
    context_parts.append(f"Investments: ${breakdown.get('investments', 0):,.2f}")
    context_parts.append(f"Real Estate: ${breakdown.get('real_estate', 0):,.2f}")

    if budget_summary:
        income = budget_summary.get("total_income", 0)
        expenses = budget_summary.get("total_expenses", 0)
        context_parts.append(f"Monthly Income: ${income:,.2f}")
        context_parts.append(f"Monthly Expenses: ${expenses:,.2f}")

    if portfolio_data:
        top = sorted(portfolio_data, key=lambda x: abs(x.get("current_value", 0)), reverse=True)[:3]
        context_parts.append("Top holdings: " + ", ".join(
            f"{h.get('ticker', '?')} (${h.get('current_value', 0):,.2f}, {h.get('gain_percent', 0):+.1f}%)" for h in top
        ))

    if property_data:
        context_parts.append("Properties: " + ", ".join(
            f"{p.get('name', '?')} (${p.get('current_value', 0):,.2f})" for p in property_data
        ))

    system_prompt = """You are a creative financial storyteller who makes people excited about their money.
Turn raw financial data into vivid, memorable narratives that change how someone THINKS about their wealth.

Style guide:
- Use concrete comparisons people can feel ("enough to buy a Tesla", "like getting a free vacation every month")
- Connect seemingly unrelated data points in surprising ways
- Each story should have one "wow moment" — a reframing that makes the reader pause
- Be warm and encouraging, but never patronizing
- Reference real numbers — vagueness kills stories
- Vary your angles: one story about growth, one about perspective, one about a specific win or opportunity"""

    seed_text = f"\nVariation seed: {seed}" if seed else ""

    # Add recent transaction context if available
    txn_context = ""
    if recent_transactions:
        txn_context = "\nRecent notable transactions:\n" + "\n".join([
            f"- {t.get('date', '?')}: {t.get('description', '?')} ${t.get('amount', 0):,.2f}"
            for t in recent_transactions[:10]
        ])

    user_prompt = f"""Create 3 engaging financial stories from this data. Each should make the reader feel something.

{chr(10).join(context_parts)}
{txn_context}
{seed_text}

Return JSON:
{{"stories": [
  {{
    "type": "comparison|milestone|perspective|growth",
    "emoji": "single emoji",
    "headline": "Punchy 5-8 word headline",
    "narrative": "2-3 sentence engaging narrative that connects data points with a vivid comparison or reframing. Include specific dollar amounts.",
    "data_points": ["formatted stat 1", "formatted stat 2", "formatted stat 3"]
  }}
]}}

Story ideas to consider:
- Compare their portfolio gains to something tangible (months of rent, a car, a vacation)
- Frame their savings rate as "days of freedom earned per month"
- Show how their real estate equity has grown vs. what they originally put down
- Compare their net worth to milestones and show progress to the next one
- Turn their diversification into a story about resilience

Return ONLY the JSON object."""

    try:
        result_text = _make_ai_request(
            client,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            temperature=0.85,
            max_tokens=1200,
            json_mode=True,
        )

        parsed = _parse_json_response(result_text)
        if isinstance(parsed, dict):
            stories = parsed.get("stories", [])
        else:
            stories = parsed

        validated = []
        for story in stories:
            if isinstance(story, dict):
                validated.append({
                    "type": story.get("type", "perspective"),
                    "emoji": str(story.get("emoji", "💡"))[:2],
                    "headline": str(story.get("headline", "Your Financial Story"))[:80],
                    "narrative": str(story.get("narrative", ""))[:500],
                    "data_points": story.get("data_points", [])[:5],
                })

        if validated:
            return validated[:3]

        return _generate_basic_stories(networth_data, budget_summary, portfolio_data, property_data)

    except Exception as e:
        logger.error(f"Financial stories error: {e}")
        return _generate_basic_stories(networth_data, budget_summary, portfolio_data, property_data)


def _generate_basic_stories(
    networth_data: Dict[str, Any],
    budget_summary: Optional[Dict[str, Any]] = None,
    portfolio_data: Optional[List[Dict[str, Any]]] = None,
    property_data: Optional[List[Dict[str, Any]]] = None,
) -> List[Dict[str, Any]]:
    """Rule-based financial stories fallback."""
    stories = []
    net_worth = networth_data.get("net_worth", 0)
    total_assets = networth_data.get("total_assets", 0)
    total_liabilities = networth_data.get("total_liabilities", 0)
    breakdown = networth_data.get("breakdown", {})
    cash = breakdown.get("cash_accounts", 0)
    investments = breakdown.get("investments", 0)
    real_estate = breakdown.get("real_estate", 0)

    # Story: Portfolio performance narrative
    if portfolio_data:
        total_gain = sum(h.get("unrealized_gain", 0) or 0 for h in portfolio_data)
        total_value = sum(abs(h.get("current_value", 0)) for h in portfolio_data)
        winners = sorted([h for h in portfolio_data if h.get("unrealized_gain", 0) > 0],
                         key=lambda x: x.get("unrealized_gain", 0), reverse=True)
        losers = sorted([h for h in portfolio_data if h.get("unrealized_gain", 0) < 0],
                        key=lambda x: x.get("unrealized_gain", 0))

        if total_gain > 0 and total_value > 0:
            gain_pct = (total_gain / (total_value - total_gain)) * 100 if (total_value - total_gain) > 0 else 0
            best = winners[0] if winners else None
            best_text = f" {best.get('ticker', '?')} leads the pack at {best.get('gain_percent', 0):+.1f}%." if best else ""
            stories.append({
                "type": "growth",
                "emoji": "📈",
                "headline": "Your Money Is Making Money",
                "narrative": f"Your portfolio has earned ${total_gain:,.0f} in unrealized gains ({gain_pct:.1f}% return).{best_text} That's money working for you while you sleep.",
                "data_points": [
                    f"${total_gain:,.0f} total gains",
                    f"{len(winners)} winners, {len(losers)} losers",
                    f"${total_value:,.0f} portfolio value",
                ],
            })
        elif total_gain < 0 and budget_summary:
            # Compare losses to expenses for perspective
            expenses = budget_summary.get("total_expenses", 0)
            if expenses > 0:
                months_of_expenses = abs(total_gain) / expenses
                stories.append({
                    "type": "perspective",
                    "emoji": "🔄",
                    "headline": "Markets Give and Take",
                    "narrative": f"Your portfolio is down ${abs(total_gain):,.0f} — equivalent to about {months_of_expenses:.1f} months of your spending. Markets are cyclical; historically, patience has been rewarded.",
                    "data_points": [
                        f"${abs(total_gain):,.0f} unrealized loss",
                        f"~{months_of_expenses:.1f} months of expenses",
                    ],
                })

    # Story: Investment gains vs monthly spending
    if budget_summary and portfolio_data:
        total_gain = sum(h.get("unrealized_gain", 0) or 0 for h in portfolio_data)
        expenses = budget_summary.get("total_expenses", 0)
        income = budget_summary.get("total_income", 0)
        if total_gain > 0 and expenses > 0:
            months_covered = total_gain / expenses
            stories.append({
                "type": "comparison",
                "emoji": "⚖️",
                "headline": "Gains vs. Spending: The Scoreboard",
                "narrative": f"Your investment gains of ${total_gain:,.0f} could fund {months_covered:.1f} months of your current lifestyle (${expenses:,.0f}/month). That's passive wealth building in action.",
                "data_points": [f"${total_gain:,.0f} in gains", f"{months_covered:.1f} months funded"],
            })
        if income > 0 and expenses > 0:
            savings = income - expenses
            if savings > 0:
                savings_rate = (savings / income) * 100
                # How long until you could take a month off?
                daily_cost = expenses / 30
                freedom_days = savings / daily_cost if daily_cost > 0 else 0
                stories.append({
                    "type": "perspective",
                    "emoji": "🏖️",
                    "headline": f"Saving {savings_rate:.0f}% of Your Income",
                    "narrative": f"You're keeping ${savings:,.0f} each month — that buys you {freedom_days:.0f} extra days of financial runway. At this pace, your cash reserves alone could sustain you for {cash / expenses:.1f} months." if cash > 0 and expenses > 0 else f"You're keeping ${savings:,.0f} each month — that buys you {freedom_days:.0f} extra days of financial runway every single month.",
                    "data_points": [
                        f"{savings_rate:.0f}% savings rate",
                        f"${savings:,.0f}/month saved",
                        f"{freedom_days:.0f} days of freedom",
                    ],
                })

    # Story: Wealth composition
    if net_worth > 0 and total_assets > 0:
        parts = []
        if cash > 0:
            parts.append(("cash", cash, cash / total_assets * 100))
        if investments > 0:
            parts.append(("investments", investments, investments / total_assets * 100))
        if real_estate > 0:
            parts.append(("real estate", real_estate, real_estate / total_assets * 100))

        parts.sort(key=lambda x: x[1], reverse=True)
        biggest = parts[0] if parts else None

        # Calculate assets-per-liability ratio
        leverage_text = ""
        if total_liabilities > 0:
            ratio = total_assets / total_liabilities
            leverage_text = f" For every $1 of debt, you have ${ratio:.2f} in assets."

        if biggest:
            stories.append({
                "type": "milestone",
                "emoji": "🎯",
                "headline": f"${net_worth:,.0f} and Growing",
                "narrative": f"Your wealth is anchored by {biggest[0]} ({biggest[2]:.0f}% of assets at ${biggest[1]:,.0f}).{leverage_text} Diversification across {len(parts)} asset classes helps protect against downturns.",
                "data_points": [
                    f"${net_worth:,.0f} net worth",
                    *[f"{p[0].title()}: ${p[1]:,.0f}" for p in parts[:3]],
                ],
            })

    # Story: Real estate equity
    if property_data:
        total_equity = sum(p.get("equity", 0) for p in property_data)
        total_prop_value = sum(p.get("current_value", 0) for p in property_data)
        if total_equity > 0 and total_prop_value > 0:
            equity_pct = (total_equity / total_prop_value) * 100
            stories.append({
                "type": "growth",
                "emoji": "🏠",
                "headline": f"${total_equity:,.0f} in Home Equity",
                "narrative": f"You own {equity_pct:.0f}% of your ${total_prop_value:,.0f} in real estate. Every mortgage payment builds this equity — it's forced savings that grows with property values.",
                "data_points": [
                    f"${total_equity:,.0f} equity",
                    f"{equity_pct:.0f}% ownership",
                    f"{len(property_data)} properties",
                ],
            })

    if not stories:
        stories.append({
            "type": "growth",
            "emoji": "🌱",
            "headline": "Your Financial Journey Begins",
            "narrative": "Every great fortune started with a single step — tracking it. Add accounts, investments, and property to unlock personalized financial stories and insights.",
            "data_points": [],
        })

    return stories[:3]


def ai_analyze_spending_trends(
    monthly_data: List[Dict[str, Any]],
    api_key: Optional[str] = None
) -> Optional[Dict[str, Any]]:
    """
    Analyze spending trends over multiple months.

    Args:
        monthly_data: List of monthly summaries with income, expenses, by_category
        api_key: Optional OpenAI API key

    Returns:
        Dict with trend analysis, predictions, and recommendations
    """
    client = get_ai_client(api_key=api_key)
    if not client or len(monthly_data) < 2:
        return None

    # Format the data
    months_text = "\n".join([
        f"- {m.get('month', 'Unknown')}: Income ${m.get('total_income', 0):.2f}, Expenses ${m.get('total_expenses', 0):.2f}, Net ${m.get('net', 0):.2f}"
        for m in monthly_data[-6:]  # Last 6 months
    ])

    system_prompt = """You are a financial analyst. Analyze spending trends and provide insights about:
1. Overall financial trajectory
2. Concerning patterns or improvements
3. Predictions for next month
4. Specific actionable recommendations"""

    user_prompt = f"""Analyze these monthly financial summaries:

{months_text}

Provide analysis as JSON:
{{
  "trend": "improving|stable|declining",
  "trend_description": "One sentence summary",
  "next_month_prediction": {{"income": number, "expenses": number}},
  "key_observations": ["observation 1", "observation 2"],
  "recommendations": ["specific action 1", "specific action 2"]
}}"""

    try:
        result_text = _make_ai_request(
            client,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            temperature=0.5,
            max_tokens=500,
            json_mode=True,
        )

        return _parse_json_response(result_text)

    except Exception as e:
        logger.error(f"Trend analysis error: {e}")
        return None
