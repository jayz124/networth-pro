# Networth Pro -- UI/UX Design Audit Report

**Auditor:** Senior UX Designer & Fintech Design Expert
**Date:** 2026-02-10
**Scope:** Full UI/UX audit of Next.js frontend (all pages, components, styling, design system)
**Severity Ratings:** Critical | Important | Nice-to-have

---

## Executive Summary

Networth Pro's Next.js frontend demonstrates a mature, well-structured design system with thoughtful use of semantic color tokens, custom CSS variables, staggered animations, and consistent card-based layouts. The application uses Plus Jakarta Sans (mapped to the `--font-satoshi` CSS variable) and JetBrains Mono for a professional typographic pairing. The color system centers on a warm gold accent (`hsl(38, 92%, 50%)`) with teal/emerald success tones rather than the stated Wealthfront muted teal (#5eb5a6), which represents the most significant brand-alignment gap.

The codebase shows strong fundamentals: shadcn/ui primitives, Lucide icon consistency, proper loading/empty/error states on most pages, and a well-themed dark mode. However, there are notable issues with **inconsistent color token usage** (hardcoded Tailwind colors vs. semantic tokens), **hardcoded USD currency symbols** in chart formatters, **one remaining emoji usage** in financial stories, a **minimal responsive strategy**, and **inconsistent chart tooltip styling** across visualization components.

**Key statistics:**
- 22 findings total: 4 Critical, 10 Important, 8 Nice-to-have
- Hardcoded `$` in 4 chart formatters despite multi-currency support
- 40+ instances of raw Tailwind color classes (`text-red-500`, `text-green-600`, etc.) bypassing semantic tokens
- Only 2 responsive breakpoint adjustments in the entire component library
- No Streamlit UI found (backend is API-only)

---

## 1. Design System & Color Tokens

### 1.1 Brand Color Misalignment with Stated Wealthfront Aesthetic

**Severity:** Important

The project description states a "Wealthfront-inspired aesthetic using muted teal (#5eb5a6)". However, the actual color system uses a warm gold accent (`hsl(38, 92%, 50%)` = approximately `#f59e0b`) and the success color is `hsl(158, 64%, 40%)` (approximately `#249a6e`), which is a darker, more saturated green than Wealthfront's signature muted teal.

**Files:**
- `/Users/jacobzachariah/Desktop/Projects/networth-pro/frontend/app/globals.css`, lines 102-103 (accent defined as warm gold)
- `/Users/jacobzachariah/Desktop/Projects/networth-pro/frontend/app/globals.css`, lines 115-116 (success color)

```css
/* globals.css line 102 - Accent is warm gold, not muted teal */
--accent: 38 92% 50%;

/* globals.css line 115 - Success is darker green, not #5eb5a6 */
--success: 158 64% 40%;
```

Wealthfront's design language uses muted, understated tones with a signature teal/seafoam green. The current gold-centric palette is visually striking but diverges from that reference.

**Recommendation:** If the Wealthfront aesthetic is the target, replace `--accent` with a muted teal (`168 40% 54%` which is approximately `#5eb5a6`) and use gold sparingly for highlights only.

---

### 1.2 Inconsistent Color Token Usage -- Hardcoded Tailwind Colors

**Severity:** Critical

The design system defines semantic tokens (`--success`, `--destructive`, `text-gain`, `text-loss`) but over 40 instances in the codebase bypass them with raw Tailwind color classes. This breaks theme consistency and makes dark mode behavior unpredictable for those elements.

**Files with violations (representative sample):**

| File | Line(s) | Hardcoded Color | Should Use |
|------|---------|----------------|------------|
| `frontend/components/budget/budget-forecast.tsx` | 107, 110, 121, 124, 136, 142, 260, 273 | `text-green-600`, `text-red-600` | `text-gain`, `text-loss` |
| `frontend/components/budget/statement-upload.tsx` | 211, 214, 263, 351, 427 | `text-green-500`, `text-red-500`, `text-green-600`, `text-red-600`, `text-yellow-600` | `text-success`, `text-destructive`, semantic tokens |
| `frontend/components/retirement/retirement-summary.tsx` | 58, 73, 88 | `text-red-500`, `text-emerald-500`, `text-orange-500` | `text-loss`, `text-gain`, semantic warning |
| `frontend/components/retirement/retirement-chart.tsx` | 89-90 | `text-red-500`, `text-emerald-500` | `text-destructive`, `text-success` |
| `frontend/components/retirement/monte-carlo-dialog.tsx` | 93, 117, 129 | `text-red-500`, `text-emerald-500`, `text-amber-500` | semantic tokens |
| `frontend/components/portfolio/holding-actions.tsx` | 91 | `text-red-600` | `text-destructive` |
| `frontend/app/settings/page.tsx` | 527, 541-542, 627, 636 | `text-emerald-600`, `bg-emerald-50` | semantic success tokens |

