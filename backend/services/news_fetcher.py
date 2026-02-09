"""
Financial news fetcher service.
Fetches relevant news articles from Google News RSS based on portfolio tickers,
account themes, and financial signals. No API key required.
"""
import logging
import urllib.request
import urllib.parse
import xml.etree.ElementTree as ET
from typing import List, Dict, Any, Optional
from datetime import datetime
import re
import hashlib

logger = logging.getLogger(__name__)

# Simple in-memory cache to avoid repeated fetches
_news_cache: Dict[str, tuple] = {}  # key -> (articles, fetched_at_timestamp)
_NEWS_CACHE_TTL = 1800  # 30 minutes


def _fetch_rss(query: str, max_results: int = 5) -> List[Dict[str, str]]:
    """Fetch articles from Google News RSS for a search query."""
    encoded_q = urllib.parse.quote(query)
    url = f"https://news.google.com/rss/search?q={encoded_q}&hl=en-US&gl=US&ceid=US:en"

    try:
        req = urllib.request.Request(url, headers={
            "User-Agent": "Mozilla/5.0 (compatible; NetworthPro/1.0)"
        })
        with urllib.request.urlopen(req, timeout=10) as response:
            xml_data = response.read()

        root = ET.fromstring(xml_data)
        articles = []

        for item in root.findall(".//item")[:max_results]:
            title_el = item.find("title")
            link_el = item.find("link")
            pub_date_el = item.find("pubDate")
            source_el = item.find("source")

            title = title_el.text if title_el is not None else ""
            link = link_el.text if link_el is not None else ""
            pub_date = pub_date_el.text if pub_date_el is not None else ""
            source = source_el.text if source_el is not None else ""

            if title and link:
                articles.append({
                    "title": _clean_title(title),
                    "url": link,
                    "source": source,
                    "published": _parse_rss_date(pub_date),
                })

        return articles

    except Exception as e:
        logger.warning(f"Failed to fetch news for '{query}': {e}")
        return []


def _clean_title(title: str) -> str:
    """Remove trailing source attribution from Google News titles."""
    # Google News titles often end with " - Source Name"
    parts = title.rsplit(" - ", 1)
    return parts[0].strip() if len(parts) == 2 and len(parts[1]) < 40 else title.strip()


def _parse_rss_date(date_str: str) -> str:
    """Parse RSS date into a readable format."""
    if not date_str:
        return ""
    try:
        # RSS dates look like: "Sat, 01 Feb 2026 14:30:00 GMT"
        dt = datetime.strptime(date_str.strip(), "%a, %d %b %Y %H:%M:%S %Z")
        return dt.strftime("%b %d, %Y")
    except (ValueError, TypeError):
        try:
            dt = datetime.strptime(date_str.strip()[:25], "%a, %d %b %Y %H:%M:%S")
            return dt.strftime("%b %d, %Y")
        except (ValueError, TypeError):
            return date_str[:20] if date_str else ""


