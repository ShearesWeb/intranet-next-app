# Codebase Refactor Design

Complete refactor of the intranet-next-app codebase to establish consistent naming, folder structure, code patterns, and best practices across API routes, page components, shared utilities, and types.

## Approach

Bottom-up, phased refactor. Each phase leaves the app fully functional.

- **Phase 1**: Foundation cleanup (dead code, file moves, shared utilities, dependency cleanup)
- **Phase 2**: API route refactor (RESTful paths, service layer extraction, standardized responses)
- **Phase 3**: Page and component refactor (server components, hook decomposition, shared components)
- **Phase 4**: Final consistency pass and CLAUDE.md update

## Naming Conventions (Target)

All files use **kebab-case**. No exceptions.

| Category | Filename | Code identifier |
|----------|----------|----------------|
| Components | `page-header.tsx` | `PageHeader` |
| Hooks | `use-cca-members.ts` | `useCcaMembers` |
| Types | `user.ts` | `AuthenticatedUser` |
| Utils | `holiday-weeks.ts` | `getWeekLabel` |
| API routes | `kebab-case` segments | `GET`, `POST`, etc. |
| Route segments | `cca-allocation/` | N/A |
| Constants | `feature-flags.ts` | `CORE_SERVICE_FLAGS` |

## Target Folder Structure

```
src/
├── app/
│   ├── api/
│   │   ├── auth/signout/
│   │   ├── cca/[cca-id]/
│   │   │   ├── members/            # GET list, POST add, DELETE remove, PATCH update
│   │   │   ├── rankings/
│   │   │   └── search-users/
│   │   ├── cca/managed-positions/
│   │   ├── cca/rankings/
│   │   │   └── all/
│   │   ├── chair/positions/
│   │   │   ├── for-chair/
│   │   │   └── [position-id]/
│   │   │       ├── applicants/     # POST add, DELETE remove (was addApplicant/removeApplicant)
│   │   │       └── rank/
│   │   ├── holiday-subsidy/        # was holidaySubsidy
│   │   │   ├── approvals/
│   │   │   │   ├── [cca-id]/
│   │   │   │   └── weekly/[cca-id]/[week-id]/
│   │   │   ├── declarations/[cca-id]/
│   │   │   └── weekly/[cca-id]/[week-id]/
│   │   ├── ping/
│   │   └── user/
│   │       ├── ccas/               # was getCCAs
│   │       ├── check-role/         # was checkRole
│   │       ├── managed-ccas/       # was getManagedCCAs
│   │       ├── rankable-positions/ # was getRankablePositions
│   │       │   └── [email]/
│   │       ├── rankings/           # was saveRankings (POST)
│   │       └── search/
│   ├── auth/
│   │   ├── callback/
│   │   ├── login/
│   │   └── auth-error/
│   └── dashboard/
│       ├── cca-allocation/         # was ccaAllocation
│       │   ├── rank/
│       │   └── rank-applicants/    # was rankApplicants
│       ├── holiday-subsidy/        # was holidaySubsidy
│       │   ├── approvals/
│       │   │   ├── [cca-name]/
│       │   │   └── weekly/[cca-name]/
│       │   ├── declaration/[cca-name]/
│       │   ├── guide/
│       │   └── weekly/[cca-name]/
│       ├── my-cca/                 # was mycca
│       │   └── admin/
│       │       ├── manage-members/[cca-name]/  # was manageMembers
│       │       └── rank-members/[cca-name]/    # was rankMembers
│       ├── layout.tsx
│       ├── loading.tsx
│       ├── error.tsx
│       └── page.tsx
├── components/
│   ├── ui/                         # shadcn primitives (untouched)
│   ├── layout/
│   │   ├── app-layout.tsx
│   │   ├── app-sidebar.tsx
│   │   ├── app-loading.tsx
│   │   ├── nav-main.tsx
│   │   ├── nav-user.tsx
│   │   ├── page-header.tsx         # NEW: shared h1 + description + optional actions
│   │   ├── empty-state.tsx         # NEW: shared empty state card
│   │   ├── error-card.tsx          # NEW: shared inline error card
│   │   ├── dashboard-error.tsx
│   │   └── dashboard-skeletons.tsx
│   ├── table/
│   │   ├── data-table.tsx          # REPLACES simple-table.tsx + selection-table.tsx
│   │   ├── data-table-toolbar.tsx  # NEW: extracted search + column visibility
│   │   ├── data-table-pagination.tsx  # NEW: extracted pagination controls
│   │   └── ordering-table.tsx      # KEPT: drag-and-drop is a distinct interaction
│   ├── badges/
│   │   └── index.tsx               # CONSOLIDATES 3 badge files into 1
│   └── feature-flags/
│       └── service-disabled-state.tsx
├── features/
│   ├── allocation/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── services/               # NEW: server-side business logic
│   │   ├── types/
│   │   └── utils/
│   ├── cca/
│   │   ├── components/
│   │   ├── hooks/
│   │   │   └── use-role-auth.ts    # MOVED from src/hooks/useRoleAuth.ts
│   │   ├── services/               # NEW
│   │   ├── types/
│   │   └── utils/
│   ├── holiday-subsidy/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── services/               # NEW
│   │   ├── types/
│   │   └── utils/
│   └── ranking/
│       ├── components/
│       ├── hooks/
│       ├── services/               # NEW
│       ├── types/
│       └── utils/
├── lib/
│   ├── supabase/                   # MOVED from src/utils/supabase/
│   │   ├── client.ts
│   │   ├── server.ts
│   │   ├── middleware.ts
│   │   ├── cookie-eviction.ts
│   │   └── helpers.ts             # NEW: unwrapRelation + shared query utils
│   ├── auth/
│   │   ├── auth-context.tsx       # MOVED from src/context/AuthContext.tsx
│   │   └── fetch-user-info.ts     # MOVED from src/lib/fetch-user-info.ts
│   ├── api/
│   │   ├── response.ts           # NEW: standardized API response helpers
│   │   ├── auth.ts               # NEW: reusable route auth guards
│   │   ├── errors.ts             # NEW: ApiError class for structured error throwing
│   │   └── fetch.ts              # NEW: client-side fetchApi<T>() helper
│   ├── hooks/
│   │   └── use-mobile.ts         # MOVED from src/hooks/use-mobile.ts
│   ├── feature-flags.ts
│   └── utils.ts                   # cn() helper
├── types/
│   └── user.ts                    # RENAMED from User.ts, CCAPosition.ts inlined
└── test-utils/                    # unchanged
```

