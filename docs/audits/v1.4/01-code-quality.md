# Code Quality, Architecture & Maintainability Audit

**Project:** Networth Pro
**Auditor:** code-quality (Senior Python Engineer)
**Date:** 2026-02-10
**Commit:** `17253cb` (main)

---

## Executive Summary

Networth Pro is a personal finance application with a Python FastAPI backend, SQLModel ORM on SQLite, and a Next.js + TypeScript frontend. The codebase is functional, ships real features, and demonstrates competent domain modeling. However, several systemic issues threaten long-term maintainability:

1. **Global mutable state** is used extensively for API keys and configuration, creating thread-safety hazards and making testing difficult.
2. **Error handling is inconsistent** -- bare `except` clauses silently swallow errors in critical paths (market data, AI calls), while `print()` is used instead of the logging framework in multiple modules.
3. **Database operations lack transactional discipline** -- service functions call `session.commit()` multiple times per operation instead of using single-transaction patterns.
4. **The frontend API client** (`lib/api.ts`, 1965 lines) contains extreme boilerplate duplication with no shared fetch utility.
5. **`datetime.utcnow()`** is used 54 times across 14 files, but this function is deprecated since Python 3.12 and returns a naive datetime.
6. **SQL injection risk** exists in `main.py` where column names are interpolated into raw SQL via f-string.
7. **The Plaid integration** returns access tokens directly to the frontend, which is a security concern explicitly noted in a TODO comment.

The codebase would benefit significantly from a dedicated refactoring pass addressing these patterns before further feature development.

---

## Findings

### 1. Module Structure & Separation of Concerns

#### 1.1 Monolithic Frontend API Client
| Severity | Location |
|----------|----------|
| :yellow_circle: Important | `/frontend/lib/api.ts` (1965 lines) |

The entire frontend API surface (types, fetch functions for 12+ resource domains) lives in a single 1965-line file. Every function repeats the same try/catch + `getBaseUrl()` + `fetch()` + error-handling boilerplate.

```typescript
// This pattern is repeated ~60+ times across the file:
export async function fetchNetWorth(): Promise<NetWorth | null> {
    try {
        const baseUrl = getBaseUrl();
        const res = await fetch(`${baseUrl}/api/v1/networth`, {
            cache: 'no-store'
        });
        if (!res.ok) {
            throw new Error('Failed to fetch net worth data');
        }
        return res.json();
    } catch (error) {
        console.error(error);
        return null;
    }
}
```

**Recommendation:** Extract a shared `apiClient` utility that handles base URL, error handling, and response parsing. Split the file by domain (portfolio, accounts, budget, etc.).

---

#### 1.2 Flat Backend API Directory
| Severity | Location |
|----------|----------|
| :blue_circle: Nice-to-have | `/backend/api/` (12 route files) |

All API route modules sit in a flat `api/` directory. While each file is reasonably sized, some overlap exists:
- `budget.py` and `budget_ai.py` both operate on the same entities (transactions, categories).
- `dashboard.py` and `dashboard_ai.py` both serve dashboard data.

This is acceptable at the current scale but will become harder to navigate as features grow.

---

#### 1.3 Models in a Single File
| Severity | Location |
|----------|----------|
| :blue_circle: Nice-to-have | `/backend/models.py` (185 lines, 14 model classes) |

All 14 SQLModel classes are defined in one file. Currently manageable, but as the schema grows, splitting into a `models/` package (e.g., `models/accounts.py`, `models/budget.py`, `models/portfolio.py`) would improve discoverability.

---

### 2. Code Duplication

#### 2.1 N+1 Query Pattern in List Endpoints
| Severity | Location |
|----------|----------|
| :yellow_circle: Important | `/backend/api/accounts.py:57-83`, `/backend/api/liabilities.py:62-88`, `/backend/api/accounts.py:276-311`, `/backend/api/liabilities.py:274-303` |

The `list_accounts`, `list_liabilities`, `get_accounts_summary`, and `get_liabilities_summary` endpoints all follow the same pattern: fetch all entities, then loop and issue a separate query for the latest `BalanceSnapshot` for each one. This is an N+1 query problem.

