"""
Dashboard API - Net worth calculation including cash, investments, and real estate.
"""
from fastapi import APIRouter, Depends
from sqlmodel import Session, select
from typing import Dict

from core.database import get_session
from models import Account, Liability, BalanceSnapshot, Portfolio, PortfolioHolding, Property, Mortgage

router = APIRouter()


@router.get("/networth")
def get_networth(session: Session = Depends(get_session)):
    """
    Get the latest Net Worth snapshot.
    Includes:
    - Cash accounts (from Account/BalanceSnapshot)
    - Investment portfolios (from PortfolioHolding)
    - Real estate equity (from Property - Mortgage)
    """
    # 1. Cash Accounts (Assets)
    accounts = session.exec(select(Account)).all()
    total_cash = 0.0
    asset_breakdown = []

    for account in accounts:
        snap = session.exec(
            select(BalanceSnapshot)
            .where(BalanceSnapshot.account_id == account.id)
            .order_by(BalanceSnapshot.date.desc())
        ).first()

        balance = snap.amount if snap else 0.0
        total_cash += balance
        asset_breakdown.append({
            "name": account.name,
            "balance": balance,
            "currency": account.currency,
            "type": "cash"
        })

    # 2. Investment Portfolios
    holdings = session.exec(select(PortfolioHolding)).all()
    portfolios = session.exec(select(Portfolio)).all()
    portfolio_map = {p.id: p.name for p in portfolios}

    total_investments = sum(h.current_value or 0 for h in holdings)

    # Group holdings by portfolio
    portfolio_values: Dict[int, float] = {}
    for h in holdings:
        if h.portfolio_id not in portfolio_values:
            portfolio_values[h.portfolio_id] = 0
        portfolio_values[h.portfolio_id] += h.current_value or 0

    for portfolio_id, value in portfolio_values.items():
        asset_breakdown.append({
            "name": portfolio_map.get(portfolio_id, f"Portfolio {portfolio_id}"),
            "balance": value,
            "currency": "USD",
            "type": "investment"
        })

    # 3. Real Estate Equity
    properties = session.exec(select(Property)).all()
    mortgages = session.exec(select(Mortgage)).all()

    # Group mortgages by property
    mortgage_by_property: Dict[int, float] = {}
    for m in mortgages:
        if m.is_active:
            if m.property_id not in mortgage_by_property:
                mortgage_by_property[m.property_id] = 0
            mortgage_by_property[m.property_id] += m.current_balance

    total_real_estate_value = 0.0
    total_real_estate_equity = 0.0

    for prop in properties:
        mortgage_balance = mortgage_by_property.get(prop.id, 0)
        equity = prop.current_value - mortgage_balance
        total_real_estate_value += prop.current_value
        total_real_estate_equity += equity

        asset_breakdown.append({
            "name": prop.name,
            "balance": equity,  # Show equity, not gross value
            "currency": prop.currency,
            "type": "real_estate"
        })

    # 4. Liabilities (non-mortgage)
    liabilities = session.exec(select(Liability)).all()
    total_liabilities = 0.0
    liab_breakdown = []

    for liab in liabilities:
        snap = session.exec(
            select(BalanceSnapshot)
            .where(BalanceSnapshot.liability_id == liab.id)
            .order_by(BalanceSnapshot.date.desc())
        ).first()

        balance = snap.amount if snap else 0.0
        total_liabilities += balance
        liab_breakdown.append({
            "name": liab.name,
            "balance": balance,
            "currency": liab.currency
        })

    # Calculate totals
    total_assets = total_cash + total_investments + total_real_estate_equity
    # Mortgages are already subtracted from real estate equity, so we don't double count
    net_worth = total_assets - total_liabilities

    return {
        "net_worth": net_worth,
        "total_assets": total_assets,
        "total_liabilities": total_liabilities,
        "currency": "USD",
        "breakdown": {
            "cash_accounts": total_cash,
            "investments": total_investments,
            "real_estate_equity": total_real_estate_equity,
        },
        "assets": asset_breakdown,
        "liabilities": liab_breakdown
    }


