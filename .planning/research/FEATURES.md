# Feature Landscape

**Domain:** Next.js App Router Intranet Application Refactoring
**Researched:** 2026-04-10

## Table Stakes

Features/patterns that must be implemented. Skipping these leaves the codebase in its current fragile, hard-to-maintain state.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Giant component decomposition | 1111-line ManageMembers and 1097-line PointsRecapCard are unmaintainable; cannot safely modify, test, or review | **High** | Each page needs extraction of 3-5 custom hooks + 4-8 child components |
| Custom hooks for data fetching | Every page repeats the same `useEffect` + `useState` + `fetch` + error handling pattern; violates DRY, no reusability | **Medium** | Create per-feature hooks: `useMembers`, `usePositions`, `useSearchUsers`, etc. |
| Toast library standardization (sonner) | Two toast libraries (react-hot-toast + sonner) create inconsistent UX and ~15KB bundle waste; sonner Toaster already in root layout | **Low** | 7 files use react-hot-toast; replace imports and remove package |
| Eliminate `any` types | 35 eslint-disable directives suppress `@typescript-eslint/no-explicit-any`; TypeScript strict mode is on but bypassed everywhere; compiler cannot catch regressions | **Medium** | Types already exist in `src/types/dashboard.ts` and `src/types/User.ts`; mostly about using them instead of `any` |
| Self-calling API route fix | `getCCAs` calls `getManagedCCAs` via HTTP fetch within the same server; adds latency, fragile cookie forwarding, unnecessary round-trip | **Low** | Extract shared logic from getManagedCCAs into `src/lib/`, call directly |
| Non-atomic ranking operations | Delete-then-insert in `saveRankings` and chair position ranking can lose all user data on transient failure | **Medium** | Replace with Supabase `upsert` on unique constraint or wrap in RPC transaction |
| API route auth gaps | Several holiday subsidy endpoints lack authentication; middleware only covers `/dashboard/*`, not `/api/*`; JCRC auth commented out | **Medium** | Add auth checks to every API route handler; uncomment JCRC authorization |
| Unused dependency removal | `aphrodite`, `fs` (security shim), `logger` are dead dependencies adding noise to audits and install size | **Low** | Remove from package.json |
| ESLint build enforcement | `ignoreDuringBuilds: true` means lint errors never block deployment; quality regressions are invisible | **Low** | Remove flag, fix surfaced lint errors |
| Standardized API response envelope | Routes return inconsistent shapes: `{ data }`, `{ success, data, message }`, `{ error }`; clients must guess the format | **Low** | Define a single `ApiResponse<T>` type and use everywhere |
| Zod request validation | All API input validation is manual inline `if` checks; inconsistent, easy to miss edge cases, no type narrowing | **Medium** | Add Zod schemas for each API route's request body; use `z.infer` for type safety |

## Differentiators

