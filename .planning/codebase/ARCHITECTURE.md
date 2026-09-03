<!-- refreshed: 2026-09-03 -->
# Architecture

**Analysis Date:** 2026-09-03

## System Overview

This is a Next.js 15 intranet application for Sheares Hall residents to manage CCAs (Co-Curricular Activities), member rankings, CCA allocation, holiday subsidies, and facilities. It is backed by Supabase (PostgreSQL + RLS), deployed on Cloudflare Workers via OpenNext, with role-based access control derived from database views and appointment hierarchies.

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│                         Pages & Layouts (App Router)                         │
│         `src/app/dashboard/*` (client components), `src/app/api/*`           │
└──────────┬───────────────┬──────────────────┬────────────┬──────────────────┘
           │               │                  │            │
           ▼               ▼                  ▼            ▼
     ┌─────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
     │    Auth     │ │   CCA Mgmt   │ │  Allocation  │ │  Facilities  │
     │   Feature   │ │   Hierarchy  │ │   & Ranking  │ │ & Subsidies  │
     │   Modules   │ │   & Members  │ │              │ │              │
     └──────┬──────┘ └──────┬───────┘ └──────┬───────┘ └──────┬───────┘
            │               │                │               │
            └───────────────┴────────────────┴───────────────┘
                            │
                            ▼
        ┌───────────────────────────────────────────────────────────────┐
        │              Domain Logic & Access Control Layer              │
        │   `src/lib/{auth, cca, api, allocation, facilities, ...}`     │
        │  - User profile & appointment resolution                      │
        │  - Role-based access control (chair, JCRC, admin)            │
        │  - Business rules (ranking, allocation, subsidy)             │
        │  - Error handling & validation                               │
        └───────────────────┬───────────────────────────────────────────┘
                            │
                            ▼
        ┌───────────────────────────────────────────────────────────────┐
        │                    Supabase Client Layer                       │
        │    `src/lib/supabase/{server, client, middleware}`            │
        │  - JWT-based auth via cookies (@supabase/ssr)                │
        │  - Row-level security (RLS) enforcement                      │
        │  - Session isolation (foreign-projref eviction)              │
        └───────────────────┬───────────────────────────────────────────┘
                            │
                            ▼
        ┌───────────────────────────────────────────────────────────────┐
        │    PostgreSQL (Supabase) + RLS Policies + RPC Functions       │
        │         Schema in `vendor/intranet/` (private submodule)      │
        │  - Core tables: users, ccas, cca_appointments, positions      │
        │  - Views: my_profile (current user), public_user_info, etc.  │
        │  - Enums: cca_kind, position_type, team_status, period, etc. │
        └───────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | Location |
|-----------|----------------|----------|
| Page Components | Entry points for dashboard features; fetch from `/api/*` via `useEffect` or server-side calls | `src/app/dashboard/{mycca,allocation,facilities,holiday-subsidy}/page.tsx` |
| API Route Handlers | Thin 30-60 line handlers; auth guard + delegate to lib | `src/app/api/{user,cca,facilities,holiday-subsidy}/**/route.ts` |
| Domain Logic Services | Implement business rules, access control, data transformation | `src/lib/{cca,allocation,facilities,holiday-subsidy,ranking}/` |
| Auth Layer | User profile resolution, JWT validation, session isolation | `src/lib/auth/`, `src/lib/supabase/` |
| UI Components | Feature-specific and shared UI primitives (shadcn/ui) | `src/components/{cca,facilities,allocation,ranking,layout,ui,shared}/` |
| Types & Enums | Shared TypeScript definitions mirroring schema contracts | `src/types/` |
| Supabase Client | Server-side client factory with RLS + cookie management | `src/lib/supabase/server.ts` |
| AuthContext | Client-side auth state, session listening, signIn/signOut | `src/lib/auth/auth-context.tsx` |

## Pattern Overview

**Overall:** Layered architecture with clear request/response flow and role-based access control at every boundary.