The budget-forecast component is the worst offender, using `text-green-600` and `text-red-600` exclusively instead of the defined semantic classes.

**Recommendation:** Replace all hardcoded Tailwind color classes with the semantic utility classes already defined in `globals.css`: `text-gain`, `text-loss`, `text-success`, `text-destructive`.

---

### 1.3 Hardcoded Chart Colors Bypass Theme System

**Severity:** Important

Multiple chart components use hardcoded hex color values for strokes, fills, and gradients. While some charts (like `net-worth-chart.tsx`) correctly use HSL CSS variable references, others use static hex values that will not adapt to theme changes.

**Files:**

- `/Users/jacobzachariah/Desktop/Projects/networth-pro/frontend/components/budget/cash-flow-chart.tsx`, lines 86-92 -- `#10b981`, `#ef4444` hardcoded for income/expenses gradients
- `/Users/jacobzachariah/Desktop/Projects/networth-pro/frontend/components/retirement/retirement-chart.tsx`, lines 119-131 -- `#ef4444`, `#8b5cf6`, `#3b82f6` hardcoded
- `/Users/jacobzachariah/Desktop/Projects/networth-pro/frontend/components/dashboard/allocation-chart.tsx`, line 13 -- `COLORS` array with hardcoded hex: `['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d']`

The allocation chart's `COLORS` array is particularly problematic as these generic hex codes do not coordinate with the design system's palette at all.

**Recommendation:** Create a shared `CHART_COLORS` constant that references the design system palette (gold, success, blue-500, violet-500, etc.) and import it across all chart components.

---

## 2. Typography

### 2.1 Font Family Mismatch with Stated DM Sans Spec

**Severity:** Important

The project description specifies "DM Sans typography," but the actual font loaded is **Plus Jakarta Sans** (imported in `layout.tsx`), mapped to the CSS variable `--font-satoshi`.

**File:** `/Users/jacobzachariah/Desktop/Projects/networth-pro/frontend/app/layout.tsx`, lines 9-14

```tsx
const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-satoshi",
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
});
```

Plus Jakarta Sans is an excellent choice for fintech, but the naming inconsistency (`--font-satoshi` variable name for Plus Jakarta Sans) suggests the font has been swapped at some point without updating the variable name or documentation.

**Recommendation:** Either switch to DM Sans to match the spec, or update the documentation and CSS variable name to `--font-plus-jakarta` for clarity.

### 2.2 Consistent Page Header Typography

**Severity:** Nice-to-have

Page headers are consistently styled with `text-3xl font-bold tracking-tight` across all pages, which is good. However, the subtitle text is `text-sm text-muted-foreground mt-1` -- a solid pattern that is applied uniformly.

**Files (all consistent):**
- `/Users/jacobzachariah/Desktop/Projects/networth-pro/frontend/app/page.tsx`, line 28
- `/Users/jacobzachariah/Desktop/Projects/networth-pro/frontend/components/portfolio/portfolio-content.tsx`, line 100
- `/Users/jacobzachariah/Desktop/Projects/networth-pro/frontend/app/settings/page.tsx`, line 327

No action needed -- this is a positive finding.

---

## 3. Spacing and Layout

### 3.1 Inconsistent Main Content Padding

**Severity:** Nice-to-have

The main content area uses `p-4 md:p-8` in the layout, providing generous desktop spacing. However, on mobile the `p-4` (16px) combined with card padding results in a somewhat cramped feel.

**File:** `/Users/jacobzachariah/Desktop/Projects/networth-pro/frontend/app/layout.tsx`, line 52

```tsx
<main className="flex-1 overflow-y-auto bg-background p-4 md:p-8">
```