```python
# accounts.py lines 57-82 (duplicated nearly identically in liabilities.py)
accounts = session.exec(select(Account)).all()
result = []
for account in accounts:
    latest_snapshot = session.exec(
        select(BalanceSnapshot)
        .where(BalanceSnapshot.account_id == account.id)
        .order_by(BalanceSnapshot.date.desc())
    ).first()
    result.append({...})
```

This issues `1 + N` database queries where `N` is the number of accounts/liabilities. For summary endpoints, it doubles -- `list` queries + `summary` queries hit the same data.

**Recommendation:** Use a subquery or join to fetch the latest balance in a single query. Alternatively, denormalize by adding a `current_balance` column to `Account` / `Liability` that is updated on each balance snapshot.

---

#### 2.2 Duplicate CRUD Boilerplate
| Severity | Location |
|----------|----------|
| :blue_circle: Nice-to-have | `/backend/api/accounts.py` vs `/backend/api/liabilities.py` |

The accounts and liabilities API modules are nearly identical in structure. Both have: Create, Read, Update, Delete, Update Balance, Get Summary -- with the same pattern of checking for duplicate names, creating balance snapshots, building response dicts. A shared base class or generic CRUD utility would eliminate ~200 lines of duplication.

---

#### 2.3 Duplicated AI Client Code
| Severity | Location |
|----------|----------|
| :blue_circle: Nice-to-have | `/backend/services/ai_provider.py:217-341` |

`GroqClient` and `OpenAIClient` share nearly identical implementations for both `chat_completion()` and `vision_completion()` because Groq uses the OpenAI-compatible API. Similarly, `KimiClient` is a third copy. All three could inherit from a shared `OpenAICompatibleClient` base.

```python
# These three classes contain almost identical code:
# GroqClient.chat_completion (lines 229-247)
# OpenAIClient.chat_completion (lines 290-308)
# KimiClient.chat_completion (lines 433-451)
```

---

### 3. Dead Code & Unused Imports

#### 3.1 Unused `os` Import in `ai_insights.py`
| Severity | Location |
|----------|----------|
| :blue_circle: Nice-to-have | `/backend/services/ai_insights.py:12` |

```python
import os  # Never used in this file
```

#### 3.2 Unused Import `base64` in `statement_parser.py`
| Severity | Location |
|----------|----------|
| :blue_circle: Nice-to-have | `/backend/services/statement_parser.py:8` |

```python
import base64  # Not used in this file
```

#### 3.3 Late Import of `json` in `parse_single_image`
| Severity | Location |
|----------|----------|
| :blue_circle: Nice-to-have | `/backend/services/statement_parser.py:872` |

```python
def parse_single_image(client, file_content: bytes, file_type: str):
    ...
    import json  # Line 872 - imported inside function body
```

`json` is a stdlib module and should be imported at the top of the file for consistency and clarity.

---

### 4. Error Handling

#### 4.1 Bare `except Exception` with Silent Pass
| Severity | Location |
|----------|----------|
| :red_circle: Critical | `/backend/services/market_data.py:42-43`, `83-84`, `256` |

Three locations in the market data service silently swallow all exceptions, including network errors, authentication failures, and unexpected data format issues:

```python
# market_data.py line 42-43
except Exception:
    pass  # Ticker not found or API error

# market_data.py line 83-84
except Exception:
    continue

# market_data.py line 256
except Exception:
    continue
```

When a yfinance API call fails (rate limit, network issue, API change), these bare excepts make it impossible to diagnose the problem. Critical financial data could silently fail to load.

**Recommendation:** At minimum, log the exception. Ideally, catch specific exception types (`yfinance.exceptions.*`, `requests.ConnectionError`, etc.).

---

#### 4.2 `print()` Used Instead of `logging` in Production Code
| Severity | Location |
|----------|----------|
| :yellow_circle: Important | Multiple files (see list below) |

Several modules use `print()` for error output instead of the `logging` framework, even though `logger` is available or could be:

| File | Lines | Example |
|------|-------|---------|
| `/backend/services/market_data.py` | 174, 261 | `print(f"Error fetching quote for {ticker}: {e}")` |
| `/backend/services/statement_parser.py` | 610, 631 | `print(f"PDF conversion error: {e}")` |
| `/backend/api/plaid.py` | 24, 74, 92, 123 | `print(f"Plaid Error: {e}")` |
| `/backend/migration.py` | 13, 16, 19, etc. | `print("Migrating Accounts...")` |

