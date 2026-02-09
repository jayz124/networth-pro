"""
Dashboard AI API - Cross-domain financial insights and financial stories.
"""
from fastapi import APIRouter, Depends
from sqlmodel import Session, select
from typing import Optional
from datetime import datetime, timedelta
import time

from core.database import get_session
from models import (
    Account, Liability, BalanceSnapshot, Portfolio, PortfolioHolding,
    Property, Mortgage, Transaction, BudgetCategory, Subscription,
)
from services.ai_insights import (
    generate_dashboard_insights,
    generate_financial_stories,
    is_ai_available,
    set_api_key,
)
from services.news_fetcher import fetch_relevant_news
from api.settings import get_setting_value

router = APIRouter(tags=["Dashboard AI"])


def load_openai_key(session: Session) -> Optional[str]:
    """Load OpenAI API key from settings."""
    api_key = get_setting_value(session, "openai_api_key")
    if api_key:
        set_api_key(api_key)
    return api_key


def _get_networth_data(session: Session) -> dict:
    """Build a net worth summary from DB data."""
    accounts = session.exec(select(Account)).all()
    total_cash = 0.0
    for account in accounts:
        snap = session.exec(
            select(BalanceSnapshot)
            .where(BalanceSnapshot.account_id == account.id)
            .order_by(BalanceSnapshot.date.desc())
        ).first()
        total_cash += snap.amount if snap else 0.0

    holdings = session.exec(select(PortfolioHolding)).all()
    total_investments = sum(h.current_value or 0 for h in holdings)

    properties = session.exec(select(Property)).all()
    mortgages = session.exec(select(Mortgage)).all()
    total_real_estate = sum(p.current_value for p in properties)
    total_mortgages = sum(m.current_balance for m in mortgages if m.is_active)

    liabilities = session.exec(select(Liability)).all()
    total_other_liab = 0.0
    for liab in liabilities:
        snap = session.exec(
            select(BalanceSnapshot)
            .where(BalanceSnapshot.liability_id == liab.id)
            .order_by(BalanceSnapshot.date.desc())
        ).first()
        total_other_liab += snap.amount if snap else 0.0

    total_assets = total_cash + total_investments + total_real_estate
    total_liabilities = total_mortgages + total_other_liab
    net_worth = total_assets - total_liabilities

    return {
        "net_worth": net_worth,
        "total_assets": total_assets,
        "total_liabilities": total_liabilities,
        "breakdown": {
            "cash_accounts": total_cash,
            "investments": total_investments,
            "real_estate": total_real_estate,
            "mortgages": total_mortgages,
        },
    }


@router.get("/dashboard/ai/insights")
def get_dashboard_insights(session: Session = Depends(get_session)):
    """Get AI-generated cross-domain financial insights for the dashboard."""
    api_key = load_openai_key(session)

    # Gather data
    networth_data = _get_networth_data(session)

    # Net worth history
    snapshots = session.exec(
        select(BalanceSnapshot).order_by(BalanceSnapshot.date)
    ).all()
    history = []
    if snapshots:
        # Simplified history: group by date
        from collections import defaultdict
        account_bals = {}
        liability_bals = {}
        dates_seen = []
        for snap in snapshots:
            date_str = snap.date.strftime("%Y-%m-%d")
            if snap.account_id:
                account_bals[snap.account_id] = snap.amount
            elif snap.liability_id:
                liability_bals[snap.liability_id] = snap.amount
            if not dates_seen or dates_seen[-1] != date_str:
                dates_seen.append(date_str)

        for date_str in dates_seen[-12:]:  # Last 12 points
            total_a = sum(account_bals.values())
            total_l = sum(liability_bals.values())
            history.append({
                "date": date_str,
                "net_worth": total_a - total_l,
            })

    # Portfolio data
    holdings = session.exec(select(PortfolioHolding)).all()
    portfolio_data = []
    for h in holdings:
        cost_basis = (h.purchase_price or 0) * h.quantity
        current_val = h.current_value or 0
        gain = current_val - cost_basis
        gain_pct = (gain / cost_basis * 100) if cost_basis > 0 else 0
        portfolio_data.append({
            "ticker": h.ticker,
            "current_value": current_val,
            "cost_basis": cost_basis,
            "unrealized_gain": gain,
            "gain_percent": gain_pct,
        })

    # Property data
    properties = session.exec(select(Property)).all()
    mortgages = session.exec(select(Mortgage)).all()
    mortgage_by_prop = {}
    for m in mortgages:
        if m.is_active:
            mortgage_by_prop.setdefault(m.property_id, 0)
            mortgage_by_prop[m.property_id] += m.current_balance

    property_data = []
    for p in properties:
        mort_bal = mortgage_by_prop.get(p.id, 0)
        property_data.append({
            "name": p.name,
            "current_value": p.current_value,
            "purchase_price": p.purchase_price,
            "mortgage_balance": mort_bal,
            "equity": p.current_value - mort_bal,
        })

    # Liability data
    liabilities = session.exec(select(Liability)).all()
    liability_data = []
    for liab in liabilities:
        snap = session.exec(
            select(BalanceSnapshot)
            .where(BalanceSnapshot.liability_id == liab.id)
            .order_by(BalanceSnapshot.date.desc())
        ).first()
        liability_data.append({
            "name": liab.name,
            "balance": snap.amount if snap else 0,
            "category": liab.category,
        })

    # Account summary
    accounts = session.exec(select(Account)).all()
    account_summary = {"count": len(accounts), "types": list(set(a.type for a in accounts))}

    # Generate insights
    insights = generate_dashboard_insights(
        networth_data=networth_data,
        networth_history=history,
        portfolio_data=portfolio_data,
        property_data=property_data,
        liability_data=liability_data,
        account_summary=account_summary,
        api_key=api_key,
    )

    return {
        "insights": insights,
        "ai_powered": is_ai_available(api_key),
    }


