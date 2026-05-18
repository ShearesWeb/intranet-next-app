# Architecture

**Analysis Date:** 2026-04-10

## Pattern Overview

**Overall:** Next.js App Router Monolith with Supabase Backend

**Key Characteristics:**
- Next.js 15 App Router with file-system-based routing for both pages and API routes
- Supabase as the sole backend (auth, database, storage) -- no custom backend server
- Client-side state management via React Context (AuthContext) with server-side data fetching via API routes
- Feature flag system controlling service availability at both layout (UI) and API layers
- Role-based access control enforced through CCA appointment/position data from Supabase
- SST (Serverless Stack) for AWS deployment via OpenNext

## Layers

**Presentation Layer (Pages and Components):**
- Purpose: Render UI, handle user interactions, manage client-side state
- Location: `src/app/` (pages), `src/components/` (reusable components)
- Contains: Page components (`page.tsx`), layout components (`layout.tsx`), UI primitives, feature-specific components
- Depends on: AuthContext, API routes (via `fetch()`), `src/lib/` utilities
- Used by: End users via browser

**API Layer (Route Handlers):**
- Purpose: Server-side data access, authorization enforcement, business logic
- Location: `src/app/api/`
- Contains: Next.js route handlers (`route.ts`) organized by domain (user, cca, chair, holidaySubsidy, sportsCulture)
- Depends on: `src/lib/` (business logic helpers), `src/utils/supabase/server.ts` (Supabase server client), `src/types/`
- Used by: Presentation layer via `fetch()` calls

**Business Logic Layer (Lib):**
- Purpose: Shared domain logic, access control checks, feature flags, data transformation
- Location: `src/lib/`
- Contains: Authorization helpers, feature flag system, ranking metrics/comments, subsidy week logic, member management rules
- Depends on: `src/types/`, `src/utils/supabase/server.ts`
- Used by: API layer, some layout components (for feature flag checks)

**Data Access Layer (Supabase Clients):**
- Purpose: Provide authenticated Supabase clients for server and client contexts
- Location: `src/utils/supabase/`
- Contains: `server.ts` (server-side client with cookie-based auth), `client.ts` (browser client), `middleware.ts` (session refresh)
- Depends on: `@supabase/ssr`, environment variables
- Used by: API routes (server client), AuthContext (browser client), middleware

**Authentication Layer:**
- Purpose: Session management, user identity resolution, route protection
- Location: `src/middleware.ts`, `src/context/AuthContext.tsx`, `src/hoc/withAuth.tsx`, `src/lib/fetch-user-info.ts`
- Contains: Middleware for route protection, React context for client-side auth state, HOC for page protection, server-side user info fetching
- Depends on: Supabase Auth, `src/utils/supabase/`
- Used by: All protected pages and API routes

**Type Definitions:**
- Purpose: Shared TypeScript interfaces and types
- Location: `src/types/`
- Contains: User types, CCA position types, dashboard view models, holiday subsidy types
- Depends on: Nothing
- Used by: All layers

## Data Flow

**Authentication Flow:**

1. User clicks "Login Now" on `src/app/page.tsx` (landing page)
2. Redirected to `src/app/auth/login/page.tsx` which renders `src/components/auth/login-form.tsx`
3. `AuthContext.signIn()` calls `supabase.auth.signInWithOAuth({ provider: 'google' })` with redirect to `/auth/callback`
4. `src/app/auth/callback/route.ts` exchanges code for session via `supabase.auth.exchangeCodeForSession()`, validates user exists in DB via `fetchUserInfo()`, redirects to `/dashboard`
5. `src/middleware.ts` runs on `/dashboard/*` and `/auth/*` routes, calling `updateSession()` from `src/utils/supabase/middleware.ts` which validates JWT claims and redirects unauthenticated users to login
6. `AuthContext` (client-side) fetches user profile from `/api/user` which calls `fetchUserInfo()` server-side

**User Info Resolution (Server-Side):**

1. `fetchUserInfo()` in `src/lib/fetch-user-info.ts` creates a server Supabase client
2. Gets verified JWT claims via `supabase.auth.getClaims()`
3. Resolves email from claims (or falls back to `supabase.auth.getUser()`)
4. Queries `authenticated_user_info` Supabase view for full user profile including appointments, roles, and points
5. Returns `AuthenticatedUser` object with `id`, `email`, `name`, `room`, `points`, `appointments[]`, role flags (`is_admin`, `is_jcrc`, `is_culture_sports_admin`)

**CCA Data Flow (Example: Members Page):**

1. Dashboard page (`src/app/dashboard/mycca/admin/manageMembers/[ccaName]/page.tsx`) calls `/api/cca/[ccaId]/members`
2. API route at `src/app/api/cca/[ccaId]/members/route.ts` authenticates user via `fetchUserInfo()`
3. Checks authorization via `getManagedCcaAccess()` from `src/lib/cca-management-access.ts` (which internally uses `checkCcaAuthorization()` from `src/lib/cca-chair-access.ts`)
4. Queries Supabase tables: `ccas`, `cca_positions`, `cca_appointments` (with joins to `public_user_info`)
5. Transforms and groups members by position type, returns JSON response

**Feature Flag Gating Flow:**

1. Feature flags defined as constants in `src/lib/feature-flags.ts` (`CORE_SERVICE_FLAGS`)
2. Layouts check flags at render time: `src/app/dashboard/ccaAllocation/layout.tsx` calls `isCoreServiceEnabled("ccaApplications")`
3. If disabled, layout renders `ServiceDisabledState` component from `src/components/feature-flags/service-disabled-state.tsx`
4. API routes independently check flags via `getCoreServiceDisabledApiResponse()` which returns a 503 response
5. Navigation sidebar filters items based on flags via `isFeatureFlaggedItemEnabled()` in `src/components/layout/app-sidebar.tsx`