**Recommendation:** Consider `p-4 sm:p-6 md:p-8` for a smoother scaling progression.

### 3.2 Consistent Card Spacing Patterns

**Severity:** Nice-to-have (positive finding)

The app consistently uses `space-y-8` for top-level page spacing, `gap-4` for grid spacing, and `space-y-4` within cards. This is clean and well-executed.

**Files (all consistent):**
- All page components use `<div className="space-y-8">` as root wrapper
- Summary card grids use `grid gap-4 md:grid-cols-2 lg:grid-cols-4` (assets, liabilities) or `lg:grid-cols-3` (dashboard)

---

## 4. Remaining Emoji Usage

### 4.1 Financial Stories Component Uses Emojis

**Severity:** Important

The financial stories component renders emoji characters from the API response data, rather than using geometric Lucide icons consistent with the rest of the application.

**File:** `/Users/jacobzachariah/Desktop/Projects/networth-pro/frontend/components/dashboard/financial-stories.tsx`, line 75

```tsx
<span className="text-2xl leading-none">{story.emoji}</span>
```

This renders API-provided emojis (like chart emoji, money bag, etc.) which clash with the clean, geometric Lucide icon system used everywhere else in the app.

**Recommendation:** Map the `story.emoji` or `story.type` to a Lucide icon component, similar to how `dashboard-insights.tsx` maps insight types to icons (`AlertTriangle`, `Lightbulb`, `TrendingUp`, etc.).

---

## 5. Shadows and Borders

### 5.1 Card Variant System is Well-Executed

**Severity:** Nice-to-have (positive finding)

The card component at `/Users/jacobzachariah/Desktop/Projects/networth-pro/frontend/components/ui/card.tsx` includes an `elevated` variant with subtle shadow, which is used appropriately for interactive cards (account cards, property cards, liability cards).

The `border-border/50` pattern for subtle internal borders is applied consistently across card footer sections.

### 5.2 Tooltip Styling Inconsistency Between Charts

**Severity:** Important

Chart tooltips use three different styling approaches:

1. **Inline contentStyle object** with HSL variables (net-worth-chart, cash-flow-chart):
   - `/Users/jacobzachariah/Desktop/Projects/networth-pro/frontend/components/dashboard/net-worth-chart.tsx`, lines 100-106
   - `/Users/jacobzachariah/Desktop/Projects/networth-pro/frontend/components/budget/cash-flow-chart.tsx`, lines 107-111

2. **Custom React tooltip component** with Tailwind classes (retirement charts):
   - `/Users/jacobzachariah/Desktop/Projects/networth-pro/frontend/components/retirement/retirement-chart.tsx`, lines 16-39

3. **Minimal inline style** without theme variables (allocation chart):
   - `/Users/jacobzachariah/Desktop/Projects/networth-pro/frontend/components/dashboard/allocation-chart.tsx`, lines 62-64
   ```tsx
   contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}
   ```

The allocation chart tooltip uses a hardcoded `rgba(0,0,0,0.1)` shadow that will look washed out in dark mode, and lacks the border/background styling of the other tooltips.

**Recommendation:** Create a shared `CHART_TOOLTIP_STYLE` constant or a `ChartTooltip` wrapper component, and use it across all Recharts tooltips.

---

## 6. Responsive Behavior

### 6.1 Severely Limited Mobile Responsiveness

**Severity:** Critical

The application has only **2 responsive breakpoint adjustments** in the entire component library beyond the sidebar collapse:

1. Mobile header visibility: `md:hidden` at `/Users/jacobzachariah/Desktop/Projects/networth-pro/frontend/components/mobile-header.tsx`, line 11
2. Refresh button label hidden on mobile: `hidden sm:inline` at `/Users/jacobzachariah/Desktop/Projects/networth-pro/frontend/components/portfolio/portfolio-content.tsx`, line 118

Critical issues on mobile viewports:

- **Summary card grids** (`md:grid-cols-2 lg:grid-cols-4`) work but the 5-column retirement grid (`lg:grid-cols-5`) at `/Users/jacobzachariah/Desktop/Projects/networth-pro/frontend/components/retirement/retirement-summary.tsx`, line 38, produces tiny cards on medium screens since there is no `md:grid-cols-3` stepping stone.