def _build_search_queries(
    tickers: List[str],
    property_types: List[str],
    liability_categories: List[str],
    account_types: List[str],
) -> List[Dict[str, str]]:
    """Build targeted search queries from the user's financial data."""
    queries = []

    # Stock/ETF ticker queries -- most specific and relevant
    for ticker in tickers[:5]:  # Top 5 holdings
        ticker_clean = ticker.upper().strip()
        queries.append({
            "query": f"{ticker_clean} stock news",
            "theme": f"{ticker_clean} Stock",
        })

    # Sector-level queries based on ticker patterns
    sector_queries = set()
    tech_tickers = {"AAPL", "MSFT", "GOOGL", "GOOG", "META", "AMZN", "NVDA", "TSLA", "AMD", "INTC", "CRM", "NFLX"}
    finance_tickers = {"JPM", "BAC", "GS", "MS", "WFC", "V", "MA", "AXP", "BRK.B", "BRK.A"}
    health_tickers = {"JNJ", "UNH", "PFE", "MRK", "ABT", "TMO", "ABBV", "LLY"}
    energy_tickers = {"XOM", "CVX", "COP", "EOG", "SLB", "PSX"}

    ticker_set = set(t.upper() for t in tickers)
    if ticker_set & tech_tickers:
        sector_queries.add("technology sector market outlook")
    if ticker_set & finance_tickers:
        sector_queries.add("financial sector banking news")
    if ticker_set & health_tickers:
        sector_queries.add("healthcare sector pharma news")
    if ticker_set & energy_tickers:
        sector_queries.add("energy sector oil market news")

    # If user has broad ETFs, add market news
    etf_tickers = {"SPY", "VOO", "VTI", "QQQ", "IWM", "DIA", "VEA", "VWO", "BND", "AGG"}
    if ticker_set & etf_tickers:
        sector_queries.add("stock market outlook economy")

    for sq in list(sector_queries)[:2]:
        queries.append({"query": sq, "theme": "Market Outlook"})

    # Real estate themed queries
    if property_types:
        queries.append({
            "query": "real estate market housing prices",
            "theme": "Real Estate",
        })
        if "rental" in [pt.lower() for pt in property_types]:
            queries.append({
                "query": "rental property investment landlord news",
                "theme": "Rental Market",
            })

    # Debt/liability themed queries
    if liability_categories:
        cats_lower = [c.lower() for c in liability_categories if c]
        if any("student" in c for c in cats_lower):
            queries.append({"query": "student loan news policy", "theme": "Student Loans"})
        if any("credit" in c for c in cats_lower):
            queries.append({"query": "credit card interest rates personal finance", "theme": "Credit Cards"})
        if any("auto" in c for c in cats_lower):
            queries.append({"query": "auto loan rates car financing", "theme": "Auto Loans"})

    # General personal finance as a fallback
    if not queries:
        queries.append({"query": "personal finance investing tips", "theme": "Personal Finance"})

    return queries[:8]  # Cap total queries


def fetch_relevant_news(
    tickers: Optional[List[str]] = None,
    property_types: Optional[List[str]] = None,
    liability_categories: Optional[List[str]] = None,
    account_types: Optional[List[str]] = None,
    max_articles: int = 8,
) -> List[Dict[str, Any]]:
    """
    Fetch relevant financial news based on the user's portfolio and accounts.

    Returns:
        List of article dicts with 'title', 'url', 'source', 'published', 'theme'
    """
    # Build a cache key from inputs
    cache_input = f"{tickers}|{property_types}|{liability_categories}|{account_types}"
    cache_key = hashlib.md5(cache_input.encode()).hexdigest()

    # Check cache
    now = datetime.utcnow().timestamp()
    if cache_key in _news_cache:
        cached_articles, cached_at = _news_cache[cache_key]
        if now - cached_at < _NEWS_CACHE_TTL:
            logger.debug("Returning cached news articles")
            return cached_articles

    queries = _build_search_queries(
        tickers=tickers or [],
        property_types=property_types or [],
        liability_categories=liability_categories or [],
        account_types=account_types or [],
    )

    all_articles = []
    seen_titles = set()

    for q_info in queries:
        articles = _fetch_rss(q_info["query"], max_results=3)
        for article in articles:
            # Deduplicate by title similarity
            title_key = re.sub(r'[^a-z0-9]', '', article["title"].lower())[:50]
            if title_key not in seen_titles:
                seen_titles.add(title_key)
                article["theme"] = q_info["theme"]
                all_articles.append(article)

    result = all_articles[:max_articles]

    # Cache the result
    _news_cache[cache_key] = (result, now)

    # Prune old cache entries
    if len(_news_cache) > 50:
        expired = [k for k, (_, ts) in _news_cache.items() if now - ts > _NEWS_CACHE_TTL]
        for k in expired:
            del _news_cache[k]

    return result
