# Coding Conventions

**Analysis Date:** 2026-04-10

## Naming Patterns

**Files:**
- Page components: `page.tsx` (Next.js App Router convention)
- Layout components: `layout.tsx`
- API routes: `route.ts`
- UI primitives: `kebab-case.tsx` (e.g., `loading-spinner.tsx`, `dropdown-menu.tsx`)
- Custom components: `kebab-case.tsx` (e.g., `cca-type-badge.tsx`, `points-recap-card.tsx`)
- Hooks: `camelCase.ts` prefixed with `use` (e.g., `useRoleAuth.ts`, `use-mobile.ts` -- mixed conventions exist)
- Types: `PascalCase.ts` (e.g., `User.ts`, `CCAPosition.ts`) or `kebab-case.ts` (e.g., `holiday-subsidy.ts`, `dashboard.ts`)
- Lib modules: `kebab-case.ts` (e.g., `cca-chair-access.ts`, `feature-flags.ts`, `fetch-user-info.ts`)
- Constants: `kebab-case.ts` in `src/lib/constants/` (e.g., `auth.ts`)

**Functions:**
- React components: `PascalCase` (e.g., `AppLayout`, `SimpleTable`, `CcaTypeBadge`)
- Hooks: `camelCase` prefixed with `use` (e.g., `useAuth`, `useRoleAuth`, `useIsMobile`)
- Library/utility functions: `camelCase` (e.g., `fetchUserInfo`, `checkCcaAuthorization`, `canManageCcaMembers`)
- API route handlers: uppercase HTTP method names (e.g., `GET`, `POST`, `PATCH`, `DELETE`)
- Internal helpers within files: `camelCase` (e.g., `authorizeChair`, `validatePosition`)

**Variables:**
- Local state: `camelCase` (e.g., `loadingCCAs`, `userPositions`, `ccaData`)
- Constants: `UPPER_SNAKE_CASE` for module-level constants (e.g., `CACHE_DURATION`, `STORAGE_KEY`, `CHAIR_POSITION_TYPES`, `HOLIDAY_WEEKS`)
- Exported const objects: `PascalCase` or `UPPER_SNAKE_CASE` (e.g., `SubsidyStatus`, `CORE_SERVICE_FLAGS`)

**Types:**
- Interfaces: `PascalCase` (e.g., `AuthenticatedUser`, `CCAData`, `SimpleTableColumn`)
- Type aliases: `PascalCase` (e.g., `PositionType`, `CcaType`, `CoreServiceKey`)
- Generic result types: discriminated union pattern `{ ok: true; data: T } | { ok: false; status: number; error: string }` used in `src/lib/cca-chair-access.ts` and `src/lib/cca-management-access.ts`

## Code Style

**Formatting:**
- No dedicated Prettier config file detected -- relies on editor defaults
- Indentation: mixed tabs and spaces (inconsistent across files -- `src/context/AuthContext.tsx` uses mixed tab/space indentation)
- Semicolons: present in most files but not enforced universally
- String quotes: double quotes predominant in JSX and imports; single quotes appear in some files (e.g., `src/app/dashboard/mycca/page.tsx`)
- Trailing commas: generally present after last property/parameter

**Linting:**
- ESLint with `next/core-web-vitals` and `next/typescript` extends in `.eslintrc.json`
- ESLint is set to `ignoreDuringBuilds: true` in `next.config.mjs` -- linting errors do not block builds
- Frequent `eslint-disable` comments throughout codebase, primarily for `@typescript-eslint/no-explicit-any` and `@typescript-eslint/no-unused-vars`

## Import Organization

**Order (observed pattern):**
1. React / framework imports (`react`, `next/...`)
2. External library imports (`@supabase/...`, `@tanstack/...`, `framer-motion`, `lucide-react`)
3. Internal alias imports (`@/components/...`, `@/lib/...`, `@/context/...`, `@/types/...`, `@/utils/...`, `@/hooks/...`)

