"""
Property valuation service using RentCast API.
Features:
- Property value estimates (AVM)
- Rent estimates
- Property records with sale history
- DB-backed caching (30-day TTL for valuations)
- Graceful degradation when API key not configured
"""
import logging
import httpx
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta, timezone
from sqlmodel import Session, select

from models import PropertyValuationCache, PropertyValueHistory, Property

logger = logging.getLogger(__name__)

# Module-level API key cache
_cached_rentcast_key: Optional[str] = None

# RentCast API config
RENTCAST_BASE_URL = "https://api.rentcast.io/v1"
VALUATION_CACHE_TTL = timedelta(days=30)
REQUEST_TIMEOUT = 15  # seconds


def set_rentcast_api_key(key: Optional[str]):
    """Set the RentCast API key from database settings."""
    global _cached_rentcast_key
    _cached_rentcast_key = key


def is_rentcast_available() -> bool:
    """Check if RentCast API key is configured."""
    return bool(_cached_rentcast_key)


def _rentcast_headers() -> dict:
    """Get headers for RentCast API calls."""
    return {
        "Accept": "application/json",
        "X-Api-Key": _cached_rentcast_key or "",
    }


async def _call_rentcast(endpoint: str, params: dict) -> Optional[dict]:
    """Make a request to RentCast API with error handling."""
    if not _cached_rentcast_key:
        logger.warning("RentCast API key not configured")
        return None

    url = f"{RENTCAST_BASE_URL}{endpoint}"
    try:
        async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
            resp = await client.get(url, headers=_rentcast_headers(), params=params)

            if resp.status_code == 401:
                logger.error("RentCast API: Invalid API key")
                return None
            if resp.status_code == 429:
                logger.warning("RentCast API: Rate limit exceeded (50 calls/month)")
                return None
            if resp.status_code == 404:
                logger.info(f"RentCast API: No data found for params {params}")
                return None
            if resp.status_code != 200:
                logger.error(f"RentCast API error {resp.status_code}: {resp.text[:200]}")
                return None

            return resp.json()
    except httpx.TimeoutException:
        logger.error("RentCast API: Request timed out")
        return None
    except Exception as e:
        logger.error(f"RentCast API error: {e}")
        return None


async def search_address(query: str) -> List[Dict[str, Any]]:
    """Search for properties by address using RentCast property records endpoint.

    Returns list of property matches with basic details.
    Uses 1 API call.
    """
    if not _cached_rentcast_key:
        return []

    data = await _call_rentcast("/properties", {"address": query})
    if not data:
        return []

    # RentCast returns a single property or list
    properties = data if isinstance(data, list) else [data]

    results = []
    for prop in properties:
        results.append({
            "address": prop.get("formattedAddress") or prop.get("addressLine1", ""),
            "city": prop.get("city", ""),
            "state": prop.get("state", ""),
            "zip_code": prop.get("zipCode", ""),
            "provider_property_id": prop.get("id", ""),
            "property_type": prop.get("propertyType", ""),
            "bedrooms": prop.get("bedrooms"),
            "bathrooms": prop.get("bathrooms"),
            "square_footage": prop.get("squareFootage"),
            "year_built": prop.get("yearBuilt"),
            "lot_size": prop.get("lotSize"),
            "last_sale_price": prop.get("lastSalePrice"),
            "last_sale_date": prop.get("lastSaleDate"),
            "tax_assessed_value": prop.get("assessorMarketValue") or prop.get("taxAssessment"),
            "provider": "rentcast",
        })

    return results


