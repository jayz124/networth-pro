# Fresh Install Audit Report

**Audit Type:** Desktop App Distribution -- Fresh Install Specialist
**Project:** Networth Pro
**Project Root:** `/Users/jacobzachariah/Desktop/Projects/networth-pro/`
**Auditor:** fresh-install-audit (networth-pro-review team)
**Date:** 2026-02-10
**Commit:** `17253cb feat: multi-AI provider support with auto-fallback and richer insights`

---

## Executive Summary

Networth Pro is a personal finance application with a FastAPI/SQLite backend and a Next.js frontend that currently runs as two separate dev servers. **There is no packaging, installer, or desktop distribution mechanism** -- no DMG, no Electron wrapper, no Docker setup, no build scripts. A fresh user must manually clone the repo, set up a Python virtualenv, install Node dependencies, and start both servers by hand.

When both servers are running, the application handles an empty database reasonably well: the dashboard displays $0 across all metrics, each section-specific page shows a friendly empty state with a CTA button, and AI features gracefully degrade to rule-based insights. However, there are **4 critical findings** related to database path inconsistencies, missing backend endpoints called by the frontend, a startup-time crash risk from Plaid, and an unresolvable relative database path. There are also **8 important findings** and **6 nice-to-have observations** detailed below.

The most urgent items for any distribution scenario are: fixing the database location to use an absolute, deterministic path; removing or guarding the Plaid module-level client initialization; implementing the three settings endpoints the frontend expects (reset, export, import); and resolving the database name mismatch between `main.py` and `database.py`.

---

## First-Run Walkthrough

### Step 1: Installation (Manual)

A new user would follow the README instructions:

```bash
cd backend && python -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt
cd frontend && npm install
```

**What happens:** Python 3.9+ is required (SQLModel uses modern typing). The `requirements.txt` includes `plaid-python==38.1.0` (exact pin), `alembic>=1.13.0` (never used), and AI provider packages that are optional but installed unconditionally.

### Step 2: Start Backend

```bash
cd backend && uvicorn main:app --reload
```

**What happens on first launch:**
1. Python imports `main.py` (line 34) which imports all API routers including `api/plaid.py`
2. `api/plaid.py` lines 19-24 execute at import time: reads `PLAID_CLIENT_ID` and `PLAID_SECRET` from env vars, prints `"WARNING: Plaid credentials not found in environment variables."` to stdout, then initializes a Plaid API client with empty credentials (lines 32-41)
3. The FastAPI lifespan handler calls `init_db()` which creates `networth_v2.db` in the **current working directory** (wherever `uvicorn` was invoked from)
4. `_ensure_property_columns()` looks for `networth.db` (a different filename!) in the backend directory -- on fresh install this file won't exist, so it returns silently

### Step 3: Start Frontend

```bash
cd frontend && npm run dev
```

**What happens:** Next.js starts on port 3000. The proxy rewrite in `next.config.ts` forwards `/api/*` to `http://127.0.0.1:8000/api/*`.

### Step 4: User Opens Browser

**Dashboard (/):** Server-side component fetches `fetchNetWorth()` and `fetchHistory()`. Both return empty arrays/zeroes. Displays:
- Net Worth: $0
- Total Assets: $0 with "0 active accounts"
- Total Liabilities: $0 with "0 outstanding debts"
- Empty "Top Assets" section with friendly placeholder
- AI Insights card makes a call to `/dashboard/ai/insights` -- returns rule-based fallback insights (generic positive messages since no data exists)
- Financial Stories card calls `/dashboard/ai/stories` -- returns rule-based stories

**Assets (/assets):** Shows loading spinner, then "No accounts yet" with "Add Your First Account" button. Works correctly.

**Liabilities (/liabilities):** Shows "No liabilities yet" with CTA button. Works correctly.

**Portfolio (/portfolio):** Empty state handled.

**Real Estate (/real-estate):** Shows "No properties yet" with CTA button. Works correctly.

**Budget (/budget):** On first load, calls `GET /budget/categories` which auto-seeds 10 default categories. Works correctly.

**Retirement (/retirement):** Loads with `DEFAULT_CONFIG` / `ESSENTIAL_DEFAULT_CONFIG`. Auto-syncs from portfolio/accounts (all empty). Shows projection charts with default values. Works correctly.