**Key Characteristics:**
- **Thin API routes**: Handlers delegate immediately to lib services, no business logic in `route.ts`
- **Access-first pattern**: Guards (`requireAuth()`, `requireChairAccess()`) run before any data fetch
- **Type-driven development**: Shared types in `src/types/` mirror the Supabase schema contract
- **Client-server boundary**: Pages use `fetch()` to API routes; no direct DB access from client components
- **Feature flags**: Compile-time constants gate features; UI and API routes both check `isCoreServiceEnabled()`
- **User model**: `AuthenticatedUser` is fully resolved once, cached in auth context; contains appointments with `has_reports` for chair detection
- **Session isolation**: Every response invalidates foreign-projref cookies to prevent data leakage across sessions (core correctness invariant)

## Layers

**Pages (App Router):**
- Purpose: Render dashboard features; control data fetching strategy (server vs client component)
- Location: `src/app/dashboard/` and `src/app/auth/`
- Contains: Page components (`.tsx`), layout wrappers
- Depends on: API routes (via `fetch`), auth context, hooks, UI components
- Used by: Browser navigation

**API Routes:**
- Purpose: HTTP entrypoints for client components; thin handlers that delegate to lib services
- Location: `src/app/api/`
- Contains: Route handler files (`route.ts`), one per HTTP method per endpoint
- Depends on: Domain logic services in `src/lib/`, Supabase client
- Used by: Client components (via `fetch()`)
- Pattern: `try { guard/validate → delegate to service → return apiOk(data) } catch (e) { return handleApiError(e) }`

**Domain Logic (Business Rules):**
- Purpose: Implement access control, business rules, data transformation independent of HTTP
- Location: `src/lib/{cca,auth,api,allocation,facilities,holiday-subsidy,ranking,supabase,timed-flags}`
- Contains: Service classes/functions (`*-service.ts`), access guards (`*-access.ts`), helpers
- Depends on: Supabase client, types, utility functions
- Used by: API routes, server components, other services
- Pattern: Receive parameters → check access with `AccessResult<T>` envelope → fetch/transform data → return or throw `ApiError`

**Auth & Session:**
- Purpose: User profile resolution, JWT validation, cookie-based session management
- Location: `src/lib/auth/`, `src/lib/supabase/`
- Contains: `fetchUserInfo()` (resolve current user), `createClient()` (server-side Supabase), middleware
- Depends on: Supabase SDK (`@supabase/ssr`, `@supabase/supabase-js`), Next.js runtime
- Used by: Middleware, all API routes, page components
- Session isolation: `cookie-eviction.ts` clears foreign-projref cookies on every request

**UI Components:**
- Purpose: Render React UI using shadcn/ui primitives; consume auth context and API data
- Location: `src/components/`
- Contains: Feature-specific components (cca/, facilities/, allocation/), shared layouts (layout/), UI primitives (ui/)
- Depends on: Lucide icons, Tailwind CSS, hooks, auth context
- Used by: Pages
- Patterns: `"use client"` only for interactive; server components for read-only

**Types:**
- Purpose: Shared TypeScript interfaces and enums mirroring schema contract
- Location: `src/types/`
- Contains: No runtime code, only type definitions
- Depends on: Nothing
- Used by: All layers

**Supabase Integration:**
- Purpose: Database access, RLS enforcement, JWT validation
- Location: `src/lib/supabase/`
- Contains: Client factory (`server.ts`, `client.ts`), middleware (`middleware.ts`), helpers (`helpers.ts`)
- Depends on: `@supabase/ssr`, `@supabase/supabase-js`, Next.js runtime
- Used by: All services, auth layer

## Data Flow

### Primary Request Path (e.g., fetch CCA members)

1. **User navigates to page** (`src/app/dashboard/my-cca/page.tsx:50`)
   - Page is client component (`"use client"`)
   - Wraps with `AppLayout` for sidebar + breadcrumbs
   
2. **useEffect fetches data** (`src/app/dashboard/my-cca/page.tsx:80`)
   - Calls `fetch("/api/cca/[cca-id]/members")`
   - Request includes Supabase JWT cookie (set by middleware)

