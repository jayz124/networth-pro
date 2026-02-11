# Performance & Security Audit Report

**Project:** Networth Pro
**Role:** Security & Performance Engineer
**Date:** 2026-02-10
**Auditor:** performance-security
**Scope:** Full backend (Python/FastAPI) + frontend (Next.js/TypeScript) codebase review

---

## Executive Summary

Networth Pro is a personal finance desktop application with a FastAPI/SQLite backend and Next.js frontend. The application handles highly sensitive financial data including bank account balances, investment portfolios, real estate holdings, API keys for multiple AI providers, and Plaid banking credentials.

The audit identified **8 critical**, **14 important**, and **9 nice-to-have** findings across security and performance domains. The most urgent issues are: **zero authentication/authorization on all API endpoints**, **Plaid access tokens exposed in URLs and responses**, **API keys stored in plaintext in SQLite**, and **no CORS configuration**. On the performance side, pervasive **N+1 query patterns** across dashboard, accounts, and liabilities endpoints will degrade as data grows, and **route ordering bugs** render several endpoints unreachable.

---

## Critical Findings

### SEC-01: No Authentication or Authorization on Any Endpoint

**Severity:** Critical
**Files:** `/backend/main.py` (lines 38-51)

The entire API surface has zero authentication. All 12 routers are mounted without any auth middleware, dependency, or guard. Any process on the machine (or network, if exposed) can read/write all financial data, including API keys.

```python
# backend/main.py:38-49
app.include_router(dashboard.router, prefix="/api/v1")
app.include_router(portfolio.router, prefix="/api/v1")
app.include_router(securities.router, prefix="/api/v1")
app.include_router(real_estate.router, prefix="/api/v1")
app.include_router(accounts.router, prefix="/api/v1")
app.include_router(liabilities.router, prefix="/api/v1")
app.include_router(retirement.router, prefix="/api/v1")
app.include_router(budget.router, prefix="/api/v1")
app.include_router(budget_ai.router, prefix="/api/v1")
app.include_router(dashboard_ai.router, prefix="/api/v1")
app.include_router(settings.router, prefix="/api/v1")
app.include_router(statements.router, prefix="/api/v1")
```

**Attack Vector:** Any local application, browser extension, or malicious script can call `http://127.0.0.1:8000/api/v1/settings` to read API keys or `DELETE /api/v1/accounts/{id}` to destroy financial records.

**Recommendation:** Add at minimum a session-based or token-based authentication middleware. Even for a desktop-only app, a local bearer token or API key that the frontend presents would prevent cross-origin and cross-process attacks. Note that `python-jose` and `passlib` are already in `requirements.txt` (line 7-8) but never used.

---

### SEC-02: No CORS Configuration

**Severity:** Critical
**File:** `/backend/main.py` (entire file, 60 lines)

The FastAPI application has no CORS middleware configured at all. There is no `CORSMiddleware` import or `app.add_middleware()` call. This means:
- In production mode, browsers will block cross-origin requests (breaking the frontend)
- The fact that it currently works relies on the Next.js proxy rewrite in `next.config.ts` line 9
- If the backend is ever exposed directly (even on localhost), any website can make requests to it via a user's browser

```python
# backend/main.py - No CORS middleware anywhere
app = FastAPI(title="Networth Pro API", lifespan=lifespan)
# Missing: app.add_middleware(CORSMiddleware, allow_origins=[...], ...)
```

**Attack Vector:** A malicious website visited by the user could make fetch requests to `http://127.0.0.1:8000/api/v1/settings` and exfiltrate API keys, since there's no CORS policy to prevent it. Most browsers will allow this for simple GET requests without preflight.

**Recommendation:** Add `CORSMiddleware` restricting origins to `http://localhost:3000` and `http://127.0.0.1:3000` at minimum.

---

### SEC-03: Plaid Access Token Returned to Client and Exposed in URL

**Severity:** Critical
**File:** `/backend/api/plaid.py` (lines 89, 95-96)

The Plaid access token -- which grants full read access to a user's bank account data -- is returned directly to the client in the token exchange response and then accepted as a URL path parameter for balance queries.