### Deleted files

| File | Reason |
|------|--------|
| `src/utils/interfaces.ts` | Dead legacy code with Windows path comment |
| `src/types/dashboard.ts` | Empty file with "intentionally empty" comment |
| `src/types/CCAPosition.ts` | Inlined into `src/types/user.ts` |
| `src/components/table/simple-table.tsx` | Replaced by `data-table.tsx` |
| `src/components/table/selection-table.tsx` | Merged into `data-table.tsx` |
| `src/components/badges/type-badges.tsx` | Consolidated into `badges/index.tsx` |
| `src/components/badges/cca-type-badge.tsx` | Consolidated into `badges/index.tsx` |
| `src/components/badges/position-type-badge.tsx` | Consolidated into `badges/index.tsx` |
| `src/context/` directory | Moved to `src/lib/auth/` |
| `src/hooks/` directory | Contents moved to features or `src/lib/hooks/` |
| `src/utils/` directory | Contents moved to `src/lib/supabase/` |

## Phase 1: Foundation Cleanup

### 1.1 Dead code removal

- Delete `src/utils/interfaces.ts` (unused — zero imports)
- Delete `src/types/dashboard.ts` (empty placeholder)
- Remove `export type User = AuthenticatedUser` backward-compat alias from `src/types/User.ts`
- Remove emoji checkmark comments (`// ✅`) from `useRoleAuth.ts` and other files

### 1.2 File moves and renames

All moves include updating every import across the codebase.

| From | To |
|------|----|
| `src/utils/supabase/*` | `src/lib/supabase/*` |
| `src/context/AuthContext.tsx` | `src/lib/auth/auth-context.tsx` |
| `src/lib/fetch-user-info.ts` | `src/lib/auth/fetch-user-info.ts` |
| `src/hooks/useRoleAuth.ts` | `src/features/cca/hooks/use-role-auth.ts` |
| `src/hooks/use-mobile.ts` | `src/lib/hooks/use-mobile.ts` |
| `src/types/User.ts` | `src/types/user.ts` |
| `src/types/CCAPosition.ts` | Inline into `src/types/user.ts` |