**Settings (/settings):** Shows all settings keys with "Not configured" status. AI provider dropdown defaults to Groq. **Contains Reset Database, Export Data, and Import Data buttons that call non-existent backend endpoints** -- clicking them will fail silently (returns error toast).

---

## Findings by Category

### 1. Database Initialization and Path Issues

#### Finding 1.1: Relative Database Path Creates CWD-Dependent Database Location
**Severity:** :red_circle: Critical

The database file is created in whatever directory the server process starts from, not in a deterministic location.

**File:** `/Users/jacobzachariah/Desktop/Projects/networth-pro/backend/core/database.py`
**Lines:** 5-7

```python
sqlite_file_name = "networth_v2.db"
# Use absolute path relative to where we run the server, or just nice local path
sqlite_url = f"sqlite:///{sqlite_file_name}"
```

The comment acknowledges this is a relative path. `sqlite:///networth_v2.db` resolves to `{CWD}/networth_v2.db`. If a user runs `uvicorn main:app` from `/Users/user/` instead of `/Users/user/networth-pro/backend/`, the database will be created in their home directory. Subsequent launches from a different directory would create a second, empty database -- making it appear as though all data was lost.

**Impact:** Data loss perception or actual data fragmentation on fresh install depending on how the server is started.

**Recommended Fix:** Use an absolute path derived from the backend directory:
```python
import os
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sqlite_file_name = os.path.join(BASE_DIR, "data", "networth_v2.db")
```

---

#### Finding 1.2: Database Name Mismatch Between `main.py` and `database.py`
**Severity:** :red_circle: Critical

The startup migration helper references a different database file than the one actually used.

**File:** `/Users/jacobzachariah/Desktop/Projects/networth-pro/backend/main.py`
**Lines:** 7-12

```python
def _ensure_property_columns():
    """Add new columns to existing Property table (SQLite ALTER TABLE)."""
    import os
    db_path = os.path.join(os.path.dirname(__file__), "networth.db")
    if not os.path.exists(db_path):
        return
```

This function looks for `networth.db` while `database.py` creates and uses `networth_v2.db`. On a fresh install, `networth.db` will never exist, so `_ensure_property_columns()` is a silent no-op. This is harmless for fresh installs (the columns are already defined in the model), but if a user upgrades from v1 to v2 and has their old `networth.db` in the backend directory, the migration path is broken -- it won't find the v2 database.

**Impact:** The `_ensure_property_columns` migration will never run on the actual database. Harmless for fresh installs but broken for upgrades.

---

### 2. Missing Backend Endpoints (Frontend-Backend Contract)

#### Finding 2.1: Settings Page Calls Three Non-Existent Backend Endpoints
**Severity:** :red_circle: Critical

The settings page UI has fully functional buttons for Reset Database, Export Data, and Import Data that call backend endpoints which do not exist.

**File:** `/Users/jacobzachariah/Desktop/Projects/networth-pro/frontend/lib/api.ts`
**Lines:** 916-974

```typescript
export async function resetDatabase(): Promise<{ success: boolean; message: string }> {
    // ...
    const res = await fetch(`${baseUrl}/api/v1/settings/reset-database`, { method: 'POST' });
    // ...
}

export async function exportData(): Promise<Blob | null> {
    // ...
    const res = await fetch(`${baseUrl}/api/v1/settings/export`, { method: 'GET' });
    // ...
}

export async function importData(file: File): Promise<{ success: boolean; message: string }> {
    // ...
    const res = await fetch(`${baseUrl}/api/v1/settings/import`, { method: 'POST', body: formData });
    // ...
}
```

**File:** `/Users/jacobzachariah/Desktop/Projects/networth-pro/frontend/app/settings/page.tsx`
**Lines:** 228-293 (handler functions that call these APIs)

**File:** `/Users/jacobzachariah/Desktop/Projects/networth-pro/backend/api/settings.py`
(No `/settings/reset-database`, `/settings/export`, or `/settings/import` endpoints defined -- only GET/PUT/DELETE for individual settings keys)

**Impact:** A fresh-install user who clicks "Reset Database", "Export Data", or "Import Data" will get an error toast. The Export Data feature is especially important for backup/restore in a personal finance app. The Reset Database confirmation dialog (lines 830-856 in settings page) includes a warning about irreversible data loss, but the action will simply fail with a 404.

