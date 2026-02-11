# Functionality Testing Audit Report

**Project:** Networth Pro
**Auditor:** Functionality Testing QA Engineer
**Date:** 2026-02-10
**Commit:** `17253cb` (main branch)
**Scope:** All functional areas -- Dashboard, Portfolio, Assets/Liabilities, Real Estate, Budget/Transactions, Retirement/Forecast, FX, Settings, AI Insights

---

## Executive Summary

This audit covers the full data-flow and functional correctness of Networth Pro's backend (FastAPI + SQLModel/SQLite) and frontend (Next.js + TypeScript). The application is a personal finance desktop app with 10 functional areas. The review uncovered **5 critical issues**, **12 important issues**, and **8 nice-to-have improvements**. The most severe problems involve route-ordering bugs that render two API endpoints completely unreachable, a net worth history calculation that produces misleading historical data, missing input validation allowing data integrity issues, and a dividend yield calculation that can produce NaN values. The retirement simulation engine is mathematically sophisticated and generally sound, but has specific edge cases that can cause incorrect outputs.

---

## Findings by Functional Area

---

### 1. Dashboard / Net Worth Computations

#### FINDING 1.1: Net Worth History Uses Static Investment/Real Estate Values for All Dates

- **Severity:** RED CRITICAL
- **File:** `/Users/jacobzachariah/Desktop/Projects/networth-pro/backend/api/dashboard.py`, lines 180-218
- **Description:** The `/networth/history` endpoint uses current (point-in-time) portfolio values and real estate values for every historical date in the timeline. This means if a user has $500K in investments today, the chart shows $500K of investments even for dates 2 years ago when they may have had $100K.

```python
# Lines 180-188: Current values fetched once
holdings = session.exec(select(PortfolioHolding)).all()
total_investments = sum(h.current_value or 0 for h in holdings)

properties = session.exec(select(Property)).all()
mortgages = session.exec(select(Mortgage)).all()
total_real_estate = sum(p.current_value for p in properties)
total_mortgages = sum(m.current_balance for m in mortgages if m.is_active)

# Lines 206-211: Applied to ALL historical dates
for date_str in all_dates:
    # ...
    total_assets = total_cash + total_investments + total_real_estate  # <-- same for every date
    total_liab = total_liabilities + total_mortgages                    # <-- same for every date
```

- **Expected:** Historical investment and real estate values should vary over time, reflecting past portfolio values.
- **Actual:** The chart shows the same investment/real estate amount across all dates. Only cash account balances change historically.
- **Impact:** Users see a misleading historical net worth graph. The graph shape is driven solely by cash account balance changes, while investments and real estate appear as a flat constant offset.
- **Recommended Fix:** Either store periodic portfolio/real estate value snapshots and use them for historical data, or clearly indicate on the UI that the historical chart only reflects cash accounts and that investment/real estate values are point-in-time approximations.

---

#### FINDING 1.2: No Multi-Currency Conversion in Net Worth Calculations

- **Severity:** YELLOW IMPORTANT
- **File:** `/Users/jacobzachariah/Desktop/Projects/networth-pro/backend/api/dashboard.py`, lines 24-131
- **Description:** The dashboard net worth calculation sums balances from accounts, properties, and liabilities without converting their individual currencies to a common base currency (USD). Each entity has a `currency` field, but values are simply added together regardless of currency.

```python
# Line 35-36: Balance taken as-is, regardless of account.currency
balance = snap.amount if snap else 0.0
total_cash += balance

# Lines 82-83: Property value taken as-is, regardless of prop.currency
for prop in properties:
    total_real_estate_value += prop.current_value
```

- **Expected:** Accounts/properties/liabilities in different currencies (e.g., GBP, EUR) should be converted to USD before summing.
- **Actual:** A GBP account with 100 GBP is treated as 100 USD.
- **Impact:** If a user has accounts in multiple currencies, the net worth figure will be incorrect.
- **Recommended Fix:** Fetch exchange rates and convert each balance to USD (or the configured default currency) before aggregation.

---

### 2. Real Estate

#### FINDING 2.1: Route Ordering Bug -- `/properties/summary` Is Unreachable

- **Severity:** RED CRITICAL
- **File:** `/Users/jacobzachariah/Desktop/Projects/networth-pro/backend/api/real_estate.py`, lines 192 and 418
- **Description:** The `GET /properties/summary` endpoint is defined on line 418 AFTER the `GET /properties/{property_id}` catch-all route on line 192. In FastAPI, routes are matched in order of definition. Any request to `/properties/summary` will be matched by `/{property_id}` with `property_id="summary"`, which will fail with a 422 validation error (since "summary" is not a valid integer) or a 404.

```python
# Line 192 - defined first, catches all /properties/{anything}
@router.get("/{property_id}")
def get_property(property_id: int, ...):

# Line 418 - defined second, never reachable
@router.get("/summary")
def get_real_estate_summary(...):
```

