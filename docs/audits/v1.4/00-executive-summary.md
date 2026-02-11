# Networth Pro -- Executive Audit Summary

**Date:** 2026-02-10
**Audit Team:** networth-pro-review (5 specialists)
**Commit:** `17253cb` (main)
**Total Findings:** 129 across 5 audit reports

| Report | Auditor | Findings | Critical | Important | Nice-to-have |
|--------|---------|----------|----------|-----------|--------------|
| [01 - Code Quality](./01-code-quality.md) | Senior Python Engineer | 33 | 4 | 17 | 12 |
| [02 - UI/UX Design](./02-ui-ux-design.md) | UX Designer & Fintech Expert | 22 | 4 | 10 | 8 |
| [03 - Functionality](./03-functionality-testing.md) | QA Engineer | 25 | 5 | 12 | 8 |
| [04 - Perf & Security](./04-performance-security.md) | Security & Performance Engineer | 31 | 8 | 14 | 9 |
| [05 - Fresh Install](./05-fresh-install-audit.md) | Distribution Specialist | 18 | 4 | 8 | 6 |
| **TOTAL** | | **129** | **25** | **61** | **43** |

After deduplication (many issues were flagged independently by multiple auditors), the unique finding count is approximately **75-80 distinct issues**.

---

## Top 10 Most Critical Findings

These are the highest-impact issues that affect data correctness, security, or application functionality. Ranked by severity and blast radius.

### 1. No Authentication on Any API Endpoint
**Source:** Performance-Security (SEC-01) | Code Quality (8.3)
**Files:** `backend/main.py:38-51`
**Impact:** Any process on the local machine (or network) can read/write all financial data, delete accounts, and exfiltrate API keys. The auth dependencies (`python-jose`, `passlib`) are installed but never used.
**Effort:** Medium

### 2. No CORS Configuration
**Source:** Performance-Security (SEC-02) | Code Quality (8.3)
**Files:** `backend/main.py`
**Impact:** Any website visited by the user can make requests to `http://127.0.0.1:8000` and exfiltrate financial data and API keys. The Next.js proxy masks this in development, but the backend is directly accessible.
**Effort:** Small

### 3. Route Ordering Bugs -- 4+ Endpoints Completely Unreachable
**Source:** Functionality (2.1, 3.1) | Performance-Security (PERF-01, PERF-02)
**Files:** `backend/api/retirement.py:99,200` | `backend/api/real_estate.py:192,418` | `backend/api/accounts.py:132,275` | `backend/api/liabilities.py:135,274`
**Impact:** `GET /retirement/plans/active`, `GET /properties/summary`, `GET /accounts/summary`, and `GET /liabilities/summary` all return 422 errors because static routes are defined after parameterized `/{id}` routes. These are dead endpoints.
**Effort:** Small

### 4. Net Worth History Chart Shows Misleading Data
**Source:** Functionality (1.1) | Performance-Security (PERF-08)
**Files:** `backend/api/dashboard.py:180-218`
**Impact:** The net worth history endpoint applies today's portfolio and real estate values to ALL historical dates. A user who bought $500K of stocks last week sees $500K in investments going back years. The chart is driven solely by cash account balance changes.
**Effort:** Large

### 5. Plaid Access Token Exposed to Frontend and in URLs
**Source:** Code Quality (8.1) | Performance-Security (SEC-03) | Fresh Install (8.5)
**Files:** `backend/api/plaid.py:84-89,95-96`
**Impact:** The Plaid access token (which grants full bank account read access) is returned in API responses and accepted as a URL path parameter, exposing it in logs, browser history, and caches. Combined with no authentication, any local process can obtain banking credentials.
**Effort:** Medium

### 6. API Keys Stored as Plaintext in SQLite
**Source:** Code Quality (8.2) | Performance-Security (SEC-04) | Functionality (12.1)
**Files:** `backend/models.py:180-184` | `backend/api/settings.py:165-167`
**Impact:** All AI provider and service API keys (OpenAI, Groq, Claude, RentCast, etc.) are stored unencrypted in the SQLite database. Anyone with filesystem access can read them. The partial masking endpoint (SEC-05) also leaks first/last 4 characters without authentication.
**Effort:** Medium

### 7. No Input Validation on Financial Amounts
**Source:** Functionality (7.1)
**Files:** `backend/models.py` (all models) | `backend/api/real_estate.py:23` | `backend/api/portfolio.py:33`
**Impact:** Negative property values, negative share quantities, 1000% interest rates, and extremely large numbers are all accepted without constraint. This can corrupt net worth calculations and produce nonsensical results.
**Effort:** Small

### 8. No Multi-Currency Conversion in Server-Side Calculations
**Source:** Functionality (1.2, 6.1) | Fresh Install (5.1)
**Files:** `backend/api/dashboard.py:24-131`
**Impact:** The backend sums account balances, property values, and liabilities in different currencies as if they were all USD. A GBP account with 100 GBP is treated as $100. Currency conversion only happens client-side for display formatting. The fallback exchange rates also only cover 10 of 30 supported currencies.
**Effort:** Large