3. **Route handler processes request** (`src/app/api/cca/[cca-id]/members/route.ts:4`)
   - Extracts `cca-id` from params
   - Delegates to `getMembers(ccaId)` from `src/lib/cca/member-service.ts`

4. **Service implements business logic** (`src/lib/cca/member-service.ts:44`)
   - `resolveCcaWithAccess()` fetches CCA + validates chair access
   - `getManagedCcaAccess()` checks authorization level
   - If not authorized, throws `ApiError(403, "Forbidden")`
   - If authorized, queries Supabase for members

5. **Supabase enforces RLS** 
   - JWT claims validated against RLS policies in schema
   - Only data the user can see is returned

6. **Response returned to client** (`src/lib/api/response.ts:4`)
   - Handler returns `apiOk(result)` → `{ data: [...], error: null }`

7. **Component renders** 
   - `useState` updates with data
   - `<DataTable>` renders members

### Authentication Flow

1. **User navigates to `/dashboard`**
   - `middleware.ts` intercepts request
   - Calls `updateSession()` from `src/lib/supabase/middleware.ts`
   - Validates JWT claims, refreshes if needed, clears foreign-projref cookies

2. **Unauthenticated → redirect to `/auth/login`**
   - Middleware detects no valid session
   - Redirects with `Location: /auth/login`

3. **User clicks "Sign in with Google"**
   - `AuthContext.signIn()` called (`src/lib/auth/auth-context.tsx:42`)
   - Calls `supabase.auth.signInWithOAuth({ provider: "google" })`
   - Redirects to Google, then to `/auth/callback`

4. **Callback processes auth** (`src/app/auth/callback/route.ts`)
   - Exchanges Google code for Supabase JWT
   - Sets httpOnly cookies via `@supabase/ssr`
   - Redirects to dashboard

5. **AuthProvider initializes user** (`src/lib/auth/auth-context.tsx:68`)
   - `useEffect` fetches `/api/user` to get `AuthenticatedUser`
   - Populates `user` state with full profile + appointments
   - All components access via `useAuth()`

**Session isolation:**
- Every request, `cookie-eviction.ts` checks for `sb-<projref>-*` cookies
- If found, clears them (indicates session leak from another Supabase project)
- Ensures users cannot accidentally access data from a different environment

### CCA Member Management Workflow

1. Chair navigates to `My CCA` page
2. Page fetches `/api/cca/[cca-id]/members`
3. Handler calls `getMembers(ccaId)`
4. Service:
   - Resolves CCA and requesting user (chair)
   - Calls `getManagedCcaAccess()` to check chair authority
   - If user manages this CCA, returns member list
   - If not, throws `ApiError(403, ...)`
5. Handler catches error, returns `apiError()` response
6. Client-side error toast shown via `sonner`

**Access control:**
- `getManagedCcaAccess()` checks `has_reports` in user's appointments
- Only users with appointments that have reports can manage
- Verified against actual hierarchy in `cca_appointments` table

### Ranking & Allocation Concepts

There are two distinct "ranking" concepts that use the same route names:

1. **Member evaluation ranking**: Chairs grade members (attendance, performance, etc.)
   - Logic: `src/lib/ranking/`
   - Currently disabled (feature flag `memberRanking: false`)
   - Table was dropped in schema refactor; re-enabling requires schema restoration

2. **CCA allocation preference**: Residents rank their preferred CCAs for allocation
   - Logic: `src/lib/allocation/`
   - Route: `/api/user/rankings/*`
   - User-facing copy calls it "preference" but code uses `ranking` for identifiers

**State Management:**
- No Redux or global state library
- Client-side: `AuthContext` for user + session, page-level `useState` for data
- Server-side: Supabase + RLS policies enforce access
- Role checks cached in `localStorage` with 5-min TTL by `useRoleAuth()` hook

## Key Abstractions

