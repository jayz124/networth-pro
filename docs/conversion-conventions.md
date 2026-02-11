# FastAPI → Next.js API Route Conversion Conventions

## Architecture Pattern

Each FastAPI router maps to a directory under `frontend/app/api/v1/`. Route handlers are thin — they validate input, call a service function, and return `NextResponse.json()`.

## File Structure

```
frontend/
  app/api/v1/
    networth/
      route.ts                 # GET /api/v1/networth
      history/route.ts         # GET /api/v1/networth/history
      breakdown/route.ts       # GET /api/v1/networth/breakdown
    accounts/
      route.ts                 # GET (list), POST (create)
      summary/route.ts         # GET /api/v1/accounts/summary (BEFORE [id])
      [id]/
        route.ts               # GET, PUT, DELETE
        balance/route.ts       # POST /api/v1/accounts/[id]/balance
    portfolios/
      route.ts                 # GET (list), POST (create)
      refresh-all/route.ts     # POST (BEFORE [id])
      [id]/
        route.ts               # GET, PUT, DELETE
        holdings/route.ts      # POST (add holding)
        refresh/route.ts       # POST (refresh prices)
    holdings/
      [id]/route.ts            # PUT, DELETE (holdings by ID are flat)
    securities/
      search/route.ts          # GET /api/v1/securities/search?q=
      [ticker]/
        quote/route.ts         # GET /api/v1/securities/AAPL/quote
    properties/
      route.ts                 # GET (list), POST (create)
      summary/route.ts         # GET (BEFORE [id])
      refresh-values/route.ts  # POST (BEFORE [id])
      valuation/
        search/route.ts        # GET ?q=
        status/route.ts        # GET
      [id]/
        route.ts               # GET, PUT, DELETE
        mortgage/route.ts      # POST (add mortgage)
        valuation/route.ts     # GET ?refresh=
        value-history/route.ts # GET
    properties/mortgages/
      [id]/route.ts            # PUT, DELETE
    liabilities/
      route.ts                 # GET (list), POST (create)
      [id]/
        route.ts               # GET, PUT, DELETE
        balance/route.ts       # POST
    retirement/plans/
      route.ts                 # GET (list), POST (create)
      active/route.ts          # GET (BEFORE [id])
      [id]/
        route.ts               # GET, PUT, DELETE
        activate/route.ts      # POST
    budget/
      categories/
        route.ts               # GET, POST
        [id]/route.ts          # PUT, DELETE
      transactions/
        route.ts               # GET (with query params), POST
        [id]/route.ts          # PUT, DELETE
      subscriptions/
        route.ts               # GET, POST
        [id]/route.ts          # PUT, DELETE
      summary/route.ts         # GET
      cash-flow/route.ts       # GET ?months=
      forecast/route.ts        # GET ?months=
      ai/
        status/route.ts        # GET
        categorize/route.ts    # POST
        insights/route.ts      # GET ?enhanced=
        detect-subscriptions/route.ts   # POST ?months=
        create-subscription/route.ts    # POST
      statements/
        parse/route.ts         # POST (file upload)
        import/route.ts        # POST
        ai-review/route.ts     # POST
        supported-formats/route.ts  # GET
    dashboard/ai/
      insights/route.ts        # GET
      stories/route.ts         # GET ?refresh=
    settings/
      route.ts                 # GET (list all)
      ai-providers/route.ts    # GET (BEFORE [key])
      export/route.ts          # GET
      import/route.ts          # POST (file upload)
      reset-database/route.ts  # POST
      encrypt-existing/route.ts  # POST
      rotate-encryption-key/route.ts  # POST
      [key]/route.ts           # GET, PUT, DELETE
```

## CRITICAL: Static vs Dynamic Route Ordering

Next.js App Router resolves static routes BEFORE dynamic `[param]` routes automatically. Just place the files correctly:

- `summary/route.ts` and `[id]/route.ts` can coexist — `/summary` resolves first
- `active/route.ts` and `[id]/route.ts` can coexist — `/active` resolves first
- `ai-providers/route.ts` and `[key]/route.ts` can coexist