`market_data.py` and `statement_parser.py` are runtime service code where `print()` output may not be captured by log aggregators. The `plaid.py` file uses `print()` exclusively with no logger configured.

**Recommendation:** Replace all `print()` calls with appropriate `logger.info()`, `logger.warning()`, or `logger.error()` calls.

---

#### 4.3 `time.sleep()` Blocking the Event Loop
| Severity | Location |
|----------|----------|
| :yellow_circle: Important | `/backend/services/ai_insights.py:85`, `93` |

The `_retry_with_backoff` function uses synchronous `time.sleep()` for retry delays. While the AI insight functions are currently called synchronously, they are called from FastAPI async routes (via `dashboard_ai.py` and `budget_ai.py`). `time.sleep()` in an async context blocks the entire event loop, preventing other requests from being served during the retry wait.

```python
# ai_insights.py line 85
time.sleep(retry_after)  # Blocks the async event loop for 5 seconds
# ai_insights.py line 93
time.sleep(delay)  # Blocks for 1, 2, 4 seconds (exponential backoff)
```

**Recommendation:** Either make the retry logic async (using `asyncio.sleep()`), or ensure these functions run in a thread pool executor to avoid blocking.

---

### 5. Database Operations

#### 5.1 SQL Injection via f-string in Schema Migration
| Severity | Location |
|----------|----------|
| :red_circle: Critical | `/backend/main.py:19` |

The `_ensure_property_columns` function interpolates column names directly into SQL via an f-string:

```python
# main.py line 19
conn.execute(f"ALTER TABLE property ADD COLUMN {col} {col_type}")
```

While the values come from a hardcoded list (lines 14-17: `"provider_property_id"` and `"valuation_provider"`), this pattern is dangerous as a precedent. If future developers add dynamic column names here, it becomes a direct SQL injection vector. The hardcoded list is the only thing preventing exploitation.

**Recommendation:** Use parameterized DDL or at minimum add a comment explaining that the column names must remain hardcoded. Consider moving this logic to a proper migration tool (Alembic).

---

#### 5.2 Multiple `session.commit()` Calls Per Operation
| Severity | Location |
|----------|----------|
| :yellow_circle: Important | `/backend/services/property_valuation.py:262,281`, `/backend/api/accounts.py:104,116`, `/backend/api/liabilities.py:108,120` |

Several operations call `session.commit()` multiple times within a single logical operation. If the second commit fails, the database is left in a partially committed state.

Example from `property_valuation.py`:
```python
# _update_valuation_cache: commits cache update at line 262, then commits history at line 281
session.add(cached)
session.commit()      # First commit
...
session.add(history)
session.commit()      # Second commit -- if this fails, cache is saved but history is not
```

Example from `accounts.py` (create account):
```python
session.add(account)
session.commit()          # Line 104: commit the account
session.refresh(account)
if data.current_balance != 0:
    snapshot = BalanceSnapshot(...)
    session.add(snapshot)
    session.commit()      # Line 116: commit the snapshot -- if this fails, account exists without balance
```

**Recommendation:** Batch all related writes into a single `session.commit()` call. Use `session.flush()` if you need the auto-generated ID before committing.

---

#### 5.3 No Database Connection Pooling or WAL Mode
| Severity | Location |
|----------|----------|
| :yellow_circle: Important | `/backend/core/database.py:7-10` |

```python
sqlite_url = f"sqlite:///{sqlite_file_name}"
connect_args = {"check_same_thread": False}
engine = create_engine(sqlite_url, connect_args=connect_args)
```

The SQLite connection is created with `check_same_thread=False` (necessary for FastAPI), but no connection pool limits or WAL mode are configured. Under concurrent load:
- Multiple writers can cause `SQLITE_BUSY` errors.
- The default SQLite journal mode (`DELETE`) is slower than WAL for concurrent readers.

**Recommendation:** Enable WAL mode (`PRAGMA journal_mode=WAL`) at startup. Consider setting `pool_size` and `max_overflow` on the engine for controlled concurrency.