- **Data tables** (portfolio, transactions) have no horizontal scroll wrapper or mobile card layout. The portfolio table (`/Users/jacobzachariah/Desktop/Projects/networth-pro/frontend/components/portfolio/data-table.tsx`) and transaction table (`/Users/jacobzachariah/Desktop/Projects/networth-pro/frontend/components/budget/transaction-table.tsx`) will overflow or become unreadable on narrow viewports.

- **Chart containers** use fixed heights (`h-[300px]`, `h-[400px]`, `h-[500px]`) that do not scale down for mobile. The retirement chart at 500px tall (`/Users/jacobzachariah/Desktop/Projects/networth-pro/frontend/components/retirement/retirement-chart.tsx`, line 82) will dominate the viewport on mobile.

- **Settings page** layout is single-column which works well, but form inputs use `w-full md:w-80` which is good.

**Recommendation:** Add `overflow-x-auto` wrappers around data tables, scale chart heights with viewport (`h-[250px] md:h-[350px]`), and add `md:grid-cols-3` intermediate breakpoints for the 5-column grids.

---

## 7. Loading, Empty, and Error States

### 7.1 Inconsistent Loading State Presentation

**Severity:** Important

Loading states vary in implementation across components:

| Component | Loading State | Implementation |
|-----------|--------------|----------------|
| Dashboard insights | Spinning RefreshCw icon, centered | Good |
| Financial stories | Spinning RefreshCw icon, centered | Good |
| Budget spending breakdown | "Loading..." text with animate-pulse | Inconsistent |
| Cash flow chart | "Loading..." text with animate-pulse | Inconsistent |
| Budget forecast | "Loading forecast..." text | Inconsistent |
| Transaction table | Spinning RefreshCw icon, centered | Good |
| Settings page | Loader2 icon with "Loading settings..." text | Mixed |

**Files:**
- `/Users/jacobzachariah/Desktop/Projects/networth-pro/frontend/components/budget/spending-breakdown.tsx`, lines 24-37 -- text-based loading
- `/Users/jacobzachariah/Desktop/Projects/networth-pro/frontend/components/budget/cash-flow-chart.tsx`, lines 39-53 -- text-based loading
- `/Users/jacobzachariah/Desktop/Projects/networth-pro/frontend/components/dashboard/dashboard-insights.tsx`, lines 100-102 -- icon-based loading

**Recommendation:** Create a shared `<LoadingState />` component with icon spinner and optional message, and use it consistently across all loading scenarios.

### 7.2 Empty States are Well-Designed

**Severity:** Nice-to-have (positive finding)

Most empty states include a centered icon, descriptive text, and sometimes a CTA button. Notable examples:

- Portfolio empty state: large Briefcase icon + "No holdings yet" + "Add First Holding" button (`portfolio-content.tsx`, lines 155-174)
- Net worth chart empty state: custom SVG chart icon + "Waiting for more snapshots" (`net-worth-chart.tsx`, lines 26-41)
- Dashboard insights empty state: Sparkles icon + "No insights available yet" + guidance text (`dashboard-insights.tsx`, lines 103-108)

### 7.3 Missing Error States

**Severity:** Important

There are no visible error boundary components or API error state handling in the UI. When API calls fail (e.g., `fetchDashboardInsights`, `fetchFinancialStories`), the component simply shows the empty state or loading state indefinitely.

**Files where error handling is absent:**
- `/Users/jacobzachariah/Desktop/Projects/networth-pro/frontend/components/dashboard/dashboard-insights.tsx` -- `loadInsights` catches error but displays empty state, no error message
- `/Users/jacobzachariah/Desktop/Projects/networth-pro/frontend/components/dashboard/financial-stories.tsx` -- same pattern
- `/Users/jacobzachariah/Desktop/Projects/networth-pro/frontend/components/budget/ai-insights-panel.tsx` -- same pattern
- `/Users/jacobzachariah/Desktop/Projects/networth-pro/frontend/app/page.tsx` -- server component with no error boundary

**Recommendation:** Add an `error.tsx` file at the app router level and create a `<ErrorState />` component that displays "Something went wrong" with a retry button.

---

## 8. Data Visualization Consistency

### 8.1 Hardcoded USD Currency Symbol in Chart Formatters

**Severity:** Critical