---

### 3. Startup and Dependency Issues

#### Finding 3.1: Plaid Module Initializes API Client at Import Time Without Credentials
**Severity:** :red_circle: Critical

The Plaid API module creates a full API client at module import time, even when credentials are absent.

**File:** `/Users/jacobzachariah/Desktop/Projects/networth-pro/backend/api/plaid.py`
**Lines:** 19-41

```python
PLAID_CLIENT_ID = os.getenv("PLAID_CLIENT_ID")
PLAID_SECRET = os.getenv("PLAID_SECRET")
PLAID_ENV = os.getenv("PLAID_ENV", "sandbox")

if not PLAID_CLIENT_ID or not PLAID_SECRET:
    print("WARNING: Plaid credentials not found in environment variables.")

host = plaid.Environment.Sandbox
# ... environment selection ...

configuration = plaid.Configuration(
    host=host,
    api_key={
        'clientId': PLAID_CLIENT_ID or "",
        'secret': PLAID_SECRET or "",
    }
)

api_client = plaid.ApiClient(configuration)
client = plaid_api.PlaidApi(api_client)
```

This code runs on every server start. The `print("WARNING: ...")` on line 24 outputs to stdout on every fresh install. More importantly, if the `plaid` Python package fails to initialize with empty string credentials (depending on the version), this could cause an import error that crashes the entire backend. The `plaid.Configuration` and `plaid.ApiClient` constructors are being called with empty strings, which may or may not raise exceptions depending on the library version.

Additionally, the Plaid router uses a different prefix pattern (`/api/plaid`) than all other routers (`/api/v1/...`), making it inconsistent.

**File:** `/Users/jacobzachariah/Desktop/Projects/networth-pro/backend/main.py`
**Line:** 51

```python
app.include_router(plaid.router)  # /api/plaid prefix is defined in the router itself
```

**Impact:** Every fresh install will see a WARNING message in the terminal. If the Plaid library version changes validation behavior, the entire backend could fail to start.

---

#### Finding 3.2: Alembic Listed as Dependency but Never Configured
**Severity:** :yellow_circle: Important

**File:** `/Users/jacobzachariah/Desktop/Projects/networth-pro/backend/requirements.txt`
**Line:** 5

```
alembic>=1.13.0
```

Alembic is installed but there is no `alembic.ini`, no `alembic/` directory, and no migration scripts. The project relies entirely on `SQLModel.metadata.create_all(engine)` for schema creation (which cannot handle column additions, renames, or deletions on existing databases) plus the manual `_ensure_property_columns()` function for one specific ALTER TABLE.

**Impact:** Fresh installs work fine. Future schema changes have no migration path -- manual ALTER TABLE statements will be needed for each change.

---

#### Finding 3.3: `python-jose` and `passlib` Dependencies Are Installed but Never Used
**Severity:** :yellow_circle: Important

**File:** `/Users/jacobzachariah/Desktop/Projects/networth-pro/backend/requirements.txt`
**Lines:** 7-8

```
python-jose[cryptography]>=3.3.0
passlib[bcrypt]>=1.7.4
```

These authentication-related packages are installed but not imported anywhere in the codebase. There is no authentication layer in the application. These add unnecessary install time and potential security surface.

**Impact:** Bloated dependency install on fresh setup. No functional impact.

---

#### Finding 3.4: No `.env.example` or Environment Variable Documentation
**Severity:** :yellow_circle: Important

The Plaid integration requires `PLAID_CLIENT_ID`, `PLAID_SECRET`, and optionally `PLAID_ENV` as environment variables, but there is no `.env.example` file, no documentation in the README about required or optional environment variables, and no `.env` file in the repository.

**Impact:** A fresh-install user has no guidance on what environment variables exist or how to configure them. The Plaid warning message provides no actionable next steps.

---

### 4. Zero-Data Handling (Per Page)

#### Finding 4.1: Dashboard Handles Zero Data Gracefully
**Severity:** No issue

**File:** `/Users/jacobzachariah/Desktop/Projects/networth-pro/frontend/app/page.tsx`
**Lines:** 17-19

```typescript
const netWorth = data?.net_worth ?? 0;
const assets = data?.total_assets ?? 0;
const liabilities = data?.total_liabilities ?? 0;
```

