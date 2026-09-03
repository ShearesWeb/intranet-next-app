# Coding Conventions

**Analysis Date:** 2026-09-03

## Naming Patterns

**Files:**
- Source files: `kebab-case.ts` / `kebab-case.tsx`
  - Example: `use-recap-navigation.ts`, `api-error.ts`, `data-table.tsx`
  - Route handlers follow Next.js naming: `route.ts`, `error.tsx`, `loading.tsx`, `layout.tsx`

**Functions:**
- `camelCase` for all regular functions
  - Example: `formatDateKey()`, `getRankingScore()`, `fetchUserFromBackend()`
  - Helper functions in utility files (`src/lib/utils.ts`, `src/lib/date.ts`)

**Hooks:**
- Filename: `use-kebab-case.ts` / `use-kebab-case.tsx`
- Function export: `useCamelCase()`
  - Example: filename `use-recap-navigation.ts`, exports `useRecapNavigation()`
  - Location: `src/hooks/` directory
  - Always include `"use client"` directive at top

**Components (code):**
- `PascalCase` for all React component functions
  - Example: `DataTable`, `AuthProvider`, `PageHeader`, `EmptyState`
  - File named after component: `PageHeader` → `page-header.tsx`

**Types/Interfaces:**
- `PascalCase` for all type definitions and interfaces
  - Example: `AuthenticatedUser`, `UserAppointment`, `AccessResult<T>`, `CcaKind`
  - Enums use single `CcaKind` not `CcaKindEnum`
  - Location: `src/types/` directory, organized by domain (user.ts, cca-data.ts, ranking.ts)

**Constants:**
- `UPPER_SNAKE_CASE` for module-level constants
  - Example: `WEEKDAY_HEADERS`, `MIN_BOOKING_LEAD_DAYS`, `CACHE_HEADERS`
  - Feature flags: `CORE_SERVICE_FLAGS` (compile-time constants in `src/lib/feature-flags.ts`)

**API route handlers:**
- HTTP verbs as function names: `GET`, `POST`, `PATCH`, `DELETE`
  - Example: `export async function GET(req, { params })`
  - Located in `src/app/api/**/route.ts`

## Code Style

**Formatting:**
- Tool: Prettier 3.8.2
- Settings (`src/.prettierrc`):
  ```json
  {
    "useTabs": true,
    "tabWidth": 2,
    "semi": true,
    "singleQuote": false,
    "trailingComma": "all",
    "printWidth": 100
  }
  ```
- Tabs (not spaces), 2-space tab width
- Trailing commas on multiline structures
- Line length limit: 100 characters
- Double quotes for strings (not single quotes)

**Linting:**
- Tool: ESLint with Next.js config
- Config extends: `["next/core-web-vitals", "next/typescript"]`
- No additional custom rules; rely on Next.js defaults
- Run: `npm run lint`

**TypeScript:**
- Strict mode enabled: `"strict": true` in `tsconfig.json`
- Target: `ES2017`
- Module: `esnext`
- Path aliases: `@/*` → `./src/*`
- `noEmit: true` (type-check only, no code generation)

## Import Organization

**Order:**
1. External packages (`react`, `next`, third-party libraries)
2. Internal path-aliased imports (`@/lib`, `@/components`, `@/types`)
3. Types via `import type` statement

**Pattern:**
```typescript
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { cn } from "@/lib/utils";
import { AuthProvider } from "@/lib/auth/auth-context";
import type { AuthenticatedUser } from "@/types/user";
```

**Path Aliases:**
- `@/*` maps to `./src/*` (defined in `tsconfig.json`)
- Always use aliases for internal imports (not relative paths like `../lib`)

**Type Imports:**
- Use `import type` for TypeScript-only imports
- Reduces bundle size, improves tree-shaking
- Example: `import type { RecapSlide } from "@/types/recap"`

## Error Handling

**API Routes:**
- Pattern: `try/catch` → `handleApiError()` in catch block
  ```typescript
  export async function GET() {
    try {
      const user = await requireAuth();
      const data = await someService(user);
      return apiOk(data);
    } catch (e) {
      return handleApiError(e);
    }
  }
  ```
- Response envelope: `{ data: T, error: null }` on success; `{ data: null, error: string }` on error
- Status codes: 200 (success), 401 (auth), 403 (forbidden), 400 (bad request), 500 (server error)
- Helpers from `@/lib/api/response`:
  - `apiOk(data, status, headers?)` — success response
  - `apiError(message, status)` — error response
  - `handleApiError(e)` — catches ApiError and converts to response

**Auth Guards:**
- Functions throw `ApiError` from `@/lib/api/errors`
  - Example: `requireAuth()`, `requireChairAccess(ccaId)`, `requireJcrcAccess()`
  - Thrown from `src/lib/api/auth.ts`
  - Caught by route handler's catch block

**User-Facing Errors:**
- Use `toast` from `sonner` for notifications
  - `toast.error(message)` — error notification
  - `toast.success(message)` — success notification
  - `toast.info(message)` — informational message
- Error messages should be user-friendly, not technical
  - Avoid: "Failed to deserialize Supabase response"
  - Use: "Failed to delete. Please try again."

**Debug Logging:**
- Pattern: `console.error("Error [context]:", error)`
- Always include context/location in the log message
- Examples:
  - `console.error("Error fetching user info:", error)`
  - `console.error("User search error:", error)`
  - `console.warn("[auth/signout] supabase.auth.signOut threw", err)`
