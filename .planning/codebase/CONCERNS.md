# Codebase Concerns

**Analysis Date:** 2026-04-10

## Tech Debt

**Excessive `any` usage across API routes and pages:**
- Issue: 35 `eslint-disable-next-line` directives across 13 files, mostly suppressing `@typescript-eslint/no-explicit-any`. State variables, map callbacks, and API response handlers use `any` instead of proper types.
- Files: `src/app/dashboard/mycca/admin/manageMembers/[ccaName]/page.tsx` (16 suppressions), `src/app/api/holidaySubsidy/weekly/[ccaId]/[weekId]/route.ts`, `src/app/api/sportsCulture/available/route.ts`, `src/app/api/cca/[ccaId]/members/route.ts`, `src/app/api/cca/[ccaId]/updateMember/route.ts`
- Impact: Type errors silently pass through at compile time. Refactoring becomes risky because the compiler cannot catch regressions.
- Fix approach: Define proper response types for Supabase query results. Replace `any` state with typed interfaces from `src/types/dashboard.ts` and `src/types/User.ts`.

**Dual toast library usage:**
- Issue: Both `react-hot-toast` and `sonner` are installed and used in different parts of the app. This creates inconsistent notification UI and increases bundle size.
- Files using `react-hot-toast`: `src/app/dashboard/mycca/admin/manageMembers/[ccaName]/page.tsx`, `src/app/dashboard/mycca/admin/rankMembers/[ccaName]/page.tsx`, `src/app/dashboard/mycca/admin/page.tsx`, `src/app/dashboard/mycca/page.tsx`, `src/app/dashboard/ccaAllocation/rankApplicants/page.tsx`, `src/app/dashboard/ccaAllocation/rank/page.tsx`, `src/hoc/withAuth.tsx`
- Files using `sonner`: `src/app/dashboard/holidaySubsidy/page.tsx`, `src/context/AuthContext.tsx`, `src/app/dashboard/holidaySubsidy/weekly/[ccaName]/page.tsx`, `src/app/dashboard/holidaySubsidy/approvals/weekly/[ccaName]/page.tsx`, `src/components/auth/login-form.tsx`, `src/app/layout.tsx`
- Impact: Users see two different notification styles. Extra ~15KB in the bundle.
- Fix approach: Standardize on `sonner` (the newer integration with a provider in `src/app/layout.tsx`). Replace all `react-hot-toast` imports and remove the package.

**Unused dependencies in `package.json`:**
- Issue: `aphrodite` (CSS-in-JS library) is listed as a dependency but not imported anywhere in `src/`. The `fs` package (`^0.0.1-security`) is a no-op shim that should not be a production dependency. The `logger` package (`^0.0.1`) appears unused.
- Files: `package.json` lines 30, 32, 33
- Impact: Increased install size. The `fs` shim is a known npm placeholder package and should never be depended on.
- Fix approach: Remove `aphrodite`, `fs`, and `logger` from `dependencies`.

**ESLint configured to ignore errors during builds:**
- Issue: `next.config.mjs` sets `eslint: { ignoreDuringBuilds: true }`. This means lint errors never block deployment.
- Files: `next.config.mjs` line 6
- Impact: Broken lint rules, type issues, and code quality violations are invisible in CI/CD.
- Fix approach: Remove `ignoreDuringBuilds: true` and fix all lint errors that surface.

**Feature flags are hardcoded constants, not runtime-configurable:**
- Issue: All three service flags (`memberRanking`, `ccaApplications`, `holidaySubsidy`) are set to `false` as compile-time constants. Changing them requires a code change and redeployment.
- Files: `src/lib/feature-flags.ts` lines 1-5
- Impact: Cannot toggle features without a new deploy. The JCRC override for `memberRanking` via `isCoreServicePositionOverrideEnabled` is the only dynamic path.
- Fix approach: Move flags to environment variables or a remote config service (e.g., Supabase table).

**Hardcoded holiday week definitions:**
- Issue: `HOLIDAY_WEEKS` contains hardcoded dates (Dec 2025 - Jan 2026) that must be manually updated each holiday period.
- Files: `src/lib/holiday-subsidy-weeks.ts` lines 21-28
- Impact: The holiday subsidy system breaks silently when dates expire. Includes a "Week (Testing)" entry with id 6 that should not ship to production.
- Fix approach: Store week definitions in Supabase. At minimum, make the definitions configurable via environment variables or an admin UI.