Advanced patterns that significantly improve maintainability, developer experience, and long-term health. Not strictly required but provide outsized returns.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Server Component / Client Component boundary optimization | Current pages are all `"use client"` at the top; entire component trees are client-rendered; moving data fetching to Server Components eliminates client-side loading states and reduces JS bundle | **High** | Requires architectural rethink per page; biggest win for the allocation and subsidy pages where data is read-heavy |
| Feature-scoped directory structure | Current flat organization (`src/hooks/`, `src/lib/`, `src/types/`) does not scale; feature-scoped folders (`src/features/cca-management/hooks/`, `src/features/cca-management/components/`) keep related code together | **Medium** | Apply during decomposition of giant components; do not reorganize everything at once |
| Shared API route middleware (withAuth wrapper) | Auth check is copy-pasted in every route handler; a `withAuth()` higher-order function eliminates boilerplate and ensures consistency | **Low** | Pattern: `export const GET = withAuth(async (request, user) => { ... })` |
| Request-level `fetchUserInfo` caching | Several API routes call `fetchUserInfo()` which issues 2 Supabase queries per call; caching per-request with React `cache()` eliminates redundant DB round-trips | **Low** | Wrap `fetchUserInfo` with React `cache()` from `react`; works in server context |
| `AccessResult<T>` pattern expansion | The discriminated union pattern in `cca-chair-access.ts` is excellent; extend it to all authorization and validation results for consistent error handling | **Low** | Already partially adopted; just needs consistent use across all API routes |
| Loading state component patterns (Suspense + loading.tsx) | Instead of manual `useState(loading)` + conditional rendering, use Next.js `loading.tsx` files and `<Suspense>` boundaries for automatic streaming | **Medium** | Works best when Server Components handle data fetching; pair with SC migration |
| Proper error boundaries | No global error boundary exists; add `error.tsx` files per route segment to catch rendering errors gracefully | **Low** | Next.js App Router convention; just create the files with fallback UI |
| Structured logging | All logging is `console.*` with ad-hoc formatting; structured logging (JSON with context, log levels, request correlation) enables production debugging | **Medium** | Use a lightweight logger like `pino`; wrap `console.*` calls |
| Short-TTL cache headers for read-heavy endpoints | All responses set `Cache-Control: no-store`; CCA listings and rankings change infrequently and could use 30-60s `stale-while-revalidate` | **Low** | Set proper headers on GET routes for `/api/user/getCCAs`, `/api/cca/rankings` |
| Prettier configuration | No formatting config exists; mixed tabs/spaces/quotes across files; automated formatting prevents style drift | **Low** | Add `.prettierrc` with opinionated defaults; run once to normalize |

## Anti-Features

Refactoring approaches to deliberately NOT pursue. These seem helpful but add complexity, risk, or unnecessary abstraction for this codebase.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Introduce Redux / Zustand / Jotai for global state | This app has one piece of global state (auth user); adding a state management library is over-engineering for the actual problem | Keep `AuthContext` for user state. Use per-feature custom hooks for local state. If cross-page state becomes necessary later, consider Zustand then. |
| Add React Query / TanStack Query for data fetching | While excellent in general, introducing RQ to an existing codebase that is moving toward Server Components is a lateral move; the App Router pattern is to fetch on the server, not cache on the client | For Client Components that remain, use well-structured custom hooks with `useEffect`/`fetch`. For read-heavy pages, migrate to Server Components where data is fetched directly. |
| Convert all pages to Server Components at once | The "pure" App Router pattern avoids `"use client"` pages, but this app is heavily interactive (drag-and-drop ranking, member management, real-time search); forcing everything server-side creates artificial complexity | Identify which pages are truly read-heavy (dashboard home, CCA listing) and convert those. Leave interactive pages as Client Components but decompose them properly. |
| Feature-flag migration to remote config | Feature flags are hardcoded constants that require redeployment; a remote config service (Supabase table, LaunchDarkly) sounds better but adds operational complexity for 3 boolean flags | Move flags to environment variables (zero operational overhead, deployable per-environment). Remote config is overkill unless the flag count grows past ~10. |
| Barrel files (index.ts re-exports) | Barrel files seem like good organization but create circular dependency risks, make tree-shaking harder, and slow TypeScript compilation in larger projects | Continue importing directly from file paths: `@/lib/cca-chair-access` not `@/lib` |
| Full monorepo extraction | Separating shared packages is premature for a single app with no other consumers | Keep everything in `src/`. Extract to packages only if a second app needs the code. |
| Over-abstracting API route handlers | Creating a generic "API framework" with middleware chains, decorators, or route factories adds indirection; this is a ~27-route app, not a microservice | Use a simple `withAuth()` wrapper at most. Keep route handlers explicit and readable. |
| Migrating to Server Actions for mutations | Server Actions are the "new" way but require `"use server"` functions, form-based patterns, and `useActionState`; retrofitting existing `fetch()` calls adds risk for no functional gain | Keep `fetch()` to API routes for mutations. Server Actions are best for greenfield forms, not retrofitting an existing API layer. |

## Feature Dependencies

