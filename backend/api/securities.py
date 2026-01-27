"""
Securities API - Search and quote endpoints using Yahoo Finance.
"""
from fastapi import APIRouter, Depends, Query
from sqlmodel import Session
from typing import List

from core.database import get_session
from services.market_data import search_securities, get_quote, get_batch_quotes
from pydantic import BaseModel

router = APIRouter(prefix="/securities", tags=["Securities"])


class BatchQuoteRequest(BaseModel):
    tickers: List[str]


@router.get("/search")
def search(
    q: str = Query(..., min_length=1, description="Search query (ticker or name)"),
    limit: int = Query(10, ge=1, le=50, description="Maximum results")
):
    """
    Search for securities by ticker or company name.
    Uses Yahoo Finance for data.
    """
    results = search_securities(q, limit=limit)
    return {"results": results, "query": q}


@router.get("/{ticker}/quote")
def quote(ticker: str, session: Session = Depends(get_session)):
    """
    Get current quote for a specific ticker.
    Prices are cached for 5 minutes.
    """
    result = get_quote(ticker, session)
    if result is None:
        return {"error": f"Could not find quote for {ticker}"}
    return result


@router.post("/batch-quotes")
def batch_quotes(request: BatchQuoteRequest, session: Session = Depends(get_session)):
    """
    Get quotes for multiple tickers in a single request.
    More efficient for refreshing portfolio prices.
    """
    results = get_batch_quotes(request.tickers, session)
    return {"quotes": results, "count": len(results)}