## Route Handler Pattern

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET handler
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const item = await prisma.account.findUnique({
            where: { id: parseInt(id) },
        });
        if (!item) {
            return NextResponse.json({ detail: 'Not found' }, { status: 404 });
        }
        return NextResponse.json(item);
    } catch (error) {
        console.error('Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

// POST handler
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        // Validate with Zod
        const parsed = createAccountSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { detail: parsed.error.errors[0].message },
                { status: 422 }
            );
        }
        const item = await prisma.account.create({ data: parsed.data });
        return NextResponse.json(item, { status: 201 });
    } catch (error) {
        console.error('Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
```

## Key Conventions

1. **Import `prisma` from `@/lib/prisma`** — never instantiate PrismaClient directly
2. **Import Zod schemas from `@/lib/validators/shared`** — validate all POST/PUT bodies
3. **Import services from `@/lib/services/`** — FX, market data, encryption, AI
4. **Error responses**: Use `{ detail: string }` for 4xx, `{ error: string }` for 5xx
5. **Dynamic route params**: In Next.js 15+, `params` is a Promise — must `await params`
6. **Query params**: Use `request.nextUrl.searchParams.get('key')`
7. **No `cache: 'no-store'` in API routes** — that's for `fetch()` calls in components
8. **Return types must match `frontend/lib/api.ts`** — this is the contract

## Service Layer

Heavy logic lives in `lib/services/`:
- `networth.ts` — net worth calculation, snapshots
- `fx-service.ts` — currency conversion (Frankfurter API, 3-tier fallback)
- `market-data.ts` — stock/crypto prices (yahoo-finance2, PriceCache)
- `encryption.ts` — AES-256-GCM for API keys (enc:: prefix)
- `ai-service.ts` — multi-provider AI (Groq, OpenAI, Claude, Kimi, Gemini)

## Response Shape Contract

The frontend `lib/api.ts` defines TypeScript interfaces for every response. Your API routes MUST return data matching these shapes exactly. Key interfaces:

- `Account` — includes `id`, `name`, `institution`, `type`, `currency`, `current_balance`, `tags`, `created_at`, `updated_at`
- `Liability` — same shape as Account plus `category`
- `Portfolio` — `id`, `name`, `description`, `currency`, `is_active`
- `Holding` — includes computed fields: `current_value`, `cost_basis`, `unrealized_gain`, `gain_percent`, `portfolio_name`, `name`
- `Property` — includes computed fields from valuations: `equity`, `total_mortgage_balance`, `monthly_payments`, `appreciation`, `appreciation_percent`, plus valuation fields
- `Mortgage` — direct DB fields
- `RetirementPlan` — includes `config_json` as string
- `BudgetCategory` — direct DB fields
- `Transaction` — includes joined fields: `category_name`, `category_color`, `account_name`
- `Subscription` — includes joined field: `category_name`

## Date Handling

- Prisma DateTime fields return JS `Date` objects — NextResponse.json() auto-serializes to ISO strings
- String date fields (e.g., `NetWorthSnapshot.date`) remain strings
- For `BalanceSnapshot.date`, use `new Date()` when creating, it's a DateTime in the schema

## FX Conversion

```typescript
import { convert } from '@/lib/services/fx-service';
const converted = await convert(amount, fromCurrency, baseCurrency);
```

## Encryption (Settings)

```typescript
import { encrypt, decrypt, isEncrypted } from '@/lib/services/encryption';

// On write (PUT /settings/{key})
if (isSecret) {
    storeValue = encrypt(value);
}

// On read (internal use)
const actualValue = decrypt(setting.value);

// On read (API response to frontend)
const maskedValue = setting.is_secret ? '••••••••••••' : setting.value;
```

## Market Data

```typescript
import { searchSecurities, getQuote, getBatchQuotes } from '@/lib/services/market-data';
```

## AI Service

```typescript
import { chatCompletionWithRetry, parseJsonResponse, resolveProvider } from '@/lib/services/ai-service';
```
