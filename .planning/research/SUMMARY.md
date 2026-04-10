# Project Research Summary

**Project:** Intranet Next App -- Auth Fix & Codebase Refactor
**Domain:** Next.js 15 App Router intranet application with Supabase auth
**Researched:** 2026-04-10
**Confidence:** HIGH

## Executive Summary

This is a Next.js 15 App Router intranet application backed by Supabase for auth and data, deployed via SST/OpenNext to AWS. The codebase has a **critical security bug**: the Supabase SSR middleware intentionally disables `setAll()`, which means refreshed JWT tokens are never written back to the browser. This causes session bleed in SSR contexts where one user can see another user's data. Fixing this bug -- by upgrading `@supabase/ssr` from v0.7.0 to v0.10.2 and re-enabling the standard cookie-forwarding pattern -- is the single highest-priority item and a prerequisite for all other work. The auth fix also resolves a refresh-token race condition and enables proper CDN cache-busting headers.

Beyond the auth bug, the codebase suffers from structural debt: monolithic 1000+ line page components, three overlapping auth mechanisms (middleware, AuthContext, withAuth HOC), zero test coverage, 35 `any`-type suppressions, duplicate toast libraries, self-calling API routes, non-atomic database operations, and unprotected API endpoints. The recommended approach is a phased refactor that fixes auth first, establishes shared infrastructure patterns (feature flags, shared types, auth utilities), then decomposes features one at a time into a feature-module architecture. The research strongly recommends against converting pages to Server Components during the refactor -- the goal is to extract smaller, well-typed Client Components and custom hooks, not to change the rendering model.

The key risks are: (1) session bleed persisting until the auth fix is deployed, (2) data loss from the non-atomic delete-then-insert ranking pattern, (3) regressions during refactoring due to zero test coverage, and (4) CDN caching of authenticated responses via CloudFront. Mitigations are detailed in each phase below. The research confidence is HIGH overall -- findings are grounded in official Supabase and Next.js documentation, verified package changelogs, and direct codebase analysis.

## Key Findings

### Recommended Stack

Stay on Next.js 15.5.6, React 18, TypeScript 5.7.2, and Tailwind CSS 4. Do not upgrade to Next.js 16 (breaking changes: middleware renamed to proxy, React 19 required, Turbopack default). The only package upgrades needed are `@supabase/ssr` (0.7.0 to 0.10.2) and `@supabase/supabase-js` (2.84.0 to 2.102.1). Remove four dead dependencies: `react-hot-toast`, `aphrodite`, `fs` (browser shim), and `logger`.

**Core technologies:**
- **Next.js 15.5.6**: Full-stack framework -- stay on 15.x to avoid 16.x breaking changes during refactor
- **@supabase/ssr ^0.10.2**: SSR cookie-based auth -- v0.10.0 adds cache headers to `setAll()` for CDN protection
- **@supabase/supabase-js ^2.102.1**: Supabase client -- latest stable, no breaking changes from 2.84
- **sonner**: Toast notifications -- standardize on this, remove duplicate react-hot-toast
- **Zod** (new addition): Request validation -- replace manual inline `if` checks in API routes

### Expected Features

**Must have (table stakes):**
- Fix session bleed via proper middleware `setAll()` cookie forwarding
- Decompose giant components (1111-line ManageMembers, 1097-line PointsRecapCard)
- Extract custom hooks for data fetching (replace repeated useEffect/useState/fetch pattern)
- Eliminate `any` types (35 eslint-disable suppressions; types already exist in `src/types/`)
- Fix non-atomic ranking operations (delete-then-insert loses data on failure)
- Close API route auth gaps (several endpoints lack authentication; middleware only covers `/dashboard/*`)
- Standardize on sonner for toasts, remove react-hot-toast
- Enable ESLint during builds (currently `ignoreDuringBuilds: true`)
- Standardize API response envelope (`ApiResponse<T>`)
- Add Zod request validation to API routes

**Should have (differentiators):**
- Feature-scoped directory structure (`src/features/*/`)
- Shared `withAuth()` API route middleware wrapper
- `React.cache()` wrapper for `fetchUserInfo()` to deduplicate per-request
- Suspense + `loading.tsx` patterns replacing manual loading states
- Error boundaries (`error.tsx` per route segment)
- Environment-variable feature flags (replace hardcoded constants)