### 1.3 New shared utilities

**`src/lib/api/response.ts`** — Standardized API response helpers:

```ts
export function apiOk<T>(data: T, status = 200) {
  return NextResponse.json({ data, error: null }, { status })
}

export function apiError(message: string, status: number) {
  return NextResponse.json({ data: null, error: message }, { status })
}
```

**`src/lib/api/auth.ts`** — Reusable auth guard functions:

```ts
export async function requireAuth(): Promise<AuthenticatedUser>
export async function requireChairAccess(ccaId: number): Promise<AuthenticatedUser>
export async function requireJcrcAccess(): Promise<AuthenticatedUser>
export async function requireAdminAccess(): Promise<AuthenticatedUser>
```

These throw `ApiError` on failure. Route handlers catch and return `apiError()`.

**`src/lib/api/errors.ts`** — Structured error class:

```ts
export class ApiError extends Error {
  constructor(public readonly statusCode: number, message: string) {
    super(message)
  }
}
```

Route handlers use a try/catch pattern:

```ts
try {
  const user = await requireAuth()
  // ... business logic
} catch (e) {
  if (e instanceof ApiError) return apiError(e.message, e.statusCode)
  return apiError("Internal server error", 500)
}
```

**`src/lib/supabase/helpers.ts`** — Shared Supabase query utilities:

```ts
export function unwrapRelation<T>(value: T | T[] | null | undefined): T | null
```

Eliminates the 3+ copies of this function currently scattered across API routes.

### 1.4 Dependency cleanup

- Remove `aphrodite` (no active usage detected in source)
- Remove `react-hot-toast` — migrate remaining usages to `sonner`
- Remove `framer-motion` — replace dashboard hover animations with CSS transitions / Tailwind `hover:scale-[1.02] transition-transform`

### 1.5 Badge consolidation

Merge `type-badges.tsx`, `cca-type-badge.tsx`, and `position-type-badge.tsx` into a single `src/components/badges/index.tsx`:

- One `humanize()` function
- One style map per badge type
- `PositionTypeBadge` cleaned up: accept only `positionType` (not dual `positionType` / `position_type`)
- All consumers updated

## Phase 2: API Route Refactor

### 2.1 Route path renames

All API route folders renamed to kebab-case. Verb-based routes consolidated into RESTful resource routes.

**CCA routes:**

| Current path | Target path | HTTP methods |
|-------------|-------------|--------------|
| `/api/cca/[ccaId]/members` | `/api/cca/[cca-id]/members` | GET |
| `/api/cca/[ccaId]/addMember` | `/api/cca/[cca-id]/members` | POST |
| `/api/cca/[ccaId]/removeMember` | `/api/cca/[cca-id]/members` | DELETE |
| `/api/cca/[ccaId]/updateMember` | `/api/cca/[cca-id]/members` | PATCH |
| `/api/cca/[ccaId]/searchUsers` | `/api/cca/[cca-id]/search-users` | GET |
| `/api/cca/[ccaId]/rankings` | `/api/cca/[cca-id]/rankings` | GET/POST |
| `/api/cca/managedPositions` | `/api/cca/managed-positions` | GET |
| `/api/cca/rankings/all` | `/api/cca/rankings/all` | GET |

**Chair routes:**

| Current path | Target path | HTTP methods |
|-------------|-------------|--------------|
| `/api/chair/positions/forChair` | `/api/chair/positions/for-chair` | GET |
| `/api/chair/positions/[position_id]/addApplicant` | `/api/chair/positions/[position-id]/applicants` | POST |
| `/api/chair/positions/[position_id]/removeApplicant` | `/api/chair/positions/[position-id]/applicants` | DELETE |
| `/api/chair/positions/[position_id]/rank` | `/api/chair/positions/[position-id]/rank` | GET/POST |

**User routes:**

| Current path | Target path | HTTP methods |
|-------------|-------------|--------------|
| `/api/user/getCCAs` | `/api/user/ccas` | GET |
| `/api/user/checkRole` | `/api/user/check-role` | GET |
| `/api/user/getManagedCCAs` | `/api/user/managed-ccas` | GET |
| `/api/user/getRankablePositions/[email]` | `/api/user/rankable-positions/[email]` | GET |
| `/api/user/saveRankings` | `/api/user/rankings` | POST |

**Holiday subsidy routes:**

