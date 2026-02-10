"""
Net worth snapshot service.

Creates daily snapshots of all net worth components so the history chart
shows real values instead of projecting today's portfolio/RE backward.
"""
import logging
from datetime import datetime
from typing import Dict
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


def backfill_snapshots(session: Session) -> int:
    """Create NetWorthSnapshot rows for historical dates found in BalanceSnapshot.

    Walks through all unique BalanceSnapshot dates chronologically, tracks
    running account/liability balances, and creates a NetWorthSnapshot for
    each date that doesn't already have one.

    Investments and real estate are recorded as 0 for historical dates
    because we have no point-in-time data for those asset classes prior
    to the snapshot system being introduced.

    Returns the number of new snapshots created.
    """
    balance_snaps = session.exec(
        select(BalanceSnapshot).order_by(BalanceSnapshot.date)
    ).all()

    if not balance_snaps:
        return 0

    # Gather dates that already have a NetWorthSnapshot
    existing_dates = set(
        row.date for row in session.exec(select(NetWorthSnapshot)).all()
    )

    # Group BalanceSnapshots by date string
    snaps_by_date: Dict[str, list] = {}
    for snap in balance_snaps:
        date_str = snap.date.strftime("%Y-%m-%d")
        if date_str not in snaps_by_date:
            snaps_by_date[date_str] = []
        snaps_by_date[date_str].append(snap)

    # Walk dates chronologically with running balances
    account_balances: Dict[int, float] = {}
    liability_balances: Dict[int, float] = {}
    created = 0

    for date_str in sorted(snaps_by_date.keys()):
        if date_str in existing_dates:
            # Still update running balances so subsequent dates are correct
            for snap in snaps_by_date[date_str]:
                if snap.account_id:
                    account_balances[snap.account_id] = snap.amount
                elif snap.liability_id:
                    liability_balances[snap.liability_id] = snap.amount
            continue

        # Apply this date's snapshots
        for snap in snaps_by_date[date_str]:
            if snap.account_id:
                account_balances[snap.account_id] = snap.amount
            elif snap.liability_id:
                liability_balances[snap.liability_id] = snap.amount

        total_cash = sum(account_balances.values())
        total_liabilities = sum(liability_balances.values())
        net_worth = total_cash - total_liabilities

        nw_snapshot = NetWorthSnapshot(
            date=date_str,
            total_cash=total_cash,
            total_investments=0.0,
            total_real_estate=0.0,
            total_liabilities=total_liabilities,
            total_mortgages=0.0,
            net_worth=net_worth,
        )
        session.add(nw_snapshot)
        created += 1

    if created:
        session.commit()
        logger.info("Backfilled %d historical net worth snapshots", created)

    return created
