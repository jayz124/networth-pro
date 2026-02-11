# FastAPI → Next.js API Routes Rewrite Status

## Branch: `rewrite/nextjs-api-routes`

## Overview

All 62 Python FastAPI endpoints have been converted to Next.js App Router API routes. The frontend `lib/api.ts` already uses relative `/api/v1/...` paths, so no URL changes were needed — the routes serve directly from Next.js.

## Commits

| Commit | Description |
|--------|-------------|
| `5a4c628` | Dashboard + networth endpoints + Prisma schema (Gemini) |
| `1baf643` | Shared services: FX, market data, encryption, AI, validators |
| `fb8df0c` | All 59 remaining routes + 4 domain services |
| `53382de` | Fix: rename create-subscription route to match api.ts |

## Shared Services

| File | Purpose |
|------|---------|
| `lib/services/fx-service.ts` | Frankfurter API, 3-tier fallback, 29 currencies |
| `lib/services/market-data.ts` | yahoo-finance2, DB-backed PriceCache (5-min TTL) |
| `lib/services/encryption.ts` | AES-256-GCM, `enc::` prefix, file-based key |
| `lib/services/ai-service.ts` | Groq/OpenAI/Claude/Kimi/Gemini, auto-fallback, retry |
| `lib/services/networth.ts` | Net worth calculation with real FX conversion |
| `lib/services/ai-insights.ts` | Dashboard + spending AI insights, rule-based fallbacks |
| `lib/services/news-fetcher.ts` | Google News RSS, smart ticker queries, 30-min cache |
| `lib/services/property-valuation.ts` | RentCast AVM, search, rent estimates, 30-day cache |
| `lib/services/statement-parser.ts` | CSV/OFX parsing, auto-detection, bank configs |
| `lib/validators/shared.ts` | Zod schemas for all POST/PUT request bodies |

## Route Map (62 routes)

### Net Worth (3 routes)
| Method | Path | File |
|--------|------|------|
| GET | `/api/v1/networth` | `networth/route.ts` |
| GET | `/api/v1/networth/history` | `networth/history/route.ts` |
| GET | `/api/v1/networth/breakdown` | `networth/breakdown/route.ts` |

### Accounts (4 routes)
| Method | Path | File |
|--------|------|------|
| GET, POST | `/api/v1/accounts` | `accounts/route.ts` |
| GET | `/api/v1/accounts/summary` | `accounts/summary/route.ts` |
| GET, PUT, DELETE | `/api/v1/accounts/:id` | `accounts/[id]/route.ts` |
| POST | `/api/v1/accounts/:id/balance` | `accounts/[id]/balance/route.ts` |

### Liabilities (3 routes)
| Method | Path | File |
|--------|------|------|
| GET, POST | `/api/v1/liabilities` | `liabilities/route.ts` |
| GET, PUT, DELETE | `/api/v1/liabilities/:id` | `liabilities/[id]/route.ts` |
| POST | `/api/v1/liabilities/:id/balance` | `liabilities/[id]/balance/route.ts` |

### Portfolios & Holdings (7 routes)
| Method | Path | File |
|--------|------|------|
| GET, POST | `/api/v1/portfolios` | `portfolios/route.ts` |
| POST | `/api/v1/portfolios/refresh-all` | `portfolios/refresh-all/route.ts` |
| GET, PUT, DELETE | `/api/v1/portfolios/:id` | `portfolios/[id]/route.ts` |
| POST | `/api/v1/portfolios/:id/holdings` | `portfolios/[id]/holdings/route.ts` |
| POST | `/api/v1/portfolios/:id/refresh` | `portfolios/[id]/refresh/route.ts` |
| GET | `/api/v1/portfolio/holdings` | `portfolio/holdings/route.ts` |
| PUT, DELETE | `/api/v1/holdings/:id` | `holdings/[id]/route.ts` |

### Securities (3 routes)
| Method | Path | File |
|--------|------|------|
| GET | `/api/v1/securities/search?q=` | `securities/search/route.ts` |
| GET | `/api/v1/securities/:ticker/quote` | `securities/[ticker]/quote/route.ts` |
| POST | `/api/v1/securities/batch-quotes` | `securities/batch-quotes/route.ts` |

### Properties & Mortgages (10 routes)
| Method | Path | File |
|--------|------|------|
| GET, POST | `/api/v1/properties` | `properties/route.ts` |
| GET | `/api/v1/properties/summary` | `properties/summary/route.ts` |
| POST | `/api/v1/properties/refresh-values` | `properties/refresh-values/route.ts` |
| GET | `/api/v1/properties/valuation/search?q=` | `properties/valuation/search/route.ts` |
| GET | `/api/v1/properties/valuation/status` | `properties/valuation/status/route.ts` |
| GET, PUT, DELETE | `/api/v1/properties/:id` | `properties/[id]/route.ts` |
| POST | `/api/v1/properties/:id/mortgage` | `properties/[id]/mortgage/route.ts` |
| GET | `/api/v1/properties/:id/valuation?refresh=` | `properties/[id]/valuation/route.ts` |
| GET | `/api/v1/properties/:id/value-history` | `properties/[id]/value-history/route.ts` |
| PUT, DELETE | `/api/v1/properties/mortgages/:id` | `properties/mortgages/[id]/route.ts` |