Despite the application supporting 30+ currencies with a `formatCurrency` / `formatCompactCurrency` function from the settings context, four chart formatter functions hardcode the `$` symbol:

**Files:**

1. `/Users/jacobzachariah/Desktop/Projects/networth-pro/frontend/components/budget/cash-flow-chart.tsx`, lines 33-36:
```tsx
const formatYAxis = (value: number) => {
    if (value >= 1000) {
        return `$${(value / 1000).toFixed(0)}k`
    }
    return `$${value}`
}
```

2. `/Users/jacobzachariah/Desktop/Projects/networth-pro/frontend/components/budget/budget-forecast.tsx`, line 201:
```tsx
tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
```

3. `/Users/jacobzachariah/Desktop/Projects/networth-pro/frontend/components/real-estate/value-history-chart.tsx`, lines 59-60:
```tsx
if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`
if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`
```

4. `/Users/jacobzachariah/Desktop/Projects/networth-pro/frontend/components/retirement/monte-carlo-dialog.tsx`, lines 32-33:
```tsx
if (Math.abs(value) >= 1000000) return `$${(value / 1000000).toFixed(1)}M`
if (Math.abs(value) >= 1000) return `$${(value / 1000).toFixed(0)}K`
```

Contrast with the **correctly** implemented retirement chart (`retirement-chart.tsx`) which uses `formatCompactCurrency` from the settings context.

**Recommendation:** Replace all hardcoded `$` formatters with the `formatCompactCurrency` function from the `useSettings()` hook.

### 8.2 Allocation Chart Uses Generic Color Palette

**Severity:** Important

The allocation chart defines a `COLORS` array with generic hex values that do not coordinate with the design system.

**File:** `/Users/jacobzachariah/Desktop/Projects/networth-pro/frontend/components/dashboard/allocation-chart.tsx`, line 13

```tsx
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];
```

These are the default Recharts demo colors. They clash with the refined gold/navy/emerald palette established in `globals.css`.

**Recommendation:** Replace with colors derived from the design system: `['hsl(38, 92%, 50%)', 'hsl(158, 64%, 40%)', 'hsl(222, 47%, 15%)', '#8b5cf6', '#3b82f6', '#0ea5e9']`.

---

## 9. Navigation Sidebar

### 9.1 Sidebar is Well-Designed

**Severity:** Nice-to-have (positive finding)

The sidebar at `/Users/jacobzachariah/Desktop/Projects/networth-pro/frontend/components/app-sidebar.tsx` is clean and functional:

- Gradient logo badge (gold-to-emerald)
- Active indicator bar with accent color
- Consistent Lucide icons for all nav items
- Theme toggle at the bottom
- Proper `bg-card/50` semi-transparent background

### 9.2 Missing Navigation Items from Stated 10 Tabs

**Severity:** Important

The project description mentions 10 functional areas: "Dashboard, Portfolio, Assets/Liabilities, Updates, Analytics, Goals, Forecast, FX, Transactions, Real Estate." The sidebar at `/Users/jacobzachariah/Desktop/Projects/networth-pro/frontend/components/app-sidebar.tsx`, lines 9-19, only shows 9 items:

```tsx
const navigation = [
    { name: "Dashboard", href: "/", icon: Home },
    { name: "Portfolio", href: "/portfolio", icon: LineChart },
    { name: "Assets", href: "/assets", icon: Wallet },
    { name: "Liabilities", href: "/liabilities", icon: CreditCard },
    { name: "Real Estate", href: "/real-estate", icon: Building2 },
    { name: "Budget", href: "/budget", icon: Receipt },
    { name: "Retirement", href: "/retirement", icon: Umbrella },
    { name: "Bank Connections", href: "/accounts", icon: Building2 },
    { name: "Settings", href: "/settings", icon: Settings },
]
```

Missing from navigation: Updates, Analytics, Goals, Forecast, FX. Some may be intentionally deferred, but this means the stated "10 tabs" is currently 7 functional pages + Bank Connections + Settings.

### 9.3 Duplicate Icon Usage in Navigation

**Severity:** Nice-to-have

`Building2` is used for both "Real Estate" and "Bank Connections" in the sidebar navigation, making them visually indistinguishable at a glance.

