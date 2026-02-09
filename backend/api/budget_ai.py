"""
Budget AI API - Auto-categorization, insights, and subscription detection.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime, timedelta

from core.database import get_session
from models import BudgetCategory, Transaction, Subscription
from services.categorizer import categorize_transaction, detect_recurring_pattern
from services.ai_insights import (
    ai_categorize_transaction,
    generate_spending_insights,
    generate_enhanced_spending_insights,
    is_ai_available,
    ai_analyze_spending_trends,
)
from services.ai_provider import (
    AIProvider,
    PROVIDER_CONFIG,
    set_provider_config,
    get_provider_info,
    resolve_provider,
)
from api.settings import get_setting_value

router = APIRouter(tags=["Budget AI"])


def load_ai_config(session: Session) -> Optional[str]:
    """Load AI provider configuration from settings, with auto-fallback."""
    provider_str = get_setting_value(session, "ai_provider")
    model = get_setting_value(session, "ai_model") or None
    provider, api_key = resolve_provider(
        provider_str,
        get_key_fn=lambda key: get_setting_value(session, key),
    )
    set_provider_config(provider, api_key, model)
    return api_key


class CategorizeRequest(BaseModel):
    transaction_ids: Optional[List[int]] = None  # If None, categorize all uncategorized


class CategorizeResult(BaseModel):
    transaction_id: int
    category_id: Optional[int]
    category_name: Optional[str]
    confidence: float
    method: str  # "rules" or "ai"


# --- AI Endpoints ---

@router.get("/budget/ai/status")
def get_ai_status(session: Session = Depends(get_session)):
    """Check if AI features are available."""
    api_key = load_ai_config(session)
    available = is_ai_available(api_key)
    info = get_provider_info()
    return {
        "ai_available": available,
        "ai_provider_name": info["display_name"] if available else None,
        "message": f"{info['display_name']} configured" if available else "Configure an AI provider in Settings for AI features"
    }


@router.post("/budget/ai/categorize")
def auto_categorize(
    data: CategorizeRequest,
    session: Session = Depends(get_session)
):
    """
    Auto-categorize transactions using hybrid approach:
    1. Rule-based matching (fast, free)
    2. OpenAI fallback for uncertain cases
    """
    # Load API key from settings
    api_key = load_ai_config(session)

    # Get categories
    categories = session.exec(select(BudgetCategory)).all()
    category_map = {c.name: c.id for c in categories}
    category_names = list(category_map.keys())

    # Get transactions to categorize
    if data.transaction_ids:
        transactions = session.exec(
            select(Transaction).where(Transaction.id.in_(data.transaction_ids))
        ).all()
    else:
        # Get all uncategorized transactions
        transactions = session.exec(
            select(Transaction).where(Transaction.category_id == None)
        ).all()

    results = []
    updated_count = 0

    for txn in transactions:
        # Try rule-based categorization first
        category_name, confidence = categorize_transaction(
            txn.description,
            txn.merchant,
            txn.amount
        )

        method = "rules"

        # If confidence is low, try AI
        if (not category_name or confidence < 0.7) and is_ai_available(api_key):
            ai_result = ai_categorize_transaction(
                txn.description,
                txn.merchant,
                txn.amount,
                category_names
            )
            if ai_result and ai_result.get("category_name"):
                category_name = ai_result["category_name"]
                confidence = ai_result.get("confidence", 0.8)
                method = "ai"

        # Update transaction if we found a category
        category_id = None
        if category_name and category_name in category_map:
            category_id = category_map[category_name]
            txn.category_id = category_id
            txn.ai_categorized = (method == "ai")
            txn.updated_at = datetime.utcnow()
            session.add(txn)
            updated_count += 1

        results.append({
            "transaction_id": txn.id,
            "category_id": category_id,
            "category_name": category_name,
            "confidence": confidence,
            "method": method,
        })

    session.commit()

    return {
        "processed": len(transactions),
        "updated": updated_count,
        "results": results,
    }


@router.get("/budget/ai/insights")
def get_insights(
    session: Session = Depends(get_session),
    months: int = 1,
    enhanced: bool = False,
):
    """
    Get AI-generated spending insights and recommendations.
    Uses rule-based insights if AI is unavailable.

    When enhanced=True, also returns trend_analysis and subscription_suggestions.
    """
    # Load API key from settings
    api_key = load_ai_config(session)

    # Get current month's summary
    today = datetime.utcnow()
    start_date = datetime(today.year, today.month, 1)
    end_date = today

    transactions = session.exec(
        select(Transaction)
        .where(Transaction.date >= start_date)
        .where(Transaction.date <= end_date)
    ).all()

    categories = {c.id: c for c in session.exec(select(BudgetCategory)).all()}

    # Build summary
    from collections import defaultdict
    total_income = 0.0
    total_expenses = 0.0
    by_category = defaultdict(lambda: {"income": 0.0, "expenses": 0.0, "transactions": 0})

    for txn in transactions:
        if txn.amount >= 0:
            total_income += txn.amount
        else:
            total_expenses += abs(txn.amount)

        cat_id = txn.category_id or 0
        if txn.amount >= 0:
            by_category[cat_id]["income"] += txn.amount
        else:
            by_category[cat_id]["expenses"] += abs(txn.amount)
        by_category[cat_id]["transactions"] += 1

    category_breakdown = []
    for cat_id, data in by_category.items():
        cat = categories.get(cat_id)
        category_breakdown.append({
            "category_id": cat_id,
            "category_name": cat.name if cat else "Uncategorized",
            "budget_limit": cat.budget_limit if cat else None,
            "income": data["income"],
            "expenses": data["expenses"],
            "transactions": data["transactions"],
        })

    summary = {
        "total_income": total_income,
        "total_expenses": total_expenses,
        "by_category": sorted(category_breakdown, key=lambda x: x["expenses"], reverse=True),
    }

    # Get previous month for comparison
    prev_start = datetime(today.year, today.month - 1 if today.month > 1 else 12, 1)
    if today.month == 1:
        prev_start = prev_start.replace(year=today.year - 1)
    prev_end = start_date - timedelta(days=1)

    prev_txns = session.exec(
        select(Transaction)
        .where(Transaction.date >= prev_start)
        .where(Transaction.date <= prev_end)
    ).all()

    prev_expenses = sum(abs(t.amount) for t in prev_txns if t.amount < 0)
    prev_income = sum(t.amount for t in prev_txns if t.amount >= 0)

    prev_summary = {
        "total_income": prev_income,
        "total_expenses": prev_expenses,
    }

    # Generate insights
    txn_dicts = [
        {"description": t.description, "amount": t.amount, "merchant": t.merchant}
        for t in transactions
    ]

    if enhanced:
        # Fetch cash flow data (last 6 months of monthly aggregates)
        cash_flow_data = []
        for i in range(6, 0, -1):
            m = today.month - i
            y = today.year
            while m <= 0:
                m += 12
                y -= 1
            m_start = datetime(y, m, 1)
            if m == 12:
                m_end = datetime(y + 1, 1, 1) - timedelta(days=1)
            else:
                m_end = datetime(y, m + 1, 1) - timedelta(days=1)

            m_txns = session.exec(
                select(Transaction)
                .where(Transaction.date >= m_start)
                .where(Transaction.date <= m_end)
            ).all()

            if m_txns:
                m_income = sum(t.amount for t in m_txns if t.amount >= 0)
                m_expenses = sum(abs(t.amount) for t in m_txns if t.amount < 0)
                cash_flow_data.append({
                    "month": m_start.strftime("%Y-%m"),
                    "total_income": m_income,
                    "total_expenses": m_expenses,
                    "net": m_income - m_expenses,
                })

        # Fetch active subscriptions
        subs = session.exec(
            select(Subscription).where(Subscription.is_active == True)
        ).all()
        subscriptions = [
            {"name": s.name, "amount": s.amount, "frequency": s.frequency, "is_active": s.is_active}
            for s in subs
        ]

        result = generate_enhanced_spending_insights(
            summary, txn_dicts, prev_summary,
            cash_flow_data=cash_flow_data if cash_flow_data else None,
            subscriptions=subscriptions if subscriptions else None,
            api_key=api_key,
        )

        info = get_provider_info()
        response = {
            "insights": result.get("insights", []),
            "ai_powered": is_ai_available(api_key),
            "ai_provider_name": info["display_name"] if is_ai_available(api_key) else None,
            "period": {"start": start_date, "end": end_date},
        }
        if "trend_analysis" in result:
            response["trend_analysis"] = result["trend_analysis"]
        if "subscription_suggestions" in result:
            response["subscription_suggestions"] = result["subscription_suggestions"]
        return response
    else:
        insights = generate_spending_insights(summary, txn_dicts, prev_summary)

        info = get_provider_info()
        return {
            "insights": insights,
            "ai_powered": is_ai_available(api_key),
            "ai_provider_name": info["display_name"] if is_ai_available(api_key) else None,
            "period": {
                "start": start_date,
                "end": end_date,
            },
        }


@router.post("/budget/ai/detect-subscriptions")
def detect_subscriptions(
    session: Session = Depends(get_session),
    months: int = 6,
):
    """
    Detect recurring transactions that might be subscriptions.
    Uses pattern detection on historical transactions.
    """
    # Get transactions from past N months
    end_date = datetime.utcnow()
    start_date = end_date - timedelta(days=months * 30)

    transactions = session.exec(
        select(Transaction)
        .where(Transaction.date >= start_date)
        .where(Transaction.date <= end_date)
        .where(Transaction.amount < 0)  # Only expenses
        .order_by(Transaction.date)
    ).all()

    # Convert to dicts for detection
    txn_dicts = [
        {
            "description": t.description,
            "merchant": t.merchant,
            "amount": t.amount,
            "date": t.date,
        }
        for t in transactions
    ]

    # Detect recurring patterns
    detected = detect_recurring_pattern(txn_dicts)

    # Get existing subscriptions to avoid duplicates
    existing_subs = session.exec(select(Subscription)).all()
    existing_names = {s.name.lower() for s in existing_subs}

    # Get subscriptions category
    sub_category = session.exec(
        select(BudgetCategory).where(BudgetCategory.name == "Subscriptions")
    ).first()

    new_suggestions = []
    for pattern in detected:
        name = pattern["name"]
        if name.lower() not in existing_names:
            new_suggestions.append({
                "name": name,
                "amount": pattern["amount"],
                "frequency": pattern["frequency"],
                "occurrences": pattern["occurrences"],
                "last_date": pattern["last_date"],
                "suggested_category_id": sub_category.id if sub_category else None,
            })

    return {
        "detected": len(detected),
        "new_suggestions": new_suggestions,
        "existing_count": len(existing_subs),
    }


@router.post("/budget/ai/create-subscription-from-detection")
def create_subscription_from_detection(
    name: str,
    amount: float,
    frequency: str,
    category_id: Optional[int] = None,
    session: Session = Depends(get_session)
):
    """Create a subscription from a detected pattern."""
    # Check if already exists
    existing = session.exec(
        select(Subscription).where(Subscription.name == name)
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Subscription with this name already exists")

    # Calculate next billing date (assume monthly for now)
    from datetime import date
    today = date.today()
    if frequency == "monthly":
        next_billing = datetime(today.year, today.month + 1 if today.month < 12 else 1, 1)
        if today.month == 12:
            next_billing = next_billing.replace(year=today.year + 1)
    elif frequency == "yearly":
        next_billing = datetime(today.year + 1, today.month, today.day)
    else:
        next_billing = None

    subscription = Subscription(
        name=name,
        amount=amount,
        frequency=frequency,
        category_id=category_id,
        next_billing_date=next_billing,
        is_active=True,
    )
    session.add(subscription)
    session.commit()
    session.refresh(subscription)

    return {
        "id": subscription.id,
        "name": subscription.name,
        "amount": subscription.amount,
        "frequency": subscription.frequency,
        "next_billing_date": subscription.next_billing_date,
    }