```python
# backend/api/plaid.py:87-89
# TODO: Save access_token and item_id to database associated with the user
# For now, we will return them (NOT SECURE FOR PRODUCTION - PROTOTYPE ONLY)
return {"access_token": access_token, "item_id": item_id}

# backend/api/plaid.py:95-96
@router.get("/balance/{access_token}")
async def get_balance(access_token: str):
```

**Attack Vector:**
1. The access token is logged in server access logs (URL path parameters are logged by default)
2. The token appears in browser history
3. The token is cached by any intermediate proxies
4. Combined with SEC-01, any process can call the exchange endpoint and obtain bank access tokens

**Recommendation:** Store access tokens server-side in an encrypted database field. Use an internal reference ID for balance queries (e.g., `/balance/{item_id}` looking up the token from DB). Never expose Plaid access tokens in URLs or API responses.

---

### SEC-04: API Keys Stored in Plaintext in SQLite Database

**Severity:** Critical
**File:** `/backend/models.py` (lines 180-184), `/backend/api/settings.py` (lines 148-177)

All API keys (OpenAI, Groq, Claude, Kimi, Gemini, RentCast) are stored as plaintext strings in the `appsettings` SQLite table. The `is_secret` field is a metadata flag only -- it controls masking in API responses but the raw value is stored unencrypted.

```python
# backend/models.py:180-184
class AppSettings(BaseModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    key: str = Field(index=True, unique=True)
    value: Optional[str] = None  # <-- Plaintext API keys here
    is_secret: bool = Field(default=False)
```

```python
# backend/api/settings.py:165-167
if setting:
    setting.value = data.value  # <-- Stored as-is
    setting.updated_at = datetime.utcnow()
```

**Attack Vector:** The SQLite database file (`networth_v2.db`) can be read by any process with filesystem access. API keys extracted from it could be used to make API calls charged to the user's accounts (OpenAI, Anthropic, etc.), or to access the user's Plaid-linked bank accounts.

**Recommendation:** Encrypt API key values before storage using a key derived from user credentials or the system keychain. On macOS, consider using the Keychain API via `keyring` library. At minimum, use Fernet symmetric encryption with a key stored separately from the database.

---

### SEC-05: Settings API Exposes Partial API Keys Without Authentication

**Severity:** Critical
**File:** `/backend/api/settings.py` (lines 43-47, 50-80)

The `GET /settings` endpoint returns all settings including masked API keys. The mask reveals the first 4 and last 4 characters, which for typical 40-character API keys reduces the search space significantly. Combined with SEC-01 (no auth), anyone can call this endpoint.

```python
# backend/api/settings.py:43-47
def mask_secret(value: Optional[str]) -> Optional[str]:
    if not value or len(value) < 8:
        return "••••••••" if value else None
    return value[:4] + "••••••••" + value[-4:]  # Exposes 8 chars
```

**Attack Vector:** An attacker with network access to port 8000 can call `GET /api/v1/settings` to learn the first/last 4 characters of all configured API keys. This partial information aids targeted brute-force or social engineering attacks against the key providers.

**Recommendation:** Return only boolean `is_set` status for secret fields. Never expose any portion of API keys in responses. The current masking provides a false sense of security while leaking information.

---

### SEC-06: Module-Level Global API Key Cache

**Severity:** Critical
**File:** `/backend/services/ai_provider.py` (lines 73-76)

API keys are cached in a module-level mutable dictionary that persists for the lifetime of the server process. This cache is shared across all requests and never cleared.

```python
# backend/services/ai_provider.py:73-76
_cached_provider: Optional[AIProvider] = None
_cached_api_keys: Dict[str, str] = {}
_cached_model: Optional[str] = None
```

**Attack Vector:** In a multi-user scenario (or if the process is compromised), API keys from one session are available to all subsequent requests. Keys persist in process memory indefinitely with no way to invalidate them.

**Recommendation:** Use request-scoped dependency injection for API key resolution instead of module-level globals. At minimum, add a TTL or explicit invalidation mechanism.

---

### PERF-01: Route Ordering Bug -- `/retirement/plans/active` Unreachable