The dashboard uses null coalescing (`??`) and optional chaining (`?.`) throughout. Empty states show "0 active accounts" and "0 outstanding debts". The "Top Assets" section shows a friendly "No assets found / Add your first asset to get started" message (lines 123-129). AI Insights and Financial Stories cards have their own loading states and fall back to rule-based content.

---

#### Finding 4.2: All CRUD Pages Show Empty States with CTAs
**Severity:** No issue

Every major section page handles the empty state properly:

- **Assets** (`/Users/jacobzachariah/Desktop/Projects/networth-pro/frontend/app/assets/page.tsx`, lines 96-108): "No accounts yet" with "Add Your First Account" button
- **Liabilities** (`/Users/jacobzachariah/Desktop/Projects/networth-pro/frontend/app/liabilities/page.tsx`, lines 96-108): "No liabilities yet" with "Add Your First Liability" button
- **Real Estate** (`/Users/jacobzachariah/Desktop/Projects/networth-pro/frontend/app/real-estate/page.tsx`, lines 107-121): "No properties yet" with "Add Your First Property" button

All pages show a loading spinner while data is being fetched, then transition to the empty state with appropriate icons and encouraging copy.

---

#### Finding 4.3: Budget Categories Auto-Seed on First Access
**Severity:** No issue (Good design)

**File:** `/Users/jacobzachariah/Desktop/Projects/networth-pro/backend/api/budget.py`
**Lines:** 100-108

```python
# If no categories exist, seed default ones
if not categories:
    for cat_data in DEFAULT_CATEGORIES:
        cat = BudgetCategory(**cat_data)
        session.add(cat)
    session.commit()
    categories = session.exec(
        select(BudgetCategory).order_by(BudgetCategory.name)
    ).all()
```

Ten default budget categories (Salary, Housing, Food & Dining, Transportation, Utilities, Shopping, Entertainment, Healthcare, Subscriptions, Other) are created on the first `GET /budget/categories` call. This is well-implemented lazy seeding.

---

#### Finding 4.4: AI Features Degrade Gracefully to Rule-Based Insights
**Severity:** No issue (Good design)

When no AI API key is configured (the default on fresh install):

- **Dashboard insights** (`/Users/jacobzachariah/Desktop/Projects/networth-pro/backend/api/dashboard_ai.py`): `generate_dashboard_insights()` returns rule-based insights analyzing the user's actual data (portfolio concentration, real estate equity, debt ratios) or generic positive messages if no data exists.
- **Dashboard stories** (`/Users/jacobzachariah/Desktop/Projects/networth-pro/backend/api/dashboard_ai.py`): `generate_financial_stories()` returns 3 rule-based narrative stories.
- **Budget insights** (`/Users/jacobzachariah/Desktop/Projects/networth-pro/backend/api/budget_ai.py`): `generate_spending_insights()` provides rule-based spending analysis.
- **Transaction categorization**: Falls back to keyword-based matching in `services/categorizer.py`.

The `is_ai_available()` check is consistently used before attempting AI calls, and all AI endpoints return the `ai_powered: false` flag so the frontend can show appropriate messaging.

---

### 5. Configuration and Settings

#### Finding 5.1: Exchange Rate Fallback Only Covers 10 of 29 Supported Currencies
**Severity:** :yellow_circle: Important

**File:** `/Users/jacobzachariah/Desktop/Projects/networth-pro/frontend/lib/settings-context.tsx`
**Lines:** 81-96

```typescript
const FALLBACK_RATES: ExchangeRates = {
    base: "USD",
    rates: {
        USD: 1, EUR: 0.92, GBP: 0.79, JPY: 149.50, CAD: 1.36,
        AUD: 1.53, CHF: 0.88, CNY: 7.24, INR: 83.12, SGD: 1.34,
    },
    lastUpdated: new Date().toISOString(),
}
```

The application supports 29 currencies (defined in `CURRENCIES` array, lines 12-42), but the fallback exchange rates only cover 10 of them. If the Frankfurter API is unreachable on first launch and the user selects BRL, MXN, ZAR, THB, MYR, IDR, PHP, PLN, TRY, RUB, ILS, HKD, NZD, SEK, NOK, DKK, AED, SAR, or KRW, the `convertFromUSD` function (lines 210-218) will find no rate and return the USD value unconverted:

