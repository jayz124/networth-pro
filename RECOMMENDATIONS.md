# NetWorth Pro - Code Review & Recommendations

**Review Date:** January 31, 2026
**Version Reviewed:** 1.3.5
**Reviewers:** Senior Engineering, Testing Engineering, UX/UI Expert (AI Agents)

---

## Executive Summary

NetWorth Pro has a **solid architectural foundation** with well-structured code, consistent design patterns, and good separation of concerns. However, several critical issues need attention before production deployment, particularly around **security**, **data integrity**, and **testing**.

| Category | Status | Priority Items |
|----------|--------|----------------|
| Security | Needs Work | Plaintext secrets, no rate limiting, input validation |
| Performance | Needs Work | N+1 queries, missing indexes, no pagination |
| Testing | Critical Gap | 0% test coverage |
| Accessibility | Needs Work | Missing ARIA labels, keyboard navigation gaps |
| UX/UI | Good | Minor polish needed |
| Code Quality | Good | Well-structured, consistent patterns |

---

## Table of Contents

1. [Critical Issues](#1-critical-issues)
2. [Security Recommendations](#2-security-recommendations)
3. [Performance Optimizations](#3-performance-optimizations)
4. [Testing Strategy](#4-testing-strategy)
5. [Accessibility Improvements](#5-accessibility-improvements)
6. [UX/UI Enhancements](#6-uxui-enhancements)
7. [Code Quality Improvements](#7-code-quality-improvements)
8. [Implementation Roadmap](#8-implementation-roadmap)
9. [Files Requiring Changes](#9-files-requiring-changes)

---

## 1. Critical Issues

These issues should be addressed immediately before any production deployment.

### 1.1 N+1 Query Problem

**Severity:** CRITICAL
**Impact:** Performance degrades exponentially with data growth

**Problem:** Every list endpoint fetches records, then loops through each to fetch related data individually.

**Files Affected:**
- `backend/api/dashboard.py` (lines 24-42, 93-126)
- `backend/api/accounts.py` (lines 57-83)
- `backend/api/liabilities.py` (lines 62-88)
- `backend/api/real_estate.py` (lines 59-90)

**Example (Current):**
```python
accounts = session.exec(select(Account)).all()
for account in accounts:
    # This runs ONE query per account!
    latest_snapshot = session.exec(
        select(BalanceSnapshot)
        .where(BalanceSnapshot.account_id == account.id)
        .order_by(BalanceSnapshot.date.desc())
    ).first()
```

**Fix:**
```python
from sqlalchemy.orm import joinedload

accounts = session.exec(
    select(Account)
    .options(joinedload(Account.balance_snapshots))
).unique().all()
```

---

### 1.2 Plaintext Secrets Storage

**Severity:** CRITICAL
**Impact:** API keys exposed if database is compromised (OWASP A02:2021)

**Problem:** OpenAI API keys stored unencrypted in SQLite database.

**File:** `backend/api/settings.py` (lines 35-39)

**Current (Insecure):**
```python
def mask_secret(value: Optional[str]) -> Optional[str]:
    if not value or len(value) < 8:
        return "********" if value else None
    return value[:4] + "********" + value[-4:]  # Shows first/last 4 chars!
```

**Fix:**
```python
from cryptography.fernet import Fernet

# Generate encryption key (store in environment variable)
ENCRYPTION_KEY = os.environ.get("ENCRYPTION_KEY")
cipher = Fernet(ENCRYPTION_KEY)

def encrypt_secret(value: str) -> str:
    return cipher.encrypt(value.encode()).decode()

def decrypt_secret(encrypted: str) -> str:
    return cipher.decrypt(encrypted.encode()).decode()

def mask_secret(value: Optional[str]) -> str:
    return "********"  # Never show any characters
```

---

### 1.3 No Input Validation on Numeric Fields

**Severity:** CRITICAL
**Impact:** Data integrity issues, incorrect calculations

**Problem:** Negative values accepted for quantities, prices, and balances.

**Files Affected:**
- `backend/api/accounts.py` (line 22)
- `backend/api/portfolio.py` (line 35)
- `backend/api/real_estate.py` (line 23)

**Current:**
```python
class HoldingCreate(BaseModel):
    quantity: float  # Allows negative!
    purchase_price: Optional[float] = None  # Allows negative!
```

**Fix:**
```python
from pydantic import Field, field_validator

class HoldingCreate(BaseModel):
    quantity: float = Field(gt=0, description="Must be positive")
    purchase_price: Optional[float] = Field(None, gt=0)

    @field_validator('quantity')
    @classmethod
    def validate_quantity(cls, v):
        if v <= 0:
            raise ValueError('Quantity must be positive')
        return v
```

---

### 1.4 Unvalidated Input to External APIs

**Severity:** CRITICAL
**Impact:** Prompt injection attacks possible

**Problem:** User-supplied descriptions passed directly to OpenAI prompts.

**Files Affected:**
- `backend/services/ai_insights.py` (lines 53-63)
- `backend/api/budget_ai.py` (lines 91-95)

**Current (Vulnerable):**
```python
prompt = f"""Categorize this transaction:
- Description: {description}  # User input directly in prompt!
- Merchant: {merchant}
"""
```

**Fix:**
```python
import json

# Escape user input
prompt = f"""Categorize this transaction:
- Description: {json.dumps(description)}
- Merchant: {json.dumps(merchant or 'Unknown')}
"""
```

---

### 1.5 Zero Test Coverage

**Severity:** CRITICAL
**Impact:** No automated verification of financial calculations

**Problem:** No unit tests, integration tests, or e2e tests exist in the codebase. For a financial application, this is unacceptable.

**Files Missing:**
- `backend/tests/` directory doesn't exist
- `frontend/__tests__/` directory doesn't exist
- No pytest.ini or jest.config.js

**Fix:** See [Section 4: Testing Strategy](#4-testing-strategy)

---

## 2. Security Recommendations

### 2.1 Add Rate Limiting

**Severity:** HIGH
**File:** `backend/main.py`

```python
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter

@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request, exc):
    return JSONResponse(
        status_code=429,
        content={"detail": "Rate limit exceeded"}
    )

# Apply to expensive endpoints
@router.get("/securities/search")
@limiter.limit("30/minute")
async def search_securities(...):
    ...
```

### 2.2 Enable Foreign Key Constraints

**Severity:** HIGH
**File:** `backend/core/database.py`

SQLite doesn't enforce foreign keys by default:

```python
from sqlalchemy import event
from sqlalchemy.engine import Engine

@event.listens_for(Engine, "connect")
def set_sqlite_pragma(dbapi_conn, connection_record):
    cursor = dbapi_conn.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()
```

### 2.3 Add Transaction Rollback

**Severity:** HIGH
**Files:** All API endpoints that perform multiple database operations

**Current (Unsafe):**
```python
account = Account(...)
session.add(account)
session.commit()  # First commit

snapshot = BalanceSnapshot(...)
session.add(snapshot)
session.commit()  # Second commit - if this fails, account exists without snapshot
```

**Fix:**
```python
try:
    account = Account(...)
    session.add(account)
    session.flush()  # Validate without committing

    snapshot = BalanceSnapshot(...)
    session.add(snapshot)

    session.commit()  # Single atomic commit
except Exception as e:
    session.rollback()
    raise HTTPException(status_code=400, detail=str(e))
```

### 2.4 Validate Ticker Symbols

**Severity:** MEDIUM
**File:** `backend/services/market_data.py`

```python
import re

def validate_ticker(ticker: str) -> bool:
    """Validate ticker format: 1-5 uppercase letters, optional -USD suffix"""
    pattern = r'^[A-Z]{1,5}(-[A-Z]{3})?$'
    return bool(re.match(pattern, ticker.upper()))

def get_quote(ticker: str):
    if not validate_ticker(ticker):
        raise ValueError(f"Invalid ticker format: {ticker}")
    # ... rest of function
```

---

## 3. Performance Optimizations

### 3.1 Add Database Indexes

**Severity:** MEDIUM
**File:** `backend/models.py`

```python
class BalanceSnapshot(BaseModel, table=True):
    date: datetime = Field(index=True)  # Already indexed
    account_id: Optional[int] = Field(
        default=None,
        foreign_key="account.id",
        index=True  # ADD THIS
    )
    liability_id: Optional[int] = Field(
        default=None,
        foreign_key="liability.id",
        index=True  # ADD THIS
    )

class Transaction(BaseModel, table=True):
    date: datetime = Field(index=True)  # Already indexed
    category_id: Optional[int] = Field(
        foreign_key="budgetcategory.id",
        index=True  # ADD THIS
    )
```

### 3.2 Add Pagination to List Endpoints

**Severity:** MEDIUM
**Files:** All list endpoints

```python
from sqlalchemy import func

@router.get("/accounts")
def list_accounts(
    session: Session = Depends(get_session),
    skip: int = 0,
    limit: int = 50
):
    total = session.exec(select(func.count(Account.id))).one()
    accounts = session.exec(
        select(Account)
        .offset(skip)
        .limit(min(limit, 100))  # Max 100 per page
    ).all()

    return {
        "total": total,
        "items": accounts,
        "skip": skip,
        "limit": limit,
        "has_more": skip + len(accounts) < total
    }
```

### 3.3 Add Unique Constraints

**Severity:** MEDIUM
**File:** `backend/models.py`

Prevent duplicate holdings in the same portfolio:

```python
from sqlalchemy import UniqueConstraint

class PortfolioHolding(BaseModel, table=True):
    __table_args__ = (
        UniqueConstraint('portfolio_id', 'ticker', name='unique_portfolio_ticker'),
    )
```

### 3.4 Implement Response Caching

**Severity:** LOW
**File:** `backend/api/dashboard.py`

```python
from functools import lru_cache
from datetime import datetime, timedelta

# Cache net worth calculation for 60 seconds
_networth_cache = {}
_cache_ttl = 60

@router.get("/networth")
def get_networth(session: Session = Depends(get_session)):
    cache_key = "networth"
    now = datetime.utcnow()

    if cache_key in _networth_cache:
        cached_data, cached_time = _networth_cache[cache_key]
        if (now - cached_time).seconds < _cache_ttl:
            return cached_data

    # Calculate net worth...
    result = calculate_networth(session)

    _networth_cache[cache_key] = (result, now)
    return result
```

---

## 4. Testing Strategy

### 4.1 Test Framework Setup

**Backend (pytest):**

```bash
# Install dependencies
pip install pytest pytest-asyncio pytest-cov httpx

# Create pytest.ini
[pytest]
testpaths = tests
python_files = test_*.py
python_functions = test_*
asyncio_mode = auto
```

**Frontend (Vitest):**

```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom
```

### 4.2 Priority Test Cases

#### P0 - Critical (Week 1)

| Test Case | File to Create | Description |
|-----------|----------------|-------------|
| Net worth calculation | `test_dashboard.py` | Verify calculation with various asset combinations |
| Orphaned data handling | `test_data_integrity.py` | Deleted accounts shouldn't break calculations |
| OpenAI fallback | `test_ai_services.py` | Rule-based categorization when AI fails |
| Portfolio P&L | `test_portfolio.py` | Verify gain/loss calculations |

**Example Test:**
```python
# backend/tests/test_dashboard.py
import pytest
from sqlmodel import Session
from api.dashboard import calculate_networth
from models import Account, BalanceSnapshot

def test_networth_with_empty_database(test_session: Session):
    """Empty database should return zero net worth"""
    result = calculate_networth(test_session)
    assert result["net_worth"] == 0
    assert result["total_assets"] == 0
    assert result["total_liabilities"] == 0

def test_networth_with_only_cash(test_session: Session):
    """Net worth should equal cash balance"""
    account = Account(name="Checking", type="checking", currency="USD")
    test_session.add(account)
    test_session.flush()

    snapshot = BalanceSnapshot(account_id=account.id, balance=10000)
    test_session.add(snapshot)
    test_session.commit()

    result = calculate_networth(test_session)
    assert result["net_worth"] == 10000

def test_networth_with_orphaned_mortgage(test_session: Session):
    """Orphaned mortgage should be handled gracefully"""
    # Create mortgage without property (orphaned)
    mortgage = Mortgage(
        property_id=999,  # Non-existent property
        current_balance=200000,
        is_active=True
    )
    test_session.add(mortgage)
    test_session.commit()

    # Should not crash
    result = calculate_networth(test_session)
    assert result is not None
```

#### P1 - High (Week 2)

| Test Case | Description |
|-----------|-------------|
| API error responses | Verify proper HTTP status codes |
| Batch quote partial failure | 50% ticker failures handled |
| Transaction validation | Invalid amounts rejected |
| Concurrent updates | Race conditions detected |

#### P2 - Medium (Week 3-4)

| Test Case | Description |
|-----------|-------------|
| Frontend error boundaries | Rendering errors caught |
| External service timeouts | yfinance/OpenAI timeouts handled |
| Large data sets | 10k transactions import |
| Historical data queries | 5 years of snapshots |

### 4.3 Test Coverage Goals

| Phase | Timeline | Target Coverage |
|-------|----------|-----------------|
| Phase 1 | Week 1 | 20% (critical paths) |
| Phase 2 | Week 2 | 40% (API endpoints) |
| Phase 3 | Week 3 | 60% (services) |
| Phase 4 | Week 4 | 80% (integration) |
| Phase 5 | Week 5+ | 90%+ (edge cases) |

---

## 5. Accessibility Improvements

### 5.1 Critical ARIA Labels

**Add to icon-only buttons:**

```tsx
// File: frontend/components/budget/transaction-table.tsx (line 154)
<Button
  variant="ghost"
  size="icon"
  aria-label={`Open actions menu for ${txn.description}`}
>
  <MoreHorizontal className="h-4 w-4" />
</Button>

// File: frontend/components/budget/statement-upload.tsx (line 247)
<input
  ref={fileInputRef}
  type="file"
  aria-label="Upload bank statement file"
  accept=".csv,.ofx,.qfx,.pdf,.png,.jpg,.jpeg,.gif,.webp"
  onChange={handleFileSelect}
  className="hidden"
/>

// File: frontend/components/retirement/retirement-chart.tsx (line 95-108)
<Button
  variant={viewMode === 'aggregated' ? 'default' : 'outline'}
  aria-label="View aggregated retirement projection"
>
  Aggregated
</Button>
```

### 5.2 Skip Navigation Link

**File:** `frontend/components/app-sidebar.tsx`

```tsx
export function AppSidebar() {
  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:p-4 focus:bg-background"
      >
        Skip to main content
      </a>
      {/* Rest of sidebar */}
    </>
  )
}
```

### 5.3 Chart Accessibility

**File:** `frontend/components/retirement/retirement-chart.tsx`

```tsx
<ResponsiveContainer width="100%" height={400}>
  <AreaChart data={data} aria-label="Net worth projection chart">
    {/* Chart content */}
  </AreaChart>
</ResponsiveContainer>

{/* Add screen reader description */}
<p className="sr-only">
  Net worth projection showing assets declining from ${data[0]?.assets.toLocaleString()}
  at age {data[0]?.age} to ${data[data.length-1]?.assets.toLocaleString()}
  at age {data[data.length-1]?.age}.
  Retirement begins at age {retirementAge}.
</p>
```

### 5.4 Focus Indicators

**File:** `frontend/app/globals.css`

```css
/* Enhance focus visibility */
*:focus-visible {
  outline: 3px solid hsl(var(--ring));
  outline-offset: 2px;
}

/* Ensure sufficient contrast */
:root {
  --ring: 222.2 47.4% 30%;  /* Darker ring for visibility */
}

.dark {
  --ring: 212.7 26.8% 70%;  /* Lighter ring for dark mode */
}
```

---

## 6. UX/UI Enhancements

### 6.1 Loading Skeletons

**Create:** `frontend/components/ui/skeleton.tsx`

```tsx
import { cn } from "@/lib/utils"

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-md bg-muted",
        className
      )}
    />
  )
}

export function CardSkeleton() {
  return (
    <div className="rounded-lg border p-6 space-y-3">
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-8 w-1/2" />
      <Skeleton className="h-3 w-2/3" />
    </div>
  )
}
```

**Usage in Budget page:**

```tsx
if (isLoading) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <CardSkeleton />
      <CardSkeleton />
      <CardSkeleton />
    </div>
  )
}
```

### 6.2 Empty State Component

**Create:** `frontend/components/ui/empty-state.tsx`

```tsx
import { LucideIcon } from "lucide-react"
import { Button } from "./button"

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description: string
  actionLabel?: string
  onAction?: () => void
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <Icon className="h-12 w-12 text-muted-foreground/50 mb-4" />
      <h3 className="font-semibold text-lg">{title}</h3>
      <p className="text-sm text-muted-foreground mt-1 max-w-sm">{description}</p>
      {actionLabel && onAction && (
        <Button onClick={onAction} className="mt-6">
          {actionLabel}
        </Button>
      )}
    </div>
  )
}
```

### 6.3 Form Validation Feedback

**Pattern for all forms:**

```tsx
// Add error state to inputs
<div className="space-y-2">
  <Label htmlFor="amount">Amount</Label>
  <Input
    id="amount"
    type="number"
    value={amount}
    onChange={(e) => setAmount(e.target.value)}
    className={errors.amount ? "border-destructive" : ""}
    aria-invalid={!!errors.amount}
    aria-describedby={errors.amount ? "amount-error" : undefined}
  />
  {errors.amount && (
    <p id="amount-error" className="text-xs text-destructive">
      {errors.amount}
    </p>
  )}
</div>
```

### 6.4 Mobile Table Responsiveness

**File:** `frontend/components/budget/statement-upload.tsx`

```tsx
{/* Desktop: Table view */}
<div className="hidden md:block border rounded-lg max-h-[400px] overflow-auto">
  <Table>
    {/* Full table */}
  </Table>
</div>

{/* Mobile: Card view */}
<div className="md:hidden space-y-2">
  {parsedTransactions.map((txn, i) => (
    <div key={i} className="border rounded-lg p-3 space-y-2">
      <div className="flex justify-between items-start">
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate">
            {txn.clean_description || txn.description}
          </p>
          <p className="text-xs text-muted-foreground">
            {new Date(txn.date).toLocaleDateString()}
          </p>
        </div>
        <p className={`font-medium ${txn.amount >= 0 ? "text-green-600" : "text-red-600"}`}>
          {formatCurrency(txn.amount)}
        </p>
      </div>
    </div>
  ))}
</div>
```

### 6.5 Toast Notifications

**Install:** `npm install sonner`

**Setup in layout:**

```tsx
// frontend/app/layout.tsx
import { Toaster } from "sonner"

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <Toaster position="bottom-right" />
      </body>
    </html>
  )
}
```

**Usage:**

```tsx
import { toast } from "sonner"

// On successful import
toast.success(`Imported ${count} transactions`)

// On error
toast.error("Failed to import transactions")

// With undo action
toast("Transaction deleted", {
  action: {
    label: "Undo",
    onClick: () => restoreTransaction(id)
  }
})
```

---

## 7. Code Quality Improvements

### 7.1 Add Proper Error Logging

**File:** `backend/services/market_data.py`

```python
import logging

logger = logging.getLogger(__name__)

def get_quote(ticker: str) -> Optional[Quote]:
    try:
        # ... fetch quote
    except ValueError as e:
        logger.warning(f"Invalid ticker {ticker}: {e}")
        return None
    except requests.Timeout:
        logger.error(f"Timeout fetching {ticker}")
        raise HTTPException(status_code=504, detail="Market data timeout")
    except Exception as e:
        logger.error(f"Unexpected error for {ticker}: {e}", exc_info=True)
        raise HTTPException(status_code=503, detail="Market data unavailable")
```

### 7.2 Standardize API Error Responses

**Create:** `backend/core/exceptions.py`

```python
from fastapi import HTTPException
from typing import Optional

class AppException(HTTPException):
    def __init__(
        self,
        status_code: int,
        code: str,
        message: str,
        details: Optional[dict] = None
    ):
        super().__init__(
            status_code=status_code,
            detail={
                "code": code,
                "message": message,
                "details": details
            }
        )

class ValidationError(AppException):
    def __init__(self, message: str, field: Optional[str] = None):
        super().__init__(
            status_code=400,
            code="VALIDATION_ERROR",
            message=message,
            details={"field": field} if field else None
        )

class NotFoundError(AppException):
    def __init__(self, resource: str, id: int):
        super().__init__(
            status_code=404,
            code="NOT_FOUND",
            message=f"{resource} with id {id} not found"
        )
```

### 7.3 Frontend API Error Handling

**File:** `frontend/lib/api.ts`

```typescript
interface ApiError {
  code: string
  message: string
  details?: Record<string, unknown>
}

interface ApiResult<T> {
  data: T | null
  error: ApiError | null
}

async function apiRequest<T>(
  url: string,
  options?: RequestInit
): Promise<ApiResult<T>> {
  try {
    const res = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers
      }
    })

    if (!res.ok) {
      const error = await res.json().catch(() => ({
        code: 'UNKNOWN_ERROR',
        message: `HTTP ${res.status}`
      }))
      return { data: null, error }
    }

    const data = await res.json()
    return { data, error: null }
  } catch (e) {
    return {
      data: null,
      error: {
        code: 'NETWORK_ERROR',
        message: e instanceof Error ? e.message : 'Network error'
      }
    }
  }
}
```

---

## 8. Implementation Roadmap

### Phase 1: Critical Security & Data Integrity (Week 1)

| Task | Priority | Effort | Owner |
|------|----------|--------|-------|
| Add input validation to all numeric fields | P0 | 3h | Backend |
| Encrypt secrets at rest | P0 | 4h | Backend |
| Fix N+1 queries in dashboard | P0 | 4h | Backend |
| Add rate limiting middleware | P0 | 2h | Backend |
| Add aria-labels to icon buttons | P0 | 2h | Frontend |

### Phase 2: Testing Foundation (Week 2)

| Task | Priority | Effort | Owner |
|------|----------|--------|-------|
| Set up pytest framework | P0 | 2h | Backend |
| Write net worth calculation tests | P0 | 4h | Backend |
| Write portfolio P&L tests | P0 | 3h | Backend |
| Set up Vitest for frontend | P1 | 2h | Frontend |
| Add error boundary tests | P1 | 3h | Frontend |

### Phase 3: Performance & Reliability (Week 3)

| Task | Priority | Effort | Owner |
|------|----------|--------|-------|
| Add database indexes | P1 | 1h | Backend |
| Implement pagination | P1 | 4h | Backend |
| Add transaction rollback | P1 | 3h | Backend |
| Add proper error logging | P1 | 2h | Backend |
| Add loading skeletons | P1 | 3h | Frontend |

### Phase 4: UX Polish (Week 4)

| Task | Priority | Effort | Owner |
|------|----------|--------|-------|
| Fix mobile table responsiveness | P1 | 2h | Frontend |
| Add form validation feedback | P1 | 4h | Frontend |
| Add toast notifications | P2 | 2h | Frontend |
| Improve empty states | P2 | 2h | Frontend |
| Add keyboard shortcuts | P2 | 3h | Frontend |

### Phase 5: Advanced (Week 5+)

| Task | Priority | Effort | Owner |
|------|----------|--------|-------|
| Consider PostgreSQL migration | P2 | 8h | Backend |
| Implement async operations | P2 | 8h | Backend |
| Add retry logic for external services | P2 | 4h | Backend |
| Complete accessibility audit | P2 | 4h | Frontend |
| Add comprehensive e2e tests | P2 | 8h | QA |

---

## 9. Files Requiring Changes

### Backend Files

| File | Changes | Priority |
|------|---------|----------|
| `backend/core/database.py` | Enable FK constraints, add PostgreSQL support | P0 |
| `backend/api/settings.py` | Encrypt secrets | P0 |
| `backend/api/accounts.py` | Add validation, fix N+1, transaction rollback | P0 |
| `backend/api/liabilities.py` | Add validation, fix N+1, transaction rollback | P0 |
| `backend/api/dashboard.py` | Fix N+1 queries | P0 |
| `backend/api/portfolio.py` | Add validation, pagination | P1 |
| `backend/api/budget.py` | Add validation, pagination | P1 |
| `backend/models.py` | Add indexes, unique constraints | P1 |
| `backend/main.py` | Add rate limiting, error handlers | P0 |
| `backend/services/market_data.py` | Add logging, timeouts, validation | P1 |
| `backend/services/ai_insights.py` | Add input escaping, logging | P1 |

### Frontend Files

| File | Changes | Priority |
|------|---------|----------|
| `frontend/components/budget/statement-upload.tsx` | Add aria-labels, mobile view, notifications | P0/P1 |
| `frontend/components/budget/transaction-table.tsx` | Add aria-labels, empty state, mobile view | P0/P1 |
| `frontend/components/retirement/retirement-chart.tsx` | Add aria-labels, chart descriptions | P0 |
| `frontend/components/app-sidebar.tsx` | Add skip link | P1 |
| `frontend/app/globals.css` | Enhance focus indicators | P1 |
| `frontend/app/budget/page.tsx` | Add loading skeletons | P1 |
| `frontend/lib/api.ts` | Improve error handling | P1 |

### New Files to Create

| File | Purpose | Priority |
|------|---------|----------|
| `backend/tests/conftest.py` | Test fixtures | P0 |
| `backend/tests/test_dashboard.py` | Dashboard tests | P0 |
| `backend/tests/test_portfolio.py` | Portfolio tests | P0 |
| `backend/core/exceptions.py` | Standardized exceptions | P1 |
| `frontend/components/ui/skeleton.tsx` | Loading skeletons | P1 |
| `frontend/components/ui/empty-state.tsx` | Empty state component | P2 |
| `frontend/components/ui/spinner.tsx` | Unified spinner | P2 |

---

## Appendix A: Security Checklist

- [ ] All secrets encrypted at rest
- [ ] Rate limiting on all public endpoints
- [ ] Input validation on all user inputs
- [ ] SQL injection prevention (parameterized queries)
- [ ] XSS prevention (React handles by default)
- [ ] CORS properly configured
- [ ] Foreign key constraints enforced
- [ ] Sensitive data masked in logs
- [ ] API keys never exposed in responses

## Appendix B: Accessibility Checklist

- [ ] All interactive elements keyboard accessible
- [ ] All images/icons have alt text or aria-labels
- [ ] Color contrast meets WCAG AA (4.5:1)
- [ ] Focus indicators visible (3px minimum)
- [ ] Form errors announced to screen readers
- [ ] Skip navigation link present
- [ ] Heading hierarchy correct (h1 → h2 → h3)
- [ ] Charts have text alternatives

## Appendix C: Performance Checklist

- [ ] No N+1 query patterns
- [ ] Database indexes on foreign keys
- [ ] Pagination on list endpoints
- [ ] Response caching where appropriate
- [ ] Lazy loading for heavy components
- [ ] Bundle size optimized (<200KB)
- [ ] Images optimized and lazy loaded

---

*This document should be reviewed and updated as recommendations are implemented.*