**Severity:** Critical
**File:** `/backend/api/retirement.py` (lines 99, 200)

The route `GET /retirement/plans/active` (line 200) is defined AFTER the parameterized route `GET /retirement/plans/{plan_id}` (line 99). FastAPI evaluates routes in registration order, so a request to `/retirement/plans/active` will match `{plan_id}` first with `plan_id="active"`.

```python
# backend/api/retirement.py:99
@router.get("/retirement/plans/{plan_id}")
def get_plan(plan_id: int, session: Session = Depends(get_session)):

# backend/api/retirement.py:200 -- UNREACHABLE
@router.get("/retirement/plans/active")
def get_active_plan(session: Session = Depends(get_session)):
```

Because `plan_id` is typed as `int`, FastAPI will return a 422 Validation Error when "active" cannot be parsed as an integer, rather than routing to the correct handler. The `get_active_plan` endpoint is effectively dead code.

**Recommendation:** Move the `/retirement/plans/active` route definition BEFORE the `/{plan_id}` route.

---

### PERF-02: Route Ordering Bug -- `/accounts/summary` and `/liabilities/summary` Unreachable

**Severity:** Critical
**File:** `/backend/api/accounts.py` (lines 132, 275), `/backend/api/liabilities.py` (lines 135, 274)

Same pattern as PERF-01. Summary endpoints are defined after parameterized ID routes:

```python
# backend/api/accounts.py:132
@router.get("/accounts/{account_id}")
def get_account(account_id: int, ...):

# backend/api/accounts.py:275 -- UNREACHABLE
@router.get("/accounts/summary")
def get_accounts_summary(...):
```

```python
# backend/api/liabilities.py:135
@router.get("/liabilities/{liability_id}")
def get_liability(liability_id: int, ...):

# backend/api/liabilities.py:274 -- UNREACHABLE
@router.get("/liabilities/summary")
def get_liabilities_summary(...):
```

Both will return 422 errors because "summary" cannot be parsed as `int`. These are functional bugs that prevent aggregate views from working.

**Recommendation:** Move both summary routes before their respective `/{id}` routes.

---

## Important Findings

### SEC-07: Plaid Credentials Read at Module Import Time

**Severity:** Important
**File:** `/backend/api/plaid.py` (lines 19-41)

Plaid credentials are read from environment variables and the API client is constructed at module import time (not inside a request handler). This means:
- The client is initialized once with whatever env vars are set at startup
- If credentials change, the server must be restarted
- If credentials are missing, a warning is printed but the module still loads, and API calls will fail with cryptic errors

```python
# backend/api/plaid.py:19-21
PLAID_CLIENT_ID = os.getenv("PLAID_CLIENT_ID")
PLAID_SECRET = os.getenv("PLAID_SECRET")
PLAID_ENV = os.getenv("PLAID_ENV", "sandbox")

# backend/api/plaid.py:40-41
api_client = plaid.ApiClient(configuration)
client = plaid_api.PlaidApi(api_client)
```

**Recommendation:** Lazily initialize the Plaid client on first use, or use a dependency injection pattern.

---

### SEC-08: Plaid Error Details Leaked to Client

**Severity:** Important
**File:** `/backend/api/plaid.py` (lines 73-75, 91-93, 122-124)

Plaid API exceptions are converted directly to HTTP 500 responses with `str(e)` as the detail, which can leak internal error information including Plaid request IDs, internal error codes, and potentially partial credential information.

```python
# backend/api/plaid.py:73-75
except plaid.ApiException as e:
    print(f"Plaid Error: {e}")
    raise HTTPException(status_code=500, detail=str(e))
```

**Recommendation:** Return a generic error message to the client. Log the full exception server-side.

---

### SEC-09: Unsanitized Ticker Symbols Passed to yfinance

**Severity:** Important
**File:** `/backend/services/market_data.py` (lines 28, 69), `/backend/api/securities.py` (line 38)

User-provided ticker symbols are passed directly to `yf.Ticker()` with only `.upper()` applied. While yfinance itself is not known to have injection vulnerabilities, unsanitized strings passed to external libraries can trigger unexpected behavior.

