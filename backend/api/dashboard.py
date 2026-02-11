"""
Dashboard API - Net worth calculation including cash, investments, and real estate.
"""
import logging
from datetime import datetime
from fastapi import APIRouter, Depends
from sqlmodel import Session, select
from typing import Dict

from core.database import get_session
from core.queries import get_latest_account_balances, get_latest_liability_balances
from core.fx_service import convert_to_base
from models import Account, Liability, BalanceSnapshot, Portfolio, PortfolioHolding, Property, Mortgage, NetWorthSnapshot, AppSettings

logger = logging.getLogger(__name__)

router = APIRouter()


def _get_base_currency(session: Session) -> str:
    """Get user's base currency from app settings, default USD."""
    setting = session.exec(
        select(AppSettings).where(AppSettings.key == "default_currency")
    ).first()
    return setting.value if setting and setting.value else "USD"


def _fx(amount: float, from_ccy: str, base_ccy: str) -> float:
    """Convert amount to base currency. No-op when currencies match."""
    if from_ccy == base_ccy:
        return amount
    return convert_to_base(amount, from_ccy, base_ccy)


@router.get("/networth")
def get_networth(session: Session = Depends(get_session)):
    """
    Get the latest Net Worth snapshot.
    Includes:
    - Cash accounts (from Account/BalanceSnapshot)
    - Investment portfolios (from PortfolioHolding)
    - Real estate equity (from Property - Mortgage)
    """
    base_ccy = _get_base_currency(session)

    # 1. Cash Accounts (Assets)
    accounts = session.exec(select(Account)).all()
    acct_balances = get_latest_account_balances(session)
    total_cash = 0.0
    asset_breakdown = []

    for account in accounts:
        snap = acct_balances.get(account.id)
        raw_balance = snap.amount if snap else 0.0
        balance = _fx(raw_balance, account.currency, base_ccy)
        total_cash += balance
        asset_breakdown.append({
            "name": account.name,
            "balance": balance,
            "currency": base_ccy,
            "original_currency": account.currency,
            "type": "cash"
        })

    # 2. Investment Portfolios
    holdings = session.exec(select(PortfolioHolding)).all()
    portfolios = session.exec(select(Portfolio)).all()
    portfolio_map = {p.id: p for p in portfolios}

    total_investments = 0.0

    # Group holdings by portfolio, converting each holding's currency
    portfolio_values: Dict[int, float] = {}
    for h in holdings:
        h_ccy = h.currency or "USD"
        converted = _fx(h.current_value or 0, h_ccy, base_ccy)
        total_investments += converted
        if h.portfolio_id not in portfolio_values:
            portfolio_values[h.portfolio_id] = 0
        portfolio_values[h.portfolio_id] += converted

    for portfolio_id, value in portfolio_values.items():
        p = portfolio_map.get(portfolio_id)
        asset_breakdown.append({
            "name": p.name if p else f"Portfolio {portfolio_id}",
            "balance": value,
            "currency": base_ccy,
            "original_currency": p.currency if p else "USD",
            "type": "investment"
        })

    # 3. Real Estate (show gross property values as assets)
    properties = session.exec(select(Property)).all()
    mortgages = session.exec(select(Mortgage)).all()

    # Build property currency lookup for mortgages
    prop_currency: Dict[int, str] = {p.id: p.currency for p in properties}

    # Group mortgages by property for reference
    mortgage_by_property: Dict[int, float] = {}
    total_mortgage_balance = 0.0
    for m in mortgages:
        if m.is_active:
            m_ccy = prop_currency.get(m.property_id, "USD")
            converted = _fx(m.current_balance, m_ccy, base_ccy)
            if m.property_id not in mortgage_by_property:
                mortgage_by_property[m.property_id] = 0
            mortgage_by_property[m.property_id] += converted
            total_mortgage_balance += converted

    total_real_estate_value = 0.0

    for prop in properties:
        converted = _fx(prop.current_value, prop.currency, base_ccy)
        total_real_estate_value += converted

        asset_breakdown.append({
            "name": prop.name,
            "balance": converted,
            "currency": base_ccy,
            "original_currency": prop.currency,
            "type": "real_estate"
        })

    # 4. Liabilities (including mortgages)
    liabilities = session.exec(select(Liability)).all()
    total_liabilities = 0.0
    liab_breakdown = []

    # Add mortgages to liabilities
    for m in mortgages:
        if m.is_active:
            prop = next((p for p in properties if p.id == m.property_id), None)
            prop_name = prop.name if prop else f"Property {m.property_id}"
            m_ccy = prop.currency if prop else "USD"
            converted = _fx(m.current_balance, m_ccy, base_ccy)
            liab_breakdown.append({
                "name": f"Mortgage - {prop_name}",
                "balance": converted,
                "currency": base_ccy,
                "original_currency": m_ccy,
                "type": "mortgage"
            })
    total_liabilities += total_mortgage_balance

    # Add other liabilities
    liab_balances = get_latest_liability_balances(session)
    for liab in liabilities:
        snap = liab_balances.get(liab.id)
        raw_balance = snap.amount if snap else 0.0
        balance = _fx(raw_balance, liab.currency, base_ccy)
        total_liabilities += balance
        liab_breakdown.append({
            "name": liab.name,
            "balance": balance,
            "currency": base_ccy,
            "original_currency": liab.currency,
            "type": "liability"
        })

    # Calculate totals
    total_assets = total_cash + total_investments + total_real_estate_value
    # Net worth = Assets - Liabilities (mortgages are now in liabilities)
    net_worth = total_assets - total_liabilities

    # Persist today's snapshot (upsert) so history chart has real data
    _upsert_today_snapshot(
        session, total_cash, total_investments, total_real_estate_value,
        total_liabilities - total_mortgage_balance, total_mortgage_balance, net_worth,
    )

    return {
        "net_worth": net_worth,
        "total_assets": total_assets,
        "total_liabilities": total_liabilities,
        "currency": base_ccy,
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
    Get historical Net Worth over time using daily snapshots.
    Each snapshot records the actual component values on that day,
    so the chart reflects real historical values rather than projecting
    today's portfolio/real-estate values backward.
    """
    from services.snapshot import compute_net_worth_components

    # Fetch stored daily snapshots
    nw_snapshots = session.exec(
        select(NetWorthSnapshot).order_by(NetWorthSnapshot.date)
    ).all()

    today = datetime.utcnow().strftime("%Y-%m-%d")

    history_list = []
    for snap in nw_snapshots:
        # Skip today's stored row — we'll append a live one below
        if snap.date == today:
            continue
        total_assets = snap.total_cash + snap.total_investments + snap.total_real_estate
        total_liab = snap.total_liabilities + snap.total_mortgages
        history_list.append({
            "date": snap.date,
            "assets": total_assets,
            "liabilities": total_liab,
            "net_worth": snap.net_worth,
        })

    # Always append a live "today" data point from current values
    components = compute_net_worth_components(session)
    total_assets_today = (
        components["total_cash"]
        + components["total_investments"]
        + components["total_real_estate"]
    )
    total_liab_today = components["total_liabilities"] + components["total_mortgages"]
    history_list.append({
        "date": today,
        "assets": total_assets_today,
        "liabilities": total_liab_today,
        "net_worth": components["net_worth"],
    })

    return history_list


@router.get("/networth/breakdown")
def get_networth_breakdown(session: Session = Depends(get_session)):
    """
    Get detailed breakdown of net worth by category.
    """
    base_ccy = _get_base_currency(session)

    # Cash
    accounts = session.exec(select(Account)).all()
    acct_balances = get_latest_account_balances(session)
    cash_items = []
    total_cash = 0.0

    for account in accounts:
        snap = acct_balances.get(account.id)
        raw_balance = snap.amount if snap else 0.0
        balance = _fx(raw_balance, account.currency, base_ccy)
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
        h_ccy = h.currency or "USD"
        converted = _fx(h.current_value or 0, h_ccy, base_ccy)
        if h.portfolio_id not in portfolio_values:
            portfolio_values[h.portfolio_id] = {"value": 0, "holdings": []}
        portfolio_values[h.portfolio_id]["value"] += converted
        portfolio_values[h.portfolio_id]["holdings"].append({
            "ticker": h.ticker,
            "value": converted,
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

    prop_currency: Dict[int, str] = {p.id: p.currency for p in properties}

    mortgage_by_property: Dict[int, float] = {}
    for m in mortgages:
        if m.is_active:
            m_ccy = prop_currency.get(m.property_id, "USD")
            converted = _fx(m.current_balance, m_ccy, base_ccy)
            if m.property_id not in mortgage_by_property:
                mortgage_by_property[m.property_id] = 0
            mortgage_by_property[m.property_id] += converted

    real_estate_items = []
    total_real_estate = 0.0

    total_mortgage_balance = 0.0
    for prop in properties:
        converted_value = _fx(prop.current_value, prop.currency, base_ccy)
        mortgage_balance = mortgage_by_property.get(prop.id, 0)
        total_mortgage_balance += mortgage_balance
        total_real_estate += converted_value
        real_estate_items.append({
            "id": prop.id,
            "name": prop.name,
            "property_type": prop.property_type,
            "current_value": converted_value,
            "mortgage_balance": mortgage_balance,
            "equity": converted_value - mortgage_balance,
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
            m_ccy = prop.currency if prop else "USD"
            converted = _fx(m.current_balance, m_ccy, base_ccy)
            liability_items.append({
                "id": f"mortgage_{m.id}",
                "name": f"Mortgage - {prop_name}",
                "balance": converted,
                "category": "mortgage",
            })

    # Add other liabilities
    liab_balances = get_latest_liability_balances(session)
    for liab in liabilities:
        snap = liab_balances.get(liab.id)
        raw_balance = snap.amount if snap else 0.0
        balance = _fx(raw_balance, liab.currency, base_ccy)
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
        "currency": base_ccy,
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


def _upsert_today_snapshot(
    session: Session,
    total_cash: float,
    total_investments: float,
    total_real_estate: float,
    total_liabilities: float,
    total_mortgages: float,
    net_worth: float,
) -> None:
    """Persist today's net worth snapshot (create or update)."""
    today = datetime.utcnow().strftime("%Y-%m-%d")
    try:
        existing = session.exec(
            select(NetWorthSnapshot).where(NetWorthSnapshot.date == today)
        ).first()

        if existing:
            existing.total_cash = total_cash
            existing.total_investments = total_investments
            existing.total_real_estate = total_real_estate
            existing.total_liabilities = total_liabilities
            existing.total_mortgages = total_mortgages
            existing.net_worth = net_worth
            session.add(existing)
        else:
            snapshot = NetWorthSnapshot(
                date=today,
                total_cash=total_cash,
                total_investments=total_investments,
                total_real_estate=total_real_estate,
                total_liabilities=total_liabilities,
                total_mortgages=total_mortgages,
                net_worth=net_worth,
            )
            session.add(snapshot)

        session.commit()
    except Exception as e:
        logger.warning("Failed to upsert snapshot: %s", e)
