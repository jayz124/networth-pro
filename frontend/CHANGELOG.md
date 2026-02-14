# Changelog

## v1.6.0 — 2026-02-14

Complete architecture rewrite from a Python/FastAPI + SQLite backend to a unified
Next.js application with API routes, Supabase (PostgreSQL), and Clerk authentication.

### Architecture

- **Removed legacy `backend/` directory** — Python FastAPI server, SQLModel ORM,
  all Python dependencies and virtual-env scaffolding are gone.
- **64 API routes converted to Next.js** (`app/api/v1/...`) covering: net worth,
  accounts, liabilities, portfolios, securities, real estate, properties, mortgages,
  valuations, budget (transactions, subscriptions, categories, summary, AI insights),
  dashboard AI (insights, stories), retirement plans, settings, Plaid, and statement
  parsing.
- **Service layer** (`lib/services/`) for net worth calculation, portfolio queries,
  FX conversion, property valuation, encryption, and AI provider abstraction.
- **Zod validation** (`lib/validators/`) for all mutation endpoints.

### Database

- **Migrated from SQLite to Supabase (PostgreSQL).**
- **Prisma 7** with `@prisma/adapter-pg` (PrismaPg driver adapter) replaces
  SQLModel. Schema defined in `prisma/schema.prisma`, config in `prisma.config.ts`.
- **Migration script** (`scripts/migrate-data.ts`) reads a local SQLite database
  and inserts all records into Supabase, remapping foreign keys.
- `prebuild` script added to `package.json` so `prisma generate` runs before every
  build (required for Netlify deploys).

### Authentication & Multi-Tenancy

- **Clerk** integrated via `@clerk/nextjs` — middleware protects all routes,
  sign-in/sign-up pages under `/sign-in` and `/sign-up`.
- Every user-facing model is scoped by `user_id` (Clerk user ID). All 64 API
  routes call `auth()` and reject requests without a valid session.
- Server components (`app/page.tsx`, `app/portfolio/page.tsx`) call service
  functions directly with the authenticated `userId` — no HTTP round-trip.

### Deployment

- **Netlify** configuration added (`netlify.toml`) with `@netlify/plugin-nextjs`.
- Build command: `npm run build`, publish directory: `.next`.

### Verification & Fixes

- **Retirement projection math validated** — all Coast FIRE, Lean FIRE,
  Traditional, and Barista FIRE scenarios pass with 0% deviation across 28
  assertions.
- **Snapshot system verified** — net worth snapshots persisted and retrieved
  correctly for authenticated users.
- **Budget date parsing fix** — transaction date handling corrected for edge cases.
- **Plaid stub routes** return 501 (Not Implemented) — Plaid integration is
  scaffolded but not yet configured.

### Other Changes

- Multi-AI provider support (Groq, OpenAI, Claude, Gemini, Kimi) with automatic
  fallback when a provider key is missing or quota is exhausted.
- Encrypted API key storage with AES-256-GCM (settings marked `is_secret`).
- RentCast property valuation integration.
- Bank statement import (CSV, OFX, PDF, image) with AI-powered categorisation.

---

## v1.4.0

Pre-rewrite checkpoint. Python/FastAPI backend with SQLite, Next.js frontend.