| Current path | Target path |
|-------------|-------------|
| `/api/holidaySubsidy/*` | `/api/holiday-subsidy/*` |

### 2.2 Service layer extraction

Each feature gets a `services/` directory for server-side business logic extracted from route handlers.

**Pattern — thin route handler:**

```ts
// src/app/api/cca/[cca-id]/members/route.ts
import { apiOk, apiError } from "@/lib/api/response"
import { requireChairAccess } from "@/lib/api/auth"
import { getMembers, addMember, removeMember, updateMember } from "@/features/cca/services/member-service"

export async function GET(_req: Request, { params }: { params: Promise<{ "cca-id": string }> }) {
  const { "cca-id": ccaIdStr } = await params
  const ccaId = parseInt(ccaIdStr, 10)
  if (isNaN(ccaId)) return apiError("Invalid CCA ID", 400)

  await requireChairAccess(ccaId)
  const members = await getMembers(ccaId)
  return apiOk({ members })
}

export async function POST(req: Request, { params }: { params: Promise<{ "cca-id": string }> }) {
  // similar thin pattern
}
```

**Service files to create:**

| Service | Extracted from |
|---------|---------------|
| `features/cca/services/member-service.ts` | `api/cca/[ccaId]/members`, `addMember`, `removeMember`, `updateMember` routes |
| `features/cca/services/ranking-service.ts` | `api/cca/[ccaId]/rankings` route |
| `features/cca/services/position-service.ts` | `api/cca/managedPositions`, `api/chair/positions` routes |
| `features/holiday-subsidy/services/declaration-service.ts` | `api/holidaySubsidy/declarations/[ccaId]` route (306 lines) |
| `features/holiday-subsidy/services/approval-service.ts` | `api/holidaySubsidy/approvals` route (294 lines) + `approvals/[ccaId]` (339 lines) |
| `features/holiday-subsidy/services/weekly-service.ts` | `api/holidaySubsidy/weekly/[ccaId]/[weekId]` route (469 lines) |
| `features/ranking/services/user-ranking-service.ts` | `api/user/saveRankings`, `api/user/getRankablePositions` routes |

### 2.3 Standardized response envelope

All API routes use the same response shape:

```ts
// Success
{ data: T, error: null }

// Error
{ data: null, error: string }
```

All frontend `fetch()` calls updated to expect this shape. A shared `fetchApi<T>()` helper can be created for the client side:

```ts
// src/lib/api/fetch.ts
export async function fetchApi<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, options)
  const json = await res.json()
  if (!res.ok) throw new ApiError(json.error, res.status)
  return json.data as T
}
```

## Phase 3: Page & Component Refactor

### 3.1 Dashboard route renames

| Current | Target |
|---------|--------|
| `/dashboard/ccaAllocation` | `/dashboard/cca-allocation` |
| `/dashboard/ccaAllocation/rankApplicants` | `/dashboard/cca-allocation/rank-applicants` |
| `/dashboard/holidaySubsidy` | `/dashboard/holiday-subsidy` |
| `/dashboard/mycca` | `/dashboard/my-cca` |
| `/dashboard/mycca/admin/manageMembers` | `/dashboard/my-cca/admin/manage-members` |
| `/dashboard/mycca/admin/rankMembers` | `/dashboard/my-cca/admin/rank-members` |

### 3.2 Server component conversion

Pages that primarily display data (no interactive editing) become async server components with direct Supabase calls:

| Page | Current | Target | Reason |
|------|---------|--------|--------|
| My CCAs list | Client + useEffect + fetch | Server component | Read-only table display |
| Holiday Subsidy landing | Client + useEffect + fetch | Server component | Read-only CCA list |
| CCA Allocation guide | Client | Server component | Static content display |
| Dashboard home | Client | Hybrid (server shell + client PointsRecap) | Welcome card is server, points are interactive |
| Holiday Subsidy guide | Client | Server component | Static guide content |
| CCA admin list | Client + useEffect + fetch | Server component | Read-only list of managed CCAs |
| Subsidy approvals index | Client + useEffect + fetch | Server component | Read-only table with counts |

Pages that stay client-side (interactive editing):
- Manage Members (add/remove/save mutations)
- Rank Members (drag-and-drop ranking)
- CCA Allocation rank (drag-and-drop ordering)
- Rank Applicants (drag-and-drop + add/remove)
- Holiday Subsidy declaration (form submission)
- Weekly commitment (table editing + save)
- Weekly approvals (approve/reject actions)

