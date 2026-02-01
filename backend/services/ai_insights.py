"""
AI-powered insights service using OpenAI.
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
from datetime import datetime, timedelta
from functools import lru_cache
import time

# Configure logging
logger = logging.getLogger(__name__)

# Module-level API key cache
_cached_api_key: Optional[str] = None

# Simple in-memory cache for categorizations
_categorization_cache: Dict[str, Tuple[Dict, datetime]] = {}
_CACHE_TTL = timedelta(hours=24)

# Configuration
DEFAULT_MODEL = "gpt-4o-mini"
FALLBACK_MODEL = "gpt-3.5-turbo"
MAX_RETRIES = 3
INITIAL_RETRY_DELAY = 1  # seconds
REQUEST_TIMEOUT = 30  # seconds


def set_api_key(api_key: Optional[str]):
    """Set the API key from database settings."""
    global _cached_api_key
    _cached_api_key = api_key


def get_openai_client(api_key: Optional[str] = None):
    """Get OpenAI client if API key is available.

    Args:
        api_key: Optional API key to use. If not provided, uses cached key or env var.
    """
    key = api_key or _cached_api_key or os.environ.get("OPENAI_API_KEY")
    if not key:
        return None

    try:
        from openai import OpenAI
        return OpenAI(api_key=key, timeout=REQUEST_TIMEOUT)
    except ImportError:
        logger.error("OpenAI package not installed. Run: pip install openai")
        return None
    except Exception as e:
        logger.error(f"Failed to create OpenAI client: {e}")
        return None


def is_ai_available(api_key: Optional[str] = None) -> bool:
    """Check if OpenAI API is configured and accessible."""
    client = get_openai_client(api_key)
    if not client:
        return False

    # Optionally verify the key works (commented out to avoid extra API calls)
    # try:
    #     client.models.list()
    #     return True
    # except Exception:
    #     return False

    return True


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

            # Don't retry on authentication errors
            if "authentication" in error_str or "invalid api key" in error_str:
                logger.error(f"Authentication error, not retrying: {e}")
                raise

            # Handle rate limits
            if "rate_limit" in error_str or "429" in error_str:
                # Extract retry-after if available
                retry_after = 60  # Default to 60 seconds
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
        if datetime.utcnow() - cached_at < _CACHE_TTL:
            logger.debug(f"Cache hit for key {cache_key[:8]}...")
            return result
        else:
            del _categorization_cache[cache_key]
    return None


def _cache_categorization(cache_key: str, result: Dict):
    """Cache a categorization result."""
    _categorization_cache[cache_key] = (result, datetime.utcnow())

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


def _make_openai_request(
    client,
    messages: List[Dict],
    model: str = DEFAULT_MODEL,
    temperature: float = 0.3,
    max_tokens: int = 1000,
    response_format: Optional[Dict] = None,
) -> str:
    """Make an OpenAI API request with error handling."""
    kwargs = {
        "model": model,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
    }

    # Use JSON mode if available and requested
    if response_format:
        kwargs["response_format"] = response_format

    def _call():
        response = client.chat.completions.create(**kwargs)
        return response.choices[0].message.content.strip()

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

    client = get_openai_client(api_key)
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
        result_text = _make_openai_request(
            client,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            temperature=0.2,
            max_tokens=150,
            response_format={"type": "json_object"}
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
        logger.error(f"OpenAI categorization error: {e}")
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
    client = get_openai_client(api_key)
    if not client:
        logger.info("AI not available, using rule-based insights")
        return _generate_basic_insights(summary)

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

    user_prompt = f"""Analyze this monthly financial summary and provide 3-5 personalized insights.

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
  {{"type": "positive", "title": "Brief Title", "description": "Encouragement for good behavior"}}
]

Types:
- "warning": Concerning patterns requiring attention
- "tip": Money-saving opportunities or suggestions
- "positive": Good financial behaviors to reinforce

Return ONLY the JSON array."""

    try:
        result_text = _make_openai_request(
            client,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            temperature=0.7,
            max_tokens=800,
            response_format={"type": "json_object"}
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
                if insight_type not in ["warning", "tip", "positive"]:
                    insight_type = "tip"

                validated_insights.append({
                    "type": insight_type,
                    "title": str(insight.get("title", "Insight"))[:50],
                    "description": str(insight.get("description", ""))[:300]
                })

        if validated_insights:
            return validated_insights[:5]
        else:
            logger.warning("AI returned no valid insights, using fallback")
            return _generate_basic_insights(summary)

    except Exception as e:
        logger.error(f"OpenAI insights error: {e}")
        return _generate_basic_insights(summary)


def _generate_basic_insights(summary: Dict[str, Any]) -> List[Dict[str, str]]:
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

    # Subscription check
    for cat in categories:
        if cat.get("category_name") == "Subscriptions" and cat.get("expenses", 0) > 100:
            insights.append({
                "type": "tip",
                "title": "Review Your Subscriptions",
                "description": f"You're spending ${cat['expenses']:.2f}/month on subscriptions. Review for unused services you could cancel."
            })
            break

    # Positive if nothing concerning
    if not insights:
        insights.append({
            "type": "positive",
            "title": "Finances Looking Good",
            "description": "Your spending is within reasonable limits. Keep monitoring your budget to maintain good financial health."
        })

    return insights[:5]


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
    client = get_openai_client(api_key)
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
            result_text = _make_openai_request(
                client,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                model=DEFAULT_MODEL,
                temperature=0.2,
                max_tokens=2000,
                response_format={"type": "json_object"}
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
    client = get_openai_client(api_key)
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
        result_text = _make_openai_request(
            client,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            temperature=0.5,
            max_tokens=500,
            response_format={"type": "json_object"}
        )

        return _parse_json_response(result_text)

    except Exception as e:
        logger.error(f"Trend analysis error: {e}")
        return None