```
ESLint build enforcement
  --> Eliminate `any` types (fixing lint errors surfaces type issues)
  --> Unused dependency removal (clean build first)

Toast library standardization
  --> Giant component decomposition (replace imports during decomposition)

Self-calling API route fix
  --> Custom hooks for data fetching (hooks can call extracted lib directly)

Giant component decomposition
  --> Custom hooks for data fetching (hooks are the extraction target)
  --> Zod request validation (validate at the API boundary during refactor)

API route auth gaps
  --> Shared API route middleware / withAuth (fix auth, then extract pattern)
  --> Non-atomic ranking operations (secure first, then make atomic)

Server Component boundary optimization
  --> Giant component decomposition (must decompose before SC migration)
  --> Loading state component patterns (Suspense works with SC)
```

## MVP Recommendation

### Phase 1: Foundation (do first, unblocks everything)

1. **Toast library standardization** -- Low effort, immediate consistency win, unblocks clean refactoring
2. **Unused dependency removal** -- 5-minute task, cleaner install
3. **ESLint build enforcement** -- Remove `ignoreDuringBuilds`, fix surfaced errors
4. **Self-calling API route fix** -- Extract shared logic to `src/lib/`, low risk
5. **Standardized API response envelope** -- Define `ApiResponse<T>`, adopt incrementally

### Phase 2: Core Refactoring (the main work)

1. **Giant component decomposition** -- Attack in feature order: CCA management > ranking > allocation > subsidies
2. **Custom hooks for data fetching** -- Extract during decomposition, not separately
3. **Eliminate `any` types** -- Replace during decomposition; types already exist in `src/types/`
4. **Zod request validation** -- Add schemas to API routes as they are touched during feature refactoring
5. **API route auth gaps** -- Fix auth as each feature area is refactored

### Phase 3: Hardening (after core refactoring)

1. **Non-atomic ranking operations** -- Requires careful testing; fix after auth and decomposition are stable
2. **Shared API route middleware (withAuth)** -- Extract the repeated pattern after all routes have auth
3. **Server Component boundary optimization** -- Evaluate which decomposed pages benefit from SC migration

### Defer

- **Feature-scoped directory structure**: Apply opportunistically during decomposition, not as a separate reorganization pass
- **Structured logging**: Valuable but not blocking; add when operational debugging becomes a pain point
- **Prettier configuration**: Add early (Phase 1) but do not count it as refactoring work; it is a one-time normalization

## Detailed Refactoring Patterns

### Pattern: Giant Component Decomposition

The 1111-line ManageMembersPage contains these distinct concerns that should become separate units:

**Extract to custom hooks:**
- `useMembers(ccaId)` -- fetches members, manages grouped member state, handles refresh
- `useUserSearch(ccaId)` -- search query, results, searching state
- `usePendingChanges()` -- tracks adds/removes/status changes, computes diff from original
- `useMemberSave(ccaId)` -- handles save logic, batching, error collection

**Extract to child components:**
- `<MemberTable>` -- renders grouped member table with action menus
- `<AddMemberDialog>` -- modal for searching and adding members
- `<PendingChangesBar>` -- floating bar showing unsaved changes count and save button
- `<MemberActionMenu>` -- dropdown with status change, commitment period, remove actions

**Keep in page component:**
- Route parameter extraction, layout wrapping, top-level error/loading states, composition of child components

### Pattern: Custom Hook Structure

```typescript
// src/hooks/cca/useMembers.ts
export function useMembers(ccaId: string | null) {
  const [groupedMembers, setGroupedMembers] = useState<GroupedMembers>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => { /* fetch logic */ }, [ccaId]);

  useEffect(() => { refresh(); }, [refresh]);

  return { groupedMembers, loading, error, refresh };
}
```

Each hook: one concern, typed return value, no `any`, error state included.

### Pattern: Toast Migration (react-hot-toast to sonner)

For each of the 7 files using react-hot-toast:
1. Replace `import toast from 'react-hot-toast'` with `import { toast } from 'sonner'`
2. `toast.success(msg)` -- identical API, no change needed
3. `toast.error(msg)` -- identical API, no change needed
4. `toast(msg)` -- identical API, no change needed
5. `toast.loading(msg)` -- sonner supports this via `toast.loading(msg)`, identical
6. Remove `react-hot-toast` from package.json after all files migrated

### Pattern: Eliminating `any` Types

The 35 eslint-disable directives fall into these categories:

