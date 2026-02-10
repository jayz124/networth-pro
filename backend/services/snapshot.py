"""
Net worth snapshot service.

Creates daily snapshots of all net worth components so the history chart
shows real values instead of projecting today's portfolio/RE backward.
"""
import logging
from datetime import datetime
from sqlmodel import Session, select

from models import (
    Account, Liability, BalanceSnapshot, PortfolioHolding,
    Property, Mortgage, NetWorthSnapshot,
)

logger = logging.getLogger(__name__)


def compute_net_worth_components(session: Session) -> dict:
    """Compute current totals for all net worth components.

    Returns a dict with keys matching NetWorthSnapshot fields.
    """
    # Cash accounts
    accounts = session.exec(select(Account)).all()
    total_cash = 0.0
    for account in accounts:
        snap = session.exec(
            select(BalanceSnapshot)
            .where(BalanceSnapshot.account_id == account.id)
            .order_by(BalanceSnapshot.date.desc())
        ).first()
        total_cash += snap.amount if snap else 0.0

    # Investments
    holdings = session.exec(select(PortfolioHolding)).all()
    total_investments = sum(h.current_value or 0 for h in holdings)

    # Real estate
    properties = session.exec(select(Property)).all()
    total_real_estate = sum(p.current_value for p in properties)

    # Mortgages
    mortgages = session.exec(select(Mortgage)).all()
    total_mortgages = sum(m.current_balance for m in mortgages if m.is_active)

    # Other liabilities
    liabilities = session.exec(select(Liability)).all()
    total_liabilities = 0.0
    for liab in liabilities:
        snap = session.exec(
            select(BalanceSnapshot)
            .where(BalanceSnapshot.liability_id == liab.id)
            .order_by(BalanceSnapshot.date.desc())
        ).first()
        total_liabilities += snap.amount if snap else 0.0

    total_assets = total_cash + total_investments + total_real_estate
    total_liab = total_liabilities + total_mortgages
    net_worth = total_assets - total_liab

    return {
        "total_cash": total_cash,
        "total_investments": total_investments,
        "total_real_estate": total_real_estate,
        "total_liabilities": total_liabilities,
        "total_mortgages": total_mortgages,
        "net_worth": net_worth,
    }


def create_daily_snapshot(session: Session) -> NetWorthSnapshot:
    """Create or update today's net worth snapshot.

    Idempotent: calling multiple times on the same day updates the
    existing row rather than creating duplicates.
    """
    today = datetime.utcnow().strftime("%Y-%m-%d")
    components = compute_net_worth_components(session)

    existing = session.exec(
        select(NetWorthSnapshot).where(NetWorthSnapshot.date == today)
    ).first()

    if existing:
        existing.total_cash = components["total_cash"]
        existing.total_investments = components["total_investments"]
        existing.total_real_estate = components["total_real_estate"]
        existing.total_liabilities = components["total_liabilities"]
        existing.total_mortgages = components["total_mortgages"]
        existing.net_worth = components["net_worth"]
        session.add(existing)
        session.commit()
        session.refresh(existing)
        logger.info("Updated today's net worth snapshot: net_worth=%.2f", existing.net_worth)
        return existing

    snapshot = NetWorthSnapshot(
        date=today,
        **components,
    )
    session.add(snapshot)
    session.commit()
    session.refresh(snapshot)
    logger.info("Created net worth snapshot for %s: net_worth=%.2f", today, snapshot.net_worth)
    return snapshot