**State Management:**
- Server state: No global store; each page fetches data via `fetch()` to API routes in `useEffect`
- Client auth state: `AuthContext` at `src/context/AuthContext.tsx` provides `user`, `session`, `loading`, `signIn`, `signOut`
- Role authorization: `useRoleAuth` hook at `src/hooks/useRoleAuth.ts` fetches and caches (localStorage, 5min TTL) role check results from `/api/user/checkRole`
- Page-local state: `useState` and `useCallback` within individual page components
- No Redux, Zustand, or other external state management library

## Key Abstractions

**AuthenticatedUser:**
- Purpose: Represents a fully resolved user with profile, role flags, and CCA appointments
- Defined in: `src/types/User.ts`
- Built by: `src/lib/fetch-user-info.ts` (`fetchUserInfo()`)
- Pattern: Server-side resolution from JWT claims + Supabase DB view (`authenticated_user_info`)

**CCA Authorization (AccessResult pattern):**
- Purpose: Encapsulates authorization check results with typed ok/error union
- Defined in: `src/lib/cca-chair-access.ts` and `src/lib/cca-management-access.ts`
- Pattern: `AccessResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string }`
- Used by: All CCA-related API routes to verify chair/management access before data operations

**Feature Flags (CORE_SERVICE_FLAGS):**
- Purpose: Toggle entire feature domains on/off (memberRanking, ccaApplications, holidaySubsidy)
- Defined in: `src/lib/feature-flags.ts`
- Pattern: Compile-time constants (not runtime/remote config). Change requires code edit and redeploy.
- Consumed by: Layout components (UI gating), API routes (503 responses), sidebar navigation (item filtering)

**AppLayout:**
- Purpose: Provides consistent sidebar + breadcrumb + content area for all dashboard pages
- Defined in: `src/components/layout/app-layout.tsx`
- Pattern: Wraps page content with `SidebarProvider` > `AppSidebar` + `SidebarInset` with auto-generated breadcrumbs from URL path
- Used by: Every dashboard page component

**Ranking System:**
- Purpose: Metric-based ranking with CCA-type-specific scoring rules
- Defined in: `src/lib/cca-ranking-metrics.ts` (metric keys, scoring), `src/lib/cca-ranking-comments.ts` (serialization/deserialization)
- Pattern: Different metric keys for sports (attendance), culture (attendance + performance), and resident (helpfulness + initiative + attitude) CCA types

## Entry Points

**Root Layout:**
- Location: `src/app/layout.tsx`
- Triggers: Every page request
- Responsibilities: Wraps all pages with `AuthProvider`, `Toaster`, font configuration

**Middleware:**
- Location: `src/middleware.ts`
- Triggers: Requests to `/dashboard/*` and `/auth/*`
- Responsibilities: Session validation via Supabase JWT claims, redirect unauthenticated users to login, redirect authenticated users away from auth pages

**Landing Page:**
- Location: `src/app/page.tsx`
- Triggers: Root URL `/`
- Responsibilities: Server component that checks auth, redirects to `/dashboard` if logged in, otherwise shows landing page

**Dashboard Home:**
- Location: `src/app/dashboard/page.tsx`
- Triggers: `/dashboard`
- Responsibilities: Displays welcome card, points recap, navigation cards for CCAs, ranking, sports & culture

**Auth Callback:**
- Location: `src/app/auth/callback/route.ts`
- Triggers: OAuth redirect from Google
- Responsibilities: Exchange auth code for session, validate user exists in DB, redirect to intended page

**API Route - User Info:**
- Location: `src/app/api/user/route.ts`
- Triggers: GET from AuthContext on page load, DELETE on sign out
- Responsibilities: Return authenticated user profile, clear auth cookies on logout

## Error Handling

**Strategy:** Per-route try/catch with JSON error responses and console logging

**Patterns:**
- API routes wrap logic in try/catch, return `NextResponse.json({ error: "message" }, { status: N })` with specific HTTP status codes (401, 403, 404, 500)
- Client pages use `toast.error()` (from both `react-hot-toast` and `sonner`) to display errors from failed API calls
- Authorization failures return structured errors via `AccessResult` pattern: `{ ok: false, status: 403, error: "You are not authorized..." }`
- Supabase query errors are logged with `console.error()` and returned as 500 responses
- Feature-disabled responses return 503 with descriptive message via `getCoreServiceDisabledApiResponse()`
- No global error boundary component detected; individual pages handle their own error states

## Cross-Cutting Concerns

**Logging:** `console.log`, `console.error`, `console.warn` -- no structured logging framework. Server-side logs go to CloudWatch via SST/OpenNext.

**Validation:** Inline validation in API routes. No schema validation library (e.g., Zod). Input sanitization is minimal -- Supabase parameterized queries provide SQL injection protection.

**Authentication:** Supabase Auth with Google OAuth provider. JWT claims verified server-side via `supabase.auth.getClaims()`. Cookie-based session management with intentionally disabled server-side cookie writes (to prevent server overriding browser session state). Middleware protects `/dashboard/*` routes.

**Authorization:** Multi-level role system:
- `is_admin` flag for full admin access
- `is_jcrc` flag for JCRC-specific features (holiday subsidy approvals, member ranking override)
- `is_culture_sports_admin` flag for sports/culture admin features
- Position-based: "lead" and "vice" position types grant chair access to manage their specific CCA
- All enforced via `checkCcaAuthorization()` and `getManagedCcaAccess()` in `src/lib/`

**Caching:** No server-side cache (all API responses include `Cache-Control: no-store, private`). Client-side caching for role auth via localStorage with 5-minute TTL in `src/hooks/useRoleAuth.ts`.

---

*Architecture analysis: 2026-04-10*