**Category 1: State variables typed as `any` (most common)**
- `const [cca, setCCA] = useState<any>(null)` -- Replace with existing `CCAData` or define proper interface from API response shape
- `const [permissions, setPermissions] = useState<any>({...})` -- Define `CcaPermissions` interface

**Category 2: Map/callback parameters typed as `any`**
- `.map((item: any) => ...)` -- Type the array being mapped; the callback parameter inherits the type
- Use Supabase generated types or define response interfaces

**Category 3: API response data untyped**
- `const data = await response.json()` returns `any` -- Define `ApiResponse<T>` and assert/validate
- Pair with Zod: `const data = MembersResponseSchema.parse(await response.json())`

**Category 4: Catch clause variables**
- `catch (error: any)` -- Use `catch (error: unknown)` and narrow with `error instanceof Error`

### Pattern: API Route Auth Wrapper

```typescript
// src/lib/api/with-auth.ts
import { NextResponse } from 'next/server';
import { fetchUserInfo } from '@/lib/fetch-user-info';
import type { AuthenticatedUser } from '@/types/User';

type AuthenticatedHandler = (
  request: Request,
  context: { user: AuthenticatedUser; params?: Record<string, string> }
) => Promise<NextResponse>;

export function withAuth(handler: AuthenticatedHandler) {
  return async (request: Request, routeContext?: { params: Promise<Record<string, string>> }) => {
    const user = await fetchUserInfo();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const params = routeContext?.params ? await routeContext.params : undefined;
    return handler(request, { user, params });
  };
}
```

### Pattern: Zod API Validation

```typescript
// src/lib/schemas/cca.ts
import { z } from 'zod';

export const addMemberSchema = z.object({
  userId: z.number().int().positive(),
  positionId: z.number().int().positive(),
  commitmentPeriod: z.enum(['semester-1', 'semester-2', 'full-year']),
});

export type AddMemberInput = z.infer<typeof addMemberSchema>;

// In API route:
const body = addMemberSchema.safeParse(await request.json());
if (!body.success) {
  return NextResponse.json({ error: body.error.flatten() }, { status: 400 });
}
// body.data is fully typed as AddMemberInput
```

## Sources

- [Next.js Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components) -- Official docs on component boundary decisions (HIGH confidence)
- [Next.js App Router Patterns 2026](https://dev.to/teguh_coding/nextjs-app-router-the-patterns-that-actually-matter-in-2026-146) -- Community patterns for 2026 (MEDIUM confidence)
- [Reusable Architecture for Large Next.js Apps](https://www.freecodecamp.org/news/reusable-architecture-for-large-nextjs-applications) -- Component decomposition and feature folders (MEDIUM confidence)
- [Next.js Building APIs](https://nextjs.org/blog/building-apis-with-nextjs) -- Official API route organization guidance (HIGH confidence)
- [Next.js App Router Project Structure (MakerKit)](https://makerkit.dev/blog/tutorials/nextjs-app-router-project-structure) -- Business logic extraction from Server Actions to services (MEDIUM confidence)
- [Sonner - shadcn/ui](https://ui.shadcn.com/docs/components/radix/sonner) -- Official shadcn integration for sonner (HIGH confidence)
- [Zod Validation Guide for Next.js](https://dev.to/whoffagents/zod-the-complete-validation-guide-for-nextjs-and-typescript-524k) -- Zod + Next.js patterns (MEDIUM confidence)
- [TypeScript 6.0 Strict by Default](https://medium.com/@sergiosantosluiz/strict-by-default-why-typescript-6-0-removed-sloppy-mode-and-how-it-affects-your-legacy-2eb675ca264c) -- Future TypeScript direction reinforcing strict mode (MEDIUM confidence)
- [React Toast Libraries Compared 2025](https://blog.logrocket.com/react-toast-libraries-compared-2025/) -- Sonner vs react-hot-toast comparison (MEDIUM confidence)
- [Next.js + Supabase Production Lessons](https://catjam.fi/articles/next-supabase-what-do-differently) -- Real-world Zod + Supabase patterns (MEDIUM confidence)

---

*Feature landscape analysis: 2026-04-10*
