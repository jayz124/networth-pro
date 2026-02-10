"""
Shared query helpers to avoid N+1 patterns.
"""
from typing import Dict, Optional
from sqlmodel import Session, select
from sqlalchemy import func

from models import BalanceSnapshot


def get_latest_account_balances(session: Session) -> Dict[int, BalanceSnapshot]:
    """Get the latest BalanceSnapshot for each account in a single query.

    Returns a dict mapping account_id -> BalanceSnapshot.
    """
    # Subquery: max date per account
    latest_dates = (
        select(
            BalanceSnapshot.account_id,
            func.max(BalanceSnapshot.date).label("max_date"),
        )
        .where(BalanceSnapshot.account_id.isnot(None))
        .group_by(BalanceSnapshot.account_id)
        .subquery()
    )

    # Join to get full snapshot rows
    snapshots = session.exec(
        select(BalanceSnapshot)
        .join(
            latest_dates,
            (BalanceSnapshot.account_id == latest_dates.c.account_id)
            & (BalanceSnapshot.date == latest_dates.c.max_date),
        )
    ).all()

    return {s.account_id: s for s in snapshots}


def get_latest_liability_balances(session: Session) -> Dict[int, BalanceSnapshot]:
    """Get the latest BalanceSnapshot for each liability in a single query.

    Returns a dict mapping liability_id -> BalanceSnapshot.
    """
    latest_dates = (
        select(
            BalanceSnapshot.liability_id,
            func.max(BalanceSnapshot.date).label("max_date"),
        )
        .where(BalanceSnapshot.liability_id.isnot(None))
        .group_by(BalanceSnapshot.liability_id)
        .subquery()
    )

    snapshots = session.exec(
        select(BalanceSnapshot)
        .join(
            latest_dates,
            (BalanceSnapshot.liability_id == latest_dates.c.liability_id)
            & (BalanceSnapshot.date == latest_dates.c.max_date),
        )
    ).all()

    return {s.liability_id: s for s in snapshots}