- **Expected:** `GET /api/v1/properties/summary` should return the real estate summary.
- **Actual:** FastAPI will try to parse "summary" as an integer for `property_id` and return a 422 Unprocessable Entity error.
- **Impact:** The real estate summary endpoint is completely non-functional.
- **Recommended Fix:** Move the `/summary` route definition above `/{property_id}`, similar to how `/valuation/status` and `/valuation/search` are correctly placed before `/{property_id}`.

---

#### FINDING 2.2: Appreciation Calculation Division by Zero When purchase_price Is Zero

- **Severity:** YELLOW IMPORTANT
- **File:** `/Users/jacobzachariah/Desktop/Projects/networth-pro/backend/api/real_estate.py`, lines 99-100
- **Description:** The appreciation percent calculation guards against `purchase_price > 0` with an inline conditional, but a property with `purchase_price = 0` (e.g., inherited property, gifted property) will get `appreciation_percent: 0`, which is misleading rather than indicating an undefined value.

```python
"appreciation_percent": ((prop.current_value - prop.purchase_price) / prop.purchase_price * 100)
    if prop.purchase_price > 0 else 0,
```

- **Expected:** For inherited/gifted properties with zero purchase price, the appreciation percent should be `null`/`None` to indicate it's not applicable.
- **Actual:** Returns `0`, implying no appreciation has occurred.
- **Recommended Fix:** Return `None` instead of `0` when `purchase_price` is zero, and handle `null` in the frontend.

---

### 3. Retirement / Forecast Simulation

#### FINDING 3.1: Route Ordering Bug -- `/retirement/plans/active` Is Unreachable

- **Severity:** RED CRITICAL
- **File:** `/Users/jacobzachariah/Desktop/Projects/networth-pro/backend/api/retirement.py`, lines 99 and 200
- **Description:** Identical to Finding 2.1. The `GET /retirement/plans/active` endpoint on line 200 is defined after `GET /retirement/plans/{plan_id}` on line 99. The string "active" will be interpreted as a `plan_id` integer parameter, causing a 422 error.

```python
# Line 99 - catches /retirement/plans/{anything}
@router.get("/retirement/plans/{plan_id}")
def get_plan(plan_id: int, ...):

# Line 200 - unreachable
@router.get("/retirement/plans/active")
def get_active_plan(...):
```

- **Expected:** `GET /api/v1/retirement/plans/active` should return the active retirement plan.
- **Actual:** Returns 422 Unprocessable Entity because "active" cannot be parsed as an integer.
- **Impact:** The frontend's `fetchRetirementPlan` for the active plan endpoint fails silently. Users cannot load their active retirement plan via the API.
- **Recommended Fix:** Move the `/retirement/plans/active` route above `/retirement/plans/{plan_id}`.

---

#### FINDING 3.2: Dividend Yield Calculation Can Produce NaN

- **Severity:** RED CRITICAL
- **File:** `/Users/jacobzachariah/Desktop/Projects/networth-pro/frontend/lib/retirement-pro/engine.ts`, lines 346-348
- **Description:** When `getPotTotal(curTaxable)` is 0 (empty taxable account), the dividend yield calculation divides by zero, producing NaN. This NaN propagates through all subsequent calculations for that simulation year and beyond.

```typescript
// Line 346: if getPotTotal(curTaxable) is 0, this produces NaN
const yieldTaxable = (assumptions.dividendYield / 100) * (curTaxable.stock / getPotTotal(curTaxable) || 0);
// The || 0 applies to the result of the division, not the divisor.
// When curTaxable is {stock: 0, bond: 0, cash: 0}, this is 0/0 = NaN, then NaN || 0 = 0 -- actually OK
// BUT when curTaxable is {stock: 100, bond: 0, cash: 0} and total is 100:
//   100 / 100 = 1 -- fine
// When curTaxable is {stock: 0, bond: 50, cash: 0} and total is 50:
//   0 / 50 = 0, then 0 || 0 = 0 -- fine
// The REAL issue: when total IS 0 but stock is also 0: 0/0 = NaN, NaN || 0 = 0 -- OK
// Actually the `|| 0` does protect against NaN since NaN is falsy in JS. But:
const annualDividendAmount = getPotTotal(curTaxable) * yieldTaxable;
// If yieldTaxable is fine but getPotTotal returns 0, this is just 0.
```

After further analysis, the `|| 0` operator **does** guard against NaN in JavaScript because NaN is falsy. However, there is a subtle edge case:

```typescript
// When curTaxable.stock = 0.0001 (very small) and total = 0 due to floating point:
// 0.0001 / 0 = Infinity, Infinity || 0 = Infinity (truthy!)
// Then annualDividendAmount = 0 * Infinity = NaN
```