**Giant page components with mixed concerns:**
- Issue: Several page files exceed 500 lines and mix data fetching, state management, business logic, and rendering in a single component.
- Files: `src/app/dashboard/mycca/admin/manageMembers/[ccaName]/page.tsx` (1111 lines), `src/components/dashboard/points-recap-card.tsx` (1097 lines), `src/app/dashboard/ccaAllocation/rankApplicants/page.tsx` (573 lines), `src/app/dashboard/mycca/admin/rankMembers/[ccaName]/page.tsx` (565 lines)
- Impact: Hard to test, review, and modify. Increases risk of regressions when changing any part of the component.
- Fix approach: Extract data-fetching into custom hooks, extract sub-sections into child components, and separate business logic into utility functions.

**Self-calling API route:**
- Issue: `src/app/api/user/getCCAs/route.ts` makes an internal `fetch()` call to `/api/user/getManagedCCAs` instead of calling the logic directly. This creates an extra HTTP round-trip within the same server.
- Files: `src/app/api/user/getCCAs/route.ts` lines 61-78
- Impact: Unnecessary latency on every call. Fragile because it requires forwarding cookies manually and the base URL must resolve correctly in all deployment environments.
- Fix approach: Extract the shared logic from `getManagedCCAs` into a shared lib function and call it directly.

## Known Bugs

**Non-atomic delete-then-insert in saveRankings:**
- Symptoms: If the insert fails after the delete succeeds in `saveRankings`, the user loses all their rankings with no recovery.
- Files: `src/app/api/user/saveRankings/route.ts` lines 37-53
- Trigger: Any transient Supabase error during insert after successful delete.
- Workaround: None. User must re-submit all rankings.

**Non-atomic delete-then-insert in chair position ranking:**
- Symptoms: Same pattern as above. If insert fails after delete, all rankings for a position are lost.
- Files: `src/app/api/chair/positions/[position_id]/rank/route.ts` lines 56-79
- Trigger: Transient Supabase error during insert after delete.
- Workaround: None.

## Security Considerations

**Commented-out credentials committed to repository:**
- Risk: `scripts/index.ts` contains commented-out Supabase service role key and Firebase admin private key in plaintext. Even though commented out, these credentials are in git history and accessible to anyone with repository access.
- Files: `scripts/index.ts` lines 8-27
- Current mitigation: Code is commented out. However, the credentials are visible in the file and in git history.
- Recommendations: Rotate both the Supabase service role key and Firebase admin private key immediately. Use `git filter-branch` or BFG Repo Cleaner to remove from history. Add `scripts/` secrets scanning to CI.

**Authorization disabled on JCRC weekly approval endpoints:**
- Risk: Both GET and PATCH handlers in the weekly approval route have their JCRC authorization checks commented out with `// TODO: Re-enable authorization after testing`. Any authenticated user can view and modify subsidy approval statuses.
- Files: `src/app/api/holidaySubsidy/approvals/weekly/[ccaId]/[weekId]/route.ts` lines 52-56 (GET), lines 140-144 (PATCH); `src/app/dashboard/holidaySubsidy/approvals/weekly/[ccaName]/page.tsx` line 286
- Current mitigation: The `holidaySubsidy` feature flag is currently set to `false`, so these endpoints return 503. But if the flag is enabled, the endpoints are unprotected.
- Recommendations: Uncomment the `authorizeJCRC` calls immediately. Add integration tests that verify authorization is enforced.

**No authentication on several API GET endpoints:**
- Risk: Most API routes under `src/app/api/holidaySubsidy/weekly/` and `src/app/api/holidaySubsidy/approvals/` do not verify the requesting user's identity. They only check feature flags and validate parameters.
- Files: `src/app/api/holidaySubsidy/weekly/[ccaId]/[weekId]/route.ts` (GET and POST have no auth check), `src/app/api/holidaySubsidy/approvals/route.ts`
- Current mitigation: Middleware redirects unauthenticated users from `/dashboard/` pages, but API routes at `/api/` are not covered by the middleware matcher. The middleware only covers `/dashboard/:path*` and `/auth/:path*`.
- Recommendations: Add the `/api/:path*` pattern to the middleware matcher in `src/middleware.ts`, or add explicit auth checks to every API route handler.

