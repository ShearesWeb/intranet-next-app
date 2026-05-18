# Architecture Research

**Domain:** Next.js 15 + Supabase intranet app refactoring
**Researched:** 2026-04-10
**Confidence:** HIGH

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Browser Layer                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │
│  │  Client   │  │  Client   │  │  Client   │  │  Shared  │        │
│  │  Pages    │  │  Hooks    │  │  Context  │  │  UI      │        │
│  └─────┬────┘  └─────┬────┘  └──────────┘  └──────────┘        │
│        │              │                                          │
├────────┴──────────────┴──────────────────────────────────────────┤
│                     Next.js Server Layer                          │
│  ┌──────────┐  ┌──────────────┐  ┌──────────────┐               │
│  │Middleware │  │Server Actions │  │Route Handlers│               │
│  │(Auth +   │  │(Mutations)    │  │(External API)│               │
│  │ Refresh) │  └───────┬──────┘  └───────┬──────┘               │
│  └─────┬────┘          │                 │                       │
├────────┴───────────────┴─────────────────┴───────────────────────┤
│                     Shared Logic Layer                            │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │
│  │  Auth    │  │  Domain  │  │  Feature  │  │  Data    │        │
│  │  Module  │  │  Logic   │  │  Flags    │  │  Access  │        │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘        │
├─────────────────────────────────────────────────────────────────┤
│                     Supabase (External)                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                      │
│  │   Auth   │  │ Database │  │ Storage  │                      │
│  └──────────┘  └──────────┘  └──────────┘                      │
└─────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| Middleware | Auth token refresh, route protection, cookie writing | Single `middleware.ts` using `supabase.auth.getUser()` with proper `setAll()` |
| Server Actions | All in-app mutations (save rankings, update members, approve subsidies) | `"use server"` functions co-located with features in `src/features/*/actions.ts` |
| Route Handlers | Health check, webhook endpoints, any external API consumers | `route.ts` files only for truly external endpoints |
| Auth Module | Session resolution, user info fetching, authorization checks | `src/lib/auth/` with `fetchUserInfo()`, `checkAuthorization()` |
| Domain Logic | Business rules per feature (ranking metrics, subsidy weeks, member management) | `src/features/*/lib/` co-located with each feature |
| Feature Flags | Runtime-configurable service toggles | Environment-variable-based with layout-level gating |
| Data Access | Supabase query abstractions per domain | `src/features/*/queries.ts` — thin wrappers around typed Supabase queries |

## Recommended Project Structure