@router.get("/dashboard/ai/stories")
def get_financial_stories(
    refresh: bool = False,
    session: Session = Depends(get_session),
):
    """Get AI-generated financial stories for the dashboard."""
    api_key = load_openai_key(session)

    # Seed: use timestamp if refresh, otherwise date-based for consistency
    if refresh:
        seed = int(time.time())
    else:
        seed = int(datetime.utcnow().strftime("%Y%m%d"))

    # Gather data
    networth_data = _get_networth_data(session)

    # Budget summary (current month)
    today = datetime.utcnow()
    start_of_month = datetime(today.year, today.month, 1)
    transactions = session.exec(
        select(Transaction)
        .where(Transaction.date >= start_of_month)
        .where(Transaction.date <= today)
    ).all()

    budget_summary = None
    if transactions:
        total_income = sum(t.amount for t in transactions if t.amount >= 0)
        total_expenses = sum(abs(t.amount) for t in transactions if t.amount < 0)
        budget_summary = {
            "total_income": total_income,
            "total_expenses": total_expenses,
        }

    # Portfolio data
    holdings = session.exec(select(PortfolioHolding)).all()
    portfolio_data = []
    for h in holdings:
        cost_basis = (h.purchase_price or 0) * h.quantity
        current_val = h.current_value or 0
        gain = current_val - cost_basis
        gain_pct = (gain / cost_basis * 100) if cost_basis > 0 else 0
        portfolio_data.append({
            "ticker": h.ticker,
            "current_value": current_val,
            "unrealized_gain": gain,
            "gain_percent": gain_pct,
        })

    # Property data
    properties = session.exec(select(Property)).all()
    mortgages = session.exec(select(Mortgage)).all()
    mortgage_by_prop = {}
    for m in mortgages:
        if m.is_active:
            mortgage_by_prop.setdefault(m.property_id, 0)
            mortgage_by_prop[m.property_id] += m.current_balance

    property_data = []
    for p in properties:
        mort_bal = mortgage_by_prop.get(p.id, 0)
        property_data.append({
            "name": p.name,
            "current_value": p.current_value,
            "equity": p.current_value - mort_bal,
        })

    # Recent transactions (last 30 days)
    thirty_days_ago = today - timedelta(days=30)
    recent_txns = session.exec(
        select(Transaction)
        .where(Transaction.date >= thirty_days_ago)
        .order_by(Transaction.date.desc())
    ).all()
    recent_transactions = [
        {"description": t.description, "amount": t.amount, "date": t.date.strftime("%Y-%m-%d")}
        for t in recent_txns[:50]
    ]

    stories = generate_financial_stories(
        networth_data=networth_data,
        budget_summary=budget_summary,
        portfolio_data=portfolio_data if portfolio_data else None,
        property_data=property_data if property_data else None,
        recent_transactions=recent_transactions if recent_transactions else None,
        seed=seed,
        api_key=api_key,
    )

    # Fetch relevant news articles based on portfolio and account signals
    tickers = [h.ticker for h in holdings] if holdings else []

    all_properties = session.exec(select(Property)).all()
    property_types = list(set(p.property_type for p in all_properties)) if all_properties else []

    all_liabilities = session.exec(select(Liability)).all()
    liability_categories = list(set(l.category for l in all_liabilities if l.category)) if all_liabilities else []

    all_accounts = session.exec(select(Account)).all()
    account_types = list(set(a.type for a in all_accounts)) if all_accounts else []

    news_articles = fetch_relevant_news(
        tickers=tickers,
        property_types=property_types,
        liability_categories=liability_categories,
        account_types=account_types,
        max_articles=8,
    )

    return {
        "stories": stories,
        "news": news_articles,
        "ai_powered": is_ai_available(api_key),
    }