**SQL injection risk via unparameterized `.or()` filters:**
- Risk: User search queries are interpolated directly into Supabase `.or()` filter strings without sanitization: `.or(\`name.ilike.%${query}%,...\`)`. A crafted `query` string could manipulate the PostgREST filter.
- Files: `src/app/api/user/search/route.ts` line 52, `src/app/api/cca/[ccaId]/searchUsers/route.ts` line 61
- Current mitigation: Supabase PostgREST partially mitigates this since it uses prepared statements under the hood, but special characters in the query string (commas, parentheses) could break filter parsing.
- Recommendations: Sanitize or escape the `query` parameter before interpolation. Use parameterized RPC calls or Supabase's `.ilike()` method on individual columns instead.

**No rate limiting on any API endpoint:**
- Risk: All 27 API routes are callable without rate limits. Search endpoints, ranking submission endpoints, and approval endpoints are all vulnerable to abuse.
- Files: All files under `src/app/api/`
- Current mitigation: None.
- Recommendations: Add rate limiting middleware (e.g., via Vercel edge functions, or a token-bucket implementation in Next.js middleware).

**No CSRF protection:**
- Risk: State-mutating API routes (POST, PATCH, DELETE) do not verify CSRF tokens. Since Supabase auth uses cookies, these endpoints are vulnerable to cross-site request forgery.
- Files: All POST/PATCH/DELETE handlers under `src/app/api/`
- Current mitigation: None detected. No `Content-Security-Policy` headers configured.
- Recommendations: Implement CSRF token verification for all state-mutating endpoints.

**Client-side role caching in localStorage:**
- Risk: `useRoleAuth` caches authorization results in `localStorage` for 5 minutes. A user whose role is revoked retains elevated access for up to 5 minutes client-side.
- Files: `src/hooks/useRoleAuth.ts` lines 17-18, 88-108
- Current mitigation: Server-side auth checks should catch unauthorized requests, but if authorization is disabled (as in the holiday subsidy routes), the cached client-side role could bypass UI-level access controls.
- Recommendations: Reduce cache duration or validate against server on sensitive operations.

## Performance Bottlenecks

**N+1 query patterns in weekly subsidy loading:**
- Problem: The GET handler loads all appointments, then builds arrays of IDs, then issues two parallel queries. For CCAs with many members, the `IN` clause on `user_id` and `position_id` arrays can grow very large.
- Files: `src/app/api/holidaySubsidy/weekly/[ccaId]/[weekId]/route.ts` lines 88-103
- Cause: Supabase `IN` clauses have URL length limits. Large CCAs could exceed these limits.
- Improvement path: Use Supabase RPC functions to perform the join server-side, or paginate the results.

**Repeated `fetchUserInfo()` calls per request:**
- Problem: Several API routes call `fetchUserInfo()` which issues two Supabase queries (getClaims + authenticated_user_info lookup). Some routes also create a separate `createClient()` call. This means 3-4 Supabase round-trips per API request just for auth.
- Files: `src/lib/fetch-user-info.ts`, called from nearly every route in `src/app/api/`
- Cause: No request-level caching of user info.
- Improvement path: Cache the `fetchUserInfo()` result per request using React's `cache()` or a request-scoped Map.

**No caching strategy on read-heavy endpoints:**
- Problem: Every request to `/api/user/getCCAs`, `/api/user/getManagedCCAs`, and `/api/cca/[ccaId]/rankings` issues fresh Supabase queries. These datasets change infrequently but are loaded on every page navigation.
- Files: `src/app/api/user/getCCAs/route.ts`, `src/app/api/user/getManagedCCAs/route.ts`, `src/app/api/cca/[ccaId]/rankings/route.ts`
- Cause: All responses set `Cache-Control: no-store, private` or have no caching headers.
- Improvement path: Implement short TTL caching (30-60 seconds) using `stale-while-revalidate` or Next.js route segment caching.

## Fragile Areas

**ManageMembers page (1111 lines):**
- Files: `src/app/dashboard/mycca/admin/manageMembers/[ccaName]/page.tsx`
- Why fragile: Single component handles member listing, search, add, remove, status updates, commitment period changes, and pending change tracking. 16 eslint-disable directives indicate the types are not well-defined. Deep nesting of state update callbacks using `any` types.
- Safe modification: Extract individual operations (add member, remove member, update status) into custom hooks. Define proper types for `GroupedMembers` state instead of `Record<string, any>`.
- Test coverage: Zero tests.