---

#### 5.4 Relative Database Path
| Severity | Location |
|----------|----------|
| :yellow_circle: Important | `/backend/core/database.py:5-7` |

```python
sqlite_file_name = "networth_v2.db"
sqlite_url = f"sqlite:///{sqlite_file_name}"
```

The database file uses a relative path, which means its location depends on the working directory when the server starts. If the server is started from a different directory, it creates a new empty database.

Meanwhile, `main.py` line 10 references a different database path for migration:
```python
db_path = os.path.join(os.path.dirname(__file__), "networth.db")
```

This is a different filename (`networth.db` vs `networth_v2.db`) at a different path (relative to `main.py` vs CWD).

**Recommendation:** Use an absolute path derived from `__file__` in `database.py`. Standardize the database filename across all modules.

---

#### 5.5 Cascade Deletes Not Configured
| Severity | Location |
|----------|----------|
| :yellow_circle: Important | `/backend/models.py` (all foreign key relationships) |

Foreign key relationships are defined without cascade delete rules:

```python
# models.py - no cascade configured
portfolio_id: int = Field(foreign_key="portfolio.id")      # PortfolioHolding
property_id: int = Field(foreign_key="property.id", index=True)  # PropertyValuationCache, etc.
category_id: Optional[int] = Field(default=None, foreign_key="budgetcategory.id")  # Transaction
```

Delete operations in API routes manually query and delete related records (e.g., `accounts.py:229-233` loops through snapshots), which is error-prone and could leave orphaned records if the manual cleanup is incomplete.

**Recommendation:** Configure `ON DELETE CASCADE` at the SQLModel/SQLAlchemy level, or at minimum add `sa_column_kwargs={"ondelete": "CASCADE"}` to foreign key fields.

---

### 6. SQLite Initialization & Schema Management

#### 6.1 No Migration Framework
| Severity | Location |
|----------|----------|
| :yellow_circle: Important | `/backend/main.py:7-23`, `/backend/migration.py` |

Schema changes are handled via raw `ALTER TABLE` statements in `main.py` and a one-shot `migration.py` script. There is no migration versioning, no rollback support, and no way to track which migrations have been applied.

```python
# main.py lines 7-23: Manual ALTER TABLE with try/except to handle "column already exists"
for col, col_type in [
    ("provider_property_id", "TEXT"),
    ("valuation_provider", "TEXT"),
]:
    try:
        conn.execute(f"ALTER TABLE property ADD COLUMN {col} {col_type}")
    except sqlite3.OperationalError:
        pass  # Column already exists
```

As the schema evolves, this approach becomes increasingly fragile. Adding a column requires editing `main.py`, and there is no record of what schema version the database is at.

**Recommendation:** Adopt Alembic for migration management. It integrates directly with SQLModel/SQLAlchemy and provides version tracking, auto-generation, and rollback.

---

### 7. Race Conditions & Thread Safety

#### 7.1 Global Mutable State for API Keys and Configuration
| Severity | Location |
|----------|----------|
| :red_circle: Critical | `/backend/services/ai_provider.py:74-76`, `/backend/services/property_valuation.py:21-22`, `/backend/services/statement_parser.py:65`, `/backend/services/news_fetcher.py:18` |

Multiple modules use module-level mutable globals to cache configuration:

```python
# ai_provider.py lines 74-76
_cached_provider: Optional[AIProvider] = None
_cached_api_keys: Dict[str, str] = {}
_cached_model: Optional[str] = None

# property_valuation.py line 21-22
_cached_rentcast_key: Optional[str] = None

# statement_parser.py line 65
_detected_date_format: Optional[str] = None

# news_fetcher.py line 18
_news_cache: Dict[str, tuple] = {}
```

These globals are read and written without any synchronization (no locks, no thread-local storage). In a multi-worker deployment (e.g., Uvicorn with `--workers > 1`), each worker would have its own copy, leading to inconsistent behavior. Even with a single worker, concurrent async requests could observe partially-updated state.

The `_detected_date_format` in `statement_parser.py` is particularly dangerous: if two users upload statements simultaneously with different date formats, one user's format detection could bleed into the other's parsing.