### 3.3 Hook decomposition

**`use-cca-members.ts` (645 lines) splits into:**

| New hook | Responsibility | Approx lines |
|----------|---------------|-------------|
| `use-cca-member-data.ts` | Fetch members, grouped data, loading/error state | ~80 |
| `use-cca-member-search.ts` | Search query, results, search loading | ~60 |
| `use-cca-member-mutations.ts` | Add, remove, update, save, pending changes | ~120 |
| `use-cca-member-permissions.ts` | Permission checks, CCA type flags | ~40 |

The page component composes these:

```tsx
const { groupedMembers, cca, loading, error } = useCcaMemberData(ccaId)
const { searchQuery, setSearchQuery, searchResults, searchUser } = useCcaMemberSearch(ccaId)
const { addMember, removeMember, updateStatus, saveAll, pendingChanges } = useCcaMemberMutations(ccaId)
const { permissions } = useCcaMemberPermissions(cca)
```

**`use-weekly-commitment.ts` (303 lines) splits into:**

| New hook | Responsibility |
|----------|---------------|
| `use-weekly-data.ts` | Fetch weekly commitment data |
| `use-weekly-mutations.ts` | Save/delete commitment changes |

### 3.4 New shared components

**`PageHeader`** — replaces the repeated `h1 + p` pattern:

```tsx
interface PageHeaderProps {
  title: string
  description?: string
  actions?: React.ReactNode
  backHref?: string
  backLabel?: string
}

export function PageHeader({ title, description, actions, backHref, backLabel }: PageHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">{title}</h1>
        {description && (
          <p className="text-muted-foreground text-sm leading-relaxed">{description}</p>
        )}
      </div>
      {(actions || backHref) && (
        <div className="flex flex-wrap items-center gap-2">
          {actions}
          {backHref && (
            <Button asChild variant="outline" size="sm" className="gap-2">
              <Link href={backHref}>
                <ArrowLeft className="h-4 w-4" />
                {backLabel || "Back"}
              </Link>
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
```

**`EmptyState`** — replaces ad-hoc empty Card blocks:

```tsx
interface EmptyStateProps {
  icon?: LucideIcon
  title: string
  description?: string
  action?: React.ReactNode
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <Card className="border-dashed bg-muted/40">
      <CardContent className="flex flex-col items-center justify-center py-16 text-center">
        {Icon && <Icon className="h-10 w-10 text-muted-foreground/50 mb-4" />}
        <p className="text-lg text-muted-foreground mb-2">{title}</p>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
        {action && <div className="mt-4">{action}</div>}
      </CardContent>
    </Card>
  )
}
```

**`ErrorCard`** — replaces ad-hoc inline error states:

```tsx
interface ErrorCardProps {
  error: string
  onRetry?: () => void
  backHref?: string
  backLabel?: string
}

export function ErrorCard({ error, onRetry, backHref, backLabel }: ErrorCardProps) {
  return (
    <Card className="border-destructive/40 bg-destructive/5">
      <CardContent className="flex flex-col items-center gap-4 p-6">
        <p className="text-destructive font-medium text-center">{error}</p>
        <div className="flex gap-2">
          {onRetry && <Button onClick={onRetry}>Try again</Button>}
          {backHref && (
            <Button asChild variant="outline">
              <Link href={backHref}>{backLabel || "Go back"}</Link>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
```

### 3.5 DataTable consolidation

Replace `SimpleTable` + `SelectionTable` with a single `DataTable`:

```tsx
interface DataTableProps<TData> {
  data: TData[]
  columns: ColumnDef<TData>[]
  searchColumn?: string
  searchPlaceholder?: string
  pageSize?: number
  emptyMessage?: string
  selectable?: boolean
  selectedIds?: Set<string | number>
  onSelectionChange?: (id: string | number) => void
  idField?: keyof TData
}
```

The component is composed from:
- `DataTableToolbar` — search input + column visibility dropdown
- `DataTablePagination` — page controls + page count
- Selection column factory — prepends checkbox column when `selectable` is true

### 3.6 OrderingTable cleanup

- Move `styled-jsx` keyframe animations to `src/app/globals.css` as standard `@keyframes`
- Extract drag state management into `src/components/table/use-drag-reorder.ts`
- Keep the component in `src/components/table/ordering-table.tsx`