```typescript
const rate = exchangeRates.rates[settings.currency.code]
if (!rate) {
    return valueInUSD  // Falls back to showing USD value
}
```

**Impact:** Users who choose a currency not in the fallback set and have no internet will see USD values without any currency conversion. No error is shown.

---

#### Finding 5.2: Frontend and Backend Version Numbers Are Inconsistent
**Severity:** :yellow_circle: Important

Three different version numbers exist across the codebase:

| Location | Version | File | Line |
|----------|---------|------|------|
| README.md title | v1.3.5 | `/Users/jacobzachariah/Desktop/Projects/networth-pro/README.md` | 1 |
| Settings page "About" | 1.3.6 | `/Users/jacobzachariah/Desktop/Projects/networth-pro/frontend/app/settings/page.tsx` | 877 |
| Backend root endpoint | 2.0.0 | `/Users/jacobzachariah/Desktop/Projects/networth-pro/backend/main.py` | 55 |

**Impact:** Confusing for users and developers. Version should be centralized in a single source of truth.

---

#### Finding 5.3: Plaid Router Uses Inconsistent URL Prefix
**Severity:** :yellow_circle: Important

**File:** `/Users/jacobzachariah/Desktop/Projects/networth-pro/backend/api/plaid.py`
**Line:** 16

```python
router = APIRouter(prefix="/api/plaid", tags=["plaid"])
```

**File:** `/Users/jacobzachariah/Desktop/Projects/networth-pro/backend/main.py`
**Line:** 51

```python
app.include_router(plaid.router)  # /api/plaid prefix is defined in the router itself
```

All other routers use `prefix="/api/v1"` (lines 38-49 of main.py), but the Plaid router hardcodes `/api/plaid` as its prefix and is included without a prefix override. This means Plaid endpoints are at `/api/plaid/...` while everything else is at `/api/v1/...`.

Additionally, the Next.js proxy only rewrites `/api/:path*` to the backend (line 8-9 of `next.config.ts`), so this does work, but it's an inconsistency that could cause confusion during development.

**Impact:** API inconsistency. Not user-facing since Plaid integration is not yet exposed in the frontend UI.

---

### 6. Distribution and Packaging

#### Finding 6.1: No Packaging, Installer, or Distribution Mechanism Exists
**Severity:** :yellow_circle: Important

There are **zero** packaging or distribution artifacts in the project:

- No Electron/Tauri wrapper for desktop packaging
- No Dockerfile or docker-compose.yml
- No Makefile, build.sh, start.sh, or install.sh
- No pyproject.toml or setup.py for the backend
- No DMG build configuration
- No `.env.example` template

The README documents manual setup only (clone, venv, pip install, npm install, start both servers). For a "desktop app" distribution, there is no path from source code to installable artifact.

**Impact:** Users must be developers to install and run the application. There is no "fresh install" experience for non-technical users.

---

### 7. Migration and Upgrade Path

#### Finding 7.1: Migration Script Contains Hardcoded Developer Path
**Severity:** :large_blue_circle: Nice-to-have

**File:** `/Users/jacobzachariah/Desktop/Projects/networth-pro/backend/migration.py`
**Line:** 9

```python
LEGACY_DB_PATH = "/Users/jacobzachariah/Desktop/Projects/networth-app/networth.db"
```

This is an absolute path to the developer's machine. Any other user running this migration script will get "Error: Legacy database not found" immediately.

**Impact:** The migration script is unusable by anyone except the original developer. For fresh installs this is irrelevant since there's no legacy data.

---

### 8. Error Handling and Resilience

#### Finding 8.1: Backend Server Crash Shows Raw Error in Frontend
**Severity:** :large_blue_circle: Nice-to-have

If the backend server is not running or crashes, the frontend's server-side rendering in `page.tsx` calls `fetchNetWorth()` and `fetchHistory()` which catch errors and return null/empty arrays. The dashboard handles this gracefully (all values default to 0). However, client-side components like AI Insights and Financial Stories will show loading states indefinitely since their API calls fail silently.

**File:** `/Users/jacobzachariah/Desktop/Projects/networth-pro/frontend/app/page.tsx`
**Lines:** 11-14

```typescript
const [data, history] = await Promise.all([
    fetchNetWorth(),
    fetchHistory()
]);
```