### Retirement Plans (4 routes)
| Method | Path | File |
|--------|------|------|
| GET, POST | `/api/v1/retirement/plans` | `retirement/plans/route.ts` |
| GET | `/api/v1/retirement/plans/active` | `retirement/plans/active/route.ts` |
| GET, PUT, DELETE | `/api/v1/retirement/plans/:id` | `retirement/plans/[id]/route.ts` |
| POST | `/api/v1/retirement/plans/:id/activate` | `retirement/plans/[id]/activate/route.ts` |

### Budget (10 routes)
| Method | Path | File |
|--------|------|------|
| GET, POST | `/api/v1/budget/categories` | `budget/categories/route.ts` |
| PUT, DELETE | `/api/v1/budget/categories/:id` | `budget/categories/[id]/route.ts` |
| GET, POST | `/api/v1/budget/transactions` | `budget/transactions/route.ts` |
| PUT, DELETE | `/api/v1/budget/transactions/:id` | `budget/transactions/[id]/route.ts` |
| GET, POST | `/api/v1/budget/subscriptions` | `budget/subscriptions/route.ts` |
| PUT, DELETE | `/api/v1/budget/subscriptions/:id` | `budget/subscriptions/[id]/route.ts` |
| GET | `/api/v1/budget/summary` | `budget/summary/route.ts` |
| GET | `/api/v1/budget/cash-flow?months=` | `budget/cash-flow/route.ts` |
| GET | `/api/v1/budget/forecast?months=` | `budget/forecast/route.ts` |

### Budget AI (5 routes)
| Method | Path | File |
|--------|------|------|
| GET | `/api/v1/budget/ai/status` | `budget/ai/status/route.ts` |
| POST | `/api/v1/budget/ai/categorize` | `budget/ai/categorize/route.ts` |
| GET | `/api/v1/budget/ai/insights?enhanced=` | `budget/ai/insights/route.ts` |
| POST | `/api/v1/budget/ai/detect-subscriptions?months=` | `budget/ai/detect-subscriptions/route.ts` |
| POST | `/api/v1/budget/ai/create-subscription-from-detection` | `budget/ai/create-subscription-from-detection/route.ts` |

### Statements (4 routes)
| Method | Path | File |
|--------|------|------|
| POST | `/api/v1/budget/statements/parse` | `budget/statements/parse/route.ts` |
| POST | `/api/v1/budget/statements/import` | `budget/statements/import/route.ts` |
| POST | `/api/v1/budget/statements/ai-review` | `budget/statements/ai-review/route.ts` |
| GET | `/api/v1/budget/statements/supported-formats` | `budget/statements/supported-formats/route.ts` |

### Dashboard AI (2 routes)
| Method | Path | File |
|--------|------|------|
| GET | `/api/v1/dashboard/ai/insights` | `dashboard/ai/insights/route.ts` |
| GET | `/api/v1/dashboard/ai/stories?refresh=` | `dashboard/ai/stories/route.ts` |

### Settings (8 routes)
| Method | Path | File |
|--------|------|------|
| GET | `/api/v1/settings` | `settings/route.ts` |
| GET | `/api/v1/settings/ai-providers` | `settings/ai-providers/route.ts` |
| GET | `/api/v1/settings/export` | `settings/export/route.ts` |
| POST | `/api/v1/settings/import` | `settings/import/route.ts` |
| POST | `/api/v1/settings/reset-database` | `settings/reset-database/route.ts` |
| POST | `/api/v1/settings/encrypt-existing` | `settings/encrypt-existing/route.ts` |
| POST | `/api/v1/settings/rotate-encryption-key` | `settings/rotate-encryption-key/route.ts` |
| GET, PUT, DELETE | `/api/v1/settings/:key` | `settings/[key]/route.ts` |

## Extra Routes (not in api.ts)

These routes exist but don't have corresponding functions in `lib/api.ts` yet:

| Route | Purpose |
|-------|---------|
| `GET /api/v1/networth/breakdown` | Detailed breakdown by category with item-level data |
| `POST /api/v1/securities/batch-quotes` | Batch price fetch for multiple tickers |
| `POST /api/v1/settings/encrypt-existing` | Re-encrypt all secret settings |
| `POST /api/v1/settings/rotate-encryption-key` | Rotate the encryption master key |

## npm Dependencies Added

| Package | Purpose |
|---------|---------|
| `yahoo-finance2` | Stock/ETF/crypto price data |
| `openai` | OpenAI + Groq + Kimi (OpenAI-compatible) |
| `@anthropic-ai/sdk` | Claude (Anthropic) |
| `@google/genai` | Google Gemini |
| `zod` | Request body validation |

## What's Left

1. **Runtime testing** — Start the Next.js dev server and test each endpoint
2. **Remove Python backend dependency** — Once all routes are verified working, the `backend/` directory can be retired
3. **Auth layer** — Currently no authentication (matches the Python backend's state)
