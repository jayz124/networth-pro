# NetWorth Pro v1.3.3

A comprehensive personal finance and retirement planning application with multi-tab net worth tracking and advanced retirement simulations.

## Features

### Dashboard
- Real-time net worth tracking
- Historical net worth visualization
- Asset allocation overview

### Portfolio Management
- Track stocks, ETFs, bonds, mutual funds, crypto
- Real-time price updates
- Performance analytics

### Assets & Liabilities
- Bank accounts, savings, cash tracking
- Debt management and payoff tracking
- Net worth calculation

### Real Estate
- Property value tracking
- Mortgage management
- Rental property income

### Retirement Planning (v1.3+)

#### Essential Mode (Simplified)
- 22 key fields for quick retirement planning
- Auto-sync from Portfolio, Assets, Real Estate, Liabilities tabs
- Simple assumptions (blended return rate, single tax rate)

#### Pro Mode (Advanced)
- 50+ configurable fields
- **15 Country Tax Profiles**: US (Federal, TX, CA, NY), UK, IE, AU, CA, DE, FR, ES, CH, SG, AE, CY
- **Multi-Account Support**: Taxable, Tax-Deferred (401k/IRA), Tax-Free (Roth)
- **Cost Basis Tracking**: Accurate capital gains calculations
- **RMD Calculations**: Required Minimum Distributions for US, Canada, Australia
- **Withdrawal Strategies**: Standard, Tax-Sensitive, Pro-Rata
- **Roth Conversion Strategies**: None, Fill Bracket, Fixed Amount
- **Stress Testing**: Market crash simulation with recovery
- **Monte Carlo Analysis**: Historical bootstrapping (1928-2023 data)

#### Pro Mode Visualizations
- Net Worth Projection (Aggregated/Detailed view)
- Asset Breakdown by Type
- Asset Allocation Over Time
- Income Composition Chart
- **Tax Efficiency Chart** (Pro only)
- Debt Service Analysis
- **Cash Flow Sankey Diagram** (Pro only)
- Cash Flow Explorer

### Settings
- Multi-currency support with live conversion rates
- Theme customization (Dark/Light/System)

---

## Quick Start

### Prerequisites
- Node.js 18+
- Python 3.10+

### Backend (FastAPI)

```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # or .venv\Scripts\activate on Windows
pip install -r requirements.txt
uvicorn main:app --reload
```

API Docs: http://127.0.0.1:8000/docs

### Frontend (Next.js)

```bash
cd frontend
npm install
npm run dev
```

App: http://localhost:3000

---

## Version History

### v1.3.3 (Current)
- **Retirement Pro Engine**: Comprehensive simulation with 15 country tax profiles
- **Tax Efficiency Chart**: Visualize gross income, taxes, and net income over time
- **Cash Flow Sankey Diagram**: Interactive flow visualization at any age
- **Country Tax Selector**: Choose your tax jurisdiction for accurate calculations
- Added RMD support for US (age 73), Canada (age 72), Australia (age 60)
- Historical Monte Carlo with 95 years of market data

### v1.3.2
- Essential vs Pro mode for Retirement tab
- Auto-sync from Portfolio, Assets, Real Estate, Liabilities
- Mode toggle with configuration conversion

### v1.3.1
- Retirement page enhancements
- UI component improvements

### v1.3.0
- Settings tab with live currency conversion
- Multi-currency support

### v1.2.0
- Retirement tab and navigation

### v1.1.0
- "Midnight Finance" theme UI overhaul

---

## Tech Stack

### Frontend
- Next.js 16.1
- React 19
- TypeScript
- Tailwind CSS 4
- Recharts (charts)
- Nivo (Sankey diagrams)
- Radix UI (components)

### Backend
- FastAPI
- SQLite (local storage)
- Python 3.10+

---

## Project Structure

```
networth-pro/
├── backend/
│   ├── api/            # API routes
│   ├── models/         # Database models
│   └── main.py         # FastAPI app
├── frontend/
│   ├── app/            # Next.js pages
│   ├── components/     # React components
│   │   └── retirement/ # Retirement-specific components
│   ├── lib/            # Utilities & logic
│   │   ├── retirement-logic.ts      # Core calculations
│   │   ├── retirement-pro/          # Pro simulation engine
│   │   │   ├── engine.ts            # Main simulation
│   │   │   ├── tax-engine.ts        # Tax calculations
│   │   │   ├── tax-profiles.ts      # 15 country profiles
│   │   │   ├── rmd-tables.ts        # RMD by country
│   │   │   ├── monte-carlo.ts       # Historical bootstrapping
│   │   │   └── historical-returns.ts # 1928-2023 data
│   │   └── settings-context.tsx     # App settings
│   └── public/
└── README.md
```

---

## License

Private - All Rights Reserved