async def get_value_estimate(address: str, session: Session, property_id: Optional[int] = None) -> Optional[Dict[str, Any]]:
    """Get property value estimate from RentCast AVM.

    Checks cache first (30-day TTL). Uses 1 API call if cache miss.
    """
    # Check cache first
    if property_id:
        cached = session.exec(
            select(PropertyValuationCache)
            .where(PropertyValuationCache.property_id == property_id)
            .where(PropertyValuationCache.provider == "rentcast")
        ).first()

        if cached and (datetime.now(timezone.utc) - cached.fetched_at) < VALUATION_CACHE_TTL:
            return {
                "estimated_value": cached.estimated_value,
                "value_range_low": cached.value_range_low,
                "value_range_high": cached.value_range_high,
                "bedrooms": cached.bedrooms,
                "bathrooms": cached.bathrooms,
                "square_footage": cached.square_footage,
                "year_built": cached.year_built,
                "cached": True,
                "fetched_at": cached.fetched_at.isoformat(),
                "provider": "rentcast",
            }

    data = await _call_rentcast("/avm/value", {"address": address})
    if not data:
        return None

    result = {
        "estimated_value": data.get("price"),
        "value_range_low": data.get("priceRangeLow"),
        "value_range_high": data.get("priceRangeHigh"),
        "cached": False,
        "provider": "rentcast",
    }

    # Extract property details from subject
    subject = data.get("subjectProperty") or data.get("subject") or {}
    result["bedrooms"] = subject.get("bedrooms")
    result["bathrooms"] = subject.get("bathrooms")
    result["square_footage"] = subject.get("squareFootage")
    result["year_built"] = subject.get("yearBuilt")
    result["provider_property_id"] = subject.get("id", "")

    # Update cache
    if property_id and result["estimated_value"]:
        _update_valuation_cache(session, property_id, result, rent_data=None)

    return result


async def get_rent_estimate(address: str, session: Session, property_id: Optional[int] = None) -> Optional[Dict[str, Any]]:
    """Get rental estimate from RentCast.

    Uses 1 API call.
    """
    data = await _call_rentcast("/avm/rent/long-term", {"address": address})
    if not data:
        return None

    result = {
        "estimated_rent_monthly": data.get("rent"),
        "rent_range_low": data.get("rentRangeLow"),
        "rent_range_high": data.get("rentRangeHigh"),
        "provider": "rentcast",
    }

    # Update cache with rent data if we have a property_id
    if property_id and result["estimated_rent_monthly"]:
        cached = session.exec(
            select(PropertyValuationCache)
            .where(PropertyValuationCache.property_id == property_id)
        ).first()
        if cached:
            cached.estimated_rent_monthly = result["estimated_rent_monthly"]
            cached.rent_range_low = result.get("rent_range_low")
            cached.rent_range_high = result.get("rent_range_high")
            cached.fetched_at = datetime.now(timezone.utc)
            session.add(cached)
            session.commit()

    return result


async def get_full_valuation(address: str, session: Session, property_id: Optional[int] = None) -> Optional[Dict[str, Any]]:
    """Get both value and rent estimates in one call.

    Uses 2 API calls (value + rent).
    """
    value_data = await get_value_estimate(address, session, property_id)
    if not value_data:
        return None

    rent_data = await get_rent_estimate(address, session, property_id)

    result = {**value_data}
    if rent_data:
        result["estimated_rent_monthly"] = rent_data.get("estimated_rent_monthly")
        result["rent_range_low"] = rent_data.get("rent_range_low")
        result["rent_range_high"] = rent_data.get("rent_range_high")

        # Calculate gross yield
        if result.get("estimated_value") and result.get("estimated_rent_monthly"):
            annual_rent = result["estimated_rent_monthly"] * 12
            result["gross_yield"] = round(annual_rent / result["estimated_value"] * 100, 2)

    # Update cache with full data
    if property_id and result.get("estimated_value"):
        _update_valuation_cache(session, property_id, result, rent_data)

    return result