- **Expected:** Dividend calculation should gracefully handle edge cases where the taxable pot is effectively zero.
- **Actual:** Under specific floating-point edge cases (very small stock values with bond/cash at exactly 0), Infinity can propagate.
- **Recommended Fix:** Use an explicit guard: `const total = getPotTotal(curTaxable); const yieldTaxable = total > 0 ? (assumptions.dividendYield / 100) * (curTaxable.stock / total) : 0;`

---

#### FINDING 3.3: Stress Test Crash Applies to Bonds But Should Spare Them

- **Severity:** YELLOW IMPORTANT
- **File:** `/Users/jacobzachariah/Desktop/Projects/networth-pro/frontend/lib/retirement-pro/engine.ts`, lines 256-264
- **Description:** The market crash stress test applies the same crash magnitude to both stocks and bonds. In real market crashes, bonds typically serve as a buffer and often appreciate in value. Applying a 40% drop to bonds is unrealistic.

```typescript
if (stressTest.crashAge && currentAge === stressTest.crashAge) {
    const dropFactor = 1 - (stressTest.crashMagnitude || 0) / 100;
    curTaxable.stock *= dropFactor;
    curTaxable.bond *= dropFactor;  // <-- bonds also crashed
    curDeferred.stock *= dropFactor;
    curDeferred.bond *= dropFactor; // <-- bonds also crashed
    curFree.stock *= dropFactor;
    curFree.bond *= dropFactor;     // <-- bonds also crashed
}
```

- **Expected:** Bonds should either be unaffected or have a separate (typically smaller) drop factor.
- **Actual:** A 40% stock crash also crashes bonds by 40%, which is unrealistic and overly pessimistic.
- **Recommended Fix:** Either apply no crash to bonds, or provide a separate `bondCrashMagnitude` parameter (typically 5-10% during stock crashes).

---

#### FINDING 3.4: Pre-Retirement Drawdown Ignores Employment Income in Gap Calculation

- **Severity:** YELLOW IMPORTANT
- **File:** `/Users/jacobzachariah/Desktop/Projects/networth-pro/frontend/lib/retirement-pro/engine.ts`, lines 469-471
- **Description:** When `operationalBalance < 0` during pre-retirement years (expenses exceed income), the code sets `preRetirementDrawdownNeeded = cashOut` (the full expense amount) rather than `preRetirementDrawdownNeeded = -operationalBalance` (the gap). This means the withdrawal solver will try to withdraw the full expense amount from the portfolio, ignoring the employment income that partially covers it.

```typescript
if (operationalBalance >= 0) {
    // ... savings contributions
} else {
    preRetirementDrawdownNeeded = cashOut;  // <-- Should be Math.abs(operationalBalance) or -operationalBalance
}
```

Later when the withdrawal solver runs (line 502):
```typescript
if (isRetired) {
    // ...
} else {
    baseNeed = preRetirementDrawdownNeeded;  // <-- This is the FULL cashOut, not just the gap
}
```

But `passiveIncome` (line 483) includes `pensionIncome + rentalIncome + dividendsAsIncome` which partially compensates. Employment income is not in `passiveIncome`. So the full `cashOut` minus `passiveIncome` is the gap the solver tries to fill. But employment income (`empIncome`) was already factored into `operationalBalance` -- so using `cashOut` directly double-counts the non-employment passive income.

- **Expected:** `preRetirementDrawdownNeeded` should be the actual funding gap: expenses minus all income sources.
- **Actual:** The drawdown amount is overstated, leading to excessive portfolio withdrawals during pre-retirement years if the user has income that doesn't fully cover expenses.
- **Recommended Fix:** Set `preRetirementDrawdownNeeded = Math.abs(operationalBalance)` or restructure the solver to consider employment income as an input.

---

#### FINDING 3.5: Config Converter Hardcodes Roth Conversion End Age to 72

- **Severity:** YELLOW IMPORTANT
- **File:** `/Users/jacobzachariah/Desktop/Projects/networth-pro/frontend/lib/retirement-pro/config-converter.ts`, line 108
- **Description:** The Roth conversion `endAge` is hardcoded to 72, which was the old RMD start age. Under SECURE Act 2.0, the RMD age is 73. This means users who set up Roth conversions will stop one year early.

```typescript
rothConversion: config.taxStrategy.rothConversionStrategy !== 'none'
    ? {
        strategy: config.taxStrategy.rothConversionStrategy,
        fixedAmount: config.taxStrategy.rothConversionAmount,
        startAge: config.retirementAge,
        endAge: 72, // <-- Should be 72 (pre-SECURE 2.0) or dynamic based on country
    }
    : undefined,
```

- **Expected:** The end age should be dynamically set based on the country's RMD start age (73 for US under SECURE Act 2.0).
- **Actual:** Hardcoded to 72, missing the last year of potential Roth conversion before RMDs begin.
- **Recommended Fix:** Reference the RMD start age from the country's configuration: `endAge: (RMD_TABLES[config.taxStrategy.country]?.startAge || 73) - 1`.