**AuthenticatedUser** (`src/types/user.ts:78`):
- Purpose: Fully-resolved user profile with role information
- Built by: `fetchUserInfo()` in `src/lib/auth/fetch-user-info.ts`
- Contains: id, email, name, room, points, profile_photo_url, telegram_handle, stay_period, matric, `is_chair`, `is_jcrc`, `appointments` array
- Each appointment has `has_reports` boolean — this, not `position_type`, determines if user can manage
- Cached in `AuthContext` after first fetch; used across all components
- Derived predicates: `deriveChairKinds()` returns Set of CCA kinds this user chairs; `isCultureSportsChair()` checks culture or sports chair status

**AccessResult<T>** (`src/lib/cca/cca-chair-access.ts` and others):
- Purpose: Envelope for access control results
- Shape: `{ ok: true; data: T } | { ok: false; status: number; error: string }`
- Used by: All access guard functions (`getManagedCcaAccess()`, `requireChairAccess()`, etc.)
- Pattern: Service methods check result and throw `ApiError` if not ok

**ApiError** (`src/lib/api/errors.ts`):
- Purpose: Typed error for HTTP responses
- Contains: `statusCode` (HTTP status), `message` (user-facing text)
- Thrown by: Access guards, validation, business logic
- Caught by: API route handlers, converted to `apiError()` response

**Feature Flags** (`src/lib/feature-flags.ts:25`):
- Purpose: Compile-time gates for features
- Type: `CORE_SERVICE_FLAGS` object
- Active flags: `memberRanking` (false), `ccaApplications` (true), `holidaySubsidy` (false), `facilities` (true), `allocationReveal` (true), `pointsRecap` (false)
- Consumed by: Pages (UI gating), API routes (503 responses), sidebar navigation
- Changing requires code edit + deploy

**AppLayout** (`src/components/layout/app-layout.tsx`):
- Purpose: Wraps every dashboard page
- Contains: Sidebar with feature-gated nav items, breadcrumbs (auto-generated from URL path)
- Provides: Context for page titles, error states, empty states
- Used by: All dashboard pages

**OrderingTable & DataTable** (`src/components/table/`):
- Purpose: Render tabular data with sorting and filtering
- OrderingTable: Specialization for drag-and-drop ranking
- DataTable: Standard TanStack React Table integration
- Props: columns, data, row actions

## Entry Points

**Root Layout** (`src/app/layout.tsx`):
- Triggers: Browser navigates to any route
- Responsibilities: 
  - Wraps app in `AuthProvider` (establishes auth context)
  - Adds `Toaster` for notifications via `sonner`
  - Applies fonts and metadata

**Middleware** (`src/middleware.ts`):
- Triggers: All requests to `/`, `/dashboard/*`, `/auth/*`
- Responsibilities:
  - Validates Supabase JWT in cookies
  - Refreshes expired sessions
  - Clears foreign-projref cookies (session isolation)
  - Redirects unauthenticated `/dashboard/*` → `/auth/login`

**Dashboard Home** (`src/app/dashboard/page.tsx`):
- Triggers: User navigates to `/dashboard`
- Responsibilities:
  - Renders dashboard with feature-gated action cards
  - Shows points recap card (if enabled) and allocated CCAs
  - Uses `useRoleAuth()` to fetch role info from `/api/user/check-role`

**CCA Routes** (`src/app/api/cca/[cca-id]/*`):
- Triggers: Requests to manage CCA members, rankings, etc.
- Responsibilities: Delegate to `src/lib/cca/*-service.ts` after access guard

**Auth Callback** (`src/app/auth/callback/route.ts`):
- Triggers: Redirect from Google OAuth
- Responsibilities: Exchange auth code for Supabase session, set cookies, redirect to dashboard

## Architectural Constraints

- **Threading:** Node.js single-threaded event loop; Cloudflare Workers also single-threaded per request
- **Global state:** `AuthContext` is the only global state; avoids Redux/Zustand
- **Circular imports:** Possible between `src/lib/` and `src/types/` — types are acyclic by design, lib modules avoid cross-service imports
- **Session isolation:** Every response must evict foreign-projref cookies; core correctness invariant
- **Type safety:** TypeScript in strict mode; mirrored types for schema contract reduce runtime surprises
- **RLS enforcement:** All data fetches go through Supabase RLS policies; app relies on database for true access control
- **Feature flags:** Static compile-time only; no runtime configuration