**Recommendation:**
- Move API key caching into the database settings layer (which is already database-backed).
- Replace `_detected_date_format` with a function parameter instead of mutable global state.
- Use `threading.Lock` or `contextvars` if mutable globals are truly needed.

---

#### 7.2 Unbounded In-Memory Caches
| Severity | Location |
|----------|----------|
| :yellow_circle: Important | `/backend/services/ai_insights.py:38`, `/backend/services/news_fetcher.py:18` |

In-memory cache dictionaries can grow without bound:

```python
# ai_insights.py line 38 - pruned at >1000 entries, but only 100 at a time
_categorization_cache: Dict[str, Tuple[Dict, datetime]] = {}

# news_fetcher.py line 18 - pruned at >50 entries, but only expired ones
_news_cache: Dict[str, tuple] = {}
```

The `ai_insights.py` cache has a soft limit of 1000 entries, which is reasonable. The `news_fetcher.py` cache only prunes expired entries when it exceeds 50 items -- if entries never expire (cache TTL not reached), the dict grows indefinitely.

**Recommendation:** Use `functools.lru_cache` or `cachetools.TTLCache` for bounded, thread-safe caching.

---

### 8. Security Concerns

#### 8.1 Plaid Access Token Returned to Frontend
| Severity | Location |
|----------|----------|
| :red_circle: Critical | `/backend/api/plaid.py:84-89` |

The Plaid `exchange_public_token` endpoint returns the `access_token` directly to the frontend client:

```python
# plaid.py lines 84-89
# TODO: Save access_token and item_id to database associated with the user
# For now, we will return them (NOT SECURE FOR PRODUCTION - PROTOTYPE ONLY)
return {"access_token": access_token, "item_id": item_id}
```

The Plaid access token grants full read access to the user's linked bank account. Exposing it to the frontend is a serious security risk -- any XSS vulnerability or browser extension could steal it.

**Recommendation:** Store the access token server-side (encrypted in the database) and never expose it to the frontend. The `balance` endpoint (`/balance/{access_token}` at line 95) also passes the token as a URL parameter, which is logged in server access logs and browser history.

---

#### 8.2 API Keys Stored as Plaintext in SQLite
| Severity | Location |
|----------|----------|
| :yellow_circle: Important | `/backend/models.py:180-184`, `/backend/api/settings.py:166-176` |

API keys (OpenAI, Groq, Claude, RentCast, etc.) are stored as plaintext strings in the `AppSettings` table:

```python
# models.py lines 180-184
class AppSettings(BaseModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    key: str = Field(index=True, unique=True)
    value: Optional[str] = None
    is_secret: bool = Field(default=False)
```

While the settings API masks secrets in responses (`mask_secret()` in `settings.py:43-47`), the raw values are stored unencrypted in the SQLite database file. Anyone with file system access to `networth_v2.db` can read all API keys.

**Recommendation:** Encrypt secret values before storing them. Use `cryptography.fernet` or a similar symmetric encryption scheme with a key derived from a user-provided passphrase or environment variable.

---

#### 8.3 No CORS Configuration
| Severity | Location |
|----------|----------|
| :yellow_circle: Important | `/backend/main.py` (entire file) |

The FastAPI app has no CORS middleware configured. While this works when the frontend proxies API calls through Next.js server-side, any direct browser-to-backend communication would be blocked by default in some configurations, or worse, unrestricted if a middleware is added later without proper origin restrictions.

---

### 9. Deprecated API Usage

#### 9.1 `datetime.utcnow()` Used Throughout
| Severity | Location |
|----------|----------|
| :yellow_circle: Important | 54 occurrences across 14 files |

`datetime.utcnow()` is deprecated since Python 3.12. It returns a naive datetime (no timezone info), which can lead to subtle bugs when comparing with timezone-aware datetimes.

Top occurrences by file:
| File | Count |
|------|-------|
| `/backend/services/market_data.py` | 9 |
| `/backend/api/budget.py` | 7 |
| `/backend/services/property_valuation.py` | 6 |
| `/backend/api/accounts.py` | 5 |
| `/backend/api/liabilities.py` | 5 |
| `/backend/models.py` | 5 (in `default_factory`) |