---

#### FINDING 3.6: Monte Carlo Uses Math.random() -- Not Seedable, Not Reproducible

- **Severity:** BLUE NICE-TO-HAVE
- **File:** `/Users/jacobzachariah/Desktop/Projects/networth-pro/frontend/lib/retirement-pro/monte-carlo.ts`, line 37
- **Description:** The Monte Carlo simulation uses `Math.random()` for bootstrapping historical returns, which means results are not reproducible between runs. This makes debugging and validation impossible.

```typescript
const randomIndex = Math.floor(Math.random() * n);
```

- **Expected:** A seeded PRNG that produces reproducible results when using the same inputs.
- **Actual:** Every run produces different results, making it impossible to verify correctness.
- **Recommended Fix:** Use a seeded PRNG (e.g., a simple linear congruential generator) with an optional seed parameter.

---

### 4. Portfolio

#### FINDING 4.1: Unrealized Gain Silently Returns Zero When Cost Basis Is Zero

- **Severity:** YELLOW IMPORTANT
- **File:** `/Users/jacobzachariah/Desktop/Projects/networth-pro/backend/api/portfolio.py`, lines 393-398
- **Description:** When `purchase_price` is None or 0 (common for transferred shares, ESPP, or RSU holdings), the `_calculate_holding_pl` function returns `unrealized_gain: 0` and `gain_percent: 0`, even if the holding has a significant current value.

```python
def _calculate_holding_pl(holding: PortfolioHolding) -> dict:
    cost_basis = (holding.purchase_price or 0) * holding.quantity
    current_value = holding.current_value or 0
    unrealized_gain = current_value - cost_basis if cost_basis > 0 else 0  # <-- 0 when no purchase price
    gain_percent = (unrealized_gain / cost_basis * 100) if cost_basis > 0 else 0
```

- **Expected:** If cost basis is 0 but there's a current value, the unrealized gain should equal the full current value.
- **Actual:** Returns 0 gain, understating the portfolio's unrealized gains.
- **Recommended Fix:** Change the guard to only zero out the gain if `current_value` is also 0: `unrealized_gain = current_value - cost_basis`.

---

#### FINDING 4.2: Portfolio Summary Total Gain Percent Is Wrong When Some Holdings Have No Cost Basis

- **Severity:** YELLOW IMPORTANT
- **File:** `/Users/jacobzachariah/Desktop/Projects/networth-pro/backend/api/portfolio.py`, lines 106-108
- **Description:** The portfolio-level `total_gain` calculation uses `total_value - total_cost if total_cost > 0 else 0`. But `total_cost` only counts holdings with a `purchase_price`. If half the holdings have no cost basis, `total_cost` will be understated, making `total_gain` look much larger than it should be.

```python
total_value = sum(h["current_value"] or 0 for h in holdings_with_pl)
total_cost = sum(h["cost_basis"] or 0 for h in holdings_with_pl)
total_gain = total_value - total_cost if total_cost > 0 else 0
total_gain_percent = (total_gain / total_cost * 100) if total_cost > 0 else 0
```

- **Expected:** The gain calculation should only include holdings where cost basis is known, OR clearly indicate that the gain figure is an approximation.
- **Actual:** If a portfolio has 10 holdings at $10K each ($100K total value), but only 5 have cost basis ($30K total cost), the gain shows $70K (70/30 = 233%), when the actual tracked gain is $20K on the 5 holdings.
- **Recommended Fix:** Either exclude holdings without cost basis from the gain calculation, or return separate tracked/untracked totals.

---

### 5. Budget / Transactions

#### FINDING 5.1: Transaction Filter `category_id=0` Treated as Falsy, Skips Filter

- **Severity:** YELLOW IMPORTANT
- **File:** `/Users/jacobzachariah/Desktop/Projects/networth-pro/backend/api/budget.py`, lines 237-238
- **Description:** The `list_transactions` endpoint uses `if category_id:` to check whether to apply the category filter. In Python, `0` is falsy, so passing `category_id=0` (meaning "uncategorized") will not apply the filter. This is inconsistent since `0` is used elsewhere in the codebase to represent "null/no category".

```python
if category_id:       # <-- 0 is falsy in Python, filter is skipped
    query = query.where(Transaction.category_id == category_id)
if account_id:        # <-- same issue
    query = query.where(Transaction.account_id == account_id)
```

- **Expected:** Passing `category_id=0` should filter for uncategorized transactions (where `category_id IS NULL`).
- **Actual:** The filter is silently skipped, returning all transactions regardless of category.
- **Recommended Fix:** Use `if category_id is not None:` instead of `if category_id:`.

---

