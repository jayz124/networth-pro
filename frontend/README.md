# NetWorth Pro Frontend v1.3.5

Next.js 16 frontend for the NetWorth Pro personal finance application.

## Quick Start

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Architecture

### App Structure (`/app`)
- `/` - Dashboard (Net Worth overview)
- `/portfolio` - Investment portfolio management
- `/assets` - Bank accounts and cash tracking
- `/liabilities` - Debt tracking
- `/real-estate` - Property management
- `/retirement` - Retirement planning (Essential & Pro modes)
- `/settings` - Currency and theme preferences

### Components (`/components`)
- `/ui` - Reusable UI components (shadcn/ui based)
- `/retirement` - Retirement-specific components
  - `config-sidebar.tsx` - Pro mode configuration
  - `essential-sidebar.tsx` - Essential mode configuration
  - `mode-toggle.tsx` - Essential/Pro mode switcher
  - `retirement-chart.tsx` - All retirement visualizations
  - `cash-flow-sankey.tsx` - Sankey diagram for cash flows
  - `monte-carlo-dialog.tsx` - Monte Carlo simulation modal
  - `cash-flow-explorer.tsx` - Year-by-year cash flow table

### Libraries (`/lib`)
- `retirement-logic.ts` - Core retirement calculations and types
- `retirement-auto-populate.ts` - Data sync from other tabs
- `retirement-mode-context.tsx` - Mode state management
- `settings-context.tsx` - App-wide settings
- `api.ts` - Backend API client

### Retirement Pro Engine (`/lib/retirement-pro`)
Comprehensive simulation engine ported from partner's retirement-planner:

| File | Purpose |
|------|---------|
| `types.ts` | Type definitions (Assets, Liabilities, TaxRules, etc.) |
| `engine.ts` | Main year-by-year simulation (~865 lines) |
| `tax-engine.ts` | Multi-type tax calculations |
| `tax-profiles.ts` | 15 country tax configurations |
| `rmd-tables.ts` | Required Minimum Distributions |
| `monte-carlo.ts` | Historical bootstrapping simulation |
| `historical-returns.ts` | 1928-2023 market data |
| `config-converter.ts` | Convert between config formats |

## Retirement Tab Modes

### Essential Mode
Simplified planning with ~22 fields:
- Personal Info (age, retirement age, life expectancy)
- Current Investments (stocks, bonds, cash, other)
- Real Estate & Debt
- Annual Cash Flow
- Retirement Spending (Go-Go/Slow-Go)
- Pension/Social Security
- Simple Assumptions (single return rate, tax rate)

### Pro Mode
Advanced planning with 50+ fields:
- Multi-account types (Taxable, Tax-Deferred, Roth)
- Cost basis tracking for capital gains
- 15 country tax profiles
- Withdrawal strategies (Standard, Tax-Sensitive, Pro-Rata)
- Roth conversion strategies
- RMD calculations
- Stress testing
- Monte Carlo analysis

## Key Dependencies

```json
{
  "next": "16.1.5",
  "react": "19.2.3",
  "recharts": "^3.7.0",
  "@nivo/sankey": "^0.99.0",
  "tailwindcss": "^4",
  "@radix-ui/*": "Various UI primitives"
}
```

## Scripts

```bash
npm run dev      # Development server
npm run build    # Production build
npm run start    # Production server
npm run lint     # ESLint
```

## Environment

All API routes run as Next.js API routes under `/api/`. No separate backend server required. No `.env` file required for local development.