```
src/
├── app/                           # Next.js App Router (routes only)
│   ├── layout.tsx                 # Root layout: fonts, Toaster, metadata
│   ├── page.tsx                   # Landing page (server component)
│   ├── globals.css
│   ├── auth/                      # Auth routes
│   │   ├── login/page.tsx
│   │   ├── callback/route.ts
│   │   └── auth-error/page.tsx
│   ├── dashboard/                 # Protected routes
│   │   ├── layout.tsx             # Dashboard shell: AuthGuard + AppLayout
│   │   ├── page.tsx               # Dashboard home
│   │   ├── mycca/
│   │   │   ├── page.tsx           # My CCAs list
│   │   │   └── admin/
│   │   │       ├── page.tsx       # Admin list
│   │   │       ├── manage-members/[ccaName]/page.tsx
│   │   │       └── rank-members/[ccaName]/page.tsx
│   │   ├── cca-allocation/
│   │   │   ├── layout.tsx         # Feature flag gate
│   │   │   ├── page.tsx
│   │   │   ├── rank/page.tsx
│   │   │   └── rank-applicants/page.tsx
│   │   ├── holiday-subsidy/
│   │   │   ├── layout.tsx         # Feature flag gate
│   │   │   ├── page.tsx
│   │   │   ├── declaration/[ccaName]/page.tsx
│   │   │   ├── weekly/[ccaName]/page.tsx
│   │   │   ├── guide/page.tsx
│   │   │   └── approvals/
│   │   │       ├── page.tsx
│   │   │       ├── [ccaName]/page.tsx
│   │   │       └── weekly/[ccaName]/page.tsx
│   │   └── sports-culture/
│   │       └── page.tsx
│   └── api/                       # Only endpoints that need to be HTTP-accessible
│       ├── ping/route.ts          # Health check
│       └── user/route.ts          # User profile GET (for AuthContext), cookie clear DELETE
│
├── features/                      # Feature modules (the heart of the app)
│   ├── auth/                      # Authentication feature
│   │   ├── components/
│   │   │   ├── login-form.tsx
│   │   │   └── auth-guard.tsx     # Replaces withAuth HOC
│   │   ├── lib/
│   │   │   ├── fetch-user-info.ts
│   │   │   ├── check-authorization.ts
│   │   │   └── middleware.ts      # updateSession logic
│   │   ├── context.tsx            # AuthContext (slim: session + user)
│   │   ├── hooks.ts               # useAuth, useRequireAuth
│   │   └── index.ts               # Public API barrel export
│   │
│   ├── cca/                       # CCA management feature
│   │   ├── components/
│   │   │   ├── member-table.tsx
│   │   │   ├── member-actions-menu.tsx
│   │   │   ├── add-member-dialog.tsx
│   │   │   ├── update-member-dialog.tsx
│   │   │   └── cca-card.tsx
│   │   ├── lib/
│   │   │   ├── chair-access.ts
│   │   │   ├── management-access.ts
│   │   │   └── member-management.ts
│   │   ├── actions.ts             # Server actions: addMember, removeMember, updateMember
│   │   ├── queries.ts             # Data fetching: getMembers, getManagedCCAs, getCCAs
│   │   ├── types.ts               # CCA-specific types
│   │   └── index.ts
│   │
│   ├── ranking/                   # Member ranking feature
│   │   ├── components/
│   │   │   ├── ranking-table.tsx
│   │   │   ├── ranking-form.tsx
│   │   │   └── metrics-input.tsx
│   │   ├── lib/
│   │   │   ├── ranking-metrics.ts
│   │   │   └── ranking-comments.ts
│   │   ├── actions.ts             # Server actions: saveRankings
│   │   ├── queries.ts             # Data fetching: getRankings, getRankablePositions
│   │   ├── types.ts
│   │   └── index.ts
│   │
│   ├── allocation/                # CCA allocation feature
│   │   ├── components/
│   │   │   ├── applicant-ranking-table.tsx
│   │   │   └── position-selector.tsx
│   │   ├── lib/
│   │   │   └── allocation-rules.ts
│   │   ├── actions.ts             # Server actions: addApplicant, removeApplicant, rankApplicants
│   │   ├── queries.ts
│   │   ├── types.ts
│   │   └── index.ts
│   │
│   ├── holiday-subsidy/           # Holiday subsidy feature
│   │   ├── components/
│   │   │   ├── declaration-form.tsx
│   │   │   ├── weekly-tracker.tsx
│   │   │   ├── approval-table.tsx
│   │   │   └── subsidy-guide.tsx
│   │   ├── lib/
│   │   │   └── subsidy-weeks.ts
│   │   ├── actions.ts             # Server actions: declare, approve, updateWeekly
│   │   ├── queries.ts
│   │   ├── types.ts
│   │   └── index.ts
│   │
│   └── sports-culture/            # Sports & culture feature
│       ├── components/
│       │   └── availability-form.tsx
│       ├── actions.ts
│       ├── queries.ts
│       ├── types.ts
│       └── index.ts
│
├── components/                    # Shared UI components (not feature-specific)
│   ├── ui/                        # shadcn/ui primitives (auto-generated, do not edit)
│   ├── layout/
│   │   ├── app-layout.tsx
│   │   ├── app-sidebar.tsx
│   │   ├── nav-main.tsx
│   │   └── nav-user.tsx
│   ├── table/
│   │   ├── simple-table.tsx
│   │   ├── selection-table.tsx
│   │   └── ordering-table.tsx
│   ├── badges/
│   │   ├── cca-type-badge.tsx
│   │   └── position-type-badge.tsx
│   └── feature-flags/
│       └── service-disabled-state.tsx
│
├── lib/                           # Shared utilities (non-feature-specific)
│   ├── feature-flags.ts           # Feature flag system
│   ├── utils.ts                   # cn() helper
│   └── constants.ts               # App-wide constants
│
├── types/                         # Shared type definitions
│   ├── user.ts                    # AuthenticatedUser, UserAppointment, role flags
│   ├── database.ts                # Supabase-generated types (if using codegen)
│   └── common.ts                  # Shared utility types (AccessResult, etc.)
│
├── utils/                         # Infrastructure utilities
│   └── supabase/
│       ├── server.ts              # Server-side Supabase client factory
│       ├── client.ts              # Browser-side Supabase client factory
│       └── middleware.ts          # Middleware-specific client factory
│
└── middleware.ts                   # Next.js middleware entry point
```

