"""
Portfolio API - Full CRUD for portfolios and holdings with P&L calculations.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from typing import List, Optional
from pydantic import BaseModel, Field
from datetime import datetime

from core.database import get_session
from models import Portfolio, PortfolioHolding
from services.market_data import get_batch_quotes

router = APIRouter(tags=["Portfolio"])


# Pydantic schemas for request/response
class PortfolioCreate(BaseModel):
    name: str
    description: Optional[str] = None
    currency: str = "USD"


class PortfolioUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    currency: Optional[str] = None
    is_active: Optional[bool] = None


class HoldingCreate(BaseModel):
    ticker: str
    asset_type: str
    quantity: float = Field(ge=0)
    purchase_price: Optional[float] = Field(default=None, ge=0)
    purchase_date: Optional[str] = None
    currency: str = "USD"
    name: Optional[str] = None


class HoldingUpdate(BaseModel):
    ticker: Optional[str] = None
    asset_type: Optional[str] = None
    quantity: Optional[float] = Field(default=None, ge=0)
    purchase_price: Optional[float] = Field(default=None, ge=0)
    purchase_date: Optional[str] = None
    currency: Optional[str] = None
    current_price: Optional[float] = None


class HoldingResponse(BaseModel):
    id: int
    portfolio_id: int
    ticker: str
    asset_type: str
    quantity: float
    purchase_price: Optional[float]
    purchase_date: Optional[str]
    currency: str
    current_price: Optional[float]
    current_value: Optional[float]
    cost_basis: Optional[float]
    unrealized_gain: Optional[float]
    gain_percent: Optional[float]
    name: Optional[str] = None

    class Config:
        from_attributes = True


# Portfolio CRUD
@router.get("/portfolios")
def list_portfolios(session: Session = Depends(get_session)):
    """List all portfolios."""
    portfolios = session.exec(select(Portfolio)).all()
    return portfolios


@router.post("/portfolios")
def create_portfolio(data: PortfolioCreate, session: Session = Depends(get_session)):
    """Create a new portfolio."""
    portfolio = Portfolio(
        name=data.name,
        description=data.description,
        currency=data.currency,
    )
    session.add(portfolio)
    session.commit()
    session.refresh(portfolio)
    return portfolio


@router.get("/portfolios/{portfolio_id}")
def get_portfolio(portfolio_id: int, session: Session = Depends(get_session)):
    """Get portfolio with all holdings and P&L calculations."""
    portfolio = session.get(Portfolio, portfolio_id)
    if not portfolio:
        raise HTTPException(status_code=404, detail="Portfolio not found")

    holdings = session.exec(
        select(PortfolioHolding).where(PortfolioHolding.portfolio_id == portfolio_id)
    ).all()

    holdings_with_pl = [_calculate_holding_pl(h) for h in holdings]
    total_value = sum(h["current_value"] or 0 for h in holdings_with_pl)
    total_cost = sum(h["cost_basis"] or 0 for h in holdings_with_pl)
    total_gain = total_value - total_cost if total_cost > 0 else 0
    total_gain_percent = (total_gain / total_cost * 100) if total_cost > 0 else 0

    return {
        "id": portfolio.id,
        "name": portfolio.name,
        "description": portfolio.description,
        "currency": portfolio.currency,
        "is_active": portfolio.is_active,
        "holdings": holdings_with_pl,
        "summary": {
            "total_value": total_value,
            "total_cost": total_cost,
            "total_gain": total_gain,
            "total_gain_percent": total_gain_percent,
            "holdings_count": len(holdings),
        }
    }


@router.put("/portfolios/{portfolio_id}")
def update_portfolio(
    portfolio_id: int,
    data: PortfolioUpdate,
    session: Session = Depends(get_session)
):
    """Update portfolio details."""
    portfolio = session.get(Portfolio, portfolio_id)
    if not portfolio:
        raise HTTPException(status_code=404, detail="Portfolio not found")

    if data.name is not None:
        portfolio.name = data.name
    if data.description is not None:
        portfolio.description = data.description
    if data.currency is not None:
        portfolio.currency = data.currency
    if data.is_active is not None:
        portfolio.is_active = data.is_active

    portfolio.updated_at = datetime.utcnow()
    session.add(portfolio)
    session.commit()
    session.refresh(portfolio)
    return portfolio


@router.delete("/portfolios/{portfolio_id}")
def delete_portfolio(portfolio_id: int, session: Session = Depends(get_session)):
    """Delete portfolio and all its holdings."""
    portfolio = session.get(Portfolio, portfolio_id)
    if not portfolio:
        raise HTTPException(status_code=404, detail="Portfolio not found")

    # Delete all holdings first
    holdings = session.exec(
        select(PortfolioHolding).where(PortfolioHolding.portfolio_id == portfolio_id)
    ).all()
    for holding in holdings:
        session.delete(holding)

    session.delete(portfolio)
    session.commit()
    return {"message": "Portfolio deleted", "id": portfolio_id}


# Holdings CRUD
@router.post("/portfolios/{portfolio_id}/holdings")
def add_holding(
    portfolio_id: int,
    data: HoldingCreate,
    session: Session = Depends(get_session)
):
    """Add a new holding to a portfolio."""
    portfolio = session.get(Portfolio, portfolio_id)
    if not portfolio:
        raise HTTPException(status_code=404, detail="Portfolio not found")

    # Calculate current value if we have price and quantity
    current_value = None
    if data.purchase_price and data.quantity:
        current_value = data.purchase_price * data.quantity

    holding = PortfolioHolding(
        portfolio_id=portfolio_id,
        ticker=data.ticker.upper(),
        asset_type=data.asset_type,
        quantity=data.quantity,
        purchase_price=data.purchase_price,
        purchase_date=data.purchase_date,
        currency=data.currency,
        current_price=data.purchase_price,  # Initially set to purchase price
        current_value=current_value,
    )
    session.add(holding)
    session.commit()
    session.refresh(holding)
    return _calculate_holding_pl(holding)


@router.get("/portfolio/holdings")
def get_all_holdings(session: Session = Depends(get_session)):
    """Get all holdings across all portfolios with P&L."""
    holdings = session.exec(select(PortfolioHolding)).all()
    portfolios = session.exec(select(Portfolio)).all()
    portfolio_map = {p.id: p.name for p in portfolios}

    results = []
    for h in holdings:
        holding_data = _calculate_holding_pl(h)
        holding_data["portfolio_name"] = portfolio_map.get(h.portfolio_id, "Unknown")
        results.append(holding_data)

    return results


@router.put("/holdings/{holding_id}")
def update_holding(
    holding_id: int,
    data: HoldingUpdate,
    session: Session = Depends(get_session)
):
    """Update a holding."""
    holding = session.get(PortfolioHolding, holding_id)
    if not holding:
        raise HTTPException(status_code=404, detail="Holding not found")

    if data.ticker is not None:
        holding.ticker = data.ticker.upper()
    if data.asset_type is not None:
        holding.asset_type = data.asset_type
    if data.quantity is not None:
        holding.quantity = data.quantity
    if data.purchase_price is not None:
        holding.purchase_price = data.purchase_price
    if data.purchase_date is not None:
        holding.purchase_date = data.purchase_date
    if data.currency is not None:
        holding.currency = data.currency
    if data.current_price is not None:
        holding.current_price = data.current_price

    # Recalculate current value
    if holding.current_price and holding.quantity:
        holding.current_value = holding.current_price * holding.quantity

    holding.updated_at = datetime.utcnow()
    session.add(holding)
    session.commit()
    session.refresh(holding)
    return _calculate_holding_pl(holding)


@router.delete("/holdings/{holding_id}")
def delete_holding(holding_id: int, session: Session = Depends(get_session)):
    """Delete a holding."""
    holding = session.get(PortfolioHolding, holding_id)
    if not holding:
        raise HTTPException(status_code=404, detail="Holding not found")

    session.delete(holding)
    session.commit()
    return {"message": "Holding deleted", "id": holding_id}


# Refresh prices
@router.post("/portfolios/{portfolio_id}/refresh")
def refresh_portfolio_prices(portfolio_id: int, session: Session = Depends(get_session)):
    """Refresh prices for all holdings in a portfolio using Yahoo Finance."""
    portfolio = session.get(Portfolio, portfolio_id)
    if not portfolio:
        raise HTTPException(status_code=404, detail="Portfolio not found")

    holdings = session.exec(
        select(PortfolioHolding).where(PortfolioHolding.portfolio_id == portfolio_id)
    ).all()

    if not holdings:
        return {"message": "No holdings to refresh", "updated": 0}

    # Get unique tickers
    tickers = list(set(h.ticker for h in holdings))

    # Batch fetch quotes
    quotes = get_batch_quotes(tickers, session)

    # Update holdings
    updated_count = 0
    for holding in holdings:
        quote = quotes.get(holding.ticker)
        if quote and quote.get("current_price"):
            holding.current_price = quote["current_price"]
            holding.current_value = holding.current_price * holding.quantity
            holding.updated_at = datetime.utcnow()
            session.add(holding)
            updated_count += 1

    session.commit()

    # Return updated holdings with P&L
    updated_holdings = session.exec(
        select(PortfolioHolding).where(PortfolioHolding.portfolio_id == portfolio_id)
    ).all()

    return {
        "message": f"Refreshed {updated_count} holdings",
        "updated": updated_count,
        "holdings": [_calculate_holding_pl(h) for h in updated_holdings],
    }


@router.post("/portfolios/refresh-all")
def refresh_all_portfolios(session: Session = Depends(get_session)):
    """Refresh prices for all holdings across all portfolios."""
    holdings = session.exec(select(PortfolioHolding)).all()

    if not holdings:
        return {"message": "No holdings to refresh", "updated": 0}

    # Get unique tickers
    tickers = list(set(h.ticker for h in holdings))

    # Batch fetch quotes
    quotes = get_batch_quotes(tickers, session)

    # Update holdings
    updated_count = 0
    for holding in holdings:
        quote = quotes.get(holding.ticker)
        if quote and quote.get("current_price"):
            holding.current_price = quote["current_price"]
            holding.current_value = holding.current_price * holding.quantity
            holding.updated_at = datetime.utcnow()
            session.add(holding)
            updated_count += 1

    session.commit()

    return {
        "message": f"Refreshed {updated_count} holdings",
        "updated": updated_count,
    }


# Summary
@router.get("/portfolios/summary")
def get_portfolio_summary(session: Session = Depends(get_session)):
    """Get aggregate value across all portfolios."""
    holdings = session.exec(select(PortfolioHolding)).all()
    portfolios = session.exec(select(Portfolio)).all()

    total_value = sum(h.current_value or 0 for h in holdings)
    total_cost = sum((h.purchase_price or 0) * h.quantity for h in holdings)
    total_gain = total_value - total_cost
    total_gain_percent = (total_gain / total_cost * 100) if total_cost > 0 else 0

    # Group by portfolio
    portfolio_values = {}
    for h in holdings:
        if h.portfolio_id not in portfolio_values:
            portfolio_values[h.portfolio_id] = {"value": 0, "cost": 0}
        portfolio_values[h.portfolio_id]["value"] += h.current_value or 0
        portfolio_values[h.portfolio_id]["cost"] += (h.purchase_price or 0) * h.quantity

    portfolio_breakdown = []
    for p in portfolios:
        pv = portfolio_values.get(p.id, {"value": 0, "cost": 0})
        portfolio_breakdown.append({
            "id": p.id,
            "name": p.name,
            "value": pv["value"],
            "cost": pv["cost"],
            "gain": pv["value"] - pv["cost"],
        })

    return {
        "total_value": total_value,
        "total_cost": total_cost,
        "total_gain": total_gain,
        "total_gain_percent": total_gain_percent,
        "portfolios_count": len(portfolios),
        "holdings_count": len(holdings),
        "portfolios": portfolio_breakdown,
    }


def _calculate_holding_pl(holding: PortfolioHolding) -> dict:
    """Calculate P&L for a holding."""
    cost_basis = (holding.purchase_price or 0) * holding.quantity
    current_value = holding.current_value or 0
    unrealized_gain = current_value - cost_basis if cost_basis > 0 else 0
    gain_percent = (unrealized_gain / cost_basis * 100) if cost_basis > 0 else 0

    return {
        "id": holding.id,
        "portfolio_id": holding.portfolio_id,
        "ticker": holding.ticker,
        "asset_type": holding.asset_type,
        "quantity": holding.quantity,
        "purchase_price": holding.purchase_price,
        "purchase_date": holding.purchase_date,
        "currency": holding.currency,
        "current_price": holding.current_price,
        "current_value": current_value,
        "cost_basis": cost_basis,
        "unrealized_gain": unrealized_gain,
        "gain_percent": gain_percent,
    }
