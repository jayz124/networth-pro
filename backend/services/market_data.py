"""
Market data service using Yahoo Finance (yfinance).
Provides security search, quotes, and batch price fetching with caching.
"""
import logging
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
from sqlmodel import Session, select
import yfinance as yf

logger = logging.getLogger(__name__)

from models import SecurityInfo, PriceCache

# Cache TTL in minutes
PRICE_CACHE_TTL = 5


def search_securities(query: str, limit: int = 10) -> List[Dict[str, Any]]:
    """
    Search for securities by ticker or name using yfinance.
    Returns list of matching securities with basic info.
    """
    if not query or len(query) < 1:
        return []

    results = []

    # Try to get info for exact ticker match first
    try:
        ticker = yf.Ticker(query.upper())
        info = ticker.info

        if info and info.get("symbol"):
            asset_type = _determine_asset_type(info)
            results.append({
                "ticker": info.get("symbol", query.upper()),
                "name": info.get("shortName") or info.get("longName") or query.upper(),
                "asset_type": asset_type,
                "exchange": info.get("exchange"),
                "currency": info.get("currency", "USD"),
                "sector": info.get("sector"),
                "current_price": info.get("currentPrice") or info.get("regularMarketPrice"),
            })
    except Exception as e:
        logger.debug("Ticker search for %s failed: %s", query, e)

    # For broader searches, we use a list of common tickers
    # yfinance doesn't have a native search API, so we do best-effort matching
    common_tickers = [
        "AAPL", "MSFT", "GOOGL", "AMZN", "META", "TSLA", "NVDA", "AMD", "INTC",
        "JPM", "BAC", "WFC", "GS", "MS", "V", "MA", "PYPL",
        "JNJ", "PFE", "UNH", "ABBV", "MRK", "LLY",
        "XOM", "CVX", "COP", "OXY", "SLB",
        "VOO", "SPY", "QQQ", "VTI", "IWM", "DIA", "VUG", "VTV",
        "BTC-USD", "ETH-USD", "SOL-USD", "BNB-USD", "XRP-USD", "ADA-USD",
        "O", "VNQ", "SCHH", "IYR", "XLRE",
        "BND", "AGG", "TLT", "LQD", "HYG",
    ]

    query_upper = query.upper()

    # Filter tickers that match the query (if not already found)
    matching_tickers = [
        t for t in common_tickers
        if query_upper in t and t not in [r.get("ticker") for r in results]
    ][:limit - len(results)]

    # Fetch info for matching tickers
    for ticker_symbol in matching_tickers:
        try:
            ticker = yf.Ticker(ticker_symbol)
            info = ticker.info

            if info and info.get("symbol"):
                asset_type = _determine_asset_type(info)
                results.append({
                    "ticker": info.get("symbol", ticker_symbol),
                    "name": info.get("shortName") or info.get("longName") or ticker_symbol,
                    "asset_type": asset_type,
                    "exchange": info.get("exchange"),
                    "currency": info.get("currency", "USD"),
                    "sector": info.get("sector"),
                    "current_price": info.get("currentPrice") or info.get("regularMarketPrice"),
                })
        except Exception as e:
            logger.debug("Failed to fetch info for ticker %s: %s", ticker_symbol, e)
            continue

    return results[:limit]


def get_quote(ticker: str, session: Session) -> Optional[Dict[str, Any]]:
    """
    Get current quote for a ticker with 5-minute caching.
    """
    ticker = ticker.upper()

    # Check cache first
    cached = session.exec(
        select(PriceCache)
        .where(PriceCache.ticker == ticker)
        .order_by(PriceCache.fetched_at.desc())
    ).first()

    if cached and cached.fetched_at > datetime.utcnow() - timedelta(minutes=PRICE_CACHE_TTL):
        return {
            "ticker": cached.ticker,
            "current_price": cached.current_price,
            "previous_close": cached.previous_close,
            "change_percent": cached.change_percent,
            "fetched_at": cached.fetched_at.isoformat(),
            "cached": True,
        }

    # Fetch fresh data
    try:
        yf_ticker = yf.Ticker(ticker)
        info = yf_ticker.info

        if not info or not info.get("symbol"):
            return None

        current_price = info.get("currentPrice") or info.get("regularMarketPrice")
        previous_close = info.get("previousClose") or info.get("regularMarketPreviousClose")

        change_percent = None
        if current_price and previous_close and previous_close > 0:
            change_percent = ((current_price - previous_close) / previous_close) * 100

        # Update cache
        if cached:
            cached.current_price = current_price or 0
            cached.previous_close = previous_close
            cached.change_percent = change_percent
            cached.fetched_at = datetime.utcnow()
            session.add(cached)
        else:
            new_cache = PriceCache(
                ticker=ticker,
                current_price=current_price or 0,
                previous_close=previous_close,
                change_percent=change_percent,
                fetched_at=datetime.utcnow(),
            )
            session.add(new_cache)

        # Also update or create SecurityInfo
        security_info = session.exec(
            select(SecurityInfo).where(SecurityInfo.ticker == ticker)
        ).first()

        if not security_info:
            asset_type = _determine_asset_type(info)
            security_info = SecurityInfo(
                ticker=ticker,
                name=info.get("shortName") or info.get("longName") or ticker,
                asset_type=asset_type,
                exchange=info.get("exchange"),
                currency=info.get("currency", "USD"),
                sector=info.get("sector"),
                last_updated=datetime.utcnow(),
            )
            session.add(security_info)

        session.commit()

        return {
            "ticker": ticker,
            "name": info.get("shortName") or info.get("longName"),
            "current_price": current_price,
            "previous_close": previous_close,
            "change_percent": change_percent,
            "fetched_at": datetime.utcnow().isoformat(),
            "cached": False,
        }
    except Exception as e:
        logger.warning("Error fetching quote for %s: %s", ticker, e)
        return None


