"""
Real Estate API - CRUD for properties and mortgages with equity calculations.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from typing import List, Optional
from pydantic import BaseModel, Field
from datetime import datetime, timezone

from core.database import get_session
from models import Property, Mortgage, PropertyValuationCache

router = APIRouter(prefix="/properties", tags=["Real Estate"])


# Pydantic schemas
class PropertyCreate(BaseModel):
    name: str
    address: str
    property_type: str  # residential, commercial, rental, land
    purchase_price: float = Field(ge=0)
    purchase_date: Optional[str] = None
    current_value: float = Field(ge=0)
    currency: str = "USD"
    provider_property_id: Optional[str] = None
    valuation_provider: Optional[str] = None


class PropertyUpdate(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    property_type: Optional[str] = None
    purchase_price: Optional[float] = Field(default=None, ge=0)
    purchase_date: Optional[str] = None
    current_value: Optional[float] = Field(default=None, ge=0)
    currency: Optional[str] = None
    provider_property_id: Optional[str] = None
    valuation_provider: Optional[str] = None


class MortgageCreate(BaseModel):
    lender: Optional[str] = None
    original_principal: float = Field(ge=0)
    current_balance: float = Field(ge=0)
    interest_rate: float = Field(ge=0)
    monthly_payment: float = Field(ge=0)
    term_years: int = Field(ge=0)
    is_active: bool = True


class MortgageUpdate(BaseModel):
    lender: Optional[str] = None
    original_principal: Optional[float] = Field(default=None, ge=0)
    current_balance: Optional[float] = Field(default=None, ge=0)
    interest_rate: Optional[float] = Field(default=None, ge=0)
    monthly_payment: Optional[float] = Field(default=None, ge=0)
    term_years: Optional[int] = Field(default=None, ge=0)
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

        # Get cached valuation data (no API call)
        cached_val = session.exec(
            select(PropertyValuationCache)
            .where(PropertyValuationCache.property_id == prop.id)
        ).first()

        entry = {
            "id": prop.id,
            "name": prop.name,
            "address": prop.address,
            "property_type": prop.property_type,
            "purchase_price": prop.purchase_price,
            "purchase_date": prop.purchase_date,
            "current_value": prop.current_value,
            "currency": prop.currency,
            "provider_property_id": getattr(prop, "provider_property_id", None),
            "valuation_provider": getattr(prop, "valuation_provider", None),
            "total_mortgage_balance": total_mortgage_balance,
            "equity": equity,
            "monthly_payments": monthly_payments,
            "mortgages": [_mortgage_to_dict(m) for m in mortgages],
            "appreciation": prop.current_value - prop.purchase_price,
            "appreciation_percent": ((prop.current_value - prop.purchase_price) / prop.purchase_price * 100)
            if prop.purchase_price > 0 else 0,
        }

        if cached_val:
            entry["estimated_rent_monthly"] = cached_val.estimated_rent_monthly
            entry["value_range_low"] = cached_val.value_range_low
            entry["value_range_high"] = cached_val.value_range_high
            entry["rent_range_low"] = cached_val.rent_range_low
            entry["rent_range_high"] = cached_val.rent_range_high
            entry["bedrooms"] = cached_val.bedrooms
            entry["bathrooms"] = cached_val.bathrooms
            entry["square_footage"] = cached_val.square_footage
            entry["year_built"] = cached_val.year_built
            entry["valuation_fetched_at"] = cached_val.fetched_at.isoformat() if cached_val.fetched_at else None

        results.append(entry)

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
        provider_property_id=data.provider_property_id,
        valuation_provider=data.valuation_provider,
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


# --- Valuation Endpoints (must be before /{property_id} to avoid route conflicts) ---

def _load_rentcast_key(session: Session):
    """Load RentCast API key from settings into module cache."""
    from api.settings import get_setting_value
    from services.property_valuation import set_rentcast_api_key
    key = get_setting_value(session, "rentcast_api_key")
    if key:
        set_rentcast_api_key(key)


@router.get("/valuation/status")
def valuation_status(session: Session = Depends(get_session)):
    """Check if property valuation APIs are configured."""
    _load_rentcast_key(session)
    from services.property_valuation import is_rentcast_available
    return {"rentcast_available": is_rentcast_available()}


@router.get("/valuation/search")
async def valuation_search(q: str, session: Session = Depends(get_session)):
    """Search for a property address via RentCast. Uses 1 API call."""
    _load_rentcast_key(session)
    from services.property_valuation import search_address
    results = await search_address(q)
    return {"results": results}


@router.post("/refresh-values")
async def refresh_all_property_values(session: Session = Depends(get_session)):
    """Refresh valuations for all properties with a provider set.

    Uses 2 API calls per property.
    """
    _load_rentcast_key(session)
    from services.property_valuation import is_rentcast_available, refresh_all_valuations
    if not is_rentcast_available():
        raise HTTPException(status_code=400, detail="RentCast API key not configured. Add it in Settings.")

    result = await refresh_all_valuations(session)
    return result


# Summary (must be before /{property_id} to avoid route conflicts)
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


# --- Per-property endpoints ---

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
    if data.provider_property_id is not None:
        prop.provider_property_id = data.provider_property_id
    if data.valuation_provider is not None:
        prop.valuation_provider = data.valuation_provider

    prop.updated_at = datetime.now(timezone.utc)
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


# --- Per-property Valuation Endpoints ---

@router.get("/{property_id}/valuation")
async def get_property_valuation(property_id: int, refresh: bool = False, session: Session = Depends(get_session)):
    """Get valuation for a property. Returns cached data by default.

    Set refresh=true to force a fresh API call (uses 2 API calls).
    """
    prop = session.get(Property, property_id)
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")

    _load_rentcast_key(session)

    if not refresh:
        from services.property_valuation import get_cached_valuation
        cached = get_cached_valuation(property_id, session)
        if cached and not cached.get("is_stale"):
            return cached

    from services.property_valuation import get_full_valuation
    result = await get_full_valuation(prop.address, session, property_id)
    if not result:
        from services.property_valuation import get_cached_valuation
        cached = get_cached_valuation(property_id, session)
        if cached:
            return cached
        return {"error": "Could not fetch valuation. Check API key in Settings."}

    return result


@router.get("/{property_id}/value-history")
def get_property_value_history(property_id: int, session: Session = Depends(get_session)):
    """Get historical value data for a property (no API call)."""
    prop = session.get(Property, property_id)
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")

    from services.property_valuation import get_value_history
    history = get_value_history(property_id, session)

    # Also add the purchase price as the first data point if we have a purchase date
    if prop.purchase_date and prop.purchase_price:
        has_purchase = any(h["date"] == prop.purchase_date for h in history)
        if not has_purchase:
            history.insert(0, {
                "date": prop.purchase_date,
                "estimated_value": prop.purchase_price,
                "source": "purchase",
            })

    return {"property_id": property_id, "history": history}


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

    mortgage.updated_at = datetime.now(timezone.utc)
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
        "provider_property_id": getattr(prop, "provider_property_id", None),
        "valuation_provider": getattr(prop, "valuation_provider", None),
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