```python
# models.py line 6 - affects all model timestamps
class BaseModel(SQLModel):
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
```

**Recommendation:** Replace with `datetime.now(datetime.timezone.utc)` or use a helper function:
```python
from datetime import datetime, timezone
def utcnow():
    return datetime.now(timezone.utc)
```

---

### 10. Resource Cleanup

#### 10.1 PDF Documents Not Closed on Error Path
| Severity | Location |
|----------|----------|
| :blue_circle: Nice-to-have | `/backend/services/statement_parser.py:589-611`, `614-632` |

`convert_pdf_to_images` and `extract_pdf_text` open a PyMuPDF document and close it in the happy path, but if an exception occurs between `fitz.open()` and `pdf_document.close()`, the document handle leaks:

```python
# statement_parser.py lines 595-606
pdf_document = fitz.open(stream=file_content, filetype="pdf")
# ... processing that could raise ...
pdf_document.close()  # Only reached on success
```

**Recommendation:** Use a context manager or try/finally to ensure cleanup:
```python
pdf_document = fitz.open(stream=file_content, filetype="pdf")
try:
    # ... processing ...
finally:
    pdf_document.close()
```

---

### 11. Fresh Installation & Version Management

#### 11.1 Hardcoded Common Tickers List
| Severity | Location |
|----------|----------|
| :blue_circle: Nice-to-have | `/backend/services/market_data.py:47-56` |

The security search function includes a hardcoded list of ~40 common tickers used as a fallback when yfinance search fails:

```python
common_tickers = [
    "AAPL", "MSFT", "GOOGL", "AMZN", "META", "TSLA", "NVDA", "AMD", "INTC",
    "JPM", "BAC", "WFC", "GS", "MS", "V", "MA", "PYPL",
    ...
]
```

This list will become stale over time (tickers delist, new prominent tickers emerge). It is also not configurable.

---

#### 11.2 Hardcoded Sector Ticker Mappings
| Severity | Location |
|----------|----------|
| :blue_circle: Nice-to-have | `/backend/services/news_fetcher.py:105-123` |

```python
tech_tickers = {"AAPL", "MSFT", "GOOGL", "GOOG", "META", "AMZN", "NVDA", "TSLA", "AMD", "INTC", "CRM", "NFLX"}
finance_tickers = {"JPM", "BAC", "GS", "MS", "WFC", "V", "MA", "AXP", "BRK.B", "BRK.A"}
health_tickers = {"JNJ", "UNH", "PFE", "MRK", "ABT", "TMO", "ABBV", "LLY"}
energy_tickers = {"XOM", "CVX", "COP", "EOG", "SLB", "PSX"}
```

These mappings are static and incomplete. The sector data is actually available from yfinance via `SecurityInfo.sector` which is already being stored in the database, making this hardcoded mapping redundant.

---

#### 11.3 Overlapping Category Keywords
| Severity | Location |
|----------|----------|
| :blue_circle: Nice-to-have | `/backend/services/categorizer.py:10-56` |

Several merchants appear in multiple categories:
- `"walmart"`, `"target"`, `"costco"` appear in both **Food & Dining** (line 23-24) and **Shopping** (line 36-37).
- `"spotify"`, `"hulu"`, `"disney"`, `"apple"` appear in both **Entertainment** (line 43-44) and **Subscriptions** (line 52-53).

The categorizer returns the highest-scoring match, but when the same keyword matches two categories with the same keyword length, the result depends on dictionary iteration order.

**Recommendation:** Remove duplicates or add disambiguation logic (e.g., amount-based: small recurring charges = Subscriptions, larger one-time = Shopping).

---

#### 11.4 Version Hardcoded in Root Endpoint
| Severity | Location |
|----------|----------|
| :blue_circle: Nice-to-have | `/backend/main.py:55` |

```python
@app.get("/")
def read_root():
    return {"message": "Networth Pro API is running", "version": "2.0.0"}
```

The version string is hardcoded. Consider extracting it to a `__version__` variable or reading from `pyproject.toml` / `setup.cfg`.

---

### 12. Frontend-Specific Issues

#### 12.1 No Shared Fetch Utility
| Severity | Location |
|----------|----------|
| :yellow_circle: Important | `/frontend/lib/api.ts` (entire file) |