**Defer (v2+):**
- Server Component boundary optimization (only after decomposition is complete)
- Structured logging (pino) -- valuable but not blocking
- Short-TTL cache headers for read-heavy endpoints
- Full Prettier normalization pass

### Architecture Approach

The target architecture is a feature-module monolith: thin page files in `src/app/` that compose feature components from `src/features/*/`. Each feature module owns its components, hooks, queries, server actions, and types. Features communicate through shared types in `src/types/` and barrel exports, never by importing each other's internals. The auth flow consolidates into middleware (session refresh + route protection) and AuthContext (client-side user state), eliminating the withAuth HOC entirely. Mutations move from client-side `fetch()` to API routes toward server actions with `revalidatePath()`. Reads stay as client-side fetches initially, with Server Component migration as an optional Phase 3+ optimization.

**Major components:**
1. **Middleware** -- auth token refresh, cookie forwarding to request + response, route protection for `/dashboard/*` and `/api/*`
2. **Feature modules** (`src/features/auth/`, `cca/`, `ranking/`, `allocation/`, `holiday-subsidy/`) -- domain logic, components, queries, actions, types per feature
3. **Shared infrastructure** -- `fetchUserInfo()` with `React.cache()`, `AccessResult<T>` discriminated union, `isCoreServiceEnabled()` env-var flags, `ApiResponse<T>` envelope
4. **Supabase client factories** -- per-request client creation in `src/utils/supabase/` (server, client, middleware variants)

### Critical Pitfalls

1. **SSR session bleed from disabled `setAll()`** -- Re-enable cookie writes in middleware and server client; upgrade `@supabase/ssr` to v0.10.2 for cache headers. This is the root cause of users seeing other users' data.
2. **Non-atomic delete-then-insert in rankings** -- Replace with Supabase RPC stored procedure or `.upsert()` with `onConflict`. Current pattern permanently loses data if insert fails after delete succeeds.
3. **Refresh token race condition** -- Fixed by resolving pitfall 1. When middleware properly writes refreshed tokens, downstream components read fresh tokens instead of triggering redundant refreshes.
4. **CDN caching authenticated responses** -- Upgrade to `@supabase/ssr` v0.10+ for automatic cache headers; add `export const dynamic = 'force-dynamic'` to auth pages; set CloudFront Minimum TTL to 0 for authenticated routes.
5. **Zero test coverage enabling silent regressions** -- Install Vitest + Testing Library before refactoring. Write characterization tests for auth flows, ranking save, and authorization checks before modifying them.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Auth Fix and Security Hardening

**Rationale:** The session bleed bug is a security vulnerability that must be fixed before any feature work. Every other phase depends on correct auth behavior. The `@supabase/ssr` upgrade is a prerequisite for proper cookie handling.

**Delivers:**
- Working session refresh via middleware `setAll()` with cache headers
- Fixed server client cookie writing (try/catch pattern)
- Expanded middleware matcher to include `/api/*`
- Auth checks on all unprotected API routes
- Verification of asymmetric JWT signing keys for performant `getClaims()`
- Test infrastructure (Vitest) with auth smoke tests

**Addresses features:** Session bleed fix, API route auth gaps, ESLint build enforcement (initial)

**Avoids pitfalls:** P1 (session bleed), P3 (refresh token race), P4 (CDN caching), P5 (unprotected API routes), P8 (SSR upgrade breakage), P9 (no tests)

### Phase 2: Shared Infrastructure and Cleanup

**Rationale:** Before decomposing features, establish the common patterns all features will use. This prevents each feature refactor from reinventing shared concerns. Quick wins (toast migration, dead dependency removal) reduce noise in subsequent PRs.

**Delivers:**
- Standardized toast library (sonner only, react-hot-toast removed)
- Dead dependency removal (aphrodite, fs, logger)
- `ApiResponse<T>` envelope type
- `AccessResult<T>` moved to `src/types/common.ts` (deduplicated)
- `fetchUserInfo()` wrapped with `React.cache()`
- `withAuth()` API route wrapper in `src/lib/api/`
- Feature flags moved to environment variables
- `src/features/` directory scaffolded
- withAuth HOC deprecated (middleware handles route protection)
- Self-calling API route fix (extract shared logic to `src/lib/`)