def _update_valuation_cache(session: Session, property_id: int, value_data: dict, rent_data: Optional[dict]):
    """Upsert valuation cache entry."""
    cached = session.exec(
        select(PropertyValuationCache)
        .where(PropertyValuationCache.property_id == property_id)
    ).first()

    if not cached:
        cached = PropertyValuationCache(property_id=property_id)

    cached.provider = "rentcast"
    cached.estimated_value = value_data.get("estimated_value")
    cached.value_range_low = value_data.get("value_range_low")
    cached.value_range_high = value_data.get("value_range_high")
    cached.bedrooms = value_data.get("bedrooms")
    cached.bathrooms = value_data.get("bathrooms")
    cached.square_footage = value_data.get("square_footage")
    cached.year_built = value_data.get("year_built")
    cached.fetched_at = datetime.now(timezone.utc)

    if rent_data:
        cached.estimated_rent_monthly = rent_data.get("estimated_rent_monthly")
        cached.rent_range_low = rent_data.get("rent_range_low")
        cached.rent_range_high = rent_data.get("rent_range_high")

    session.add(cached)
    session.flush()  # Persist cache entry before querying history

    # Also record a history point
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    existing_history = session.exec(
        select(PropertyValueHistory)
        .where(PropertyValueHistory.property_id == property_id)
        .where(PropertyValueHistory.date == today)
        .where(PropertyValueHistory.source == "rentcast")
    ).first()

    if not existing_history and value_data.get("estimated_value"):
        history = PropertyValueHistory(
            property_id=property_id,
            date=today,
            estimated_value=value_data["estimated_value"],
            source="rentcast",
        )
        session.add(history)

    session.commit()


async def refresh_property_valuation(property_id: int, session: Session) -> Optional[Dict[str, Any]]:
    """Refresh valuation for a single property. Updates current_value on the property.

    Uses 2 API calls (value + rent).
    """
    prop = session.get(Property, property_id)
    if not prop:
        return None

    result = await get_full_valuation(prop.address, session, property_id)
    if not result or not result.get("estimated_value"):
        return None

    # Update property current_value
    prop.current_value = result["estimated_value"]
    prop.valuation_provider = "rentcast"
    if result.get("provider_property_id"):
        prop.provider_property_id = result["provider_property_id"]
    prop.updated_at = datetime.now(timezone.utc)
    session.add(prop)
    session.commit()

    return result


async def refresh_all_valuations(session: Session) -> Dict[str, Any]:
    """Refresh valuations for all properties that have a provider set.

    Uses 2 API calls per property (value + rent).
    """
    properties = session.exec(
        select(Property).where(Property.valuation_provider != None)
    ).all()

    updated = 0
    errors = 0
    results = []

    for prop in properties:
        try:
            result = await refresh_property_valuation(prop.id, session)
            if result:
                updated += 1
                results.append({"id": prop.id, "name": prop.name, "new_value": result["estimated_value"]})
            else:
                errors += 1
        except Exception as e:
            logger.error(f"Error refreshing property {prop.id}: {e}")
            errors += 1

    return {"updated": updated, "errors": errors, "results": results}


def get_value_history(property_id: int, session: Session) -> List[Dict[str, Any]]:
    """Get historical value data points for a property."""
    records = session.exec(
        select(PropertyValueHistory)
        .where(PropertyValueHistory.property_id == property_id)
        .order_by(PropertyValueHistory.date)
    ).all()

    return [
        {
            "date": r.date,
            "estimated_value": r.estimated_value,
            "source": r.source,
        }
        for r in records
    ]


def get_cached_valuation(property_id: int, session: Session) -> Optional[Dict[str, Any]]:
    """Get cached valuation data for a property (no API call)."""
    cached = session.exec(
        select(PropertyValuationCache)
        .where(PropertyValuationCache.property_id == property_id)
    ).first()

    if not cached:
        return None

    return {
        "estimated_value": cached.estimated_value,
        "estimated_rent_monthly": cached.estimated_rent_monthly,
        "value_range_low": cached.value_range_low,
        "value_range_high": cached.value_range_high,
        "rent_range_low": cached.rent_range_low,
        "rent_range_high": cached.rent_range_high,
        "bedrooms": cached.bedrooms,
        "bathrooms": cached.bathrooms,
        "square_footage": cached.square_footage,
        "year_built": cached.year_built,
        "provider": cached.provider,
        "fetched_at": cached.fetched_at.isoformat(),
        "is_stale": (datetime.now(timezone.utc) - cached.fetched_at) > VALUATION_CACHE_TTL,
    }