def get_batch_quotes(tickers: List[str], session: Session) -> Dict[str, Dict[str, Any]]:
    """
    Fetch quotes for multiple tickers efficiently.
    Uses yfinance download for batch fetching.
    """
    if not tickers:
        return {}

    tickers = [t.upper() for t in tickers]
    results = {}
    tickers_to_fetch = []

    # Check cache first for each ticker
    for ticker in tickers:
        cached = session.exec(
            select(PriceCache)
            .where(PriceCache.ticker == ticker)
            .order_by(PriceCache.fetched_at.desc())
        ).first()

        if cached and cached.fetched_at > datetime.utcnow() - timedelta(minutes=PRICE_CACHE_TTL):
            results[ticker] = {
                "ticker": cached.ticker,
                "current_price": cached.current_price,
                "previous_close": cached.previous_close,
                "change_percent": cached.change_percent,
                "fetched_at": cached.fetched_at.isoformat(),
                "cached": True,
            }
        else:
            tickers_to_fetch.append(ticker)

    # Fetch remaining tickers
    if tickers_to_fetch:
        try:
            # Use yfinance Tickers for batch fetching
            yf_tickers = yf.Tickers(" ".join(tickers_to_fetch))

            for ticker in tickers_to_fetch:
                try:
                    info = yf_tickers.tickers[ticker].info

                    if info and info.get("symbol"):
                        current_price = info.get("currentPrice") or info.get("regularMarketPrice")
                        previous_close = info.get("previousClose") or info.get("regularMarketPreviousClose")

                        change_percent = None
                        if current_price and previous_close and previous_close > 0:
                            change_percent = ((current_price - previous_close) / previous_close) * 100

                        # Update cache
                        cached = session.exec(
                            select(PriceCache).where(PriceCache.ticker == ticker)
                        ).first()

                        if cached:
                            cached.current_price = current_price or 0
                            cached.previous_close = previous_close
                            cached.change_percent = change_percent
                            cached.fetched_at = datetime.utcnow()
                        else:
                            cached = PriceCache(
                                ticker=ticker,
                                current_price=current_price or 0,
                                previous_close=previous_close,
                                change_percent=change_percent,
                                fetched_at=datetime.utcnow(),
                            )
                            session.add(cached)

                        results[ticker] = {
                            "ticker": ticker,
                            "current_price": current_price,
                            "previous_close": previous_close,
                            "change_percent": change_percent,
                            "fetched_at": datetime.utcnow().isoformat(),
                            "cached": False,
                        }
                except Exception as e:
                    logger.debug("Failed to fetch quote for %s in batch: %s", ticker, e)
                    continue

            session.commit()
        except Exception as e:
            logger.warning("Error batch fetching quotes: %s", e)

    return results


def _determine_asset_type(info: Dict[str, Any]) -> str:
    """
    Determine asset type from yfinance info dict.
    """
    quote_type = info.get("quoteType", "").upper()
    symbol = info.get("symbol", "")

    if quote_type == "CRYPTOCURRENCY" or symbol.endswith("-USD"):
        return "crypto"
    elif quote_type == "ETF":
        return "etf"
    elif quote_type == "MUTUALFUND":
        return "mutual_fund"
    elif info.get("sector") == "Real Estate":
        return "reit"
    elif quote_type == "EQUITY":
        return "stock"
    else:
        return "stock"  # Default to stock
