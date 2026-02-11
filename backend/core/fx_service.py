"""
Foreign exchange conversion service.

Fetches live rates from the Frankfurter API (free, no API key),
caches them in memory with a configurable TTL, and provides
fallback rates for all 30 supported currencies when the API
is unreachable.
"""
import logging
import time
from typing import Dict, Optional

import httpx

logger = logging.getLogger(__name__)

# Cache TTL in seconds (1 hour)
_CACHE_TTL = 3600

# In-memory cache: {"base": str, "rates": {code: float}, "fetched_at": float}
_rate_cache: Optional[Dict] = None


# Fallback USD-based rates (approximate, for offline use)
FALLBACK_RATES: Dict[str, float] = {
    "USD": 1.0,
    "EUR": 0.92,
    "GBP": 0.79,
    "CAD": 1.36,
    "AUD": 1.53,
    "JPY": 149.50,
    "CHF": 0.88,
    "CNY": 7.24,
    "INR": 83.12,
    "SGD": 1.34,
    "HKD": 7.82,
    "NZD": 1.64,
    "SEK": 10.42,
    "NOK": 10.55,
    "DKK": 6.87,
    "AED": 3.67,
    "SAR": 3.75,
    "KRW": 1320.0,
    "BRL": 4.97,
    "MXN": 17.15,
    "ZAR": 18.60,
    "THB": 35.20,
    "MYR": 4.72,
    "IDR": 15650.0,
    "PHP": 56.20,
    "PLN": 4.02,
    "TRY": 30.25,
    "RUB": 92.50,
    "ILS": 3.67,
}

# All supported currency codes
SUPPORTED_CURRENCIES = list(FALLBACK_RATES.keys())


def _fetch_live_rates() -> Optional[Dict[str, float]]:
    """Fetch live USD-based rates from Frankfurter API.

    Returns a dict of {currency_code: rate_vs_usd} or None on failure.
    """
    targets = ",".join(c for c in SUPPORTED_CURRENCIES if c != "USD")
    url = f"https://api.frankfurter.app/latest?from=USD&to={targets}"
    try:
        resp = httpx.get(url, timeout=5.0)
        resp.raise_for_status()
        data = resp.json()
        rates = {"USD": 1.0, **data.get("rates", {})}
        logger.info("Fetched live FX rates for %d currencies", len(rates))
        return rates
    except Exception as exc:
        logger.warning("Failed to fetch live FX rates: %s", exc)
        return None


def get_rates() -> Dict[str, float]:
    """Return USD-based exchange rates, using cache or live fetch.

    Falls back to hardcoded rates if the API is unreachable.
    """
    global _rate_cache

    now = time.time()

    # Return cached if fresh
    if _rate_cache and (now - _rate_cache["fetched_at"]) < _CACHE_TTL:
        return _rate_cache["rates"]

    # Try live fetch
    live = _fetch_live_rates()
    if live:
        _rate_cache = {"rates": live, "fetched_at": now}
        return live

    # If we have stale cache, prefer it over hardcoded
    if _rate_cache:
        logger.info("Using stale cached FX rates")
        return _rate_cache["rates"]

    # Last resort: hardcoded fallback
    logger.info("Using fallback FX rates")
    return FALLBACK_RATES


def convert(amount: float, from_currency: str, to_currency: str) -> float:
    """Convert an amount between two currencies.

    Both currencies are expressed as rates relative to USD.
    """
    if from_currency == to_currency:
        return amount

    rates = get_rates()
    from_rate = rates.get(from_currency, 1.0)
    to_rate = rates.get(to_currency, 1.0)

    # Convert: amount_in_from -> USD -> to_currency
    usd_amount = amount / from_rate
    return usd_amount * to_rate


def convert_to_base(amount: float, from_currency: str, base_currency: str) -> float:
    """Convenience wrapper: convert amount to the user's base currency."""
    return convert(amount, from_currency, base_currency)