@router.get("/networth/history")
def get_networth_history(session: Session = Depends(get_session)):
    """
    Get historical Net Worth over time.
    Aggregates BalanceSnapshots by date.
    Note: This currently only tracks cash accounts history.
    Portfolio and real estate values are current-point-in-time.
    """
    # Get all snapshots ordered by date
    snapshots = session.exec(
        select(BalanceSnapshot).order_by(BalanceSnapshot.date)
    ).all()

    history_map = {}

    for snap in snapshots:
        date_str = snap.date.strftime("%Y-%m-%d")
        if date_str not in history_map:
            history_map[date_str] = {"date": date_str, "assets": 0.0, "liabilities": 0.0}

        if snap.account_id:
            history_map[date_str]["assets"] += snap.amount
        elif snap.liability_id:
            history_map[date_str]["liabilities"] += snap.amount

    # Convert to list and sort
    history_list = []
    for date_key in sorted(history_map.keys()):
        item = history_map[date_key]
        item["net_worth"] = item["assets"] - item["liabilities"]
        history_list.append(item)

    return history_list


@router.get("/networth/breakdown")
def get_networth_breakdown(session: Session = Depends(get_session)):
    """
    Get detailed breakdown of net worth by category.
    """
    # Cash
    accounts = session.exec(select(Account)).all()
    cash_items = []
    total_cash = 0.0

    for account in accounts:
        snap = session.exec(
            select(BalanceSnapshot)
            .where(BalanceSnapshot.account_id == account.id)
            .order_by(BalanceSnapshot.date.desc())
        ).first()
        balance = snap.amount if snap else 0.0
        total_cash += balance
        cash_items.append({
            "id": account.id,
            "name": account.name,
            "balance": balance,
            "institution": account.institution,
            "type": account.type,
        })

    # Investments
    holdings = session.exec(select(PortfolioHolding)).all()
    portfolios = session.exec(select(Portfolio)).all()
    portfolio_map = {p.id: p for p in portfolios}

    investment_items = []
    total_investments = 0.0

    portfolio_values: Dict[int, Dict] = {}
    for h in holdings:
        if h.portfolio_id not in portfolio_values:
            portfolio_values[h.portfolio_id] = {"value": 0, "holdings": []}
        portfolio_values[h.portfolio_id]["value"] += h.current_value or 0
        portfolio_values[h.portfolio_id]["holdings"].append({
            "ticker": h.ticker,
            "value": h.current_value or 0,
            "quantity": h.quantity,
        })

    for portfolio_id, data in portfolio_values.items():
        portfolio = portfolio_map.get(portfolio_id)
        total_investments += data["value"]
        investment_items.append({
            "id": portfolio_id,
            "name": portfolio.name if portfolio else f"Portfolio {portfolio_id}",
            "value": data["value"],
            "holdings_count": len(data["holdings"]),
        })

    # Real Estate
    properties = session.exec(select(Property)).all()
    mortgages = session.exec(select(Mortgage)).all()

    mortgage_by_property: Dict[int, float] = {}
    for m in mortgages:
        if m.is_active:
            if m.property_id not in mortgage_by_property:
                mortgage_by_property[m.property_id] = 0
            mortgage_by_property[m.property_id] += m.current_balance

    real_estate_items = []
    total_real_estate = 0.0

    for prop in properties:
        mortgage_balance = mortgage_by_property.get(prop.id, 0)
        equity = prop.current_value - mortgage_balance
        total_real_estate += equity
        real_estate_items.append({
            "id": prop.id,
            "name": prop.name,
            "property_type": prop.property_type,
            "current_value": prop.current_value,
            "mortgage_balance": mortgage_balance,
            "equity": equity,
        })

    # Liabilities
    liabilities = session.exec(select(Liability)).all()
    liability_items = []
    total_liabilities = 0.0

    for liab in liabilities:
        snap = session.exec(
            select(BalanceSnapshot)
            .where(BalanceSnapshot.liability_id == liab.id)
            .order_by(BalanceSnapshot.date.desc())
        ).first()
        balance = snap.amount if snap else 0.0
        total_liabilities += balance
        liability_items.append({
            "id": liab.id,
            "name": liab.name,
            "balance": balance,
            "category": liab.category,
        })

    total_assets = total_cash + total_investments + total_real_estate
    net_worth = total_assets - total_liabilities

    return {
        "net_worth": net_worth,
        "total_assets": total_assets,
        "total_liabilities": total_liabilities,
        "categories": {
            "cash": {
                "total": total_cash,
                "items": cash_items,
            },
            "investments": {
                "total": total_investments,
                "items": investment_items,
            },
            "real_estate": {
                "total": total_real_estate,
                "items": real_estate_items,
            },
            "liabilities": {
                "total": total_liabilities,
                "items": liability_items,
            },
        }
    }