**Path Aliases:**
- `@/*` maps to `./src/*` (configured in `tsconfig.json`)
- Use `@/components/ui/button` not `../ui/button`
- Use `@/lib/utils` not `../../lib/utils`

**Import Style:**
- Named imports preferred: `import { Button } from "@/components/ui/button"`
- Default imports for pages: `export default function Dashboard()`
- Type imports use inline `type` keyword: `import { type ClassValue } from "clsx"`

## Component Patterns

**Page Components:**
- Use `"use client"` directive at top for interactive pages
- Wrap content in `<AppLayout>` for dashboard pages
- Show `<AppLoading />` or `<LoadingSpinner />` while data loads
- Use `useAuth()` hook to access user context
- Fetch data with `fetch('/api/...')` in `useEffect` hooks
- Export as `export default function PageName()`

**Example page structure (from `src/app/dashboard/mycca/page.tsx`):**
```tsx
'use client';
import { useAuth } from '@/context/AuthContext';
import { AppLayout } from '@/components/layout/app-layout';

export default function MyCCAs() {
  const { user } = useAuth();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/...')
      .then(res => res.json())
      .then(data => setData(data))
      .catch(err => toast.error(err.message))
      .finally(() => setLoading(false));
  }, [user]);

  if (loading) return <AppLayout><LoadingSpinner /></AppLayout>;

  return (
    <AppLayout>
      {/* page content */}
    </AppLayout>
  );
}
```

**UI Components:**
- shadcn/ui (new-york style) primitives in `src/components/ui/`
- Use `cn()` utility from `src/lib/utils.ts` for conditional class merging
- Use `class-variance-authority` (`cva`) for variant-based styling (see `src/components/ui/button.tsx`)
- Components accept `className` prop for external customization
- Component functions use `function` keyword (not arrow functions) for shadcn components

**Feature-flagged layouts:**
- Use `isCoreServiceEnabled()` in layout files to gate entire feature sections
- Render `<ServiceDisabledState service="..." />` when disabled
- Example: `src/app/dashboard/holidaySubsidy/layout.tsx`, `src/app/dashboard/ccaAllocation/layout.tsx`

## API Route Patterns

**Standard API route structure (from `src/app/api/cca/[ccaId]/addMember/route.ts`):**
```typescript
export async function POST(
    request: Request,
    { params }: { params: Promise<{ ccaId: string }> }
) {
    try {
        const { ccaId } = await params;
        const body = await request.json();
        const supabase = await createClient();

        // 1. Authenticate user
        const requestingUser = await fetchUserInfo();
        if (!requestingUser) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // 2. Fetch resource
        const { data, error } = await supabase.from('table').select('...').eq('id', id).single();
        if (error || !data) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 });
        }

        // 3. Authorize
        const authResult = await getManagedCcaAccess({ supabase, requestingUser, cca: data });
        if (!authResult.ok) {
            return NextResponse.json({ error: authResult.error }, { status: authResult.status });
        }

        // 4. Business logic + DB mutation
        // 5. Return result
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error:', error);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
```

**Feature flag gating in API routes:**
```typescript
const disabledResponse = getCoreServiceDisabledApiResponse("holidaySubsidy");
if (disabledResponse) return disabledResponse;
```

**Response format conventions:**
- Success: `NextResponse.json({ data })` or `NextResponse.json({ success: true, ... })`
- Error: `NextResponse.json({ error: "message" }, { status: 4xx/5xx })`
- Some routes use `{ success: boolean, data: [], message: "..." }` pattern (e.g., `src/app/api/user/search/route.ts`)
- No single standardized response envelope -- varies between routes

## Error Handling

**Client-side patterns:**
- `try/catch` around async operations
- Toast notifications for user-facing errors via `sonner` (`toast.error(...)`) in most places
- Legacy `react-hot-toast` still used in `src/hoc/withAuth.tsx` and `src/app/dashboard/mycca/page.tsx`
- `console.error()` for developer debugging
- Loading/error state managed with `useState` booleans