### 3.7 Dashboard page refactor

Replace `framer-motion` hover animations with CSS:

```tsx
// Before (framer-motion)
<motion.div whileHover={{ scale: 1.02, y: -2 }} whileTap={{ scale: 0.98 }}>

// After (CSS/Tailwind)
<div className="transition-transform duration-200 hover:scale-[1.02] hover:-translate-y-0.5 active:scale-[0.98]">
```

Extract the repeated action card pattern into a shared component:

```tsx
interface ActionCardProps {
  href: string
  icon: LucideIcon
  title: string
  description: string
}

function ActionCard({ href, icon: Icon, title, description }: ActionCardProps) {
  return (
    <Link href={href} className="block">
      <div className="group relative overflow-hidden rounded-xl border border-orange-100 bg-card p-4 shadow-sm transition-all hover:border-orange-300 hover:shadow-md">
        <div className="absolute inset-0 bg-gradient-to-r from-orange-50 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
        <div className="relative flex items-center gap-4">
          <div className="flex h-10 w-10 md:h-12 md:w-12 shrink-0 items-center justify-center rounded-full bg-orange-100 text-orange-600 transition-colors group-hover:bg-orange-500 group-hover:text-white">
            <Icon className="h-5 w-5 md:h-6 md:w-6" />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-foreground group-hover:text-orange-700 transition-colors">{title}</h3>
            <p className="text-sm text-muted-foreground group-hover:text-orange-600/80 transition-colors">{description}</p>
          </div>
          <ChevronRight className="h-5 w-5 text-muted-foreground/50 transition-colors group-hover:text-orange-500" />
        </div>
      </div>
    </Link>
  )
}
```

### 3.8 Error boundaries

Add `error.tsx` files per route segment that delegate to `DashboardError`:

```tsx
// src/app/dashboard/cca-allocation/error.tsx
"use client"
import { DashboardError } from "@/components/layout/dashboard-error"
export default function Error(props) {
  return <DashboardError {...props} segmentLabel="CCA Allocation" />
}
```

### 3.9 Loading states

Add `loading.tsx` files per route segment using the appropriate skeleton:

```tsx
// src/app/dashboard/my-cca/loading.tsx
import { DashboardTableSkeleton } from "@/components/layout/dashboard-skeletons"
export default function Loading() {
  return <DashboardTableSkeleton />
}
```

## Phase 4: Final Consistency Pass

### 4.1 Audit

- Verify all files follow kebab-case naming
- Verify no orphaned imports or dead exports
- Verify no duplicated utility functions
- Verify all API routes use standardized response envelope
- Verify all pages use `PageHeader`, `EmptyState`, `ErrorCard` where appropriate
- Verify no `react-hot-toast`, `aphrodite`, or `framer-motion` imports remain

### 4.2 Build verification

- `npm run build` passes cleanly
- `npm run lint` passes (or at minimum, no new lint errors)
- All existing tests pass

### 4.3 CLAUDE.md update

Update the conventions section in CLAUDE.md to reflect the new patterns:
- Naming conventions (all kebab-case files)
- API response envelope standard
- Service layer pattern
- Shared component usage (PageHeader, EmptyState, ErrorCard, DataTable)
- Server vs client component decision criteria

## Frontend URL changes

Dashboard route renames will change user-facing URLs. These should be handled with Next.js `redirect()` in a catch-all or by updating all internal `<Link>` references:

| Old URL | New URL |
|---------|---------|
| `/dashboard/ccaAllocation/*` | `/dashboard/cca-allocation/*` |
| `/dashboard/holidaySubsidy/*` | `/dashboard/holiday-subsidy/*` |
| `/dashboard/mycca/*` | `/dashboard/my-cca/*` |

Consider adding `next.config.mjs` redirects for any bookmarked/shared URLs.

## Risks and Mitigations

| Risk | Mitigation |
|------|-----------|
| API path changes break frontend fetch calls | Phase 2 updates all fetch URLs atomically with route renames |
| Dashboard URL changes break bookmarks | Add redirect rules in `next.config.mjs` |
| Server component conversion breaks interactivity | Only convert verified read-only pages; interactive pages stay client |
| Service layer extraction introduces bugs | Extract without changing logic first; refactor within service later |
| Large PR blast radius | Each phase is a separate PR / commit set |