```python
# backend/services/market_data.py:28
ticker = yf.Ticker(query.upper())

# backend/services/market_data.py:69
ticker = yf.Ticker(ticker_symbol)
```

**Recommendation:** Validate ticker symbols against a regex pattern (e.g., `^[A-Z0-9.\-]{1,12}$`) before passing to yfinance.

---

### SEC-10: SQL Injection Pattern in Migration Script (f-string SQL)

**Severity:** Important
**File:** `/backend/main.py` (lines 14-19)

The `_ensure_property_columns()` function constructs SQL using f-strings. While the column names and types are currently hardcoded (not from user input), this establishes a dangerous pattern that could be exploited if the list were ever modified to include dynamic values.

```python
# backend/main.py:14-19
for col, col_type in [
    ("provider_property_id", "TEXT"),
    ("valuation_provider", "TEXT"),
]:
    try:
        conn.execute(f"ALTER TABLE property ADD COLUMN {col} {col_type}")
```

**Recommendation:** Use parameterized queries or SQLModel's schema migration tools (Alembic is already in requirements.txt but unused).

---

### SEC-11: Hardcoded Absolute Path Exposes Username and Directory Structure

**Severity:** Important
**File:** `/backend/migration.py` (line 9)

The migration script contains a hardcoded absolute path that exposes the developer's username and directory structure.

```python
# backend/migration.py:9
LEGACY_DB_PATH = "/Users/jacobzachariah/Desktop/Projects/networth-app/networth.db"
```

**Recommendation:** Use a relative path, environment variable, or command-line argument for the legacy database path.

---

### SEC-12: Financial Data Sent to Third-Party AI Providers

**Severity:** Important
**Files:** `/backend/services/ai_insights.py` (lines 892-921), `/backend/api/dashboard_ai.py`

Complete financial snapshots -- including net worth, portfolio holdings with exact values, property details, and liability balances -- are sent to third-party AI providers (OpenAI, Groq, Anthropic, Moonshot, Google) for insight generation.

```python
# backend/services/ai_insights.py:892-906
user_prompt = f"""Analyze this financial snapshot and provide 5-7 specific, actionable insights.

NET WORTH: ${net_worth:,.2f}
- Total Assets: ${total_assets:,.2f}
- Total Liabilities: ${total_liabilities:,.2f}
- Cash & Bank Accounts: ${breakdown.get('cash_accounts', 0):,.2f}
- Investment Portfolio: ${breakdown.get('investments', 0):,.2f}
...
```

**Recommendation:** Add clear user disclosure that financial data is shared with AI providers. Consider allowing users to opt out of AI features. Redact or generalize specific dollar amounts when possible.

---

### PERF-03: N+1 Query Pattern in Accounts Listing

**Severity:** Important
**File:** `/backend/api/accounts.py` (lines 57-83)

The `list_accounts` endpoint fetches all accounts, then issues a separate database query for each account's latest balance snapshot. With N accounts, this results in N+1 queries.

```python
# backend/api/accounts.py:57-83
accounts = session.exec(select(Account)).all()  # Query 1
for account in accounts:
    latest_snapshot = session.exec(                # Query 2..N+1
        select(BalanceSnapshot)
        .where(BalanceSnapshot.account_id == account.id)
        .order_by(BalanceSnapshot.date.desc())
    ).first()
```

**Recommendation:** Use a single query with a subquery or window function to fetch latest snapshots for all accounts at once. For example:
```sql
SELECT a.*, bs.amount, bs.date
FROM account a
LEFT JOIN balancesnapshot bs ON bs.account_id = a.id
  AND bs.date = (SELECT MAX(date) FROM balancesnapshot WHERE account_id = a.id)
```

---

### PERF-04: N+1 Query Pattern in Liabilities Listing

**Severity:** Important
**File:** `/backend/api/liabilities.py` (lines 62-88)

Identical N+1 pattern as PERF-03, for liabilities.

```python
# backend/api/liabilities.py:62-88
liabilities = session.exec(select(Liability)).all()
for liability in liabilities:
    latest_snapshot = session.exec(
        select(BalanceSnapshot)
        .where(BalanceSnapshot.liability_id == liability.id)
        .order_by(BalanceSnapshot.date.desc())
    ).first()
```