**Addresses features:** Toast standardization, unused dependency removal, standardized API response, self-calling API route fix, shared API middleware, feature flag migration

**Avoids pitfalls:** P6 (auth fragmentation -- clear target architecture established)

### Phase 3: CCA Management Feature Module

**Rationale:** CCA management is the most complex feature area (1111-line ManageMembers page) and the foundation that ranking and allocation depend on. Refactoring it first establishes the decomposition pattern for all other features.

**Delivers:**
- `src/features/cca/` module with queries, actions, components, types
- ManageMembers decomposed into 4 custom hooks + 4-5 child components
- `any` types replaced with existing types from `src/types/dashboard.ts`
- Zod validation schemas for CCA API routes
- Characterization tests for CCA management flows

**Addresses features:** Giant component decomposition (CCA), custom hooks, eliminate `any` types (CCA portion), Zod validation (CCA routes)

**Avoids pitfalls:** P7 (server/client boundaries -- extract as Client Components, do not convert to SC), P9 (add tests before refactoring)

### Phase 4: Ranking Feature Module

**Rationale:** Ranking depends on CCA types (it lives inside CCA admin routes). This phase also addresses the critical non-atomic save operation.

**Delivers:**
- `src/features/ranking/` module
- PointsRecapCard (1097 lines) decomposed into manageable components
- Atomic ranking save via Supabase RPC stored procedure
- Ranking-specific Zod schemas and types

**Addresses features:** Giant component decomposition (ranking), non-atomic ranking operations, Zod validation (ranking routes)

**Avoids pitfalls:** P2 (non-atomic delete-then-insert -- replaced with RPC transaction)

### Phase 5: Allocation and Holiday Subsidy Feature Modules

**Rationale:** These are the most independent features. Allocation uses CCA + ranking types but has its own pages. Holiday subsidy is entirely standalone. They can be refactored in parallel or sequentially.

**Delivers:**
- `src/features/allocation/` module
- `src/features/holiday-subsidy/` module
- JCRC authorization checks uncommented and tested
- Subsidy-specific validation and types

**Addresses features:** Remaining giant component decomposition, JCRC auth fix, allocation and subsidy page refactoring

**Avoids pitfalls:** P5 (JCRC auth re-enabled), P9 (tests for each feature)

### Phase 6: Hardening and Polish

**Rationale:** With all features refactored, this phase applies cross-cutting quality improvements that would have been noisy during active refactoring.

**Delivers:**
- ESLint enforcement enabled in builds (remove `ignoreDuringBuilds`)
- Remaining `any` type audit and cleanup
- Error boundaries (`error.tsx` per route segment)
- Loading state improvements (Suspense where beneficial)
- Optional: Server Component migration for read-heavy pages (dashboard home, CCA listing)
- CloudFront cache configuration verification

**Addresses features:** ESLint enforcement, error boundaries, loading states, optional SC optimization

**Avoids pitfalls:** P4 (final CDN cache audit), P7 (SC migration only where clearly beneficial)

### Phase Ordering Rationale

- Auth before everything because session bleed is a security vulnerability and correct token handling is a prerequisite for server-side data fetching and authorization.
- Infrastructure before features because shared patterns (withAuth wrapper, ApiResponse type, React.cache on fetchUserInfo) prevent each feature from reinventing the wheel.
- CCA before ranking because ranking lives inside the CCA admin section and depends on CCA types.
- Allocation and subsidy after ranking because allocation uses ranking types, and subsidy is independent but lower priority.
- Hardening last because enabling ESLint enforcement mid-refactor would create PR noise, and SC migration requires decomposed components.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 1 (Auth Fix):** Needs verification of Supabase project JWT signing key type (symmetric vs asymmetric). Also needs CloudFront cache behavior configuration review specific to the deployment.
- **Phase 4 (Ranking):** Needs Supabase migration planning for the RPC stored procedure. Review current database schema constraints.