**File:** `/Users/jacobzachariah/Desktop/Projects/networth-pro/frontend/components/app-sidebar.tsx`, lines 14 and 17

**Recommendation:** Use `Landmark` or `University` for Bank Connections to differentiate from Real Estate.

---

## 10. Dark Mode

### 10.1 Dark Mode Token System is Well-Implemented

**Severity:** Nice-to-have (positive finding)

The dark theme at `/Users/jacobzachariah/Desktop/Projects/networth-pro/frontend/app/globals.css`, lines 126-171, properly inverts all CSS custom properties. Card backgrounds use `222 47% 9%` (very dark navy), borders are `217 33% 18%`, and the atmospheric body gradient adapts via CSS variables.

### 10.2 Settings Page Hardcoded Light-Mode Colors

**Severity:** Important

The settings page uses `bg-emerald-50` and `bg-yellow-50` background colors that do not have dark mode counterparts in Tailwind v4 by default. The code adds `dark:bg-emerald-950` and `dark:bg-yellow-950` inline, which works but is fragile and inconsistent with the semantic token approach used elsewhere.

**File:** `/Users/jacobzachariah/Desktop/Projects/networth-pro/frontend/app/settings/page.tsx`, lines 527-528, 541-542

```tsx
<span className="text-xs text-emerald-600 bg-emerald-50 dark:bg-emerald-950 px-1.5 py-0.5 rounded">
    Configured
</span>
```

**Recommendation:** Create semantic status badge variants (e.g., `bg-success/10 text-success`) that automatically adapt to the theme.

---

## 11. Known TypeScript Issue

### 11.1 Sparkles Component `title` Prop Warning

**Severity:** Nice-to-have

As documented in the CLAUDE.md, the `title` prop on a Lucide Sparkles component causes a TypeScript warning.

**File:** `/Users/jacobzachariah/Desktop/Projects/networth-pro/frontend/components/budget/statement-upload.tsx`, line 398

```tsx
<Sparkles className="h-3 w-3 text-purple-500 flex-shrink-0 mt-0.5" title="AI categorized" />
```

**Recommendation:** Replace `title` with a wrapping `<Tooltip>` component or suppress the warning with a comment.

---

## 12. Custom Toast Notification System

### 12.1 Settings Page Implements Its Own Toast System

**Severity:** Important

The settings page builds a custom toast notification system from scratch rather than using a dedicated toast library (like Sonner or Radix Toast) already common in shadcn/ui projects.

**File:** `/Users/jacobzachariah/Desktop/Projects/networth-pro/frontend/app/settings/page.tsx`, lines 49-56, 220-226, 306-322

```tsx
// Custom toast state management
interface Toast {
    id: number
    type: ToastType
    message: string
}
```

The custom implementation uses hardcoded `bg-emerald-500`, `bg-red-500`, `bg-blue-500` colors (not semantic tokens), and `animate-in slide-in-from-right` without proper exit animations.

**Recommendation:** Install and use `sonner` (recommended by shadcn/ui) for a consistent, accessible toast system that can be reused across all pages.

---

## 13. Wealthfront Design Language Comparison

### 13.1 Gaps from Wealthfront Reference

