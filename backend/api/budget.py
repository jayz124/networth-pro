"""
Budget API - CRUD for categories, transactions, subscriptions, and analytics.
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime, timedelta
from collections import defaultdict

from core.database import get_session
from models import BudgetCategory, Transaction, Subscription, Account

router = APIRouter(tags=["Budget"])


# Default categories to seed
DEFAULT_CATEGORIES = [
    {"name": "Salary", "icon": "Briefcase", "color": "#10b981", "is_income": True},
    {"name": "Housing", "icon": "Home", "color": "#3b82f6", "is_income": False},
    {"name": "Food & Dining", "icon": "UtensilsCrossed", "color": "#f59e0b", "is_income": False},
    {"name": "Transportation", "icon": "Car", "color": "#8b5cf6", "is_income": False},
    {"name": "Utilities", "icon": "Zap", "color": "#06b6d4", "is_income": False},
    {"name": "Shopping", "icon": "ShoppingBag", "color": "#ec4899", "is_income": False},
    {"name": "Entertainment", "icon": "Tv", "color": "#f97316", "is_income": False},
    {"name": "Healthcare", "icon": "Heart", "color": "#ef4444", "is_income": False},
    {"name": "Subscriptions", "icon": "CreditCard", "color": "#6366f1", "is_income": False},
    {"name": "Other", "icon": "MoreHorizontal", "color": "#64748b", "is_income": False},
]


# Pydantic schemas
class CategoryCreate(BaseModel):
    name: str
    icon: Optional[str] = None
    color: Optional[str] = None
    budget_limit: Optional[float] = None
    is_income: bool = False


class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    icon: Optional[str] = None
    color: Optional[str] = None
    budget_limit: Optional[float] = None
    is_income: Optional[bool] = None


class TransactionCreate(BaseModel):
    date: datetime
    description: str
    amount: float  # Positive=income, negative=expense
    category_id: Optional[int] = None
    account_id: Optional[int] = None
    is_recurring: bool = False
    recurrence_frequency: Optional[str] = None  # daily, weekly, bi-weekly, monthly, yearly
    merchant: Optional[str] = None
    notes: Optional[str] = None


class TransactionUpdate(BaseModel):
    date: Optional[datetime] = None
    description: Optional[str] = None
    amount: Optional[float] = None
    category_id: Optional[int] = None
    account_id: Optional[int] = None
    is_recurring: Optional[bool] = None
    recurrence_frequency: Optional[str] = None
    merchant: Optional[str] = None
    notes: Optional[str] = None


class SubscriptionCreate(BaseModel):
    name: str
    amount: float
    frequency: str  # monthly, yearly
    category_id: Optional[int] = None
    next_billing_date: Optional[datetime] = None
    is_active: bool = True


class SubscriptionUpdate(BaseModel):
    name: Optional[str] = None
    amount: Optional[float] = None
    frequency: Optional[str] = None
    category_id: Optional[int] = None
    next_billing_date: Optional[datetime] = None
    is_active: Optional[bool] = None


# --- Category Endpoints ---

@router.get("/budget/categories")
def list_categories(session: Session = Depends(get_session)):
    """List all budget categories."""
    categories = session.exec(
        select(BudgetCategory).order_by(BudgetCategory.name)
    ).all()

    # If no categories exist, seed default ones
    if not categories:
        for cat_data in DEFAULT_CATEGORIES:
            cat = BudgetCategory(**cat_data)
            session.add(cat)
        session.commit()
        categories = session.exec(
            select(BudgetCategory).order_by(BudgetCategory.name)
        ).all()

    return [
        {
            "id": cat.id,
            "name": cat.name,
            "icon": cat.icon,
            "color": cat.color,
            "budget_limit": cat.budget_limit,
            "is_income": cat.is_income,
        }
        for cat in categories
    ]


@router.post("/budget/categories")
def create_category(data: CategoryCreate, session: Session = Depends(get_session)):
    """Create a new budget category."""
    existing = session.exec(
        select(BudgetCategory).where(BudgetCategory.name == data.name)
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Category with this name already exists")

    category = BudgetCategory(
        name=data.name,
        icon=data.icon,
        color=data.color,
        budget_limit=data.budget_limit,
        is_income=data.is_income,
    )
    session.add(category)
    session.commit()
    session.refresh(category)

    return {
        "id": category.id,
        "name": category.name,
        "icon": category.icon,
        "color": category.color,
        "budget_limit": category.budget_limit,
        "is_income": category.is_income,
    }


@router.put("/budget/categories/{category_id}")
def update_category(
    category_id: int,
    data: CategoryUpdate,
    session: Session = Depends(get_session)
):
    """Update a budget category."""
    category = session.get(BudgetCategory, category_id)
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")

    if data.name is not None:
        existing = session.exec(
            select(BudgetCategory).where(
                BudgetCategory.name == data.name,
                BudgetCategory.id != category_id
            )
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="Category with this name already exists")
        category.name = data.name
    if data.icon is not None:
        category.icon = data.icon
    if data.color is not None:
        category.color = data.color
    if data.budget_limit is not None:
        category.budget_limit = data.budget_limit
    if data.is_income is not None:
        category.is_income = data.is_income

    category.updated_at = datetime.utcnow()
    session.add(category)
    session.commit()
    session.refresh(category)

    return {
        "id": category.id,
        "name": category.name,
        "icon": category.icon,
        "color": category.color,
        "budget_limit": category.budget_limit,
        "is_income": category.is_income,
    }


@router.delete("/budget/categories/{category_id}")
def delete_category(category_id: int, session: Session = Depends(get_session)):
    """Delete a budget category (transactions will have null category)."""
    category = session.get(BudgetCategory, category_id)
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")

    # Clear category from transactions
    transactions = session.exec(
        select(Transaction).where(Transaction.category_id == category_id)
    ).all()
    for txn in transactions:
        txn.category_id = None
        session.add(txn)

    session.delete(category)
    session.commit()
    return {"message": "Category deleted", "id": category_id}


# --- Transaction Endpoints ---

@router.get("/budget/transactions")
def list_transactions(
    session: Session = Depends(get_session),
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    category_id: Optional[int] = None,
    account_id: Optional[int] = None,
    limit: int = Query(default=100, le=500),
    offset: int = 0,
):
    """List transactions with optional filters."""
    query = select(Transaction).order_by(Transaction.date.desc())

    if start_date:
        query = query.where(Transaction.date >= start_date)
    if end_date:
        query = query.where(Transaction.date <= end_date)
    if category_id:
        query = query.where(Transaction.category_id == category_id)
    if account_id:
        query = query.where(Transaction.account_id == account_id)

    query = query.offset(offset).limit(limit)
    transactions = session.exec(query).all()

    # Get category and account names
    categories = {c.id: c for c in session.exec(select(BudgetCategory)).all()}
    accounts = {a.id: a for a in session.exec(select(Account)).all()}

    return [
        {
            "id": txn.id,
            "date": txn.date,
            "description": txn.description,
            "amount": txn.amount,
            "category_id": txn.category_id,
            "category_name": categories.get(txn.category_id).name if txn.category_id and txn.category_id in categories else None,
            "category_color": categories.get(txn.category_id).color if txn.category_id and txn.category_id in categories else None,
            "account_id": txn.account_id,
            "account_name": accounts.get(txn.account_id).name if txn.account_id and txn.account_id in accounts else None,
            "is_recurring": txn.is_recurring,
            "recurrence_frequency": txn.recurrence_frequency,
            "merchant": txn.merchant,
            "notes": txn.notes,
            "ai_categorized": txn.ai_categorized,
            "created_at": txn.created_at,
        }
        for txn in transactions
    ]


@router.post("/budget/transactions")
def create_transaction(data: TransactionCreate, session: Session = Depends(get_session)):
    """Create a new transaction."""
    # Validate category exists if provided
    if data.category_id:
        category = session.get(BudgetCategory, data.category_id)
        if not category:
            raise HTTPException(status_code=400, detail="Category not found")

    # Validate account exists if provided
    if data.account_id:
        account = session.get(Account, data.account_id)
        if not account:
            raise HTTPException(status_code=400, detail="Account not found")

    transaction = Transaction(
        date=data.date,
        description=data.description,
        amount=data.amount,
        category_id=data.category_id,
        account_id=data.account_id,
        is_recurring=data.is_recurring,
        recurrence_frequency=data.recurrence_frequency if data.is_recurring else None,
        merchant=data.merchant,
        notes=data.notes,
    )
    session.add(transaction)
    session.commit()
    session.refresh(transaction)

    # Get category name
    category_name = None
    category_color = None
    if transaction.category_id:
        cat = session.get(BudgetCategory, transaction.category_id)
        if cat:
            category_name = cat.name
            category_color = cat.color

    return {
        "id": transaction.id,
        "date": transaction.date,
        "description": transaction.description,
        "amount": transaction.amount,
        "category_id": transaction.category_id,
        "category_name": category_name,
        "category_color": category_color,
        "account_id": transaction.account_id,
        "is_recurring": transaction.is_recurring,
        "recurrence_frequency": transaction.recurrence_frequency,
        "merchant": transaction.merchant,
        "notes": transaction.notes,
        "ai_categorized": transaction.ai_categorized,
        "created_at": transaction.created_at,
    }


@router.get("/budget/transactions/{transaction_id}")
def get_transaction(transaction_id: int, session: Session = Depends(get_session)):
    """Get a specific transaction."""
    transaction = session.get(Transaction, transaction_id)
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")

    category_name = None
    category_color = None
    if transaction.category_id:
        cat = session.get(BudgetCategory, transaction.category_id)
        if cat:
            category_name = cat.name
            category_color = cat.color

    account_name = None
    if transaction.account_id:
        acct = session.get(Account, transaction.account_id)
        if acct:
            account_name = acct.name

    return {
        "id": transaction.id,
        "date": transaction.date,
        "description": transaction.description,
        "amount": transaction.amount,
        "category_id": transaction.category_id,
        "category_name": category_name,
        "category_color": category_color,
        "account_id": transaction.account_id,
        "account_name": account_name,
        "is_recurring": transaction.is_recurring,
        "recurrence_frequency": transaction.recurrence_frequency,
        "merchant": transaction.merchant,
        "notes": transaction.notes,
        "ai_categorized": transaction.ai_categorized,
        "created_at": transaction.created_at,
    }


@router.put("/budget/transactions/{transaction_id}")
def update_transaction(
    transaction_id: int,
    data: TransactionUpdate,
    session: Session = Depends(get_session)
):
    """Update a transaction."""
    transaction = session.get(Transaction, transaction_id)
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")

    if data.date is not None:
        transaction.date = data.date
    if data.description is not None:
        transaction.description = data.description
    if data.amount is not None:
        transaction.amount = data.amount
    if data.category_id is not None:
        if data.category_id != 0:  # Allow setting to None via 0
            category = session.get(BudgetCategory, data.category_id)
            if not category:
                raise HTTPException(status_code=400, detail="Category not found")
        transaction.category_id = data.category_id if data.category_id != 0 else None
    if data.account_id is not None:
        transaction.account_id = data.account_id if data.account_id != 0 else None
    if data.is_recurring is not None:
        transaction.is_recurring = data.is_recurring
        # Clear frequency if not recurring
        if not data.is_recurring:
            transaction.recurrence_frequency = None
    if data.recurrence_frequency is not None:
        transaction.recurrence_frequency = data.recurrence_frequency
    if data.merchant is not None:
        transaction.merchant = data.merchant
    if data.notes is not None:
        transaction.notes = data.notes

    transaction.updated_at = datetime.utcnow()
    session.add(transaction)
    session.commit()
    session.refresh(transaction)

    return {
        "id": transaction.id,
        "date": transaction.date,
        "description": transaction.description,
        "amount": transaction.amount,
        "category_id": transaction.category_id,
        "is_recurring": transaction.is_recurring,
        "recurrence_frequency": transaction.recurrence_frequency,
        "merchant": transaction.merchant,
        "notes": transaction.notes,
    }


@router.delete("/budget/transactions/{transaction_id}")
def delete_transaction(transaction_id: int, session: Session = Depends(get_session)):
    """Delete a transaction."""
    transaction = session.get(Transaction, transaction_id)
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")

    session.delete(transaction)
    session.commit()
    return {"message": "Transaction deleted", "id": transaction_id}


# --- Subscription Endpoints ---

@router.get("/budget/subscriptions")
def list_subscriptions(session: Session = Depends(get_session)):
    """List all subscriptions."""
    subscriptions = session.exec(
        select(Subscription).order_by(Subscription.name)
    ).all()

    categories = {c.id: c for c in session.exec(select(BudgetCategory)).all()}

    return [
        {
            "id": sub.id,
            "name": sub.name,
            "amount": sub.amount,
            "frequency": sub.frequency,
            "category_id": sub.category_id,
            "category_name": categories.get(sub.category_id).name if sub.category_id and sub.category_id in categories else None,
            "next_billing_date": sub.next_billing_date,
            "is_active": sub.is_active,
        }
        for sub in subscriptions
    ]


@router.post("/budget/subscriptions")
def create_subscription(data: SubscriptionCreate, session: Session = Depends(get_session)):
    """Create a new subscription."""
    subscription = Subscription(
        name=data.name,
        amount=data.amount,
        frequency=data.frequency,
        category_id=data.category_id,
        next_billing_date=data.next_billing_date,
        is_active=data.is_active,
    )
    session.add(subscription)
    session.commit()
    session.refresh(subscription)

    return {
        "id": subscription.id,
        "name": subscription.name,
        "amount": subscription.amount,
        "frequency": subscription.frequency,
        "category_id": subscription.category_id,
        "next_billing_date": subscription.next_billing_date,
        "is_active": subscription.is_active,
    }


@router.put("/budget/subscriptions/{subscription_id}")
def update_subscription(
    subscription_id: int,
    data: SubscriptionUpdate,
    session: Session = Depends(get_session)
):
    """Update a subscription."""
    subscription = session.get(Subscription, subscription_id)
    if not subscription:
        raise HTTPException(status_code=404, detail="Subscription not found")

    if data.name is not None:
        subscription.name = data.name
    if data.amount is not None:
        subscription.amount = data.amount
    if data.frequency is not None:
        subscription.frequency = data.frequency
    if data.category_id is not None:
        subscription.category_id = data.category_id if data.category_id != 0 else None
    if data.next_billing_date is not None:
        subscription.next_billing_date = data.next_billing_date
    if data.is_active is not None:
        subscription.is_active = data.is_active

    subscription.updated_at = datetime.utcnow()
    session.add(subscription)
    session.commit()
    session.refresh(subscription)

    return {
        "id": subscription.id,
        "name": subscription.name,
        "amount": subscription.amount,
        "frequency": subscription.frequency,
        "category_id": subscription.category_id,
        "next_billing_date": subscription.next_billing_date,
        "is_active": subscription.is_active,
    }


@router.delete("/budget/subscriptions/{subscription_id}")
def delete_subscription(subscription_id: int, session: Session = Depends(get_session)):
    """Delete a subscription."""
    subscription = session.get(Subscription, subscription_id)
    if not subscription:
        raise HTTPException(status_code=404, detail="Subscription not found")

    session.delete(subscription)
    session.commit()
    return {"message": "Subscription deleted", "id": subscription_id}


# --- Analytics Endpoints ---

@router.get("/budget/summary")
def get_budget_summary(
    session: Session = Depends(get_session),
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
):
    """Get monthly totals by category."""
    # Default to current month
    if not start_date:
        today = datetime.utcnow()
        start_date = datetime(today.year, today.month, 1)
    if not end_date:
        end_date = datetime.utcnow()

    transactions = session.exec(
        select(Transaction)
        .where(Transaction.date >= start_date)
        .where(Transaction.date <= end_date)
    ).all()

    categories = {c.id: c for c in session.exec(select(BudgetCategory)).all()}

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

    # Build category breakdown
    category_breakdown = []
    for cat_id, data in by_category.items():
        cat = categories.get(cat_id)
        category_breakdown.append({
            "category_id": cat_id,
            "category_name": cat.name if cat else "Uncategorized",
            "category_color": cat.color if cat else "#64748b",
            "category_icon": cat.icon if cat else "MoreHorizontal",
            "budget_limit": cat.budget_limit if cat else None,
            "income": data["income"],
            "expenses": data["expenses"],
            "net": data["income"] - data["expenses"],
            "transactions": data["transactions"],
        })

    # Sort by expenses descending
    category_breakdown.sort(key=lambda x: x["expenses"], reverse=True)

    return {
        "period": {
            "start": start_date,
            "end": end_date,
        },
        "total_income": total_income,
        "total_expenses": total_expenses,
        "net": total_income - total_expenses,
        "transaction_count": len(transactions),
        "by_category": category_breakdown,
    }


@router.get("/budget/cash-flow")
def get_cash_flow(
    session: Session = Depends(get_session),
    months: int = Query(default=6, le=24),
):
    """Get income vs expenses over time (monthly)."""
    end_date = datetime.utcnow()
    start_date = end_date - timedelta(days=months * 30)

    transactions = session.exec(
        select(Transaction)
        .where(Transaction.date >= start_date)
        .where(Transaction.date <= end_date)
        .order_by(Transaction.date)
    ).all()

    # Group by month
    monthly_data = defaultdict(lambda: {"income": 0.0, "expenses": 0.0})

    for txn in transactions:
        month_key = f"{txn.date.year}-{txn.date.month:02d}"
        if txn.amount >= 0:
            monthly_data[month_key]["income"] += txn.amount
        else:
            monthly_data[month_key]["expenses"] += abs(txn.amount)

    # Build result sorted by month
    result = []
    for month_key in sorted(monthly_data.keys()):
        data = monthly_data[month_key]
        result.append({
            "month": month_key,
            "income": data["income"],
            "expenses": data["expenses"],
            "net": data["income"] - data["expenses"],
        })

    return result


# --- Forecast Endpoint ---

@router.get("/budget/forecast")
def get_forecast(
    session: Session = Depends(get_session),
    months: int = Query(default=6, le=12),
):
    """
    Forecast future income and expenses based on recurring transactions.
    Projects recurring transactions forward for the specified number of months.
    """
    # Get all recurring transactions
    recurring_txns = session.exec(
        select(Transaction)
        .where(Transaction.is_recurring == True)
        .where(Transaction.recurrence_frequency != None)
    ).all()

    # Also include active subscriptions
    subscriptions = session.exec(
        select(Subscription).where(Subscription.is_active == True)
    ).all()

    # Get categories for names
    categories = {c.id: c for c in session.exec(select(BudgetCategory)).all()}

    # Helper to calculate interval in days
    def get_interval_days(frequency: str) -> int:
        if frequency == "daily":
            return 1
        elif frequency == "weekly":
            return 7
        elif frequency == "bi-weekly":
            return 14
        elif frequency == "monthly":
            return 30
        elif frequency == "yearly":
            return 365
        else:
            return 30  # Default to monthly

    # Build forecast data
    today = datetime.utcnow()
    forecast_data = []

    for month_offset in range(months):
        # Calculate month start and end
        forecast_month = today.month + month_offset
        forecast_year = today.year
        while forecast_month > 12:
            forecast_month -= 12
            forecast_year += 1

        month_start = datetime(forecast_year, forecast_month, 1)
        if forecast_month == 12:
            month_end = datetime(forecast_year + 1, 1, 1) - timedelta(days=1)
        else:
            month_end = datetime(forecast_year, forecast_month + 1, 1) - timedelta(days=1)

        month_key = f"{forecast_year}-{forecast_month:02d}"
        month_income = 0.0
        month_expenses = 0.0
        projected_transactions = []

        # Project recurring transactions
        for txn in recurring_txns:
            frequency = txn.recurrence_frequency
            interval_days = get_interval_days(frequency)

            # Calculate how many times this transaction occurs in this month
            if frequency == "monthly":
                # Assume once per month
                occurrences = 1
            elif frequency == "yearly":
                # Check if this is the month it occurs
                if txn.date.month == forecast_month:
                    occurrences = 1
                else:
                    occurrences = 0
            elif frequency == "daily":
                # Days in month
                occurrences = (month_end - month_start).days + 1
            elif frequency == "weekly":
                occurrences = 4  # ~4 weeks per month
            elif frequency == "bi-weekly":
                occurrences = 2
            else:
                occurrences = 1

            if occurrences > 0:
                total_amount = txn.amount * occurrences
                if total_amount >= 0:
                    month_income += total_amount
                else:
                    month_expenses += abs(total_amount)

                projected_transactions.append({
                    "description": txn.description,
                    "amount": txn.amount,
                    "occurrences": occurrences,
                    "total": total_amount,
                    "category_name": categories.get(txn.category_id).name if txn.category_id and txn.category_id in categories else None,
                    "frequency": frequency,
                    "type": "income" if txn.amount >= 0 else "expense",
                })

        # Project subscriptions
        for sub in subscriptions:
            if sub.frequency == "monthly":
                occurrences = 1
            elif sub.frequency == "yearly":
                # Check if this subscription's billing month matches
                if sub.next_billing_date and sub.next_billing_date.month == forecast_month:
                    occurrences = 1
                else:
                    occurrences = 0
            else:
                occurrences = 1

            if occurrences > 0:
                total_amount = -sub.amount * occurrences  # Subscriptions are expenses
                month_expenses += abs(total_amount)

                projected_transactions.append({
                    "description": f"Subscription: {sub.name}",
                    "amount": -sub.amount,
                    "occurrences": occurrences,
                    "total": total_amount,
                    "category_name": categories.get(sub.category_id).name if sub.category_id and sub.category_id in categories else "Subscriptions",
                    "frequency": sub.frequency,
                    "type": "expense",
                })

        forecast_data.append({
            "month": month_key,
            "month_name": month_start.strftime("%B %Y"),
            "income": month_income,
            "expenses": month_expenses,
            "net": month_income - month_expenses,
            "transactions": projected_transactions,
        })

    # Calculate totals
    total_income = sum(m["income"] for m in forecast_data)
    total_expenses = sum(m["expenses"] for m in forecast_data)

    return {
        "months": months,
        "total_projected_income": total_income,
        "total_projected_expenses": total_expenses,
        "total_projected_net": total_income - total_expenses,
        "monthly_average_income": total_income / months if months > 0 else 0,
        "monthly_average_expenses": total_expenses / months if months > 0 else 0,
        "forecast": forecast_data,
        "recurring_count": len(recurring_txns),
        "subscription_count": len(subscriptions),
    }