- Development-only: Use conditional logging if needed, but generally log in production
- Never log sensitive data (passwords, tokens, PII)

## Styling

**Framework:**
- Tailwind CSS v4 (not v3)
- Syntax: `@import 'tailwindcss'` in global CSS (not `@tailwind base/components/utilities`)
- Located in `src/app/globals.css`

**Theme:**
- CSS variables for theming and dark mode support
- Global vars defined in `src/app/globals.css`
- Used via `var(--name)` in CSS

**Utility Classes:**
- `cn()` function combines `clsx` + `tailwind-merge` (from `@/lib/utils.ts`)
  ```typescript
  import { cn } from "@/lib/utils";
  
  export function Button({ className, ...props }) {
    return <button className={cn("px-4 py-2 rounded", className)} {...props} />;
  }
  ```
- Always use `cn()` when conditionally merging Tailwind classes
- Prevents specificity conflicts when composing component styling

**UI Components:**
- shadcn/ui (new-york style) primitive components in `src/components/ui/`
- Examples: `Button`, `Card`, `Dialog`, `Tabs`, `DataTable`
- Customization: Modify the component file directly in `src/components/ui/`

## Component Patterns

**Client vs Server Components:**
- Add `"use client"` directive at the top only for interactive pages
- Read-only pages (server components) omit the directive
- Server components can call Supabase directly

**Page Layout:**
- Use `<PageHeader>` from `@/components/layout/page-header` for page titles
  - Structure: flat `h1 + p` block, no Card wrappers
  - Reference examples: `src/app/dashboard/mycca/` and `src/app/dashboard/holiday-subsidy/`
  - Avoid: Wrapping page titles in Card or other containers

**Empty/Error States:**
- `<EmptyState>` from `@/components/layout/empty-state` for empty data lists
- `<ErrorCard>` from `@/components/layout/error-card` for error displays

**Data Tables:**
- `<DataTable>` from `@/components/table/data-table` for all tabular data
- `<OrderingTable>` from `@/components/table/ordering-table` for drag-and-drop ranking
- Props: `data`, `columns`, `searchColumn`, `pageSize`, `emptyMessage`, `className`
- Column definitions use TanStack React Table (`ColumnDef`)

**Component Directory Structure:**
```
src/components/
├── ui/                    # shadcn/ui primitives
├── layout/                # Page layout: PageHeader, AppLayout, EmptyState
├── table/                 # DataTable, OrderingTable, related utilities
├── auth/                  # Auth-specific components: LoginForm
├── cca/                   # CCA domain components
├── ranking/               # Ranking feature components
├── holiday-subsidy/       # Holiday subsidy feature components
├── facilities/            # Facilities booking components
├── allocation/            # CCA allocation components
├── badges/                # Badge variants
├── shared/                # Shared utility components
└── feature-flags/         # Feature flag UI gates
```

## React Patterns

**Hooks:**
- Standard React hooks: `useState`, `useEffect`, `useRef`, `useContext`
- Custom hooks in `src/hooks/`
- Always use `"use client"` directive in hook files

**useEffect Cleanup:**
- Remove event listeners and cancel async operations on unmount
  ```typescript
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { /* ... */ };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);
  ```

**State Management:**
- No global state library (Redux, Zustand, Jotai)
- Use Context API for auth state (`src/lib/auth/auth-context.tsx`)
- Component-level state suffices for most cases
- Fetch data in `useEffect`, cache results in `localStorage` where appropriate (5-min TTL via `useRoleAuth()`)

**Async Operations:**
- Fetch in `useEffect`, store result in state
- Cache role checks in `localStorage` (5-minute TTL) via `useRoleAuth()` hook
- No automatic refetch on window focus (user must manually retry)

## Copy/Documentation Conventions

**User-Facing Naming:**
- CCA allocation: Use "preference" (not "ranking") in UI copy
- Ranking concepts are stored under "ranking" identifiers but displayed as "preference"
- Example: route `/api/ranking/preference` but UI button says "Save Preferences"

**Code Comments:**
- JSDoc/TSDoc style for public functions
- Explain the "why" not the "what" — the code shows what it does
- Example from codebase:
  ```typescript
  /** First and last date keys of a month, for range-filtered API queries. */
  export function getMonthRange(year: number, month: number): { start: string; end: string }
  ```

**Type Documentation:**
- Document domain concepts and enum meanings in type files
- Example from `src/types/user.ts`:
  ```typescript
  /**
   * `enum.cca_kind` — the activity family a CCA belongs to.
   * Named `kind`, not `type`, and the distinction matters.
   */
  export type CcaKind = "sports" | "committee" | "culture" | "jcrc" | "adhoc" | "supplementary";
  ```

## Access Control Patterns

**Result Type:**
- `AccessResult<T>` from `@/lib/cca/cca-chair-access.ts`
  ```typescript
  type AccessResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string };
  ```
- Used to encapsulate auth check and error info in one return value
- Consumed by API routes to guard access before processing

**Auth Decorators:**
- `requireAuth()` — throws `ApiError(401)` if unauthenticated
- `requireChairAccess(ccaId)` — throws `ApiError(403)` if not a chair of that CCA
- `requireJcrcAccess()` — throws `ApiError(403)` if not a JCRC member
- All from `@/lib/api/auth.ts`

---

*Convention analysis: 2026-09-03*
