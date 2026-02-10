"""
Liabilities API - Full CRUD for debts and liabilities with balance tracking.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime

from core.database import get_session
from core.queries import get_latest_liability_balances
from models import Liability, BalanceSnapshot

router = APIRouter(tags=["Liabilities"])


# Pydantic schemas
class LiabilityCreate(BaseModel):
    name: str
    category: Optional[str] = None  # credit_card, student_loan, auto_loan, personal_loan, other
    currency: str = "USD"
    current_balance: float = 0.0
    interest_rate: Optional[float] = None
    minimum_payment: Optional[float] = None
    due_date: Optional[int] = None  # Day of month
    tags: Optional[str] = None


class LiabilityUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    currency: Optional[str] = None
    interest_rate: Optional[float] = None
    minimum_payment: Optional[float] = None
    due_date: Optional[int] = None
    tags: Optional[str] = None


class BalanceUpdate(BaseModel):
    amount: float
    date: Optional[datetime] = None


class LiabilityResponse(BaseModel):
    id: int
    name: str
    category: Optional[str]
    currency: str
    tags: Optional[str]
    current_balance: float
    interest_rate: Optional[float]
    minimum_payment: Optional[float]
    due_date: Optional[int]
    last_updated: Optional[datetime]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# Liability CRUD
@router.get("/liabilities")
def list_liabilities(session: Session = Depends(get_session)):
    """List all liabilities with their current balances."""
    liabilities = session.exec(select(Liability)).all()
    latest_balances = get_latest_liability_balances(session)

    result = []
    for liability in liabilities:
        snap = latest_balances.get(liability.id)
        result.append({
            "id": liability.id,
            "name": liability.name,
            "category": liability.category,
            "currency": liability.currency,
            "tags": liability.tags,
            "current_balance": snap.amount if snap else 0.0,
            "last_updated": snap.date if snap else None,
            "created_at": liability.created_at,
            "updated_at": liability.updated_at,
        })

    return result


@router.post("/liabilities")
def create_liability(data: LiabilityCreate, session: Session = Depends(get_session)):
    """Create a new liability with initial balance."""
    # Check for duplicate name
    existing = session.exec(
        select(Liability).where(Liability.name == data.name)
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Liability with this name already exists")

    liability = Liability(
        name=data.name,
        category=data.category,
        currency=data.currency,
        tags=data.tags,
    )
    session.add(liability)
    session.commit()
    session.refresh(liability)

    # Create initial balance snapshot
    if data.current_balance != 0:
        snapshot = BalanceSnapshot(
            date=datetime.utcnow(),
            liability_id=liability.id,
            amount=data.current_balance,
            currency=data.currency,
        )
        session.add(snapshot)
        session.commit()

    return {
        "id": liability.id,
        "name": liability.name,
        "category": liability.category,
        "currency": liability.currency,
        "tags": liability.tags,
        "current_balance": data.current_balance,
        "last_updated": datetime.utcnow() if data.current_balance != 0 else None,
        "created_at": liability.created_at,
        "updated_at": liability.updated_at,
    }


@router.get("/liabilities/summary")
def get_liabilities_summary(session: Session = Depends(get_session)):
    """Get aggregate summary of all liabilities."""
    liabilities = session.exec(select(Liability)).all()
    latest_balances = get_latest_liability_balances(session)

    total_balance = 0.0
    by_category = {}

    for liability in liabilities:
        balance = latest_balances[liability.id].amount if liability.id in latest_balances else 0.0
        total_balance += balance

        # Group by category
        cat = liability.category or "Other"
        if cat not in by_category:
            by_category[cat] = 0.0
        by_category[cat] += balance

    return {
        "total_balance": total_balance,
        "liabilities_count": len(liabilities),
        "by_category": [{"category": k, "balance": v} for k, v in by_category.items()],
    }


@router.get("/liabilities/{liability_id}")
def get_liability(liability_id: int, session: Session = Depends(get_session)):
    """Get liability details with balance history."""
    liability = session.get(Liability, liability_id)
    if not liability:
        raise HTTPException(status_code=404, detail="Liability not found")

    # Get all balance snapshots
    snapshots = session.exec(
        select(BalanceSnapshot)
        .where(BalanceSnapshot.liability_id == liability_id)
        .order_by(BalanceSnapshot.date.desc())
    ).all()

    current_balance = snapshots[0].amount if snapshots else 0.0
    last_updated = snapshots[0].date if snapshots else None

    return {
        "id": liability.id,
        "name": liability.name,
        "category": liability.category,
        "currency": liability.currency,
        "tags": liability.tags,
        "current_balance": current_balance,
        "last_updated": last_updated,
        "created_at": liability.created_at,
        "updated_at": liability.updated_at,
        "balance_history": [
            {"date": s.date, "amount": s.amount, "currency": s.currency}
            for s in snapshots[:30]  # Last 30 entries
        ],
    }


@router.put("/liabilities/{liability_id}")
def update_liability(
    liability_id: int,
    data: LiabilityUpdate,
    session: Session = Depends(get_session)
):
    """Update liability details (not balance)."""
    liability = session.get(Liability, liability_id)
    if not liability:
        raise HTTPException(status_code=404, detail="Liability not found")

    if data.name is not None:
        # Check for duplicate name
        existing = session.exec(
            select(Liability).where(Liability.name == data.name, Liability.id != liability_id)
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="Liability with this name already exists")
        liability.name = data.name
    if data.category is not None:
        liability.category = data.category
    if data.currency is not None:
        liability.currency = data.currency
    if data.tags is not None:
        liability.tags = data.tags

    liability.updated_at = datetime.utcnow()
    session.add(liability)
    session.commit()
    session.refresh(liability)

    # Get current balance
    latest_snapshot = session.exec(
        select(BalanceSnapshot)
        .where(BalanceSnapshot.liability_id == liability_id)
        .order_by(BalanceSnapshot.date.desc())
    ).first()

    return {
        "id": liability.id,
        "name": liability.name,
        "category": liability.category,
        "currency": liability.currency,
        "tags": liability.tags,
        "current_balance": latest_snapshot.amount if latest_snapshot else 0.0,
        "last_updated": latest_snapshot.date if latest_snapshot else None,
        "created_at": liability.created_at,
        "updated_at": liability.updated_at,
    }


@router.delete("/liabilities/{liability_id}")
def delete_liability(liability_id: int, session: Session = Depends(get_session)):
    """Delete liability and all its balance history."""
    liability = session.get(Liability, liability_id)
    if not liability:
        raise HTTPException(status_code=404, detail="Liability not found")

    # Delete all balance snapshots
    snapshots = session.exec(
        select(BalanceSnapshot).where(BalanceSnapshot.liability_id == liability_id)
    ).all()
    for snapshot in snapshots:
        session.delete(snapshot)

    session.delete(liability)
    session.commit()
    return {"message": "Liability deleted", "id": liability_id}


# Balance updates
@router.post("/liabilities/{liability_id}/balance")
def update_balance(
    liability_id: int,
    data: BalanceUpdate,
    session: Session = Depends(get_session)
):
    """Record a new balance snapshot for a liability."""
    liability = session.get(Liability, liability_id)
    if not liability:
        raise HTTPException(status_code=404, detail="Liability not found")

    snapshot = BalanceSnapshot(
        date=data.date or datetime.utcnow(),
        liability_id=liability_id,
        amount=data.amount,
        currency=liability.currency,
    )
    session.add(snapshot)

    liability.updated_at = datetime.utcnow()
    session.add(liability)

    session.commit()
    session.refresh(snapshot)

    return {
        "id": liability.id,
        "name": liability.name,
        "current_balance": data.amount,
        "last_updated": snapshot.date,
    }