### Structure Rationale

- **`src/app/`:** Thin route definitions only. Pages import feature components and call feature queries/actions. A page file should be 50-100 lines: layout wrapper + feature component composition. No business logic in route files.

- **`src/features/`:** Feature-based modules following domain boundaries. Each feature owns its components, business logic, data access (queries and actions), and types. Features communicate through shared types in `src/types/`, never by importing each other's internals directly.

- **`src/components/`:** Only truly shared, domain-agnostic UI components. If a component is used by exactly one feature, it belongs in that feature's `components/` directory.

- **`src/lib/`:** Cross-cutting utilities that do not belong to any feature: feature flags, CSS class merge helper, app-wide constants. This stays small.

- **`src/types/`:** Types shared across multiple features. Feature-specific types live in `src/features/*/types.ts`.

- **`src/utils/supabase/`:** Infrastructure-level Supabase client factories. These are plumbing, not business logic.

## Architectural Patterns

### Pattern 1: Middleware-Only Auth Protection

**What:** Consolidate the three overlapping auth mechanisms (middleware redirect, AuthContext client fetch, withAuth HOC) into a single coherent flow: middleware handles session refresh and route protection; a slim AuthContext provides client-side user state; no HOC needed.

**When to use:** Every protected route.

**Trade-offs:** Simplifies auth but requires middleware cookie writing to be fixed first (the session bleed bug). Once middleware properly writes refreshed cookies via `setAll()`, the withAuth HOC becomes unnecessary since middleware already redirects unauthenticated users.

**Target flow:**

```
Request → middleware.ts
           │
           ├─ Call supabase.auth.getUser() (validates + refreshes token)
           ├─ Write refreshed cookies to BOTH request AND response via setAll()
           ├─ If unauthenticated + /dashboard/* → redirect to /auth/login
           ├─ If authenticated + /auth/* → redirect to /dashboard
           │
           └─ Request passes to page
                │
                ├─ Server Components: can call fetchUserInfo() directly
                │   (cookies already refreshed by middleware)
                │
                └─ Client Components: useAuth() reads from AuthContext
                    (AuthContext fetches from /api/user on mount)
```

**Example middleware.ts (target):**

```typescript
// src/utils/supabase/middleware.ts — FIXED version
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
    let supabaseResponse = NextResponse.next({ request })

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll()
                },
                setAll(cookiesToSet) {
                    // CRITICAL FIX: Write cookies to both request and response
                    cookiesToSet.forEach(({ name, value, options }) =>
                        request.cookies.set(name, value)
                    )
                    supabaseResponse = NextResponse.next({ request })
                    cookiesToSet.forEach(({ name, value, options }) =>
                        supabaseResponse.cookies.set(name, value, options)
                    )
                },
            },
        }
    )

    // getUser() validates token and triggers refresh if needed
    const { data: { user } } = await supabase.auth.getUser()

    const path = request.nextUrl.pathname

    if (!user && path.startsWith('/dashboard')) {
        const url = request.nextUrl.clone()
        url.pathname = '/auth/login'
        return NextResponse.redirect(url)
    }

    if (user && path.startsWith('/auth')) {
        const url = request.nextUrl.clone()
        url.pathname = '/dashboard'
        return NextResponse.redirect(url)
    }

    return supabaseResponse
}
```

### Pattern 2: Server Actions for Mutations, Direct Queries for Reads

**What:** Replace the current pattern of client-side `fetch()` to API route handlers with:
- **Reads:** Server Components call `queries.ts` functions directly (they run on the server). Client Components that need data receive it as props from a parent Server Component, or call a server action for on-demand fetches.
- **Writes:** Client Components call server actions in `actions.ts` for all mutations.
- **API routes:** Keep only for the `/api/user` endpoint (AuthContext needs it) and any health/webhook endpoints.

**When to use:** All data operations throughout the app.