### 9. Frontend Settings Buttons Call Non-Existent Backend Endpoints
**Source:** Fresh Install (2.1)
**Files:** `frontend/lib/api.ts:916-974` | `frontend/app/settings/page.tsx:228-293`
**Impact:** Reset Database, Export Data, and Import Data buttons in Settings are fully wired in the frontend but the corresponding backend endpoints (`/settings/reset-database`, `/settings/export`, `/settings/import`) don't exist. Clicking them fails silently with an error toast.
**Effort:** Medium

### 10. Database Path Issues -- Relative Path + Name Mismatch
**Source:** Fresh Install (1.1, 1.2) | Code Quality (5.4)
**Files:** `backend/core/database.py:5-7` | `backend/main.py:10`
**Impact:** The database uses a relative path (CWD-dependent), meaning starting the server from a different directory creates a new empty database. Additionally, `main.py` references `networth.db` while `database.py` creates `networth_v2.db` -- the migration function operates on the wrong file.
**Effort:** Small

---

## Prioritized Fix Backlog

### Phase 1: Immediate / Before Next Release

| # | Issue | Source Reports | Effort | Priority Rationale |
|---|-------|---------------|--------|-------------------|
| 1 | Fix route ordering bugs (move static routes before `/{id}` routes) | Func, Perf-Sec | Small | 4 endpoints are completely broken |
| 2 | Add CORS middleware (restrict to `localhost:3000`) | Perf-Sec, Code | Small | Any website can exfiltrate data |
| 3 | Fix database path (absolute path + name mismatch) | Fresh, Code | Small | Data loss risk on mislaunch |
| 4 | Add input validation (`ge=0` on monetary fields) | Func | Small | Data integrity at risk |
| 5 | Fix Plaid access token handling (store server-side) | Code, Perf-Sec | Medium | Banking credentials exposed |
| 6 | Add basic authentication middleware | Perf-Sec | Medium | All data accessible without auth |
| 7 | Fix dividend yield NaN edge case | Func | Small | Retirement calc can produce garbage |
| 8 | Guard Plaid module-level initialization | Fresh, Code | Small | Startup warning / potential crash |

### Phase 2: Short-Term / Next Sprint

| # | Issue | Source Reports | Effort | Priority Rationale |
|---|-------|---------------|--------|-------------------|
| 9 | Fix net worth history (static values for all dates) | Func, Perf-Sec | Large | Most visible chart is misleading |
| 10 | Implement or remove settings endpoints (reset/export/import) | Fresh | Medium | Visible broken functionality |
| 11 | Fix N+1 query patterns (accounts, liabilities, dashboard) | Code, Perf-Sec | Medium | O(N) queries on every dashboard load |
| 12 | Add composite indexes on BalanceSnapshot | Perf-Sec | Small | Speeds up most-used queries |
| 13 | Encrypt API keys at rest | Code, Perf-Sec, Func | Medium | Plaintext secrets in database |
| 14 | Replace hardcoded `$` in chart formatters with `formatCompactCurrency` | UI/UX | Small | Multi-currency display broken in 4 charts |
| 15 | Standardize semantic color tokens (replace 40+ hardcoded Tailwind colors) | UI/UX | Medium | Design system inconsistency |
| 16 | Fix pre-retirement drawdown calculation | Func | Small | Overstates portfolio withdrawals |
| 17 | Fix portfolio P&L with missing cost basis | Func | Small | Understated/inflated gains |
| 18 | Replace `print()` with `logging` throughout | Code | Small | No structured log output |
| 19 | Fix bare `except: pass` in market_data.py | Code | Small | Silent failures in critical path |

### Phase 3: Medium-Term / Planned Refactoring

| # | Issue | Source Reports | Effort | Priority Rationale |
|---|-------|---------------|--------|-------------------|
| 20 | Implement backend FX conversion service | Func | Large | Server-side calcs ignore currency |
| 21 | Expand fallback exchange rates to all 30 currencies | Func, Fresh | Small | 20 currencies have no fallback |
| 22 | Adopt Alembic for database migrations | Code, Fresh | Medium | No migration versioning/rollback |
| 23 | Extract shared frontend API client utility | Code | Medium | 60+ duplicated fetch patterns |
| 24 | Add error boundaries and error states in frontend | UI/UX | Medium | API errors show blank/loading |
| 25 | Replace `datetime.utcnow()` with timezone-aware datetimes | Code, Func | Medium | 54 occurrences, deprecated in 3.12 |
| 26 | Fix stress test bond handling (separate crash factor) | Func | Small | Overly pessimistic simulations |
| 27 | Update Roth conversion end age (72 -> 73 per SECURE Act 2.0) | Func | Small | Off-by-one in tax strategy |
| 28 | Add mobile responsive design (tables, charts, grids) | UI/UX | Large | Limited responsive breakpoints |
| 29 | Standardize loading states (shared `<LoadingState />` component) | UI/UX | Small | 3 different loading patterns |
| 30 | Add rate limiting on sensitive endpoints | Perf-Sec | Small | No abuse protection |
| 31 | Eliminate global mutable state (API keys, date format) | Code | Medium | Thread-safety hazards |
| 32 | Add cascade deletes on foreign keys | Code | Small | Orphaned records possible |
| 33 | Consolidate `session.commit()` calls per operation | Code | Medium | Partial commits on failure |
| 34 | Enable SQLite WAL mode | Perf-Sec, Code | Small | Better concurrent read perf |
| 35 | Create shared chart tooltip and color palette | UI/UX | Small | 3 tooltip styles, generic colors |
| 36 | Add `.env.example` and environment variable docs | Fresh | Small | No guidance on configuration |
| 37 | Centralize version number | Fresh | Small | 3 different version strings |
| 38 | Replace emojis with Lucide icons in financial stories | UI/UX | Small | Inconsistent with design system |
| 39 | Standardize date types across models (str vs datetime) | Func | Medium | Mixed types cause parsing issues |
| 40 | Add frontend request timeouts (AbortController) | Perf-Sec | Small | Fetch calls can hang indefinitely |