**Recommendation:** Same as PERF-03 -- use a single join query.

---

### PERF-05: N+1 Query Pattern in Dashboard Net Worth Calculation

**Severity:** Important
**File:** `/backend/api/dashboard.py` (lines 28-33, 112-117)

The `get_networth` endpoint queries latest snapshot for each account and each liability individually. The `get_networth_breakdown` endpoint (lines 233-238) repeats the same pattern. These are the most-visited endpoints (dashboard load).

```python
# backend/api/dashboard.py:28-33
for account in accounts:
    snap = session.exec(
        select(BalanceSnapshot)
        .where(BalanceSnapshot.account_id == account.id)
        .order_by(BalanceSnapshot.date.desc())
    ).first()
```

With 10 accounts and 5 liabilities, this produces 16 queries per dashboard load instead of 2.

**Recommendation:** Use batch queries with subqueries to fetch all latest snapshots in one round-trip.

---

### PERF-06: N+1 Query in Accounts and Liabilities Summary Endpoints

**Severity:** Important
**File:** `/backend/api/accounts.py` (lines 276-304), `/backend/api/liabilities.py` (lines 275-303)

The summary endpoints (if they were reachable -- see PERF-02) contain the same N+1 pattern. Each account/liability triggers an individual snapshot query.

**Recommendation:** Same batch query approach as PERF-03/04/05.

---

### PERF-07: Missing Composite Database Indexes on BalanceSnapshot

**Severity:** Important
**File:** `/backend/models.py` (lines 46-57)

`BalanceSnapshot` has an index on `date` only. The most common query pattern is `WHERE account_id = X ORDER BY date DESC` (or `liability_id`), which would benefit from composite indexes.

```python
# backend/models.py:46-57
class BalanceSnapshot(BaseModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    date: datetime = Field(index=True)  # <-- Only index
    account_id: Optional[int] = Field(default=None, foreign_key="account.id")     # No index
    liability_id: Optional[int] = Field(default=None, foreign_key="liability.id")  # No index
    amount: float
    currency: str
```