**Server-side (API routes):**
- Wrap entire handler body in `try/catch`
- Catch block logs `console.error(...)` and returns generic error JSON
- Supabase errors checked inline: `if (error) { return NextResponse.json({ error: error.message }, { status: 500 }); }`
- Specific error codes handled (e.g., Postgres `23505` unique violation -> 409 Conflict in `src/app/api/holidaySubsidy/declarations/[ccaId]/route.ts`)

**Authorization pattern:**
- Uses a result-type pattern: `AccessResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string }`
- Defined in `src/lib/cca-chair-access.ts` and `src/lib/cca-management-access.ts`
- Callers check `if (!authResult.ok)` and forward `authResult.status` / `authResult.error`

## Logging

**Framework:** `console` (no structured logging library)

**Patterns:**
- `console.error("Error [context]:", error)` for unexpected errors
- `console.warn(...)` for non-critical issues (e.g., cookie clearing failure)
- `console.log(...)` for informational messages (e.g., "No authenticated user found")
- No log levels, no structured JSON logging, no external logging service

## Comments

**When to Comment:**
- File-level comment showing file path (legacy pattern from Windows paths): `// C:\Ron\intranet-next-app\src\hoc\withAuth.tsx`
- File-level comment with relative path: `// src/app/api/ping/route.ts`
- Inline comments using `//` with checkmark emojis for step annotations: `// ✅ Check client-side cache first` (seen in `src/hooks/useRoleAuth.ts`, `src/app/api/sportsCulture/available/route.ts`)
- Block explanation comments after function definitions (see `src/hoc/withAuth.tsx` lines 34-66)

**JSDoc/TSDoc:**
- Minimal usage. One JSDoc comment found in `src/lib/fetch-user-info.ts`: `/** Get the authenticated user's ID... */`
- Most functions have no documentation comments

## State Management

**Client state:** React `useState` + `useEffect` for data fetching
- No global state management library (no Redux, Zustand, Jotai)
- `AuthContext` (`src/context/AuthContext.tsx`) provides user session via React Context
- `useAuth()` hook is the single context consumer
- `useRoleAuth()` hook in `src/hooks/useRoleAuth.ts` caches role data in `localStorage` with 5-minute TTL

**Server state:** No React Query / SWR / TanStack Query
- Data fetched via raw `fetch()` in `useEffect` hooks
- No client-side caching beyond manual `localStorage` usage in `useRoleAuth`

## Styling

**Approach:** Tailwind CSS v4 with `tw-animate-css`
- CSS variables for theming defined in `src/app/globals.css`
- Utility classes applied directly in JSX
- `cn()` helper from `src/lib/utils.ts` combines `clsx` + `tailwind-merge`
- `aphrodite` package is listed as a dependency but no active usage detected in source files
- Custom fonts: Geist Sans, Geist Mono (local), Fredoka (Google Font)

## Module Design

**Exports:**
- Named exports preferred for components: `export function AppLayout(...)`, `export function SimpleTable(...)`
- Named exports for library functions: `export function fetchUserInfo()`, `export function checkCcaAuthorization()`
- Default exports only for Next.js page/layout convention: `export default function Dashboard()`
- Re-exports from UI components: `export { Button, buttonVariants }`

**Barrel Files:**
- Not used. Each module is imported directly from its file path.

**Shared logic in `src/lib/`:**
- Pure business logic functions (no React dependencies) in `src/lib/`
- Authorization: `src/lib/cca-chair-access.ts`, `src/lib/cca-management-access.ts`
- Feature flags: `src/lib/feature-flags.ts`
- Domain logic: `src/lib/cca-ranking-metrics.ts`, `src/lib/cca-ranking-comments.ts`, `src/lib/cca-cut-status.ts`
- Data fetching (server-only): `src/lib/fetch-user-info.ts` (marked `"use server"`)

---

*Convention analysis: 2026-04-10*
