# Plan: User Authentication + Onboarding Flow

## Summary
Add JWT-based authentication and a 5-step onboarding wizard to Networth Pro. First user registers freely and becomes admin; additional users require admin to be logged in. All users share the same financial data (single-tenant). The existing `python-jose` and `passlib` dependencies (already in requirements.txt) power the auth layer.

---

## Phase 1: Backend Auth

### 1.1 Add Models (`backend/models.py` -- append at bottom)
```python
class User(BaseModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    username: str = Field(index=True, unique=True)
    hashed_password: str
    display_name: Optional[str] = None
    is_active: bool = Field(default=True)
    is_admin: bool = Field(default=False)
    onboarding_completed: bool = Field(default=False)

class UserSession(BaseModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    token_jti: str = Field(index=True, unique=True)
    expires_at: datetime
    is_revoked: bool = Field(default=False)
```
Tables auto-created by existing `init_db()` -> `SQLModel.metadata.create_all(engine)`.

### 1.2 Create `backend/core/auth.py`
- `hash_password(password)` / `verify_password(plain, hashed)` using passlib bcrypt
- `create_access_token(user_id, session)` -> JWT with 30-day expiry, stores `UserSession` row
- `get_current_user(credentials, session)` -> FastAPI `Depends()` that validates Bearer token, checks session not revoked, returns `User`
- `SECRET_KEY` from env var `JWT_SECRET_KEY` with a default fallback for local use
- Uses `HTTPBearer` scheme (not OAuth2PasswordBearer) -- simpler for SPA

### 1.3 Create `backend/api/auth.py` (new router)
Endpoints (all under `/api/v1`):

| Endpoint | Auth Required | Purpose |
|----------|--------------|---------|
| `GET /auth/setup-check` | No | Returns `{needs_setup: bool}` -- true if no users exist |
| `POST /auth/register` | No* | Create user. First user auto-becomes admin. Subsequent users require admin auth header. |
| `POST /auth/login` | No | Returns `{token, user, expires_at}` |
| `POST /auth/logout` | Yes | Revokes all sessions for current user |
| `GET /auth/me` | Yes | Returns current user profile |
| `POST /auth/complete-onboarding` | Yes | Sets `onboarding_completed = true` |

*Register logic: if `user_count == 0`, allow open registration and set `is_admin=True`. If `user_count > 0`, require valid admin auth header.

### 1.4 Modify `backend/main.py`
- Import `auth` router and `get_current_user`
- Register auth router first (no auth required on it)
- Wrap all 12 existing routers with `dependencies=[Depends(get_current_user)]`:
```python
from fastapi import Depends
from core.auth import get_current_user
from api import auth

app.include_router(auth.router, prefix="/api/v1")  # Public

for r in [dashboard, portfolio, securities, real_estate, accounts,
          liabilities, retirement, budget, budget_ai, dashboard_ai,
          settings, statements]:
    app.include_router(r.router, prefix="/api/v1",
                       dependencies=[Depends(get_current_user)])

app.include_router(plaid.router, dependencies=[Depends(get_current_user)])
```
No changes needed to individual router files.

---

## Phase 2: Frontend Auth

### 2.1 Modify `frontend/lib/api.ts`
- Add `setAuthToken(token)` / `getAuthToken()` -- stores in localStorage key `networth-pro-token`
- Add `authFetch(url, options)` wrapper that injects `Authorization: Bearer <token>` header
- Add auth API functions: `checkSetup()`, `register()`, `login()`, `logout()`, `fetchCurrentUser()`, `completeOnboarding()`
- Bulk-replace all ~50 `fetch(` calls with `authFetch(` -- mechanical find-and-replace
- Add 401 response interceptor in `authFetch` that clears token and reloads on auth failure

### 2.2 Create `frontend/lib/auth-context.tsx`
- Auth state machine: `loading` | `needs_setup` | `unauthenticated` | `authenticated`
- On mount: check for existing token in localStorage -> validate via `/auth/me` -> fallback to `/auth/setup-check`
- Exposes: `state`, `login()`, `register()`, `logout()`, `refreshUser()`, `markOnboardingComplete()`