**Recommendation:** Add composite indexes: `(account_id, date DESC)` and `(liability_id, date DESC)`. This will dramatically speed up the N+1 queries (even before they're optimized) and the batch alternatives.

---

### PERF-08: Historical Net Worth Adds Current Portfolio Value to All Past Dates

**Severity:** Important
**File:** `/backend/api/dashboard.py` (lines 180-211)

The `get_networth_history` endpoint fetches current investment and real estate values, then adds them to ALL historical dates. This produces inaccurate historical data -- a user who bought stocks last week will see their entire history inflated by today's portfolio value.

```python
# backend/api/dashboard.py:180-182
holdings = session.exec(select(PortfolioHolding)).all()
total_investments = sum(h.current_value or 0 for h in holdings)

# backend/api/dashboard.py:210-211 (inside loop over all dates)
total_assets = total_cash + total_investments + total_real_estate  # Current values on historical dates!
```

**Recommendation:** Either track portfolio/real estate value snapshots over time, or only include investments/real estate in the most recent data point. The current approach produces misleading charts.

---

### PERF-09: Sequential API Calls in Securities Search

**Severity:** Important
**File:** `/backend/services/market_data.py` (lines 67-84)

The `search_securities` function makes individual sequential `yf.Ticker().info` calls for each matching ticker from the common list. Each call can take 1-3 seconds, making a search with 5 matches take 5-15 seconds.

```python
# backend/services/market_data.py:67-84
for ticker_symbol in matching_tickers:
    try:
        ticker = yf.Ticker(ticker_symbol)
        info = ticker.info  # Blocking network call
```

**Recommendation:** Use `yf.Tickers()` for batch fetching (as done in `get_batch_quotes`) or implement concurrent fetching with `asyncio` or `concurrent.futures`.

---

### SEC-13: No Rate Limiting on Any Endpoint

**Severity:** Important
**File:** `/backend/main.py` (entire file)

There is no rate limiting on any endpoint. The file upload endpoint (`/budget/statements/parse`) accepts files up to 10MB, and AI endpoints trigger expensive third-party API calls.

**Attack Vector:** A malicious local process could flood the AI endpoints to exhaust API quotas, or upload large files repeatedly to consume disk/memory.

**Recommendation:** Add rate limiting middleware (e.g., `slowapi`) with sensible defaults, especially on file upload and AI endpoints.

---

### SEC-14: Unused Authentication Dependencies in requirements.txt

**Severity:** Important
**File:** `/backend/requirements.txt` (lines 7-8)

The project includes `python-jose[cryptography]` and `passlib[bcrypt]` -- libraries specifically for JWT token handling and password hashing -- but neither is imported or used anywhere in the codebase.

```
# backend/requirements.txt:7-8
python-jose[cryptography]>=3.3.0
passlib[bcrypt]>=1.7.4
```

This suggests authentication was planned but never implemented, and the unused dependencies increase the attack surface.

**Recommendation:** Either implement authentication using these libraries or remove them from requirements to reduce the dependency surface.

---

## Nice-to-Have Findings

### PERF-10: SQLite Database Path Is Relative

**Severity:** Nice-to-have
**File:** `/backend/core/database.py` (lines 5-7)

The database path is relative, meaning the database location depends on the working directory when the server starts. This can cause "database not found" or "wrong database" issues.

```python
# backend/core/database.py:5-7
sqlite_file_name = "networth_v2.db"
sqlite_url = f"sqlite:///{sqlite_file_name}"
```

**Recommendation:** Use an absolute path derived from the project directory, e.g., `os.path.join(os.path.dirname(__file__), '..', 'data', 'networth_v2.db')`.

---

### PERF-11: No WAL Mode for SQLite

**Severity:** Nice-to-have
**File:** `/backend/core/database.py` (lines 9-10)

SQLite is running in the default journal mode. WAL (Write-Ahead Logging) mode would allow concurrent reads during writes, improving performance under load.

```python
# backend/core/database.py:9-10
connect_args = {"check_same_thread": False}
engine = create_engine(sqlite_url, connect_args=connect_args)
```

**Recommendation:** Enable WAL mode after engine creation:
```python
from sqlalchemy import event
@event.listens_for(engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.close()
```

---

### PERF-12: Unbounded In-Memory Caches

**Severity:** Nice-to-have
**File:** `/backend/services/ai_insights.py` (lines 38-39, 119-128), `/backend/services/news_fetcher.py` (lines 18-19, 207-211)

The categorization cache grows to 1000 entries before bulk-pruning 100, and the news cache grows to 50 before pruning expired entries. Neither has a maximum memory limit.

```python
# backend/services/ai_insights.py:124-128
if len(_categorization_cache) > 1000:
    sorted_items = sorted(_categorization_cache.items(), key=lambda x: x[1][1])
    for key, _ in sorted_items[:100]:
        del _categorization_cache[key]
```

**Recommendation:** Use `functools.lru_cache` or a bounded cache (e.g., `cachetools.TTLCache`) with fixed maximum size.

---

### PERF-13: `datetime.utcnow()` Usage (Deprecated)

**Severity:** Nice-to-have
**Files:** `/backend/models.py` (lines 6-7), `/backend/api/accounts.py` (lines 110, 126), `/backend/api/liabilities.py` (lines 114, 129), and 10+ other files

`datetime.utcnow()` is deprecated since Python 3.12 in favor of `datetime.now(timezone.utc)`. While functionally equivalent for now, this will generate deprecation warnings.

```python
# backend/models.py:6-7
class BaseModel(SQLModel):
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
```

**Recommendation:** Replace all `datetime.utcnow()` calls with `datetime.now(timezone.utc)`.

---

### PERF-14: Frontend Uses `cache: 'no-store'` on All API Calls

**Severity:** Nice-to-have
**File:** `/frontend/lib/api.ts` (line 8)

The frontend base URL logic and API calls consistently disable caching. While appropriate for mutation endpoints, read-only endpoints like net worth history or settings could benefit from short-lived caches.

```typescript
// frontend/lib/api.ts:6-9
const getBaseUrl = () => {
    const isServer = typeof window === 'undefined';
    return isServer ? 'http://127.0.0.1:8000' : '';
};
```

**Recommendation:** Add appropriate `Cache-Control` headers from the backend for read-heavy endpoints, and use `next` revalidation options on the frontend.

---

### PERF-15: No Request Timeouts in Frontend API Client

**Severity:** Nice-to-have
**File:** `/frontend/lib/api.ts`

The frontend `fetch` calls do not specify `AbortController` timeouts. If the backend hangs (e.g., during a yfinance call), the frontend will wait indefinitely.

**Recommendation:** Add `AbortController` with a timeout (e.g., 30 seconds) for all API calls:
```typescript
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 30000);
const response = await fetch(url, { signal: controller.signal, ... });
```

---

### SEC-15: XML Parsing Without Explicit Entity Expansion Limits

**Severity:** Nice-to-have
**File:** `/backend/services/news_fetcher.py` (line 34)

The news fetcher parses XML from Google News RSS using `xml.etree.ElementTree.fromstring()`. While Python's `ET` is not vulnerable to XXE by default (it doesn't resolve external entities), it is susceptible to "billion laughs" entity expansion attacks if the XML source were malicious.