**Holiday subsidy week configuration:**
- Files: `src/lib/holiday-subsidy-weeks.ts`
- Why fragile: Hardcoded dates mean the entire holiday subsidy system silently stops working when dates expire. The testing week (id 6) mixed in with production weeks creates confusion.
- Safe modification: Treat week definitions as data, not code. Add runtime validation that warns when all weeks have expired.
- Test coverage: Zero tests.

**Auth context and session management:**
- Files: `src/context/AuthContext.tsx`, `src/utils/supabase/server.ts`, `src/utils/supabase/middleware.ts`
- Why fragile: Cookie writes are intentionally disabled in server-side Supabase client (`allowCookieWrite` defaults to false). Middleware also disables cookie writes. This means Supabase cannot refresh expired tokens server-side. If the client-side token expires during a long session, server-side auth checks may fail silently.
- Safe modification: Understand the intentional design (avoiding server-driven cookie state overriding browser sessions). Any changes to cookie handling must be tested across both server components and API routes.
- Test coverage: Zero tests.

**Delete-then-insert ranking operations:**
- Files: `src/app/api/user/saveRankings/route.ts`, `src/app/api/chair/positions/[position_id]/rank/route.ts`
- Why fragile: These use a delete-all-then-insert pattern without transactions. A failure between delete and insert loses all data.
- Safe modification: Replace with Supabase `upsert` on a unique constraint, or wrap in an RPC function with a transaction.
- Test coverage: Zero tests.

## Scaling Limits

**Supabase PostgREST URL length limits:**
- Current capacity: Supabase `.or()` and `.in()` filters build URL query strings. With ~100+ members, the generated URLs can exceed default limits.
- Limit: PostgREST typically has a URL limit around 8KB. Large CCAs with many positions could hit this.
- Scaling path: Switch to RPC (stored procedures) for complex queries. Batch large `.in()` arrays (already done for PATCH in the weekly approval route with `BATCH_SIZE = 20`).

## Dependencies at Risk

**`fs` package (`^0.0.1-security`):**
- Risk: This is a placeholder/security-holding package on npm. It does nothing and may be flagged by security scanners. Its presence suggests a past attempt to use Node's `fs` module in browser code.
- Impact: No functional impact, but creates noise in dependency audits.
- Migration plan: Remove from `package.json`.

**`logger` package (`^0.0.1`):**
- Risk: Extremely minimal package with no meaningful functionality. Not imported anywhere in the codebase.
- Impact: Dead dependency.
- Migration plan: Remove from `package.json`.

## Missing Critical Features

**Zero test coverage:**
- Problem: No test files exist anywhere in the codebase. No test framework is configured (`jest`, `vitest`, etc. are absent from `devDependencies`). No `test` script in `package.json`.
- Blocks: Cannot verify correctness of authorization logic, ranking algorithms, subsidy calculations, or any business logic without manual testing. Refactoring is high-risk.

**No structured logging:**
- Problem: All logging uses `console.log`, `console.error`, and `console.warn` with ad-hoc string formatting. No log levels, no structured output, no correlation IDs.
- Blocks: Debugging production issues requires manually searching CloudWatch/log streams. Cannot filter by severity or trace requests.

**No input validation library:**
- Problem: Request body validation is done manually with inline `if` checks. No schema validation (e.g., Zod, Yup, or similar).
- Blocks: Inconsistent validation across endpoints. Easy to forget edge cases. No type narrowing from validation.

## Test Coverage Gaps

**Entire codebase is untested:**
- What's not tested: All 27 API routes, all 15+ page components, all lib utilities, all hooks, all context providers.
- Files: Every file in `src/`
- Risk: Any change can introduce regressions that are only caught in production. Authorization logic, data transformation, and business rules have zero automated verification.
- Priority: High. Start with API route authorization tests (especially the commented-out JCRC auth), then lib utility tests (`src/lib/holiday-subsidy-weeks.ts`, `src/lib/cca-chair-access.ts`, `src/lib/feature-flags.ts`), then data-fetching hooks.

---

*Concerns audit: 2026-04-10*