Phases with standard patterns (skip research-phase):
- **Phase 2 (Infrastructure):** Well-documented patterns -- toast migration, dependency removal, env-var feature flags are all straightforward.
- **Phase 3 (CCA Module):** Component decomposition is mechanical extraction work guided by the detailed patterns in FEATURES.md.
- **Phase 6 (Hardening):** ESLint, error boundaries, and loading.tsx are standard Next.js App Router conventions.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Versions verified via npm registry and GitHub changelogs. Breaking changes between @supabase/ssr 0.7.0-0.10.2 reviewed commit-by-commit. |
| Features | HIGH | Features derived from direct codebase analysis (file sizes, pattern counts, dependency audit). Patterns validated against official Next.js and Supabase docs. |
| Architecture | HIGH | Feature-module structure follows established Next.js community patterns. Auth flow based on official Supabase SSR documentation. |
| Pitfalls | HIGH | Session bleed root cause confirmed by code inspection. Non-atomic operations confirmed by API route source analysis. All pitfalls cross-referenced with official docs and known CVEs. |

**Overall confidence:** HIGH

### Gaps to Address

- **Asymmetric JWT keys:** Unknown whether the Supabase project uses asymmetric or symmetric JWT signing keys. If symmetric, `getClaims()` makes a network call instead of local verification. Check Supabase Dashboard before Phase 1.
- **CloudFront configuration:** The exact CloudFront cache behavior settings for this deployment are unknown. Minimum TTL must be verified and set to 0 for authenticated routes. Review during Phase 1 deployment.
- **Database schema constraints:** Unknown whether unique constraints exist on `(user_id, position_id)` for the rankings tables. This determines whether `.upsert()` with `onConflict` is viable versus requiring an RPC function. Check before Phase 4.
- **JCRC authorization logic:** The commented-out `authorizeJCRC` function needs review to understand why it was disabled. May have been intentional (bug in the check) or accidental. Investigate during Phase 5.
- **Credentials in git history:** `scripts/index.ts` contains commented-out Supabase service role key and Firebase admin key. These should be rotated and purged from git history, but this is an operational task outside the refactoring scope.

## Sources

### Primary (HIGH confidence)
- [Supabase SSR Docs: Creating a Client](https://supabase.com/docs/guides/auth/server-side/creating-a-client) -- official cookie pattern with `getAll`/`setAll`
- [Supabase SSR Docs: Next.js Setup](https://supabase.com/docs/guides/auth/server-side/nextjs) -- official Next.js middleware and client patterns
- [Supabase SSR Docs: Advanced Guide](https://supabase.com/docs/guides/auth/server-side/advanced-guide) -- getClaims vs getUser, CDN caching
- [GitHub: @supabase/ssr CHANGELOG.md](https://github.com/supabase/ssr/blob/main/CHANGELOG.md) -- version history 0.7.0 to 0.10.2
- [Next.js Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components) -- component boundary decisions
- [Next.js Authentication Guide](https://nextjs.org/docs/app/guides/authentication) -- defense-in-depth, middleware vs data access layer
- [Next.js Caching Guide](https://nextjs.org/docs/app/getting-started/caching) -- caching behavior in Next.js 15
- [CVE-2025-29927 Postmortem](https://vercel.com/blog/postmortem-on-next-js-middleware-bypass) -- middleware bypass vulnerability

### Secondary (MEDIUM confidence)
- [Next.js App Router Patterns 2026](https://dev.to/teguh_coding/nextjs-app-router-the-patterns-that-actually-matter-in-2026-146) -- community patterns
- [Feature-Driven Architecture with Next.js](https://dev.to/rufatalv/feature-driven-architecture-with-nextjs-a-better-way-to-structure-your-application-1lph) -- feature module pattern
- [MakerKit: Server Actions vs Route Handlers](https://makerkit.dev/blog/tutorials/server-actions-vs-route-handlers) -- when to use each pattern
- [GitHub Issue #39947](https://github.com/supabase/supabase/issues/39947) -- getClaims vs getUser recommendation
- [GitHub Issue #40985](https://github.com/supabase/supabase/issues/40985) -- getClaims docs clarification (still open)
- [Supabase PostgREST Transactions (GitHub #526)](https://github.com/orgs/supabase/discussions/526) -- RPC alternative for transactions

### Tertiary (LOW confidence)
- [GitHub Discussion #27037: @supabase/ssr v1.0 roadmap](https://github.com/orgs/supabase/discussions/27037) -- API stability, no release date confirmed

---
*Research completed: 2026-04-10*
*Ready for roadmap: yes*