```python
# backend/services/news_fetcher.py:34
root = ET.fromstring(xml_data)
```

Since the source is Google News, the practical risk is very low.

**Recommendation:** Use `defusedxml.ElementTree` as a drop-in replacement for defense-in-depth.

---

### PERF-16: Duplicate Database Path in main.py vs database.py

**Severity:** Nice-to-have
**File:** `/backend/main.py` (line 10) vs `/backend/core/database.py` (line 5)

`main.py` references `"networth.db"` (line 10) for the migration function, while `database.py` uses `"networth_v2.db"` (line 5) for the actual database. This dual path means the migration function might operate on the wrong database file.

```python
# backend/main.py:10
db_path = os.path.join(os.path.dirname(__file__), "networth.db")

# backend/core/database.py:5
sqlite_file_name = "networth_v2.db"
```

**Recommendation:** Centralize the database path in `database.py` and reference it from `main.py`.

---

### PERF-17: No Pagination on List Endpoints

**Severity:** Nice-to-have
**Files:** `/backend/api/accounts.py` (line 59), `/backend/api/portfolio.py`, `/backend/api/real_estate.py`

Most list endpoints return all records without pagination:

```python
# backend/api/accounts.py:59
accounts = session.exec(select(Account)).all()
```

For a personal finance app, dataset sizes are typically small (< 100 records), so this is low priority.

**Recommendation:** Add optional `limit` and `offset` query parameters to list endpoints for future-proofing.

---

### SEC-16: MD5 Used for Cache Keys

**Severity:** Nice-to-have
**Files:** `/backend/services/ai_insights.py` (line 104), `/backend/services/news_fetcher.py` (line 172)