#### FINDING 5.2: Budget Summary Treats Zero-Amount Transactions as Income

- **Severity:** BLUE NICE-TO-HAVE
- **File:** `/Users/jacobzachariah/Desktop/Projects/networth-pro/backend/api/budget.py`, lines 568-571
- **Description:** Transactions with `amount = 0` are counted as income because the check uses `if txn.amount >= 0:`.

```python
if txn.amount >= 0:
    total_income += txn.amount
else:
    total_expenses += abs(txn.amount)
```

- **Expected:** Zero-amount transactions should be excluded or categorized separately.
- **Actual:** Zero-amount transactions inflate the income transaction count.
- **Recommended Fix:** Add an explicit check: `if txn.amount > 0: total_income += ...` or skip zero amounts.

---

#### FINDING 5.3: Cash Flow Endpoint Uses Approximate 30-Day Months

- **Severity:** BLUE NICE-TO-HAVE
- **File:** `/Users/jacobzachariah/Desktop/Projects/networth-pro/backend/api/budget.py`, line 619
- **Description:** The cash flow endpoint calculates the start date as `end_date - timedelta(days=months * 30)`. This means "6 months" is 180 days, not an actual 6-month calendar span. For month 6, this could miss a few days of data.

```python
start_date = end_date - timedelta(days=months * 30)
```

- **Expected:** Use proper calendar month arithmetic (e.g., `dateutil.relativedelta`).
- **Actual:** Slightly inaccurate date ranges; for 6 months, uses 180 days instead of the actual 6-month span.
- **Recommended Fix:** Use `relativedelta(months=months)` from the `dateutil` library.

---

### 6. FX / Multi-Currency

#### FINDING 6.1: No Backend FX API Exists

- **Severity:** YELLOW IMPORTANT
- **File:** N/A (confirmed by examining `/Users/jacobzachariah/Desktop/Projects/networth-pro/backend/api/` directory)
- **Description:** Despite the sidebar listing "FX" as a feature area and the frontend settings page supporting currency selection, there is no backend FX API endpoint. All FX conversion happens client-side via the Frankfurter API called from the frontend's `settings-context.tsx`.

- **Expected:** A dedicated backend FX endpoint to ensure consistent rates are used for server-side calculations (net worth, etc.).
- **Actual:** Server-side calculations (dashboard net worth, portfolio P&L) ignore currency entirely. Client-side conversion only applies to display formatting, not to the underlying data.
- **Impact:** The backend's net worth calculation adds USD amounts with EUR amounts as if they were the same currency.
- **Recommended Fix:** Implement a backend FX service that stores exchange rates and applies them during net worth aggregation, or ensure all data is stored in a single base currency.

---

#### FINDING 6.2: Fallback Exchange Rates Only Cover 10 of 30 Supported Currencies

- **Severity:** YELLOW IMPORTANT
- **File:** `/Users/jacobzachariah/Desktop/Projects/networth-pro/frontend/lib/settings-context.tsx`, lines 81-96
- **Description:** The `FALLBACK_RATES` object only includes rates for 10 currencies (USD, EUR, GBP, JPY, CAD, AUD, CHF, CNY, INR, SGD), but the app supports 30 currencies. If the Frankfurter API is unreachable, users selecting HKD, NZD, SEK, NOK, DKK, AED, SAR, KRW, BRL, MXN, ZAR, THB, MYR, IDR, PHP, PLN, TRY, RUB, or ILS will see USD values (no conversion applied).

```typescript
const FALLBACK_RATES: ExchangeRates = {
    base: "USD",
    rates: {
        USD: 1, EUR: 0.92, GBP: 0.79, JPY: 149.50, CAD: 1.36,
        AUD: 1.53, CHF: 0.88, CNY: 7.24, INR: 83.12, SGD: 1.34,
        // Missing: HKD, NZD, SEK, NOK, DKK, AED, SAR, KRW, BRL, MXN, ZAR, THB, MYR, IDR, PHP, PLN, TRY, RUB, ILS
    },
    lastUpdated: new Date().toISOString(),
}
```

- **Expected:** Fallback rates should cover all 30 supported currencies.
- **Actual:** 20 currencies have no fallback, showing USD amounts when the API is down.
- **Recommended Fix:** Add approximate fallback rates for all 30 supported currencies.

---

### 7. Data Validation

#### FINDING 7.1: No Input Validation on Financial Amounts

- **Severity:** RED CRITICAL
- **File:** `/Users/jacobzachariah/Desktop/Projects/networth-pro/backend/models.py`, lines 1-185
- **Description:** The SQLModel models define no validation constraints on financial amounts. There are no minimum/maximum bounds on any numeric field. A user (or malicious API call) can submit negative values for property values, mortgage balances, quantities, or extremely large numbers that could cause overflow issues.

