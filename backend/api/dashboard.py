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

    # 3. Real Estate (show gross property values as assets)
    properties = session.exec(select(Property)).all()
    mortgages = session.exec(select(Mortgage)).all()

    # Group mortgages by property for reference
    mortgage_by_property: Dict[int, float] = {}
    total_mortgage_balance = 0.0
    for m in mortgages:
        if m.is_active:
            if m.property_id not in mortgage_by_property:
                mortgage_by_property[m.property_id] = 0
            mortgage_by_property[m.property_id] += m.current_balance
            total_mortgage_balance += m.current_balance

    total_real_estate_value = 0.0

    for prop in properties:
        total_real_estate_value += prop.current_value

        asset_breakdown.append({
            "name": prop.name,
            "balance": prop.current_value,  # Show gross property value
            "currency": prop.currency,
            "type": "real_estate"
        })

    # 4. Liabilities (including mortgages)
    liabilities = session.exec(select(Liability)).all()
    total_liabilities = 0.0
    liab_breakdown = []

    # Add mortgages to liabilities
    for m in mortgages:
        if m.is_active:
            # Find the property name for this mortgage
            prop = next((p for p in properties if p.id == m.property_id), None)
            prop_name = prop.name if prop else f"Property {m.property_id}"
            liab_breakdown.append({
                "name": f"Mortgage - {prop_name}",
                "balance": m.current_balance,
                "currency": prop.currency if prop else "USD",
                "type": "mortgage"
            })
    total_liabilities += total_mortgage_balance

    # Add other liabilities
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
            "currency": liab.currency,
            "type": "liability"
        })

    # Calculate totals
    total_assets = total_cash + total_investments + total_real_estate_value
    # Net worth = Assets - Liabilities (mortgages are now in liabilities)
    net_worth = total_assets - total_liabilities

    return {
        "net_worth": net_worth,
        "total_assets": total_assets,
        "total_liabilities": total_liabilities,
        "currency": "USD",
        "breakdown": {
            "cash_accounts": total_cash,
            "investments": total_investments,
            "real_estate": total_real_estate_value,
            "mortgages": total_mortgage_balance,
        },
        "assets": asset_breakdown,
        "liabilities": liab_breakdown
    }


@router.get("/networth/history")
def get_networth_history(session: Session = Depends(get_session)):
    """
    Get historical Net Worth over time.
    Computes cumulative net worth at each date based on all balance snapshots.
    Uses the most recent snapshot for each account/liability as of each date.
    """
    # Get all snapshots ordered by date
    snapshots = session.exec(
        select(BalanceSnapshot).order_by(BalanceSnapshot.date)
    ).all()

    if not snapshots:
        return []

    # Track the most recent balance for each account and liability
    account_balances: Dict[int, float] = {}
    liability_balances: Dict[int, float] = {}

    # Collect all unique dates
    all_dates = sorted(set(snap.date.strftime("%Y-%m-%d") for snap in snapshots))

    # Build a timeline: for each snapshot, update the running balance
    # Group snapshots by date first
    snapshots_by_date: Dict[str, list] = {}
    for snap in snapshots:
        date_str = snap.date.strftime("%Y-%m-%d")
        if date_str not in snapshots_by_date:
            snapshots_by_date[date_str] = []
        snapshots_by_date[date_str].append(snap)

    # Get current portfolio value (point-in-time, we'll add this to all dates for context)
    holdings = session.exec(select(PortfolioHolding)).all()
    total_investments = sum(h.current_value or 0 for h in holdings)

    # Get current real estate value and mortgages
    properties = session.exec(select(Property)).all()
    mortgages = session.exec(select(Mortgage)).all()
    total_real_estate = sum(p.current_value for p in properties)
    total_mortgages = sum(m.current_balance for m in mortgages if m.is_active)

    # Build cumulative history
    history_list = []

    for date_str in all_dates:
        # Apply all snapshots up to and including this date
        if date_str in snapshots_by_date:
            for snap in snapshots_by_date[date_str]:
                if snap.account_id:
                    account_balances[snap.account_id] = snap.amount
                elif snap.liability_id:
                    liability_balances[snap.liability_id] = snap.amount

        # Calculate totals as of this date
        total_cash = sum(account_balances.values())
        total_liabilities = sum(liability_balances.values())

        # For historical accuracy, we only have point-in-time portfolio/real estate
        # So we include them only for dates close to "now" or as context
        # For a proper implementation, we'd need to track portfolio snapshots too
        # For now, include investments and real estate in all dates for visualization
        total_assets = total_cash + total_investments + total_real_estate
        total_liab = total_liabilities + total_mortgages

        history_list.append({
            "date": date_str,
            "assets": total_assets,
            "liabilities": total_liab,
            "net_worth": total_assets - total_liab,
        })

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

    total_mortgage_balance = 0.0
    for prop in properties:
        mortgage_balance = mortgage_by_property.get(prop.id, 0)
        total_mortgage_balance += mortgage_balance
        total_real_estate += prop.current_value  # Use gross value
        real_estate_items.append({
            "id": prop.id,
            "name": prop.name,
            "property_type": prop.property_type,
            "current_value": prop.current_value,
            "mortgage_balance": mortgage_balance,
            "equity": prop.current_value - mortgage_balance,
        })

    # Liabilities (including mortgages)
    liabilities = session.exec(select(Liability)).all()
    liability_items = []
    total_liabilities = total_mortgage_balance  # Start with mortgages

    # Add mortgages to liability items
    for m in mortgages:
        if m.is_active:
            prop = next((p for p in properties if p.id == m.property_id), None)
            prop_name = prop.name if prop else f"Property {m.property_id}"
            liability_items.append({
                "id": f"mortgage_{m.id}",
                "name": f"Mortgage - {prop_name}",
                "balance": m.current_balance,
                "category": "mortgage",
            })

    # Add other liabilities
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