### 2.3 Create `frontend/components/auth-gate.tsx`
Conditional renderer based on auth state:
- `loading` -> centered spinner with app logo
- `needs_setup` -> `<SetupPage />`
- `unauthenticated` -> `<LoginPage />`
- `authenticated` + `!onboarding_completed` -> `<OnboardingWizard />`
- `authenticated` + `onboarding_completed` -> full app shell (sidebar + main content)

The app shell HTML (sidebar, mobile header, main) moves from `layout.tsx` into `AuthGate`.

### 2.4 Modify `frontend/app/layout.tsx`
Replace hardcoded shell with:
```tsx
<ThemeProvider ...>
  <AuthProvider>
    <SettingsProvider>
      <AuthGate>{children}</AuthGate>
    </SettingsProvider>
  </AuthProvider>
</ThemeProvider>
```

### 2.5 Create `frontend/components/auth/login-page.tsx`
- Full-screen centered card with app logo
- Username + password inputs with Lucide icons
- Error display, loading state
- Matches design system: slide-up-fade animation, accent button

### 2.6 Create `frontend/components/auth/setup-page.tsx`
- Similar to login but with: display name, username, password, confirm password
- "Welcome to Networth Pro" heading
- Auto-login after registration

### 2.7 Modify `frontend/components/app-sidebar.tsx`
- Add user avatar (initial letter) + display name + logout button at bottom
- Uses `useAuth()` hook for user data and logout

### 2.8 Convert `frontend/app/page.tsx` to Client Component
- Add `"use client"` directive
- Move `fetchNetWorth()` / `fetchHistory()` into `useEffect`
- Necessary because server components can't access the auth token from localStorage

---

## Phase 3: Onboarding Wizard

### 3.1 Create `frontend/components/onboarding/onboarding-wizard.tsx`
- Full-screen layout with progress bar at top, step content centered, navigation at bottom
- Step indicators (dot progression)
- "Skip setup" button to bypass entirely
- Each step is a separate component receiving `onNext`, `onSkip`, `onFinish` callbacks
- `key={currentStep}` on content wrapper triggers slide-up-fade re-animation on step change

### 3.2 Step Components (5 files in `frontend/components/onboarding/steps/`)

**`welcome-step.tsx`** -- Welcome screen
- App logo with gradient
- "Welcome, {displayName}!" greeting
- 3 feature highlights: track net worth, manage investments, budget intelligently
- No user input needed, just "Get Started" via onNext

**`currency-step.tsx`** -- Currency selection
- Reuses `CURRENCIES` array from `settings-context.tsx`
- `<Select>` dropdown with currency code + name + symbol
- Preview showing formatted sample amount
- Calls `useSettings().updateCurrency()` on selection

**`first-account-step.tsx`** -- Add first account (skippable)
- Simplified form: name, type (checking/savings/investment dropdown), initial balance
- Calls `createAccount()` from api.ts on submit
- Success animation with checkmark on completion
- "Skip for now" secondary button

**`ai-setup-step.tsx`** -- AI provider setup (skippable)
- Brief explanation of AI features
- Recommends Groq (free, no credit card)
- Single API key input field
- "Get a free Groq key" external link
- Calls `updateAppSetting("groq_api_key", key)` on save
- "Skip for now" secondary button

**`complete-step.tsx`** -- All done
- Success icon with celebration styling
- Summary of what was configured (currency, account, AI)
- "Go to Dashboard" button calls `completeOnboarding()` API then `markOnboardingComplete()`

---

## File Change Summary