**Trade-offs:** Eliminates ~25 API route files. Server actions are POST-only so read caching is lost, but this app already uses `Cache-Control: no-store` everywhere, so no practical loss. The main gain is removing the boilerplate HTTP layer and self-calling API route anti-pattern.

**Example:**

```typescript
// src/features/cca/queries.ts
"use server"
import { createClient } from "@/utils/supabase/server"
import { fetchUserInfo } from "@/features/auth"

export async function getCCAMembers(ccaId: number) {
    const user = await fetchUserInfo()
    if (!user) throw new Error("Unauthorized")

    const supabase = await createClient()
    const { data, error } = await supabase
        .from("cca_appointments")
        .select("*, public_user_info(*), cca_positions(*)")
        .eq("cca_positions.cca_id", ccaId)

    if (error) throw error
    return groupMembersByPosition(data)
}

// src/features/cca/actions.ts
"use server"
import { revalidatePath } from "next/cache"
import { createClient } from "@/utils/supabase/server"
import { fetchUserInfo } from "@/features/auth"
import { checkCcaAuthorization } from "./lib/chair-access"

export async function removeMember(ccaId: number, userId: number, positionId: number) {
    const user = await fetchUserInfo()
    const authCheck = checkCcaAuthorization({ requestingUser: user, cca: { id: ccaId }, require: "chair" })
    if (!authCheck.ok) throw new Error(authCheck.error)

    const supabase = await createClient()
    const { error } = await supabase
        .from("cca_appointments")
        .delete()
        .eq("user_id", userId)
        .eq("position_id", positionId)

    if (error) throw error
    revalidatePath(`/dashboard/mycca/admin/manage-members`)
}
```

### Pattern 3: Feature Module Barrel Exports

**What:** Each feature exposes a deliberate public API through its `index.ts`. Other features and pages import only from the barrel export, never reaching into a feature's internal files.

**When to use:** All cross-feature imports.

**Trade-offs:** Adds one file per feature, but enforces clear module boundaries and makes refactoring internals safe.

**Example:**

```typescript
// src/features/auth/index.ts
export { AuthProvider, useAuth } from "./context"
export { fetchUserInfo, fetchUserId } from "./lib/fetch-user-info"
export { AuthGuard } from "./components/auth-guard"
export type { AuthenticatedUser } from "@/types/user"

// src/features/cca/index.ts
export { getCCAMembers, getManagedCCAs, getUserCCAs } from "./queries"
export { addMember, removeMember, updateMember } from "./actions"
export { MemberTable } from "./components/member-table"
export { CCACard } from "./components/cca-card"
export type { Member, ManagedCcaPosition } from "./types"
```

### Pattern 4: Thin Page Components via Composition

**What:** Page files in `src/app/` are thin orchestrators that compose feature components. All state management, data fetching, and rendering logic lives in feature components.

**When to use:** Every page.

**Trade-offs:** Requires extracting components from the current monolithic pages, which is the bulk of the refactoring work. But the result is pages that are 50-100 lines and feature components that are independently testable.

**Example — transforming the 1111-line manageMembers page:**

```typescript
// src/app/dashboard/mycca/admin/manage-members/[ccaName]/page.tsx
// TARGET: ~40 lines instead of 1111

import { AppLayout } from "@/components/layout/app-layout"
import { MemberManagementView } from "@/features/cca/components/member-management-view"

interface PageProps {
    params: Promise<{ ccaName: string }>
    searchParams: Promise<{ ccaId?: string }>
}

export default async function ManageMembersPage({ params, searchParams }: PageProps) {
    const { ccaName } = await params
    const { ccaId } = await searchParams

    if (!ccaId) {
        return <div>Missing CCA ID</div>
    }

    return (
        <AppLayout>
            <MemberManagementView
                ccaName={decodeURIComponent(ccaName)}
                ccaId={parseInt(ccaId, 10)}
            />
        </AppLayout>
    )
}
```

### Pattern 5: Environment-Variable Feature Flags

**What:** Replace hardcoded compile-time `CORE_SERVICE_FLAGS` constants with environment-variable-based flags that can be changed per deployment without code changes.

**When to use:** All feature flag checks.

**Trade-offs:** Slightly more complex than constants, but enables toggling features without redeploying. Server-only env vars (no `NEXT_PUBLIC_` prefix) keep flags secure. For this intranet app with few flags, this is the right level of complexity -- no need for a full feature flag service like LaunchDarkly.

