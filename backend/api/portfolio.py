from fastapi import APIRouter, Depends
from sqlmodel import Session, select
from typing import List
from core.database import get_session
from models import Portfolio, PortfolioHolding

router = APIRouter()

@router.get("/portfolio/holdings")
def get_holdings(session: Session = Depends(get_session)):
    """
    Get all portfolio holdings.
    """
    # Join with Portfolio to get portfolio name if needed
    results = session.exec(select(PortfolioHolding)).all()
    return results