These calls have try/catch wrappers in `api.ts` that return null on failure. The dashboard handles null gracefully.

**Impact:** If backend is down, the app shows $0 everywhere with loading spinners on AI cards -- no explicit error message telling the user to start the backend.

---

#### Finding 8.2: Statement Parser Uses Global Mutable State for Date Format Detection
**Severity:** :large_blue_circle: Nice-to-have

**File:** `/Users/jacobzachariah/Desktop/Projects/networth-pro/backend/services/statement_parser.py`
**Lines:** 65, 95, 118-124

```python
_detected_date_format: Optional[str] = None

def parse_date(date_str: str, format_hint: Optional[str] = None) -> Optional[datetime]:
    global _detected_date_format
    # ...

def set_date_format_hint(rows: List[List[str]], date_col: int):
    global _detected_date_format
    # ...
```

The date format detection uses a module-level global variable. If two users upload statements concurrently (one DD/MM, one MM/DD), the format hint from one request could leak into the other.

**Impact:** Potential date parsing errors in concurrent statement uploads. Low risk in a single-user personal finance app, but architecturally unsound.

---

#### Finding 8.3: News Fetcher Uses MD5 for Cache Key
**Severity:** :large_blue_circle: Nice-to-have

**File:** `/Users/jacobzachariah/Desktop/Projects/networth-pro/backend/services/news_fetcher.py`
**Line:** 172

```python
cache_key = hashlib.md5(cache_input.encode()).hexdigest()
```

MD5 is used for a non-security-critical cache key. This is technically fine but may trigger security scanners/linters in CI pipelines.

**Impact:** No security concern (not used for authentication or integrity). May cause false positives in security scans.

---

#### Finding 8.4: `datetime.utcnow()` Used Throughout Backend (Deprecated in Python 3.12+)
**Severity:** :large_blue_circle: Nice-to-have

**Files:** Multiple backend files use `datetime.utcnow()`:
- `/Users/jacobzachariah/Desktop/Projects/networth-pro/backend/models.py` line 6: `default_factory=datetime.utcnow`
- `/Users/jacobzachariah/Desktop/Projects/networth-pro/backend/api/settings.py` line 167: `setting.updated_at = datetime.utcnow()`
- `/Users/jacobzachariah/Desktop/Projects/networth-pro/backend/api/dashboard_ai.py` line 214: `seed = int(datetime.utcnow().strftime(...))`
- `/Users/jacobzachariah/Desktop/Projects/networth-pro/backend/services/market_data.py` lines 102, 132, 198
- `/Users/jacobzachariah/Desktop/Projects/networth-pro/backend/services/property_valuation.py` lines 133, 200, 254

`datetime.utcnow()` is deprecated since Python 3.12. The recommended replacement is `datetime.now(datetime.timezone.utc)`.

**Impact:** Deprecation warnings on Python 3.12+. No functional issue on Python 3.9-3.11.

---

#### Finding 8.5: Plaid Endpoint Exposes Access Token in URL Path
**Severity:** :large_blue_circle: Nice-to-have

**File:** `/Users/jacobzachariah/Desktop/Projects/networth-pro/backend/api/plaid.py`
**Line:** 95

```python
@router.get("/balance/{access_token}")
async def get_balance(access_token: str):
```

The Plaid access token is passed as a URL path parameter. URL path parameters are logged in server access logs, browser history, and network monitoring tools. The comment on lines 88-89 acknowledges this is a prototype:

```python
# TODO: Save access_token and item_id to database associated with the user
# For now, we will return them (NOT SECURE FOR PRODUCTION - PROTOTYPE ONLY)
```

**Impact:** Security concern if this ever reaches production. For a local-only fresh install, the risk is minimal since all traffic is on localhost.

---

### 9. First-Run Documentation

#### Finding 9.1: No Onboarding Flow or Getting Started Guide
**Severity:** :yellow_circle: Important

There is no in-app onboarding for a new user. After launching both servers and visiting `http://localhost:3000`, the user sees a dashboard with all zeroes and no guidance on where to start. The README provides technical setup instructions but no user journey documentation.

Other finance apps typically provide:
- A welcome modal or setup wizard
- "Get started" steps (1. Add an account, 2. Add your first balance, etc.)
- Tooltips on first visit