MD5 is used for generating cache keys. While not a security risk in this context (cache keys don't need collision resistance), it could be confusing in security audits.

```python
# backend/services/ai_insights.py:104
return hashlib.md5(normalized.encode()).hexdigest()
```

**Recommendation:** Use `hashlib.sha256` for consistency with security best practices, though MD5 is functionally acceptable here.

---

## Summary Table

| ID | Finding | Severity | Category | File(s) |
|----|---------|----------|----------|---------|
| SEC-01 | No authentication on any endpoint | Critical | Security | `main.py` |
| SEC-02 | No CORS configuration | Critical | Security | `main.py` |
| SEC-03 | Plaid access token in URL and response | Critical | Security | `plaid.py` |
| SEC-04 | API keys stored in plaintext SQLite | Critical | Security | `models.py`, `settings.py` |
| SEC-05 | Partial API keys exposed without auth | Critical | Security | `settings.py` |
| SEC-06 | Global mutable API key cache | Critical | Security | `ai_provider.py` |
| PERF-01 | `/retirement/plans/active` unreachable | Critical | Performance | `retirement.py` |
| PERF-02 | `/accounts/summary` and `/liabilities/summary` unreachable | Critical | Performance | `accounts.py`, `liabilities.py` |
| SEC-07 | Plaid client initialized at import time | Important | Security | `plaid.py` |
| SEC-08 | Plaid error details leaked to client | Important | Security | `plaid.py` |
| SEC-09 | Unsanitized ticker symbols | Important | Security | `market_data.py`, `securities.py` |
| SEC-10 | f-string SQL in migration | Important | Security | `main.py` |
| SEC-11 | Hardcoded absolute path with username | Important | Security | `migration.py` |
| SEC-12 | Financial data sent to AI providers | Important | Security | `ai_insights.py` |
| SEC-13 | No rate limiting | Important | Security | `main.py` |
| SEC-14 | Unused auth dependencies | Important | Security | `requirements.txt` |
| PERF-03 | N+1 queries in accounts listing | Important | Performance | `accounts.py` |
| PERF-04 | N+1 queries in liabilities listing | Important | Performance | `liabilities.py` |
| PERF-05 | N+1 queries in dashboard | Important | Performance | `dashboard.py` |
| PERF-06 | N+1 queries in summary endpoints | Important | Performance | `accounts.py`, `liabilities.py` |
| PERF-07 | Missing composite indexes | Important | Performance | `models.py` |
| PERF-08 | Inaccurate historical net worth | Important | Performance | `dashboard.py` |
| PERF-09 | Sequential API calls in search | Important | Performance | `market_data.py` |
| PERF-10 | Relative database path | Nice-to-have | Performance | `database.py` |
| PERF-11 | No WAL mode for SQLite | Nice-to-have | Performance | `database.py` |
| PERF-12 | Unbounded in-memory caches | Nice-to-have | Performance | `ai_insights.py`, `news_fetcher.py` |
| PERF-13 | Deprecated `datetime.utcnow()` | Nice-to-have | Performance | Multiple files |
| PERF-14 | No frontend caching | Nice-to-have | Performance | `api.ts` |
| PERF-15 | No frontend request timeouts | Nice-to-have | Performance | `api.ts` |
| SEC-15 | XML parsing without defusedxml | Nice-to-have | Security | `news_fetcher.py` |
| PERF-16 | Duplicate database paths | Nice-to-have | Performance | `main.py`, `database.py` |
| PERF-17 | No pagination on list endpoints | Nice-to-have | Performance | Multiple files |
| SEC-16 | MD5 for cache keys | Nice-to-have | Security | `ai_insights.py`, `news_fetcher.py` |

---

## Priority Recommendations

### Immediate (Before Any Deployment)
1. **Add authentication** -- Even a simple local token guard (SEC-01)
2. **Add CORS middleware** -- Restrict to frontend origin (SEC-02)
3. **Fix Plaid token handling** -- Store server-side, remove from URLs (SEC-03)
4. **Encrypt stored API keys** -- Use system keychain or Fernet encryption (SEC-04)
5. **Fix route ordering** -- Move static routes before parameterized routes (PERF-01, PERF-02)

### Short-Term (Next Sprint)
6. **Fix N+1 queries** -- Batch all snapshot lookups (PERF-03/04/05/06)
7. **Add composite indexes** on BalanceSnapshot (PERF-07)
8. **Add rate limiting** on sensitive endpoints (SEC-13)
9. **Fix historical net worth** accuracy (PERF-08)
10. **Validate ticker input** with regex (SEC-09)

### Medium-Term (Next Release)
11. Implement proper database migrations with Alembic (SEC-10)
12. Add user disclosure for AI data sharing (SEC-12)
13. Enable SQLite WAL mode (PERF-11)
14. Add frontend request timeouts (PERF-15)
15. Parallelize securities search (PERF-09)

---

## Notes on Scope

- **DMG packaging:** No macOS DMG packaging scripts were found in the codebase. The audit scope mentioned this but it does not appear to be implemented.
- **Streamlit:** No Streamlit files were found. The application uses Next.js for its frontend, not Streamlit.
- **Dependency vulnerabilities:** No `pip audit` or `npm audit` was run as part of this code-level review. Running these tools is recommended as a complementary step.
- **All file paths** referenced in this report are relative to `/Users/jacobzachariah/Desktop/Projects/networth-pro/backend/` unless the `frontend/` prefix is shown.
