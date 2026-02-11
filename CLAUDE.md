# Networth Pro - Project Context

## Architecture

- **Backend:** Python FastAPI (`backend/`), SQLModel ORM, SQLite DB at `backend/data/networth.db`
- **Frontend:** Next.js + TypeScript (`frontend/`), shadcn/ui components, Tailwind CSS
- **Backend runs:** `.venv/bin/uvicorn main:app --reload --host 0.0.0.0 --port 8000`
- **Frontend runs:** `npm run dev` on port 3000
- **API prefix:** `/api/v1/` (routes registered in `backend/main.py`)

## Key Features

- Net worth tracking (accounts, liabilities, balance snapshots)
- Investment portfolio tracking with real-time stock prices
- Real estate management with RentCast property valuations
- Budget tracking with transaction import from bank statements (CSV, OFX, PDF, images)
- AI-powered insights, categorization, and financial stories
- News feed based on portfolio holdings
- Retirement planning calculator

## Multi-AI Provider System (Just Completed)

### Provider Abstraction Layer (`backend/services/ai_provider.py`)
- `AIProvider` enum: GROQ, OPENAI, CLAUDE, KIMI, GEMINI
- `BaseAIClient` ABC with `chat_completion()` and `vision_completion()` methods
- 5 concrete clients: GroqClient, OpenAIClient, ClaudeClient, KimiClient, GeminiClient
- `resolve_provider()` - smart auto-fallback: if chosen provider has no key, scans all providers for one that does
- `PROVIDER_CONFIG` dict with model defaults, key settings, capabilities per provider
- Groq is default (free tier, no credit card needed)

### Settings (`backend/api/settings.py`)
- Known settings: `groq_api_key`, `openai_api_key`, `claude_api_key`, `kimi_api_key`, `gemini_api_key`, `ai_provider`, `ai_model`, `rentcast_api_key`, `default_currency`
- `GET /settings/ai-providers` returns all providers with active/configured status
- Route ordering matters: `/settings/ai-providers` must come BEFORE `/settings/{key}`

### AI Insights (`backend/services/ai_insights.py`)
- `generate_dashboard_insights()` - cross-domain financial insights (portfolio, real estate, debt, milestones)
- `generate_financial_stories()` - engaging narratives connecting data points
- `generate_spending_insights()` / `generate_enhanced_spending_insights()` - budget analysis
- All functions fall back to rich rule-based insights when AI is unavailable
- Uses `_make_ai_request()` with retry/backoff logic

### Frontend Settings Page (`frontend/app/settings/page.tsx`)
- Provider dropdown selector + model override input
- Per-provider API key management with show/hide toggle
- Status badges (Configured/Not configured), capability notes

## Current State

- **OpenAI key:** Configured but has `insufficient_quota` error (credits expired)
- **Groq key:** Not configured (user should set one up for free AI features)
- **Dashboard shows:** 8 rich rule-based insights + 3 financial stories + 8 news articles
- **All changes committed:** `17253cb feat: multi-AI provider support with auto-fallback and richer insights`

## Known Issues

- Pre-existing: `statement-upload.tsx:398` has a `title` prop on a Sparkles Lucide component that causes a TypeScript warning (not from our changes)
- OpenAI quota is expired, so AI features fall back to rule-based (user needs to add a Groq key for free AI)

## File Map (Key Files)

```
backend/
  main.py                          # FastAPI app setup, route registration
  api/
    settings.py                    # Settings CRUD + /ai-providers endpoint
    budget_ai.py                   # AI categorization, spending insights
    dashboard_ai.py                # Dashboard AI insights + financial stories
    statements.py                  # Bank statement parsing + import
  services/
    ai_provider.py                 # Provider abstraction layer (NEW)
    ai_insights.py                 # AI insight generation + rule-based fallbacks
    statement_parser.py            # CSV/OFX/PDF/image statement parsing
    news_fetcher.py                # Google News RSS fetcher
  models/                          # SQLModel database models
  core/database.py                 # Database engine + session

frontend/
  lib/api.ts                       # API client functions + types
  app/settings/page.tsx            # Settings page with provider management
  components/dashboard/
    dashboard-insights.tsx          # Financial insights card
    financial-stories.tsx           # Stories + news card
  components/budget/
    ai-insights-panel.tsx           # Budget AI insights
    statement-upload.tsx            # Statement upload dialog
```