**Impact:** New users have to discover functionality by clicking through navigation. The empty dashboard provides no clear next step.

---

## Summary Table

| # | Finding | Severity | Category | File(s) |
|---|---------|----------|----------|---------|
| 1.1 | Relative database path creates CWD-dependent DB location | :red_circle: Critical | Database | `backend/core/database.py:5-7` |
| 1.2 | Database name mismatch (`networth.db` vs `networth_v2.db`) | :red_circle: Critical | Database | `backend/main.py:10` |
| 2.1 | Three settings endpoints called by frontend don't exist in backend | :red_circle: Critical | API Contract | `frontend/lib/api.ts:916-974`, `backend/api/settings.py` |
| 3.1 | Plaid module initializes API client at import time without credentials | :red_circle: Critical | Startup | `backend/api/plaid.py:19-41` |
| 3.2 | Alembic dependency installed but never configured | :yellow_circle: Important | Dependencies | `backend/requirements.txt:5` |
| 3.3 | `python-jose` and `passlib` installed but never used | :yellow_circle: Important | Dependencies | `backend/requirements.txt:7-8` |
| 3.4 | No `.env.example` or environment variable documentation | :yellow_circle: Important | Configuration | Project root |
| 5.1 | Exchange rate fallback covers only 10 of 29 currencies | :yellow_circle: Important | Configuration | `frontend/lib/settings-context.tsx:81-96` |
| 5.2 | Three different version numbers across codebase | :yellow_circle: Important | Configuration | Multiple files |
| 5.3 | Plaid router uses inconsistent URL prefix (`/api/plaid` vs `/api/v1`) | :yellow_circle: Important | API Design | `backend/api/plaid.py:16`, `backend/main.py:51` |
| 6.1 | No packaging, installer, or distribution mechanism | :yellow_circle: Important | Distribution | Project root |
| 9.1 | No onboarding flow or getting started guide | :yellow_circle: Important | UX | Frontend |
| 7.1 | Migration script has hardcoded developer path | :large_blue_circle: Nice-to-have | Migration | `backend/migration.py:9` |
| 8.1 | No explicit error when backend is down | :large_blue_circle: Nice-to-have | Error Handling | `frontend/app/page.tsx:11-14` |
| 8.2 | Statement parser uses global mutable state for date format | :large_blue_circle: Nice-to-have | Concurrency | `backend/services/statement_parser.py:65` |
| 8.3 | MD5 used for cache key (may trigger security scanners) | :large_blue_circle: Nice-to-have | Security | `backend/services/news_fetcher.py:172` |
| 8.4 | `datetime.utcnow()` deprecated in Python 3.12+ | :large_blue_circle: Nice-to-have | Compatibility | Multiple backend files |
| 8.5 | Plaid access token exposed in URL path | :large_blue_circle: Nice-to-have | Security | `backend/api/plaid.py:95` |

**Totals:** 4 :red_circle: Critical, 8 :yellow_circle: Important, 6 :large_blue_circle: Nice-to-have

---

## Priority Action Items

### Immediate (Before Any Distribution)

1. **Fix database path** -- Use an absolute path in `database.py` anchored to the backend directory (e.g., `backend/data/networth_v2.db`), and ensure the `data/` directory is created at startup
2. **Fix database name mismatch** -- Update `main.py:10` to reference `networth_v2.db` instead of `networth.db`
3. **Implement or remove settings endpoints** -- Either implement `POST /settings/reset-database`, `GET /settings/export`, `POST /settings/import` in the backend, or remove the buttons from the settings page
4. **Guard Plaid initialization** -- Wrap the Plaid client creation in a lazy initializer that only runs when Plaid endpoints are actually called, or make the entire Plaid module conditional on credentials being present

### Short-Term

5. Remove unused dependencies (`alembic`, `python-jose`, `passlib`) from `requirements.txt`
6. Add `.env.example` with documented environment variables
7. Expand fallback exchange rates to cover all 29 supported currencies
8. Centralize version number to a single constant
9. Add a welcome/onboarding experience for first-time users

### Long-Term

10. Add a proper migration system (Alembic or manual versioned scripts)
11. Create a packaging/distribution pipeline (Docker at minimum, Electron/Tauri for desktop)
12. Replace `datetime.utcnow()` with timezone-aware datetimes