### New Files (12)
| File | Purpose |
|------|---------|
| `backend/core/auth.py` | Password hashing, JWT, FastAPI auth dependencies |
| `backend/api/auth.py` | Auth API: register, login, logout, me, setup-check, complete-onboarding |
| `frontend/lib/auth-context.tsx` | React auth state management |
| `frontend/components/auth-gate.tsx` | Conditional render: auth screen vs app shell |
| `frontend/components/auth/login-page.tsx` | Login form |
| `frontend/components/auth/setup-page.tsx` | First-user registration form |
| `frontend/components/onboarding/onboarding-wizard.tsx` | Wizard container with progress and navigation |
| `frontend/components/onboarding/steps/welcome-step.tsx` | Welcome screen |
| `frontend/components/onboarding/steps/currency-step.tsx` | Currency picker |
| `frontend/components/onboarding/steps/first-account-step.tsx` | Add first account form |
| `frontend/components/onboarding/steps/ai-setup-step.tsx` | AI provider key setup |
| `frontend/components/onboarding/steps/complete-step.tsx` | Completion/celebration |

### Modified Files (6)
| File | Changes |
|------|---------|
| `backend/models.py` | Append `User` and `UserSession` models (~15 lines) |
| `backend/main.py` | Import auth router, register it, wrap other routers with auth dependency (~15 lines) |
| `frontend/lib/api.ts` | Add auth functions + `authFetch` wrapper, replace ~50 `fetch()` calls (~100 lines) |
| `frontend/app/layout.tsx` | Wrap with `AuthProvider`, move shell into `AuthGate` (~15 lines changed) |
| `frontend/app/page.tsx` | Convert server component to client component (~30 lines changed) |
| `frontend/components/app-sidebar.tsx` | Add user display + logout button (~25 lines) |

---

## Build Order

1. **Backend models** -> `models.py` (User, UserSession)
2. **Backend auth utils** -> `core/auth.py`
3. **Backend auth router** -> `api/auth.py`
4. **Backend route protection** -> `main.py` changes
5. **Frontend API layer** -> `api.ts` (authFetch, auth functions, bulk fetch->authFetch)
6. **Frontend auth context** -> `auth-context.tsx`
7. **Frontend auth gate** -> `auth-gate.tsx`
8. **Login + Setup pages** -> `login-page.tsx`, `setup-page.tsx`
9. **Layout integration** -> `layout.tsx` changes
10. **Dashboard conversion** -> `page.tsx` server->client component
11. **Sidebar logout** -> `app-sidebar.tsx` changes
12. **Onboarding wizard** -> wizard container + 5 step components

---

## Key Design Decisions

### Why Admin-Gated Multi-User (not single-user or open)
- Supports distribution to testers: each instance gets its own admin
- Prevents unauthorized registration if backend is accidentally exposed
- No per-user data isolation needed (single-tenant data model preserved)
- Admin can create accounts for household members or demo purposes

### Why No `user_id` on Existing Tables
- Adding `user_id` to ~15 tables would require ALTER TABLE migrations + rewriting every query
- This is a local desktop app, not a multi-tenant SaaS
- Auth protects access at the API layer (must be logged in)
- Per-user isolation can be added later if needed

### Why 30-Day Token Expiry
- Desktop app -- users shouldn't need to log in frequently
- Explicit logout revokes the session server-side
- Token is stored in localStorage for persistence across browser refreshes

### Why Convert Dashboard to Client Component
- The dashboard (`page.tsx`) is the only server component
- Server components can't access localStorage (where the JWT lives)
- All other pages are already client components -- this makes the pattern consistent
- No SEO impact since this is a local app

---

## Verification Plan

1. **Fresh start**: Stop backend, delete `networth_v2.db`, restart backend. Frontend should show setup page.
2. **Registration**: Create first user -> auto-login -> onboarding wizard appears.
3. **Onboarding**: Walk through all 5 steps. Verify currency change persists, account creation works, AI key saves.
4. **Skip onboarding**: Register new user (after reset), click "Skip setup" -> goes to dashboard.
5. **Login/Logout**: Log out from sidebar -> login page appears. Log back in -> dashboard (onboarding already complete).
6. **Auth protection**: With no token, `curl http://localhost:8000/api/v1/accounts` -> 401. With valid token header -> 200.
7. **Token persistence**: Refresh browser while logged in -> stays logged in (token in localStorage).
8. **Admin gating**: While logged in as admin, create second user via API. Without admin, registration returns 403.
9. **Existing data**: If `networth_v2.db` has existing accounts/portfolios, they remain accessible after auth is added and first user registers.