## Anti-Patterns

### Modifying `AuthenticatedUser` in component state

**What happens:** Component fetches `/api/user`, stores in `useState`, then mutates it locally (e.g., `user.appointments.push(...)`)

**Why it's wrong:** AuthContext may have refreshed the true user state elsewhere; component's local copy is now stale. Other components see different data.

**Do this instead:** 
- Call `/api/user/refresh` endpoint to invalidate cache and re-fetch from server
- Or keep user state read-only; fetch appointment mutations from `/api/user/appointments` separately
- AuthContext owns the single source of truth; treat it as immutable in components

### Checking `is_chair` without checking `cca_kind`

**What happens:** Code checks `if (user.is_chair) { ...allow chair access }` without verifying the user chairs that specific CCA kind (sports vs culture vs committee)

**Why it's wrong:** Chair role is not binary; user may chair one kind and not another. Leads to authorization bypasses.

**Do this instead:** 
- Use `isCultureSportsChair(user)` for culture/sports checks
- Use `deriveChairKinds(user)` to get full set and check membership: `deriveChairKinds(user).has("sports")`
- Let API route guard do the heavy lifting: `getManagedCcaAccess()` verifies the specific CCA

### Returning partial data on error

**What happens:** API handler fetches some data, hits an error partway through, returns a 200 with partial data and an error field

**Why it's wrong:** Client code checks `response.ok` (which is true for 200) and assumes `data` is complete; silent data loss

**Do this instead:** 
- Always use correct HTTP status on error: 400, 401, 403, 404, 500
- Return `apiError()` envelope: `{ data: null, error: "message" }`
- Never mix successful data with error messages in the same response

### Skipping RLS by loading schema directly

**What happens:** Code loads `cca_users` table directly without filtering, relying on app logic to filter results

**Why it's wrong:** If app logic is forgotten or buggy, all data is exposed. RLS should be the enforcement layer.

**Do this instead:** 
- Let Supabase RLS policies handle filtering; only query data the user can see
- Trust the schema; if you need different data, change the Supabase query, not the app filter

## Error Handling

**Strategy:** Try-catch in route handlers + guards in services; throw `ApiError` for known conditions, let unexpected errors propagate to global handler.

**Patterns:**
- API routes: `try { ... } catch (e) { return handleApiError(e) }`
- Services: Check access first; throw `ApiError` if guard fails
- Auth guards: `requireAuth()` throws 401; `requireChairAccess()` throws 403 or 400 as appropriate
- User-facing errors: `toast.error(response.error)` via `sonner` in client components
- Debug: `console.error("Error [context]:", error)` with contextual labels

## Cross-Cutting Concerns

**Logging:** 
- No structured logger; uses `console.error()` for warnings and errors, `console.log()` for debug
- Route handlers log unhandled errors: `handleApiError()` prints to stderr
- Supabase errors are logged: `.catch((e) => console.error("Supabase error:", e))`

**Validation:**
- Route handlers validate input via type guards: `parseInt()`, type narrowing with `as` (use sparingly)
- Service methods assume validated input; do not re-validate
- Supabase schema enforces database constraints (NOT NULL, UNIQUE, CHECK)

**Authentication:**
- Middleware validates JWT on every request to `/dashboard` and `/auth`
- Services call `requireAuth()` to get current user; throws 401 if missing
- Session stored in httpOnly cookies via `@supabase/ssr`; client SDK refreshes automatically
- Role-based access: `getManagedCcaAccess()`, `requireJcrcAccess()`, `requireAdminAccess()` check appointments

**Authorization:**
- Supabase RLS policies enforce row-level access
- App-level guards (`*-access.ts` files) verify user has management authority
- Feature flags gate entire features: routes return 503 if flag is off

---

*Architecture analysis: 2026-09-03*