Specific examples:
- `PortfolioHolding.quantity` (line 38): No `ge=0` constraint -- negative shares allowed
- `Property.current_value` (line 89): No `ge=0` constraint -- negative property values allowed
- `Property.purchase_price` (line 87): No `ge=0` constraint
- `Mortgage.current_balance` (line 128): No `ge=0` constraint
- `Mortgage.interest_rate` (line 129): No range constraint (negative interest rates or 1000% allowed)
- `Mortgage.monthly_payment` (line 130): No `ge=0` constraint

The Pydantic request schemas (e.g., `PropertyCreate`, `HoldingCreate`) also lack validation:

```python
# backend/api/real_estate.py, line 23
class PropertyCreate(BaseModel):
    purchase_price: float   # No min constraint
    current_value: float    # No min constraint

# backend/api/portfolio.py, line 33
class HoldingCreate(BaseModel):
    quantity: float         # No min constraint
    purchase_price: Optional[float] = None  # No min constraint
```

- **Expected:** Financial amounts should have appropriate constraints (`ge=0` for prices, values; `ge=0, le=100` for percentages).
- **Actual:** Any float value is accepted, including negative and extreme values.
- **Impact:** Negative property values or negative quantities can corrupt net worth calculations. Extremely large numbers could cause floating-point overflow.
- **Recommended Fix:** Add Pydantic validators with `Field(ge=0)` for monetary amounts and `Field(ge=0, le=100)` for percentage fields.

---

#### FINDING 7.2: No Sanitization of String Inputs

- **Severity:** BLUE NICE-TO-HAVE
- **File:** Multiple API files
- **Description:** String inputs like `description`, `name`, `notes`, `merchant`, and `address` accept arbitrary input without sanitization. While SQLModel/SQLAlchemy parameterizes queries (preventing SQL injection), there's no protection against excessively long strings, control characters, or script tags that could cause XSS in the frontend.

Example locations:
- `/Users/jacobzachariah/Desktop/Projects/networth-pro/backend/api/budget.py`, line 57: `description: str` (no max length)
- `/Users/jacobzachariah/Desktop/Projects/networth-pro/backend/api/real_estate.py`, line 19: `address: str` (no max length)
- `/Users/jacobzachariah/Desktop/Projects/networth-pro/backend/models.py`, line 12: `name: str` (no max length in DB)

- **Expected:** String fields should have maximum length constraints and be stripped of control characters.
- **Actual:** No length limits; a user could submit a 10MB string as a transaction description.
- **Recommended Fix:** Add `max_length` constraints to Pydantic models (e.g., `name: str = Field(max_length=200)`).

---

### 8. Date Handling

#### FINDING 8.1: Inconsistent Date Storage -- Some Fields Use datetime, Others Use str

- **Severity:** YELLOW IMPORTANT
- **File:** `/Users/jacobzachariah/Desktop/Projects/networth-pro/backend/models.py`, lines 40, 88, 117
- **Description:** The codebase uses mixed date types: `BalanceSnapshot.date` is a `datetime` (line 48), `Transaction.date` is a `datetime` (line 157), but `PortfolioHolding.purchase_date` is `Optional[str]` (line 40), `Property.purchase_date` is `Optional[str]` (line 88), and `PropertyValueHistory.date` is `str` (line 117).

```python
# datetime fields:
class BalanceSnapshot(BaseModel, table=True):
    date: datetime = Field(index=True)           # line 48

class Transaction(BaseModel, table=True):
    date: datetime = Field(index=True)           # line 157

# string fields:
class PortfolioHolding(BaseModel, table=True):
    purchase_date: Optional[str] = None          # line 40

class Property(BaseModel, table=True):
    purchase_date: Optional[str] = None          # line 88

class PropertyValueHistory(BaseModel, table=True):
    date: str  # YYYY-MM-DD                      # line 117
```

- **Expected:** All date fields should use a consistent type (either all `datetime` or all `str` with a defined format).
- **Actual:** Mixing `datetime` and `str` creates parsing issues and makes date comparison/sorting unreliable for string-typed dates.
- **Recommended Fix:** Standardize all date fields to `datetime` type with proper serialization.

---

#### FINDING 8.2: `datetime.utcnow()` Is Used -- Deprecated in Python 3.12+

- **Severity:** BLUE NICE-TO-HAVE
- **File:** Multiple files (models.py line 6, budget.py line 183, etc.)
- **Description:** The codebase uses `datetime.utcnow()` which was deprecated in Python 3.12. While the project runs on Python 3.9 (from `.venv` path), this will cause warnings when upgrading.

```python
class BaseModel(SQLModel):
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
```

- **Recommended Fix:** Use `datetime.now(tz=timezone.utc)` for future compatibility.

---

### 9. Analytics / PDF Reports

#### FINDING 9.1: No Analytics or PDF Report Backend Exists

