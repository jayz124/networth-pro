# Changelog

All notable changes to NetWorth Pro will be documented in this file.

## [1.3.5] - 2025-01-31

### Added
- **Bank Statement Upload with AI Enhancement**
  - Support for CSV, OFX/QFX file formats (no AI required)
  - Support for PDF and image files (requires OpenAI API key)
  - Intelligent column auto-detection for CSV files
  - Smart date format detection (DD/MM/YYYY vs MM/DD/YYYY)
  - AI-powered transaction categorization when OpenAI key is configured
  - AI Review button to re-run categorization on parsed transactions
  - Clean description extraction from messy bank data
  - Merchant name extraction
  - Pattern recognition (e.g., large deposits from employers = salary, not subscriptions)

- **Statement Upload UI Enhancements**
  - "AI Enhanced" badge when transactions have been AI-reviewed
  - Sparkles icon indicator on individual AI-reviewed transactions
  - Shows cleaned descriptions when available
  - AI Review button visible when AI is available but not yet enhanced

### Changed
- Updated version to 1.3.5
- Improved statement parser with better error handling and fallback logic

### Technical
- Added `aiReviewTransactions()` API function
- Added `/budget/statements/ai-review` endpoint for re-running AI categorization
- Added `re` import to `ai_insights.py` for regex parsing
- Enhanced `ParsedTransaction` type with `clean_description` and `ai_reviewed` fields

---

## [1.3.3] - 2025-01-29

### Added
- **Retirement Pro Simulation Engine** - Comprehensive year-by-year simulation with:
  - 15 country tax profiles (US variants, UK, IE, AU, CA, DE, FR, ES, CH, SG, AE, CY)
  - Tax-efficient withdrawal ordering (Standard, Tax-Sensitive, Pro-Rata)
  - Required Minimum Distribution (RMD) calculations for US, Canada, Australia
  - Roth conversion strategies (Fill Bracket, Fixed Amount)
  - Cost basis tracking for accurate capital gains
  - Historical bootstrapping Monte Carlo (1928-2023 market data)

- **Tax Efficiency Chart** (Pro Mode only)
  - Visualize gross income, taxes paid, and net income over time
  - Retirement age marker
  - Interactive tooltips

- **Cash Flow Sankey Diagram** (Pro Mode only)
  - Interactive flow visualization showing income sources and outflows
  - Age navigation (step through each year)
  - Color-coded flows by category
  - Handles surplus and deficit scenarios

- **Country Tax Selector** in Pro Mode sidebar
  - Choose from 15 countries/regions for accurate tax calculations
  - Includes US state variants (TX, CA, NY)

### Changed
- Updated package version to 1.3.3
- Enhanced Pro Mode with comprehensive simulation engine
- Improved documentation

### Dependencies
- Added `@nivo/sankey` and `@nivo/core` for Sankey diagrams

---

## [1.3.2] - 2025-01-28

### Added
- **Essential vs Pro Mode** for Retirement tab
  - Essential Mode: 22 simplified fields for quick planning
  - Pro Mode: 50+ fields for comprehensive planning
  - Mode toggle with smooth configuration conversion

- **Auto-Sync Feature** (Essential Mode)
  - Automatically populate from Portfolio, Assets, Real Estate, Liabilities tabs
  - Manual sync button with loading state
  - Synced field indicators

- **Retirement Mode Context**
  - localStorage persistence for mode preference
  - React Context for global state

### Changed
- Split Retirement sidebar into Essential and Pro variants
- Added mode toggle component with segmented control UI

---

## [1.3.1] - 2025-01-27

### Added
- Retirement page UI enhancements
- Net worth calculation fixes (mortgages as liabilities)

### Changed
- Improved accordion sections in retirement sidebar
- Better mobile responsiveness

---

## [1.3.0] - 2025-01-26

### Added
- **Settings Tab** with live currency conversion
- Multi-currency support (USD, GBP, EUR, CAD, AUD, CHF, JPY, SGD, AED)
- Currency context for app-wide formatting

### Changed
- All monetary values now respect user's currency preference
- Real-time exchange rate fetching

---

## [1.2.0] - 2025-01-25

### Added
- **Retirement Tab** with comprehensive planning features
- Navigation between tabs
- Retirement projection charts

---

## [1.1.0] - 2025-01-24

### Added
- **"Midnight Finance" Theme** - Complete UI/UX overhaul
- Dark mode optimized design
- Consistent color palette across all tabs

### Changed
- Card layouts and typography
- Chart styling and colors
- Navigation and header design

---

## [1.0.0] - 2025-01-20

### Added
- Initial release
- Dashboard with net worth tracking
- Portfolio management
- Assets tab
- Liabilities tab
- Real Estate tab
