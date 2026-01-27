"""
Real Estate API - CRUD for properties and mortgages with equity calculations.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime

from core.database import get_session
from models import Property, Mortgage

router = APIRouter(prefix="/properties", tags=["Real Estate"])


# Pydantic schemas
class PropertyCreate(BaseModel):
    name: str
    address: str
    property_type: str  # residential, commercial, rental, land
    purchase_price: float
    purchase_date: Optional[str] = None
    current_value: float
    currency: str = "USD"


class PropertyUpdate(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    property_type: Optional[str] = None
    purchase_price: Optional[float] = None
    purchase_date: Optional[str] = None
    current_value: Optional[float] = None
    currency: Optional[str] = None


class MortgageCreate(BaseModel):
    lender: Optional[str] = None
    original_principal: float
    current_balance: float
    interest_rate: float
    monthly_payment: float
    term_years: int
    is_active: bool = True


class MortgageUpdate(BaseModel):
    lender: Optional[str] = None
    original_principal: Optional[float] = None
    current_balance: Optional[float] = None
    interest_rate: Optional[float] = None
    monthly_payment: Optional[float] = None
    term_years: Optional[int] = None
    is_active: Optional[bool] = None


# Property CRUD
@router.get("")
def list_properties(session: Session = Depends(get_session)):
    """List all properties with their mortgages and equity."""
    properties = session.exec(select(Property)).all()

    results = []
    for prop in properties:
        mortgages = session.exec(
            select(Mortgage).where(Mortgage.property_id == prop.id)
        ).all()

        total_mortgage_balance = sum(m.current_balance for m in mortgages if m.is_active)
        equity = prop.current_value - total_mortgage_balance
        monthly_payments = sum(m.monthly_payment for m in mortgages if m.is_active)

        results.append({
            "id": prop.id,
            "name": prop.name,
            "address": prop.address,
            "property_type": prop.property_type,
            "purchase_price": prop.purchase_price,
            "purchase_date": prop.purchase_date,
            "current_value": prop.current_value,
            "currency": prop.currency,
            "total_mortgage_balance": total_mortgage_balance,
            "equity": equity,
            "monthly_payments": monthly_payments,
            "mortgages": [_mortgage_to_dict(m) for m in mortgages],
            "appreciation": prop.current_value - prop.purchase_price,
            "appreciation_percent": ((prop.current_value - prop.purchase_price) / prop.purchase_price * 100)
            if prop.purchase_price > 0 else 0,
        })

    return results


@router.post("")
def create_property(data: PropertyCreate, session: Session = Depends(get_session)):
    """Create a new property."""
    prop = Property(
        name=data.name,
        address=data.address,
        property_type=data.property_type,
        purchase_price=data.purchase_price,
        purchase_date=data.purchase_date,
        current_value=data.current_value,
        currency=data.currency,
    )
    session.add(prop)
    session.commit()
    session.refresh(prop)

    return {
        **_property_to_dict(prop),
        "mortgages": [],
        "total_mortgage_balance": 0,
        "equity": prop.current_value,
        "monthly_payments": 0,
    }


@router.get("/{property_id}")
def get_property(property_id: int, session: Session = Depends(get_session)):
    """Get property with mortgage and equity details."""
    prop = session.get(Property, property_id)
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")

    mortgages = session.exec(
        select(Mortgage).where(Mortgage.property_id == property_id)
    ).all()

    total_mortgage_balance = sum(m.current_balance for m in mortgages if m.is_active)
    equity = prop.current_value - total_mortgage_balance
    monthly_payments = sum(m.monthly_payment for m in mortgages if m.is_active)

    return {
        **_property_to_dict(prop),
        "mortgages": [_mortgage_to_dict(m) for m in mortgages],
        "total_mortgage_balance": total_mortgage_balance,
        "equity": equity,
        "monthly_payments": monthly_payments,
        "appreciation": prop.current_value - prop.purchase_price,
        "appreciation_percent": ((prop.current_value - prop.purchase_price) / prop.purchase_price * 100)
        if prop.purchase_price > 0 else 0,
    }


@router.put("/{property_id}")
def update_property(
    property_id: int,
    data: PropertyUpdate,
    session: Session = Depends(get_session)
):
    """Update property details."""
    prop = session.get(Property, property_id)
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")

    if data.name is not None:
        prop.name = data.name
    if data.address is not None:
        prop.address = data.address
    if data.property_type is not None:
        prop.property_type = data.property_type
    if data.purchase_price is not None:
        prop.purchase_price = data.purchase_price
    if data.purchase_date is not None:
        prop.purchase_date = data.purchase_date
    if data.current_value is not None:
        prop.current_value = data.current_value
    if data.currency is not None:
        prop.currency = data.currency

    prop.updated_at = datetime.utcnow()
    session.add(prop)
    session.commit()
    session.refresh(prop)

    # Return with mortgage details
    mortgages = session.exec(
        select(Mortgage).where(Mortgage.property_id == property_id)
    ).all()

    total_mortgage_balance = sum(m.current_balance for m in mortgages if m.is_active)
    equity = prop.current_value - total_mortgage_balance

    return {
        **_property_to_dict(prop),
        "mortgages": [_mortgage_to_dict(m) for m in mortgages],
        "total_mortgage_balance": total_mortgage_balance,
        "equity": equity,
    }


@router.delete("/{property_id}")
def delete_property(property_id: int, session: Session = Depends(get_session)):
    """Delete property and its mortgages."""
    prop = session.get(Property, property_id)
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")

    # Delete all mortgages first
    mortgages = session.exec(
        select(Mortgage).where(Mortgage.property_id == property_id)
    ).all()
    for mortgage in mortgages:
        session.delete(mortgage)

    session.delete(prop)
    session.commit()
    return {"message": "Property deleted", "id": property_id}


# Mortgage CRUD
@router.post("/{property_id}/mortgage")
def add_mortgage(
    property_id: int,
    data: MortgageCreate,
    session: Session = Depends(get_session)
):
    """Add a mortgage to a property."""
    prop = session.get(Property, property_id)
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")

    mortgage = Mortgage(
        property_id=property_id,
        lender=data.lender,
        original_principal=data.original_principal,
        current_balance=data.current_balance,
        interest_rate=data.interest_rate,
        monthly_payment=data.monthly_payment,
        term_years=data.term_years,
        is_active=data.is_active,
    )
    session.add(mortgage)
    session.commit()
    session.refresh(mortgage)
    return _mortgage_to_dict(mortgage)


@router.put("/mortgages/{mortgage_id}")
def update_mortgage(
    mortgage_id: int,
    data: MortgageUpdate,
    session: Session = Depends(get_session)
):
    """Update mortgage details."""
    mortgage = session.get(Mortgage, mortgage_id)
    if not mortgage:
        raise HTTPException(status_code=404, detail="Mortgage not found")

    if data.lender is not None:
        mortgage.lender = data.lender
    if data.original_principal is not None:
        mortgage.original_principal = data.original_principal
    if data.current_balance is not None:
        mortgage.current_balance = data.current_balance
    if data.interest_rate is not None:
        mortgage.interest_rate = data.interest_rate
    if data.monthly_payment is not None:
        mortgage.monthly_payment = data.monthly_payment
    if data.term_years is not None:
        mortgage.term_years = data.term_years
    if data.is_active is not None:
        mortgage.is_active = data.is_active

    mortgage.updated_at = datetime.utcnow()
    session.add(mortgage)
    session.commit()
    session.refresh(mortgage)
    return _mortgage_to_dict(mortgage)


@router.delete("/mortgages/{mortgage_id}")
def delete_mortgage(mortgage_id: int, session: Session = Depends(get_session)):
    """Delete a mortgage."""
    mortgage = session.get(Mortgage, mortgage_id)
    if not mortgage:
        raise HTTPException(status_code=404, detail="Mortgage not found")

    session.delete(mortgage)
    session.commit()
    return {"message": "Mortgage deleted", "id": mortgage_id}


# Summary
@router.get("/summary")
def get_real_estate_summary(session: Session = Depends(get_session)):
    """Get total real estate equity and summary."""
    properties = session.exec(select(Property)).all()
    mortgages = session.exec(select(Mortgage)).all()

    # Group mortgages by property
    mortgage_by_property = {}
    for m in mortgages:
        if m.property_id not in mortgage_by_property:
            mortgage_by_property[m.property_id] = []
        mortgage_by_property[m.property_id].append(m)

    total_property_value = 0
    total_mortgage_balance = 0
    total_equity = 0
    total_monthly_payments = 0
    total_appreciation = 0

    property_breakdown = []
    for prop in properties:
        prop_mortgages = mortgage_by_property.get(prop.id, [])
        mortgage_balance = sum(m.current_balance for m in prop_mortgages if m.is_active)
        monthly_payment = sum(m.monthly_payment for m in prop_mortgages if m.is_active)
        equity = prop.current_value - mortgage_balance
        appreciation = prop.current_value - prop.purchase_price

        total_property_value += prop.current_value
        total_mortgage_balance += mortgage_balance
        total_equity += equity
        total_monthly_payments += monthly_payment
        total_appreciation += appreciation

        property_breakdown.append({
            "id": prop.id,
            "name": prop.name,
            "property_type": prop.property_type,
            "current_value": prop.current_value,
            "mortgage_balance": mortgage_balance,
            "equity": equity,
            "appreciation": appreciation,
        })

    return {
        "total_property_value": total_property_value,
        "total_mortgage_balance": total_mortgage_balance,
        "total_equity": total_equity,
        "total_monthly_payments": total_monthly_payments,
        "total_appreciation": total_appreciation,
        "properties_count": len(properties),
        "properties": property_breakdown,
    }


def _property_to_dict(prop: Property) -> dict:
    """Convert Property to dict."""
    return {
        "id": prop.id,
        "name": prop.name,
        "address": prop.address,
        "property_type": prop.property_type,
        "purchase_price": prop.purchase_price,
        "purchase_date": prop.purchase_date,
        "current_value": prop.current_value,
        "currency": prop.currency,
        "created_at": prop.created_at.isoformat() if prop.created_at else None,
        "updated_at": prop.updated_at.isoformat() if prop.updated_at else None,
    }


def _mortgage_to_dict(mortgage: Mortgage) -> dict:
    """Convert Mortgage to dict."""
    return {
        "id": mortgage.id,
        "property_id": mortgage.property_id,
        "lender": mortgage.lender,
        "original_principal": mortgage.original_principal,
        "current_balance": mortgage.current_balance,
        "interest_rate": mortgage.interest_rate,
        "monthly_payment": mortgage.monthly_payment,
        "term_years": mortgage.term_years,
        "is_active": mortgage.is_active,
        "created_at": mortgage.created_at.isoformat() if mortgage.created_at else None,
        "updated_at": mortgage.updated_at.isoformat() if mortgage.updated_at else None,
    }