As noted in finding 1.1, every API function independently:
1. Calls `getBaseUrl()`
2. Constructs a fetch call with `cache: 'no-store'`
3. Checks `res.ok`
4. Handles errors with `console.error`
5. Returns a fallback value (`null`, `[]`, etc.)

This means any change to error handling, authentication headers, retry logic, or base URL logic requires modifying 60+ functions.

---

#### 12.2 Error Details Discarded
| Severity | Location |
|----------|----------|
| :yellow_circle: Important | `/frontend/lib/api.ts` (all fetch functions) |

Every API function catches errors and returns a silent fallback:

```typescript
} catch (error) {
    console.error(error);
    return null;  // or [] or {}
}
```

The actual HTTP status code and error message from the backend are never propagated to the UI. Users see empty states with no indication of what went wrong (network error? auth failure? server error?).

---

### 13. Miscellaneous

#### 13.1 MD5 Used for Cache Keys
| Severity | Location |
|----------|----------|
| :blue_circle: Nice-to-have | `/backend/services/ai_insights.py:104`, `/backend/services/news_fetcher.py:172` |

```python
# ai_insights.py line 104
return hashlib.md5(normalized.encode()).hexdigest()

# news_fetcher.py line 172
cache_key = hashlib.md5(cache_input.encode()).hexdigest()
```

MD5 is not a security concern here (it is only used for cache key generation, not authentication), but it is flagged by many security scanners and linting tools. Using `hashlib.sha256` or even a simpler hash avoids false-positive alerts.

---

#### 13.2 Top-Level Imports in Module Scope for Plaid
| Severity | Location |
|----------|----------|
| :yellow_circle: Important | `/backend/api/plaid.py:1-41` |

The Plaid module imports and initializes the Plaid client at module scope (lines 1-41). If the `plaid` package is not installed, importing this module causes the entire application to fail at startup -- even though Plaid is an optional integration.

```python
# plaid.py lines 4-11 - these run at import time
import plaid
from plaid.api import plaid_api
...
api_client = plaid.ApiClient(configuration)  # Line 40 - runs at import
client = plaid_api.PlaidApi(api_client)       # Line 41 - runs at import
```

**Recommendation:** Wrap Plaid initialization in a lazy-loading pattern or guard with a try/except ImportError.

---

#### 13.3 `Liability` Model Missing Fields Used by API
| Severity | Location |
|----------|----------|
| :yellow_circle: Important | `/backend/models.py:19-24` vs `/backend/api/liabilities.py:22-25` |

The `LiabilityCreate` schema accepts `interest_rate`, `minimum_payment`, and `due_date`, but the `Liability` model does not have these fields:

```python
# models.py - Liability model
class Liability(BaseModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(index=True, unique=True)
    category: Optional[str] = None
    currency: str = Field(default="USD")
    tags: Optional[str] = None
    # Missing: interest_rate, minimum_payment, due_date

# liabilities.py - API schema accepts these fields
class LiabilityCreate(BaseModel):
    ...
    interest_rate: Optional[float] = None
    minimum_payment: Optional[float] = None
    due_date: Optional[int] = None
```

These fields are accepted by the API but silently discarded because they have no corresponding model columns. The `LiabilityResponse` schema also declares these fields, but they can never be populated.

---

## Summary Table