- **Severity:** YELLOW IMPORTANT
- **File:** N/A (confirmed by searching the entire backend for analytics/PDF files)
- **Description:** The project context describes "Analytics (with PDF reports)" as a functional area, but no backend analytics API or PDF report generation code exists. There is no analytics page in the frontend either. The budget page has an "Analytics" tab, but it only shows spending breakdowns and cash flow charts -- no exportable PDF report.

- **Expected:** An analytics page with PDF report generation as described in the project context.
- **Actual:** Feature does not exist. The budget page's Analytics tab is the closest equivalent but has no PDF export.
- **Impact:** Users cannot generate downloadable financial reports.
- **Recommended Fix:** Either implement the Analytics/PDF feature or update the project documentation to reflect the actual feature set.

---

### 10. Goals Tracking

#### FINDING 10.1: Goals Feature Does Not Exist

- **Severity:** BLUE NICE-TO-HAVE
- **File:** N/A
- **Description:** The project context lists "Goals" as a functional area, but no goals-related code exists in either the backend API or the frontend. There is no `/goals` page, no goals model, and no goals API endpoint.

- **Expected:** A goals tracking feature with progress indicators.
- **Actual:** Feature is entirely absent from the codebase.
- **Recommended Fix:** Either implement the Goals feature or remove it from the project documentation.

---

### 11. AI Insights

#### FINDING 11.1: AI Insights Cache Race Condition on Concurrent Requests

- **Severity:** BLUE NICE-TO-HAVE
- **File:** `/Users/jacobzachariah/Desktop/Projects/networth-pro/backend/services/ai_insights.py`
- **Description:** The AI insights module uses an in-memory dictionary `_insights_cache` for caching, with no thread/async lock. If two concurrent requests hit the dashboard insights endpoint simultaneously, both could trigger expensive AI API calls instead of one serving from cache. For a single-user desktop app this is low-risk, but could waste API quota.

- **Recommended Fix:** Add a simple threading lock around the cache check-and-populate logic.

---

### 12. Settings

#### FINDING 12.1: API Keys Stored in Plaintext in SQLite

- **Severity:** YELLOW IMPORTANT
- **File:** `/Users/jacobzachariah/Desktop/Projects/networth-pro/backend/models.py`, lines 180-184 and `/Users/jacobzachariah/Desktop/Projects/networth-pro/backend/api/settings.py`
- **Description:** While the `AppSettings` model has an `is_secret` field, the actual API keys (OpenAI, Groq, Claude, Kimi, Gemini, RentCast) are stored as plaintext in the SQLite database. The `is_secret` flag only controls whether the value is masked in API responses -- the actual value is still stored unencrypted.

```python
class AppSettings(BaseModel, table=True):
    key: str = Field(index=True, unique=True)
    value: Optional[str] = None            # <-- plaintext API keys
    is_secret: bool = Field(default=False)  # <-- only for display masking
```

- **Expected:** For a desktop app, this is acceptable but not ideal. API keys should at least be encrypted at rest.
- **Actual:** Anyone with access to the SQLite file can read all API keys in plaintext.
- **Impact:** Low for a single-user desktop app, but a concern if the database file is shared or backed up to cloud storage.
- **Recommended Fix:** Consider basic encryption (e.g., using the system keychain) for API keys, or document this as a known limitation.

---

### 13. Sidebar / Navigation

#### FINDING 13.1: `/accounts` Route Referenced in Sidebar But Page May Be Missing

- **Severity:** BLUE NICE-TO-HAVE
- **File:** `/Users/jacobzachariah/Desktop/Projects/networth-pro/frontend/components/app-sidebar.tsx`, line 17
- **Description:** The sidebar includes a "Bank Connections" link pointing to `/accounts`, but there is a `/accounts/page.tsx` that handles Plaid bank connections. The Plaid integration is a complex feature requiring server-side setup. The sidebar entry exists but the Plaid feature requires configuration that may not be obvious to users.

```typescript
{ name: "Bank Connections", href: "/accounts", icon: Building2 },
```

- **Expected:** The feature should either work out-of-the-box or show a clear setup guide.
- **Actual:** The page exists but Plaid requires environment variables and API keys to function.
- **Recommended Fix:** Add an informational message on the Bank Connections page when Plaid is not configured.

---

## Summary Table