**Example:**

```typescript
// src/lib/feature-flags.ts — TARGET
const CORE_SERVICE_DEFAULTS: Record<string, boolean> = {
    memberRanking: false,
    ccaApplications: false,
    holidaySubsidy: false,
}

export type CoreServiceKey = keyof typeof CORE_SERVICE_DEFAULTS

function getEnvFlag(service: CoreServiceKey): boolean {
    const envKey = `FEATURE_${service.replace(/([A-Z])/g, '_$1').toUpperCase()}`
    const envValue = process.env[envKey]
    if (envValue === undefined) return CORE_SERVICE_DEFAULTS[service]
    return envValue === "true" || envValue === "1"
}

export function isCoreServiceEnabled(
    service: CoreServiceKey,
    context?: { isJcrc?: boolean }
): boolean {
    if (service === "memberRanking" && context?.isJcrc) return true
    return getEnvFlag(service)
}

// Rest of the API stays the same
```

**Environment variables:**
```
FEATURE_MEMBER_RANKING=false
FEATURE_CCA_APPLICATIONS=false
FEATURE_HOLIDAY_SUBSIDY=false
```

## Data Flow

### Authentication Flow (Target)

```
Browser                    Middleware                  Server Component
  │                           │                            │
  ├──── Request ──────────────┤                            │
  │                           ├─ createServerClient()      │
  │                           ├─ supabase.auth.getUser()   │
  │                           ├─ setAll() → write cookies  │
  │                           │   to request + response    │
  │                           ├─ Route check:              │
  │                           │   /dashboard + no user     │
  │                           │   → redirect /auth/login   │
  │                           │                            │
  │                           ├──── Forward request ───────┤
  │                           │                            ├─ fetchUserInfo()
  │                           │                            │   (reads refreshed cookies)
  │                           │                            ├─ getClaims() → email
  │                           │                            ├─ DB query → user profile
  │                           │                            │
  │ ◄──── HTML response ─────┤◄──── Rendered page ────────┤
  │                           │                            │
  ├─ AuthContext mounts        │                            │
  ├─ fetch(/api/user)          │                            │
  ├─ Store user in state       │                            │
```

### Data Mutation Flow (Target: Server Actions)

```
Client Component              Server Action               Supabase
  │                               │                          │
  ├─ User clicks "Save" ─────────┤                          │
  │                               ├─ fetchUserInfo()         │
  │                               ├─ Authorization check     │
  │                               ├─ Validate input          │
  │                               ├─── Supabase mutation ────┤
  │                               │                          ├─ Write to DB
  │                               │◄──── Result ─────────────┤
  │                               ├─ revalidatePath()        │
  │◄──── Result (or error) ──────┤                          │
  ├─ toast.success/error          │                          │
  ├─ UI auto-refreshes (revalidation)                       │
```

### Data Read Flow (Target: Server Components + Props)

```
Server Component (page)        Feature Query               Supabase
  │                               │                          │
  ├─ Call query function ─────────┤                          │
  │                               ├─ fetchUserInfo()         │
  │                               ├─ Authorization check     │
  │                               ├─── Supabase select ─────┤
  │                               │◄──── Data ───────────────┤
  │◄──── Typed data ──────────────┤                          │
  │                                                          │
  ├─ Render Server Component                                 │
  │   with data as props                                     │
  ├─ Pass data to Client Components                          │
  │   where interactivity needed                             │
```

### Key Data Flows

1. **User info resolution:** Middleware refreshes token via `getUser()` and writes cookies. Downstream server code calls `fetchUserInfo()` which uses `getClaims()` to read the (now-refreshed) JWT claims, resolves email, queries `authenticated_user_info` view. This is the single source of truth for "who is the current user."

2. **Authorization cascade:** `fetchUserInfo()` returns `AuthenticatedUser` with `appointments[]` and role flags. Authorization helpers (`checkCcaAuthorization`, `getManagedCcaAccess`) take this user object and return `AccessResult<T>` — a typed ok/error union. Every mutation server action starts with this check.

3. **Feature flag propagation:** Flags are checked at three points: (a) Layout components gate entire feature UI sections, (b) Server actions check before executing mutations, (c) Sidebar filters nav items. All three use the same `isCoreServiceEnabled()` function.