### Phase 4: Feature Gaps & Polish

| # | Issue | Source Reports | Effort | Priority Rationale |
|---|-------|---------------|--------|-------------------|
| 41 | Implement Analytics / PDF report feature | Func | Large | Documented but absent |
| 42 | Implement Goals tracking feature | Func, UI/UX | Large | Documented but absent |
| 43 | Create packaging/distribution pipeline (Docker/Electron) | Fresh | Large | No path to installable artifact |
| 44 | Add onboarding flow for first-time users | Fresh | Medium | No guidance on empty app |
| 45 | Add user disclosure for AI data sharing | Perf-Sec | Small | Financial data sent to 3rd parties |
| 46 | Implement pagination on list endpoints | Perf-Sec | Small | Future-proofing |
| 47 | Fix Liability model missing fields (interest_rate, minimum_payment, due_date) | Code | Small | API accepts but silently discards |
| 48 | Validate ticker symbols with regex | Perf-Sec | Small | Unsanitized input to yfinance |
| 49 | Add portfolio sparklines to table | UI/UX | Medium | Wealthfront feature gap |
| 50 | Remove unused dependencies (alembic, python-jose, passlib) | Fresh | Small | Bloated install |

---

## Recommended Order of Operations

```
WEEK 1 (Phase 1 - Critical fixes, small effort):
  - Fix route ordering bugs across 4 API files
  - Add CORSMiddleware to main.py
  - Fix database path + name mismatch
  - Add Pydantic Field(ge=0) validators on monetary fields
  - Guard Plaid initialization with lazy loading
  - Fix dividend yield division guard

WEEK 2 (Phase 1 continued - Medium effort):
  - Implement basic auth middleware (local bearer token)
  - Fix Plaid token storage (server-side only)
  - Replace hardcoded $ in 4 chart formatters
  - Fix bare except clauses in market_data.py
  - Replace print() with logging

WEEK 3-4 (Phase 2 - Core functionality fixes):
  - Fix net worth history (store periodic snapshots)
  - Implement settings reset/export/import endpoints
  - Fix N+1 queries with batch queries + composite indexes
  - Replace hardcoded Tailwind colors with semantic tokens
  - Fix pre-retirement drawdown and portfolio P&L calculations

WEEK 5-6 (Phase 3 - Architecture improvements):
  - Implement backend FX conversion service
  - Extract shared frontend API utility
  - Adopt Alembic for migrations
  - Add error boundaries and loading state components
  - Replace datetime.utcnow() project-wide
  - Encrypt API keys at rest

ONGOING (Phase 4 - Feature completion):
  - Analytics/PDF reports
  - Goals tracking
  - Desktop packaging
  - Onboarding flow
  - Mobile responsive design
```

---

## Cross-Cutting Themes

Several patterns appeared across multiple audit reports, suggesting systemic areas for improvement:

1. **Missing authentication layer** -- Flagged by 3 of 5 auditors. Auth libraries are installed but unused. This is the single most impactful security gap.

2. **Route ordering bugs** -- The same FastAPI anti-pattern (static routes after parameterized `/{id}` routes) appears in 4 different API files, suggesting it was copy-pasted without understanding the matching order.

3. **N+1 query patterns** -- Every list endpoint that joins with `BalanceSnapshot` follows the same loop-and-query pattern. A single fix pattern (subquery join) can be applied to all 6 affected endpoints.

4. **Global mutable state** -- Module-level caches and state variables without synchronization appear in 5 different service files. This is a systemic architecture choice that should be addressed with dependency injection or request-scoped state.

5. **Inconsistent type discipline** -- Dates are `datetime` in some models and `str` in others. Currency amounts are summed without conversion. API schemas accept fields the models don't store. This suggests rapid feature development without consistent data contracts.

6. **Frontend-backend contract gaps** -- Three settings endpoints exist in the frontend but not the backend. The frontend handles errors by returning silent nulls, hiding broken functionality from users.

7. **Hardcoded values** -- USD `$` symbols in formatters, Roth conversion age at 72, sector ticker mappings, common tickers list, developer filesystem paths, and version numbers are all hardcoded when they should be configurable or derived.

---

*This executive summary synthesizes findings from all 5 audit reports. See individual reports for complete details, code snippets, and file-level recommendations.*