| # | Finding | Severity | Files Affected |
|---|---------|----------|----------------|
| 4.1 | Bare `except Exception: pass` swallows errors | :red_circle: Critical | `market_data.py` |
| 5.1 | SQL injection risk via f-string in ALTER TABLE | :red_circle: Critical | `main.py` |
| 7.1 | Global mutable state without synchronization | :red_circle: Critical | `ai_provider.py`, `property_valuation.py`, `statement_parser.py`, `news_fetcher.py` |
| 8.1 | Plaid access token returned to frontend | :red_circle: Critical | `plaid.py` |
| 1.1 | Monolithic 1965-line frontend API client | :yellow_circle: Important | `frontend/lib/api.ts` |
| 2.1 | N+1 query pattern in list endpoints | :yellow_circle: Important | `accounts.py`, `liabilities.py` |
| 4.2 | `print()` used instead of `logging` | :yellow_circle: Important | `market_data.py`, `statement_parser.py`, `plaid.py`, `migration.py` |
| 4.3 | `time.sleep()` blocking async event loop | :yellow_circle: Important | `ai_insights.py` |
| 5.2 | Multiple `session.commit()` per operation | :yellow_circle: Important | `property_valuation.py`, `accounts.py`, `liabilities.py` |
| 5.3 | No WAL mode or connection pool config for SQLite | :yellow_circle: Important | `database.py` |
| 5.4 | Relative database path depends on CWD | :yellow_circle: Important | `database.py` |
| 5.5 | No cascade deletes on foreign keys | :yellow_circle: Important | `models.py` |
| 6.1 | No migration framework (manual ALTER TABLE) | :yellow_circle: Important | `main.py` |
| 7.2 | Unbounded in-memory caches | :yellow_circle: Important | `ai_insights.py`, `news_fetcher.py` |
| 8.2 | API keys stored as plaintext in SQLite | :yellow_circle: Important | `models.py`, `settings.py` |
| 8.3 | No CORS configuration | :yellow_circle: Important | `main.py` |
| 9.1 | Deprecated `datetime.utcnow()` (54 occurrences) | :yellow_circle: Important | 14 files |
| 12.1 | No shared fetch utility in frontend | :yellow_circle: Important | `frontend/lib/api.ts` |
| 12.2 | Frontend discards error details | :yellow_circle: Important | `frontend/lib/api.ts` |
| 13.2 | Plaid module fails application startup if not installed | :yellow_circle: Important | `plaid.py` |
| 13.3 | Liability model missing fields accepted by API | :yellow_circle: Important | `models.py`, `liabilities.py` |
| 1.2 | Flat backend API directory structure | :blue_circle: Nice-to-have | `backend/api/` |
| 1.3 | All models in single file | :blue_circle: Nice-to-have | `models.py` |
| 2.2 | Duplicate CRUD boilerplate | :blue_circle: Nice-to-have | `accounts.py`, `liabilities.py` |
| 2.3 | Duplicate AI client code | :blue_circle: Nice-to-have | `ai_provider.py` |
| 3.1 | Unused `os` import | :blue_circle: Nice-to-have | `ai_insights.py` |
| 3.2 | Unused `base64` import | :blue_circle: Nice-to-have | `statement_parser.py` |
| 3.3 | Late import of `json` in function body | :blue_circle: Nice-to-have | `statement_parser.py` |
| 10.1 | PDF document not closed on error path | :blue_circle: Nice-to-have | `statement_parser.py` |
| 11.1 | Hardcoded common tickers list | :blue_circle: Nice-to-have | `market_data.py` |
| 11.2 | Hardcoded sector ticker mappings | :blue_circle: Nice-to-have | `news_fetcher.py` |
| 11.3 | Overlapping category keywords | :blue_circle: Nice-to-have | `categorizer.py` |
| 11.4 | Hardcoded version string | :blue_circle: Nice-to-have | `main.py` |
| 13.1 | MD5 used for cache keys | :blue_circle: Nice-to-have | `ai_insights.py`, `news_fetcher.py` |

**Totals:** 4 Critical, 17 Important, 12 Nice-to-have

---

## Recommended Priority Order

1. **Immediate** (before next feature work):
   - Fix bare `except` clauses in `market_data.py` (4.1)
   - Store Plaid access tokens server-side (8.1)
   - Replace `print()` with `logging` throughout (4.2)

2. **Short-term** (next sprint):
   - Eliminate global mutable state for API keys (7.1)
   - Add WAL mode and connection pooling to SQLite (5.3)
   - Fix `_detected_date_format` thread-safety in statement parser (7.1)
   - Consolidate `session.commit()` calls (5.2)
   - Add missing Liability model fields (13.3)

3. **Medium-term** (planned refactoring):
   - Adopt Alembic for migrations (6.1)
   - Extract shared fetch utility in frontend (1.1, 12.1)
   - Replace `datetime.utcnow()` project-wide (9.1)
   - Add cascade deletes to foreign keys (5.5)
   - Encrypt stored API keys (8.2)

---

*End of audit report.*