## Component Communication Rules

| From | To | Allowed Communication |
|------|----|----------------------|
| Page (app/) | Feature components | Import from feature barrel (`@/features/*/index.ts`) |
| Feature A | Feature B | Import from Feature B's barrel export only; never reach into internals |
| Feature | Shared components | Import from `@/components/*` |
| Feature | Shared types | Import from `@/types/*` |
| Feature | Shared lib | Import from `@/lib/*` |
| Feature | Supabase | Import from `@/utils/supabase/*` |
| Shared components | Features | NEVER — shared components must not depend on features |
| Client component | Server action | Call directly (React Server Actions protocol) |
| Client component | API route | Only `/api/user` (for AuthContext); avoid for everything else |

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| Current (intranet, <500 users) | Monolith is correct. No caching needed. Server actions eliminate API overhead. |
| 1K-5K users | Add `unstable_cache` or React `cache()` to expensive queries (e.g., managed CCA positions). Consider Supabase connection pooling. |
| 5K+ users (unlikely for intranet) | Move feature flag checks to middleware to avoid rendering gated pages at all. Add rate limiting to server actions. |

### Scaling Priorities

1. **First bottleneck:** `fetchUserInfo()` is called on every server action and server component. It queries `authenticated_user_info` view every time. Add `React.cache()` wrapper so it deduplicates within a single request lifecycle.
2. **Second bottleneck:** Supabase connection count. Each server action creates a new client. This is fine for intranet scale but would need pooling at higher load.

## Anti-Patterns

### Anti-Pattern 1: Self-Calling API Routes

**What people do:** API route `getCCAs` internally fetches `getManagedCCAs` via HTTP (`fetch('/api/user/getManagedCCAs')`), passing cookies manually.

**Why it's wrong:** Adds network latency, requires manual cookie forwarding, creates circular dependency risk, and is fragile (cookies header may be missing in edge cases).

**Do this instead:** Extract the shared logic into a query function in `src/features/cca/queries.ts`. Both callers import and call the function directly — no HTTP round-trip.

### Anti-Pattern 2: Monolithic Page Components

**What people do:** Put data fetching, state management, column definitions, dialog rendering, search logic, and table rendering all in one 1000+ line `page.tsx`.

**Why it's wrong:** Impossible to test individual pieces. Merge conflicts are constant. Hard to reason about what changed.

**Do this instead:** Page files should be under 100 lines. Extract: (a) Table column definitions to a `columns.tsx` file, (b) data fetching to `queries.ts`, (c) mutations to `actions.ts`, (d) complex UI sections to named components in the feature's `components/` directory.

### Anti-Pattern 3: Triple Auth Guard

**What people do:** Middleware checks auth AND AuthContext checks auth AND withAuth HOC checks auth — three overlapping mechanisms with different behaviors (middleware redirects server-side, AuthContext returns null, withAuth shows "Loading..." then redirects client-side using react-hot-toast while the rest of the app uses sonner).

**Why it's wrong:** Confusing to maintain. Three places to update. The HOC uses a different toast library. Redundant network requests.

**Do this instead:** Middleware handles route protection (server-side redirect). AuthContext provides user state to client components. That's two mechanisms with clear, non-overlapping responsibilities. Delete the withAuth HOC entirely.

### Anti-Pattern 4: Client-Side Data Fetching via useEffect

**What people do:** Every page uses `useEffect` + `fetch('/api/...')` + `useState` to load data, creating loading spinners and waterfalls.

**Why it's wrong:** Unnecessary client-side round-trip when the server already has the data. Creates flash-of-loading-state. Each page reinvents the same fetch-then-setState pattern.

**Do this instead:** Use Server Components for initial data fetching. Pass data as props to Client Components that need interactivity. Only use client-side fetching for data that changes in response to user actions (and even then, prefer server actions with `revalidatePath`).

### Anti-Pattern 5: Duplicated AccessResult Type

**What people do:** `AccessResult<T>` type is defined independently in both `cca-chair-access.ts` and `cca-management-access.ts`.

**Why it's wrong:** Two identical type definitions that could drift apart.

