"""
Accounts API - Full CRUD for cash accounts with balance tracking.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from typing import List, Optional
from pydantic import BaseModel, Field
from datetime import datetime, timezone

from core.database import get_session
from core.queries import get_latest_account_balances
from models import Account, BalanceSnapshot

router = APIRouter(tags=["Accounts"])


# Pydantic schemas
class AccountCreate(BaseModel):
    name: str
    institution: Optional[str] = None
    type: str  # checking, savings, investment, cash
    currency: str = "USD"
    current_balance: float = Field(default=0.0, ge=0)
    tags: Optional[str] = None


class AccountUpdate(BaseModel):
    name: Optional[str] = None
    institution: Optional[str] = None
    type: Optional[str] = None
    currency: Optional[str] = None
    tags: Optional[str] = None


class BalanceUpdate(BaseModel):
    amount: float
    date: Optional[datetime] = None


class AccountResponse(BaseModel):
    id: int
    name: str
    institution: Optional[str]
    type: str
    currency: str
    tags: Optional[str]
    current_balance: float
    last_updated: Optional[datetime]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# Account CRUD
@router.get("/accounts")
def list_accounts(session: Session = Depends(get_session)):
    """List all accounts with their current balances."""
    accounts = session.exec(select(Account)).all()
    latest_balances = get_latest_account_balances(session)

    result = []
    for account in accounts:
        snap = latest_balances.get(account.id)
        result.append({
            "id": account.id,
            "name": account.name,
            "institution": account.institution,
            "type": account.type,
            "currency": account.currency,
            "tags": account.tags,
            "current_balance": snap.amount if snap else 0.0,
            "last_updated": snap.date if snap else None,
            "created_at": account.created_at,
            "updated_at": account.updated_at,
        })

    return result


@router.post("/accounts")
def create_account(data: AccountCreate, session: Session = Depends(get_session)):
    """Create a new account with initial balance."""
    # Check for duplicate name
    existing = session.exec(
        select(Account).where(Account.name == data.name)
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Account with this name already exists")

    account = Account(
        name=data.name,
        institution=data.institution,
        type=data.type,
        currency=data.currency,
        tags=data.tags,
    )
    session.add(account)
    session.commit()
    session.refresh(account)

    # Create initial balance snapshot
    if data.current_balance != 0:
        snapshot = BalanceSnapshot(
            date=datetime.now(timezone.utc),
            account_id=account.id,
            amount=data.current_balance,
            currency=data.currency,
        )
        session.add(snapshot)
        session.commit()

    return {
        "id": account.id,
        "name": account.name,
        "institution": account.institution,
        "type": account.type,
        "currency": account.currency,
        "tags": account.tags,
        "current_balance": data.current_balance,
        "last_updated": datetime.now(timezone.utc) if data.current_balance != 0 else None,
        "created_at": account.created_at,
        "updated_at": account.updated_at,
    }


@router.get("/accounts/summary")
def get_accounts_summary(session: Session = Depends(get_session)):
    """Get aggregate summary of all accounts."""
    accounts = session.exec(select(Account)).all()
    latest_balances = get_latest_account_balances(session)

    total_balance = 0.0
    by_type = {}
    by_institution = {}

    for account in accounts:
        balance = latest_balances[account.id].amount if account.id in latest_balances else 0.0
        total_balance += balance

        # Group by type
        if account.type not in by_type:
            by_type[account.type] = 0.0
        by_type[account.type] += balance

        # Group by institution
        inst = account.institution or "Other"
        if inst not in by_institution:
            by_institution[inst] = 0.0
        by_institution[inst] += balance

    return {
        "total_balance": total_balance,
        "accounts_count": len(accounts),
        "by_type": [{"type": k, "balance": v} for k, v in by_type.items()],
        "by_institution": [{"institution": k, "balance": v} for k, v in by_institution.items()],
    }


@router.get("/accounts/{account_id}")
def get_account(account_id: int, session: Session = Depends(get_session)):
    """Get account details with balance history."""
    account = session.get(Account, account_id)
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    # Get all balance snapshots
    snapshots = session.exec(
        select(BalanceSnapshot)
        .where(BalanceSnapshot.account_id == account_id)
        .order_by(BalanceSnapshot.date.desc())
    ).all()

    current_balance = snapshots[0].amount if snapshots else 0.0
    last_updated = snapshots[0].date if snapshots else None

    return {
        "id": account.id,
        "name": account.name,
        "institution": account.institution,
        "type": account.type,
        "currency": account.currency,
        "tags": account.tags,
        "current_balance": current_balance,
        "last_updated": last_updated,
        "created_at": account.created_at,
        "updated_at": account.updated_at,
        "balance_history": [
            {"date": s.date, "amount": s.amount, "currency": s.currency}
            for s in snapshots[:30]  # Last 30 entries
        ],
    }


@router.put("/accounts/{account_id}")
def update_account(
    account_id: int,
    data: AccountUpdate,
    session: Session = Depends(get_session)
):
    """Update account details (not balance)."""
    account = session.get(Account, account_id)
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    if data.name is not None:
        # Check for duplicate name
        existing = session.exec(
            select(Account).where(Account.name == data.name, Account.id != account_id)
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="Account with this name already exists")
        account.name = data.name
    if data.institution is not None:
        account.institution = data.institution
    if data.type is not None:
        account.type = data.type
    if data.currency is not None:
        account.currency = data.currency
    if data.tags is not None:
        account.tags = data.tags

    account.updated_at = datetime.now(timezone.utc)
    session.add(account)
    session.commit()
    session.refresh(account)

    # Get current balance
    latest_snapshot = session.exec(
        select(BalanceSnapshot)
        .where(BalanceSnapshot.account_id == account_id)
        .order_by(BalanceSnapshot.date.desc())
    ).first()

    return {
        "id": account.id,
        "name": account.name,
        "institution": account.institution,
        "type": account.type,
        "currency": account.currency,
        "tags": account.tags,
        "current_balance": latest_snapshot.amount if latest_snapshot else 0.0,
        "last_updated": latest_snapshot.date if latest_snapshot else None,
        "created_at": account.created_at,
        "updated_at": account.updated_at,
    }


@router.delete("/accounts/{account_id}")
def delete_account(account_id: int, session: Session = Depends(get_session)):
    """Delete account and all its balance history."""
    account = session.get(Account, account_id)
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    # Delete all balance snapshots
    snapshots = session.exec(
        select(BalanceSnapshot).where(BalanceSnapshot.account_id == account_id)
    ).all()
    for snapshot in snapshots:
        session.delete(snapshot)

    session.delete(account)
    session.commit()
    return {"message": "Account deleted", "id": account_id}


# Balance updates
@router.post("/accounts/{account_id}/balance")
def update_balance(
    account_id: int,
    data: BalanceUpdate,
    session: Session = Depends(get_session)
):
    """Record a new balance snapshot for an account."""
    account = session.get(Account, account_id)
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    snapshot = BalanceSnapshot(
        date=data.date or datetime.now(timezone.utc),
        account_id=account_id,
        amount=data.amount,
        currency=account.currency,
    )
    session.add(snapshot)

    account.updated_at = datetime.now(timezone.utc)
    session.add(account)

    session.commit()
    session.refresh(snapshot)

    return {
        "id": account.id,
        "name": account.name,
        "current_balance": data.amount,
        "last_updated": snapshot.date,
    }