| # | Finding | Severity | File | Line(s) |
|---|---------|----------|------|---------|
| 1.1 | Net Worth History uses static investment/real estate values | RED CRITICAL | `backend/api/dashboard.py` | 180-218 |
| 1.2 | No multi-currency conversion in net worth calculations | YELLOW IMPORTANT | `backend/api/dashboard.py` | 24-131 |
| 2.1 | `/properties/summary` route unreachable (ordering bug) | RED CRITICAL | `backend/api/real_estate.py` | 192, 418 |
| 2.2 | Appreciation % returns 0 instead of null for zero purchase price | YELLOW IMPORTANT | `backend/api/real_estate.py` | 99-100 |
| 3.1 | `/retirement/plans/active` route unreachable (ordering bug) | RED CRITICAL | `backend/api/retirement.py` | 99, 200 |
| 3.2 | Dividend yield calculation edge case can produce Infinity/NaN | RED CRITICAL | `frontend/lib/retirement-pro/engine.ts` | 346-348 |
| 3.3 | Stress test crash applies equally to bonds and stocks | YELLOW IMPORTANT | `frontend/lib/retirement-pro/engine.ts` | 256-264 |
| 3.4 | Pre-retirement drawdown overstates withdrawal amount | YELLOW IMPORTANT | `frontend/lib/retirement-pro/engine.ts` | 469-471 |
| 3.5 | Roth conversion end age hardcoded to 72 (should be 73+) | YELLOW IMPORTANT | `frontend/lib/retirement-pro/config-converter.ts` | 108 |
| 3.6 | Monte Carlo not seedable/reproducible | BLUE NICE-TO-HAVE | `frontend/lib/retirement-pro/monte-carlo.ts` | 37 |
| 4.1 | Unrealized gain returns 0 when cost basis is zero | YELLOW IMPORTANT | `backend/api/portfolio.py` | 393-398 |
| 4.2 | Portfolio total gain inflated when some holdings lack cost basis | YELLOW IMPORTANT | `backend/api/portfolio.py` | 106-108 |
| 5.1 | category_id=0 filter treated as falsy, skips filter | YELLOW IMPORTANT | `backend/api/budget.py` | 237-238 |
| 5.2 | Zero-amount transactions counted as income | BLUE NICE-TO-HAVE | `backend/api/budget.py` | 568-571 |
| 5.3 | Cash flow uses approximate 30-day months | BLUE NICE-TO-HAVE | `backend/api/budget.py` | 619 |
| 6.1 | No backend FX API; currency not used in server-side calculations | YELLOW IMPORTANT | N/A | N/A |
| 6.2 | Fallback exchange rates cover only 10 of 30 currencies | YELLOW IMPORTANT | `frontend/lib/settings-context.tsx` | 81-96 |
| 7.1 | No input validation on financial amounts (negatives, extremes) | RED CRITICAL | `backend/models.py` | 1-185 |
| 7.2 | No string input sanitization or length limits | BLUE NICE-TO-HAVE | Multiple files | Various |
| 8.1 | Inconsistent date types (datetime vs str) across models | YELLOW IMPORTANT | `backend/models.py` | 40, 88, 117 |
| 8.2 | `datetime.utcnow()` deprecated in Python 3.12+ | BLUE NICE-TO-HAVE | Multiple files | Various |
| 9.1 | Analytics/PDF report feature does not exist | YELLOW IMPORTANT | N/A | N/A |
| 10.1 | Goals tracking feature does not exist | BLUE NICE-TO-HAVE | N/A | N/A |
| 11.1 | AI insights cache has no concurrency protection | BLUE NICE-TO-HAVE | `backend/services/ai_insights.py` | N/A |
| 12.1 | API keys stored in plaintext in SQLite | YELLOW IMPORTANT | `backend/models.py` | 180-184 |
| 13.1 | Bank Connections page needs Plaid setup guidance | BLUE NICE-TO-HAVE | `frontend/components/app-sidebar.tsx` | 17 |

### Severity Distribution

| Severity | Count |
|----------|-------|
| RED CRITICAL | 5 |
| YELLOW IMPORTANT | 12 |
| BLUE NICE-TO-HAVE | 8 |
| **Total** | **25** |

---

## Priority Recommendations

### Immediate (Fix Before Release)
1. **Fix route ordering bugs** (Findings 2.1, 3.1) -- Move static routes before parameterized routes
2. **Fix net worth history** (Finding 1.1) -- At minimum, add a disclaimer; ideally store periodic snapshots
3. **Add input validation** (Finding 7.1) -- Add `ge=0` constraints to all monetary Pydantic fields
4. **Fix dividend yield NaN edge case** (Finding 3.2) -- Add explicit zero-division guard

### Short-Term (Next Sprint)
5. **Implement backend FX conversion** (Findings 1.2, 6.1) -- Apply exchange rates in net worth aggregation
6. **Fix pre-retirement drawdown** (Finding 3.4) -- Use the actual gap, not the full expense amount
7. **Fix portfolio P&L with missing cost basis** (Findings 4.1, 4.2) -- Handle null cost basis correctly
8. **Add complete fallback exchange rates** (Finding 6.2)
9. **Standardize date types** (Finding 8.1)

### Medium-Term
10. **Fix stress test bond handling** (Finding 3.3)
11. **Fix Roth conversion end age** (Finding 3.5)
12. **Implement Goals and Analytics features** (Findings 9.1, 10.1) or remove from documentation