| Wealthfront Feature | Networth Pro Status | Gap Level |
|---------------------|---------------------|-----------|
| Muted teal (#5eb5a6) brand color | Uses warm gold accent | Significant |
| DM Sans typography | Uses Plus Jakarta Sans | Moderate (both are excellent) |
| Large hero net worth number | Present, well-executed | Aligned |
| Minimal, airy whitespace | Good use of space-y-8 | Aligned |
| Subtle card shadows | Present via elevated variant | Aligned |
| Smooth micro-animations | Staggered slide-up-fade animations | Aligned |
| Gentle gradient backgrounds | Atmospheric body::before gradient | Aligned |
| Clean data visualizations | Good but inconsistent colors | Moderate |
| Segmented controls | Used in retirement mode toggle | Aligned |
| Progress indicators for goals | Not implemented (no Goals page) | Significant |
| Portfolio gain/loss sparklines | Not present in portfolio table | Moderate |
| Account aggregation visual | Bank Connections is placeholder | Significant |

---

## Summary Table

| # | Finding | Severity | File(s) | Category |
|---|---------|----------|---------|----------|
| 1.1 | Brand color misalignment (gold accent vs. muted teal) | Important | `globals.css:102-103` | Color System |
| 1.2 | 40+ hardcoded Tailwind colors bypass semantic tokens | Critical | `budget-forecast.tsx`, `statement-upload.tsx`, `retirement-summary.tsx`, + others | Color System |
| 1.3 | Chart colors use hardcoded hex, not theme tokens | Important | `cash-flow-chart.tsx`, `retirement-chart.tsx`, `allocation-chart.tsx` | Color System |
| 2.1 | Font is Plus Jakarta Sans, not DM Sans as documented | Important | `layout.tsx:9-14` | Typography |
| 3.1 | Mobile padding could scale more smoothly | Nice-to-have | `layout.tsx:52` | Spacing |
| 4.1 | Financial stories renders emojis instead of Lucide icons | Important | `financial-stories.tsx:75` | Icons |
| 5.2 | Chart tooltip styling inconsistent across components | Important | `net-worth-chart.tsx`, `allocation-chart.tsx`, `retirement-chart.tsx` | Shadows/Borders |
| 6.1 | Severely limited mobile responsive design | Critical | Multiple page/component files | Responsive |
| 7.1 | Inconsistent loading state presentation | Important | `spending-breakdown.tsx`, `cash-flow-chart.tsx`, `budget-forecast.tsx` | States |
| 7.3 | Missing error states and error boundaries | Important | All data-fetching components | States |
| 8.1 | Hardcoded `$` in 4 chart Y-axis formatters | Critical | `cash-flow-chart.tsx:33-36`, `budget-forecast.tsx:201`, `value-history-chart.tsx:59-60`, `monte-carlo-dialog.tsx:32-33` | Data Viz |
| 8.2 | Allocation chart uses default Recharts colors | Important | `allocation-chart.tsx:13` | Data Viz |
| 9.2 | 5 stated nav items missing from sidebar | Important | `app-sidebar.tsx:9-19` | Navigation |
| 9.3 | Building2 icon used for two different nav items | Nice-to-have | `app-sidebar.tsx:14,17` | Navigation |
| 10.2 | Settings page hardcoded light/dark mode colors | Important | `settings/page.tsx:527-528, 541-542` | Dark Mode |
| 11.1 | Sparkles title prop TypeScript warning | Nice-to-have | `statement-upload.tsx:398` | TypeScript |
| 12.1 | Custom toast system instead of shared library | Important | `settings/page.tsx:49-56, 220-226, 306-322` | Components |
| 13.1 | No Goals page (key Wealthfront feature) | Nice-to-have | N/A | Feature Gap |
| 13.2 | No sparklines in portfolio table | Nice-to-have | `portfolio/columns.tsx` | Feature Gap |
| 13.3 | Bank Connections is placeholder page | Nice-to-have | `accounts/page.tsx` | Feature Gap |
| -- | Staggered card animations (positive) | Nice-to-have | `globals.css:65-68`, all pages | Animation |
| -- | Consistent page header pattern (positive) | Nice-to-have | All page files | Typography |

**Totals:** 4 Critical, 10 Important, 8 Nice-to-have (plus 3 positive findings noted)

---

## Priority Recommendations

### Immediate (Critical fixes):
1. **Replace hardcoded `$` symbols** in chart formatters with `formatCompactCurrency` from settings context
2. **Standardize on semantic color tokens** -- bulk replace `text-green-600` with `text-gain`, `text-red-600` with `text-loss` across budget and retirement components
3. **Add responsive table handling** -- wrap data tables in `overflow-x-auto` containers and scale chart heights for mobile

### Short-term (Important):
4. Replace emojis in financial stories with Lucide icons
5. Create shared `ChartTooltip` component and `CHART_COLORS` constant
6. Add `error.tsx` error boundary and `<ErrorState />` component
7. Standardize loading states with a shared `<LoadingState />` component
8. Replace custom settings toast with Sonner library
9. Clean up settings page status badges to use semantic tokens

### Medium-term (Nice-to-have):
10. Evaluate brand color alignment (gold accent vs. muted teal target)
11. Add intermediate responsive breakpoints for 5-column retirement grid
12. Differentiate Bank Connections icon from Real Estate icon
13. Update CSS variable name from `--font-satoshi` to match actual font