**Do this instead:** Define `AccessResult<T>` once in `src/types/common.ts` and import it everywhere.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Supabase Auth | OAuth flow + JWT validation | Use `getUser()` in middleware only; `getClaims()` everywhere else for speed |
| Supabase Database | Server-side client per request | Always create fresh client with `await createClient()`. Enable cookie writing in middleware only. |
| Supabase Storage | Public URL generation for profile photos | Used via `supabase.storage.from().getPublicUrl()` — no auth needed for public bucket reads |
| SST/OpenNext | AWS Lambda deployment | `sst.config.ts` handles deployment config. No code changes needed for refactoring. |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Auth feature <-> All features | `fetchUserInfo()` returns `AuthenticatedUser` | Every feature depends on auth; auth depends on nothing |
| CCA feature <-> Ranking feature | Shared types: `CcaType`, `PositionType` from `@/types/user` | Ranking needs CCA context but imports types only, not CCA queries |
| Feature flag system <-> All features | `isCoreServiceEnabled()` called in layouts + actions | Flags are checked at the boundary, not deep inside business logic |
| Page routes <-> Feature modules | Pages import from feature barrel exports | Pages are thin composition layers |

## Build Order (Dependencies)

This ordering matters for the refactoring roadmap — each phase depends on the previous.

```
Phase 1: Auth Fix + Middleware Cookie Writing
    │     (Unblocks everything — session bleed must be fixed first)
    │
    ▼
Phase 2: Shared Infrastructure
    │     (Feature flags to env vars, AccessResult to shared types,
    │      supabase client cookie writing, remove withAuth HOC,
    │      remove react-hot-toast, establish features/ directory)
    │
    ▼
Phase 3: CCA Feature Module
    │     (Extract from monolithic pages, create queries.ts + actions.ts,
    │      break up 1111-line manageMembers page)
    │     Depends on: Auth fix, shared infrastructure
    │
    ▼
Phase 4: Ranking Feature Module
    │     (Extract ranking logic, depends on CCA types)
    │     Depends on: CCA feature types established
    │
    ▼
Phase 5: Allocation Feature Module
    │     (Uses CCA + Ranking types)
    │     Depends on: CCA + Ranking features
    │
    ▼
Phase 6: Holiday Subsidy Feature Module
    │     (Most independent — can run in parallel with Allocation)
    │     Depends on: Shared infrastructure only
    │
    ▼
Phase 7: Cleanup + Polish
          (Remove unused deps, enable ESLint, type audit, UI consistency)
```

**Why this order:**
- Auth first because the session bleed bug is a security issue and blocks correct server-side data fetching.
- Shared infrastructure second because every feature module needs the common patterns established (feature flags, shared types, auth utilities).
- CCA before Ranking because ranking depends on CCA types and the ranking page is inside the CCA admin section (`mycca/admin/rankMembers`).
- Holiday Subsidy is the most independent feature — it could theoretically be done in parallel with Allocation.
- Cleanup last because adding ESLint enforcement before the refactoring is done would create noise in every PR.

## Sources

- [Supabase SSR Auth for Next.js](https://supabase.com/docs/guides/auth/server-side/nextjs) — Official middleware and cookie handling patterns
- [Supabase SSR Client Creation](https://supabase.com/docs/guides/auth/server-side/creating-a-client) — getAll/setAll cookie pattern
- [getClaims vs getUser discussion](https://github.com/supabase/supabase/issues/40985) — Supabase team recommends getClaims for performance, getUser for middleware refresh
- [Next.js Server Actions vs Route Handlers](https://github.com/vercel/next.js/discussions/72919) — Server actions for internal mutations, route handlers for external APIs
- [Server Actions for read operations discussion](https://github.com/vercel/next.js/discussions/58674) — POST-only limitation; use Server Components for reads
- [Feature-Driven Architecture with Next.js](https://dev.to/rufatalv/feature-driven-architecture-with-nextjs-a-better-way-to-structure-your-application-1lph) — Feature module organization pattern
- [Next.js Feature Flags with App Router](https://aurorascharff.no/posts/implementing-feature-flagging-with-nextjs-app-router/) — Environment-variable-based flags in server components
- [MakerKit: Server Actions vs Route Handlers](https://makerkit.dev/blog/tutorials/server-actions-vs-route-handlers) — When to use each pattern

---
*Architecture research for: Next.js 15 + Supabase intranet app refactoring*
*Researched: 2026-04-10*
