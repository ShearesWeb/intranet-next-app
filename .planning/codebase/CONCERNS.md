# Codebase Concerns

**Analysis Date:** 2026-09-03

## Tech Debt

**Large monolithic components:**
- Issue: `cupid-animation.tsx` (2,932 lines), `allocation-reveal-overlay.tsx` (931 lines), `subsidy-flow-visual.tsx` (862 lines), `sidebar.tsx` (694 lines) are difficult to maintain, test, and debug
- Files: `src/components/allocation/cupid-animation.tsx`, `src/components/cca/allocation-reveal-overlay.tsx`, `src/components/holiday-subsidy/subsidy-flow-visual.tsx`, `src/components/ui/sidebar.tsx`
- Impact: Changes to these files risk unintended side effects; testing is difficult; cognitive load for developers is high; bundle size bloat
- Fix approach: Break into smaller, focused sub-components with clear responsibility boundaries; extract animation logic into separate hooks; memoize expensive sub-trees

**Type casting without runtime validation:**
- Issue: `useApiQuery.ts` line 56 casts response data `as T` without validating structure at runtime; `useApiQuery.ts` line 53 uses optional property type cast `as { error?: string }` which could fail silently
- Files: `src/hooks/use-api-query.ts`
- Impact: Malformed API responses could cause runtime crashes; type safety provides false confidence that data is valid
- Fix approach: Add runtime schema validation (Zod, Valibot, or similar) to validate response shape before casting; provide typed `select` option for response transformation

**No error tracking / observability:**
- Issue: Errors are logged via `console.error()` but there's no centralized error tracking, monitoring, or alerting system for production issues
- Files: Throughout `src/hooks/`, `src/lib/`, `src/app/api/` (71 console.error calls found)
- Impact: Production errors may go unnoticed; debugging real-world issues requires access to browser console; no metrics on error frequency or patterns
- Fix approach: Integrate error tracking service (Sentry, Axiom, or similar); implement error context enrichment (user id, timestamp, feature flags); set up alerts for critical errors

## Test Coverage Gaps

**API routes lack tests:**
- What's not tested: Many critical API routes have no integration tests (`src/app/api/user/route.ts`, `src/app/api/user/search/route.ts`, `src/app/api/user/ccas/route.ts`, `src/app/api/chair/positions/for-chair/route.ts`, `src/app/api/holiday-subsidy/approvals/route.ts`, `src/app/api/holiday-subsidy/calendar/route.ts`, etc.)
- Files: `src/app/api/user/route.ts`, `src/app/api/user/search/route.ts`, `src/app/api/user/ccas/route.ts`, `src/app/api/chair/positions/for-chair/route.ts`, `src/app/api/holiday-subsidy/calendar/route.ts`, `src/app/api/holiday-subsidy/approvals/route.ts`, `src/app/api/chair/positions/[position-id]/applicants/route.ts`, `src/app/api/chair/positions/[position-id]/rank/route.ts`, `src/app/api/user/check-role/route.ts`, `src/app/api/user/managed-ccas/route.ts`
- Risk: Changes to these routes could break critical user flows without detection; access control bugs may go unnoticed; edge cases in data transformation are not validated
- Priority: High

**Hooks without tests:**
- What's not tested: 25 client-side hooks lack unit/component tests, including critical data-fetching hooks (`use-weekly-approvals.ts`, `use-cca-members.ts`, `use-applicant-rankings.ts`, `use-member-save.ts`, `use-role-auth.ts`, `use-ranking-editor.ts`, etc.)
- Files: `src/hooks/use-weekly-approvals.ts`, `src/hooks/use-cca-members.ts`, `src/hooks/use-applicant-rankings.ts`, `src/hooks/use-recap-data.ts`, `src/hooks/use-member-search.ts`, `src/hooks/use-ranking-editor.ts`, `src/hooks/use-allocation-reveal.ts`, `src/hooks/use-managed-ccas.ts`, `src/hooks/use-subsidy-approval-details.ts`, `src/hooks/use-chair-ccas.ts`, `src/hooks/use-member-save.ts`, `src/hooks/use-subsidy-declarations.ts`, `src/hooks/use-weekly-commitment.ts`, and 12 others
- Risk: Logic bugs in state management, data fetching error handling, and side effects remain undetected; refactoring hooks is risky
- Priority: High

**Complex animation components untested:**
- What's not tested: `cupid-animation.tsx` and `allocation-reveal-overlay.tsx` have no unit or component tests despite complex timing and event handling logic
- Files: `src/components/allocation/cupid-animation.tsx`, `src/components/cca/allocation-reveal-overlay.tsx`
- Risk: Animation glitches, timing issues, or event handler bugs could frustrate users without detection
- Priority: Medium

## Fragile Areas

**Large animation component with tightly-coupled timing logic:**
- Files: `src/components/cca/allocation-reveal-overlay.tsx` (931 lines)
- Why fragile: Complex state machine (`stage`, `cut`, `dragging`, `shown`, `resolved`); multiple timer-based state transitions; drag event lifecycle managed via ref (`draggingRef`) to work around React closure stale-state issues; tight coupling between animation timing and component lifecycle; multiple setTimeout chains with hardcoded durations (OPEN_DELAY=1250ms, SLOT_GAP=2500ms, RESOLVE_AT=1600ms, DONE_PADDING=900ms)
- Safe modification: Add comprehensive E2E tests before changing timing constants; isolate animation orchestration into a separate service; add JSDoc comments documenting state machine transitions; use explicit transition logging to validate timing guarantees; consider using a state machine library (XState)
- Test coverage: No tests; high risk of regressions

**Cupid allocation animation algorithm:**
- Files: `src/components/allocation/cupid-animation.tsx` (2,932 lines)
- Why fragile: Implements a complex matching algorithm with interconnected position/applicant state; contains hardcoded test data (`POSITIONS`, `APPLICANTS`) mixed with component logic; complex log generation and step visualization; tightly coupled rendering and animation logic; no separation between algorithm and UI
- Safe modification: Extract algorithm to pure function module; add unit tests for algorithm correctness before UI changes; document state transitions and invariants; consider generating step visualizations from algorithm output rather than hardcoding steps
- Test coverage: No tests; high business logic risk

**Sidebar navigation with complex conditional rendering:**
- Files: `src/components/ui/sidebar.tsx` (694 lines)
- Why fragile: Deeply nested conditional rendering based on feature flags and user roles; complex CSS/animation logic; multiple event handlers; dependency on context and theme state
- Safe modification: Add component tests for different role/flag combinations; break navigation tree into smaller sub-components; test keyboard navigation separately
- Test coverage: No tests

**Weekly approvals hook with complex data fetch and mutation:**
- Files: `src/hooks/use-weekly-approvals.ts` (435 lines)
- Why fragile: Multiple nested try/catch blocks; complex state updates across multiple `useState` calls; error handling with side effects (toast notifications); fetches multiple resources with interdependencies; no validation of response shape
- Safe modification: Add unit tests for success/error paths; extract state management into reducer; add response validation; add loading state more explicitly
- Test coverage: No tests

## Security Considerations

**Session isolation - localStorage data persistence:**
- Risk: Client-side role cache (`useRoleAuth.ts`) and feature flag cache stored in localStorage could leak between sessions if a user switches accounts in same browser session without clearing cache
- Files: `src/hooks/use-role-auth.ts` (lines 88-123), `src/app/dashboard/page.tsx` (line 178), `src/hooks/use-recap-data.ts` (line 30), `src/hooks/use-allocation-reveal.ts` (lines 26-46)
- Current mitigation: `useRoleAuth` validates cached data includes email and timestamp; TTL enforcement (5 min); cache cleared on error. However, if user A logs in, caches role data, then user B logs in on same browser — if user B hits an endpoint before the 5-minute TTL expires on user A's cached data, stale roles could be used
- Recommendations: On session switch (detect via `useAuth()` user change), explicitly clear all auth-related localStorage keys; add user ID to all localStorage keys to namespace by user; consider using sessionStorage instead for cache that shouldn't persist across browser sessions; add test cases for multi-user scenarios

**API parameter validation:**
- Risk: Route handlers accept `params` from URL without explicit validation; e.g., `src/app/api/cca/[cca-id]/rankings/route.ts` line 49 parses `params["cca-id"]` as number without bounds checking
- Files: `src/app/api/cca/[cca-id]/rankings/route.ts`, `src/app/api/chair/positions/[position-id]/applicants/route.ts`, `src/app/api/chair/positions/[position-id]/rank/route.ts`, `src/app/api/holiday-subsidy/declarations/[cca-id]/route.ts`, and others
- Current mitigation: RLS policies on Supabase enforce authorization; chair/access checks call server-side RPC (`can_manage_cca`, `can_manage_cca_position`)
- Recommendations: Add input validation/sanitization layer for all numeric IDs; use Zod or similar for schema validation on route parameters and request bodies; document security assumptions (e.g., "RLS is the authorization boundary")

**No CSRF protection on state-mutating endpoints:**
- Risk: POST/PATCH/DELETE endpoints lack CSRF tokens; vulnerable if accessed from cross-origin requests
- Files: `src/app/api/cca/[cca-id]/rankings/route.ts`, `src/app/api/chair/positions/[position-id]/rank/route.ts`, `src/app/api/holiday-subsidy/approvals/route.ts`, `src/app/api/holiday-subsidy/declarations/[cca-id]/route.ts`, and all other mutation endpoints
- Current mitigation: Next.js middleware validates session via Supabase JWT in cookies; SameSite cookie flag likely set by default
- Recommendations: Verify SameSite=Strict is enforced on Supabase session cookies; consider adding explicit CSRF token validation if cross-origin requests are expected; document the CSRF model

## Performance Bottlenecks

**Large data tables without pagination:**
- Problem: Tables in `src/components/holiday-subsidy/subsidy-member-table.tsx` (278 lines), `src/components/holiday-subsidy/subsidy-member-approval-table.tsx` (299 lines), `src/components/cca/member-group-table.tsx` (321 lines) may render hundreds of rows without pagination; no virtual scrolling
- Files: `src/components/holiday-subsidy/subsidy-member-table.tsx`, `src/components/holiday-subsidy/subsidy-member-approval-table.tsx`, `src/components/cca/member-group-table.tsx`, `src/components/ranking/points-recap-card.tsx` (353 lines)
- Cause: Tables use `.map()` to render all rows; no limit on result set from API; no lazy loading
- Improvement path: Implement server-side pagination in API routes; add `offset`/`limit` parameters; render tables with virtual scrolling (react-window); add search/filter to reduce result set client-side

**No request deduplication or caching strategy:**
- Problem: `useApiQuery` hook fetches every time URL changes; no built-in deduplication of simultaneous requests; no cache invalidation strategy
- Files: `src/hooks/use-api-query.ts`
- Cause: Simple fetch-based implementation; no query client
- Improvement path: Consider React Query/SWR for automatic deduplication, caching, and background refetching; or implement request deduplication in hook itself

**Animation performance - 46 confetti pieces with full CSS animations:**
- Problem: `allocation-reveal-overlay.tsx` renders 46 animated confetti pieces with animation keyframes; no GPU acceleration hints or performance optimization
- Files: `src/components/cca/allocation-reveal-overlay.tsx` (lines 50-72)
- Cause: Fixed animation count; no will-change hints; no transform3d to trigger GPU
- Improvement path: Use CSS will-change on animated elements; implement dynamic confetti count based on device capability; use requestAnimationFrame for custom animation logic instead of CSS

**Large animation component re-renders:**
- Problem: `cupid-animation.tsx` (2,932 lines) has complex state (`steps`, `board`, `log`, etc.); re-renders may cascade through many child nodes
- Files: `src/components/allocation/cupid-animation.tsx`
- Cause: Monolithic component with mixed rendering and logic; no memoization of sub-trees
- Improvement path: Break into smaller components with React.memo; memoize step visualization, log rendering; use useCallback for event handlers

## Fragile Areas

**Role-based access control cache:**
- Files: `src/hooks/use-role-auth.ts`
- Why fragile: Client-side cache of authorization state with 5-minute TTL; inconsistent with server state if permissions change mid-session; cache key doesn't include user context beyond email
- Safe modification: Add integration tests for permission changes mid-session; consider server-driven authorization checks for critical operations; add cache version to detect schema changes
- Test coverage: No tests

**Complex ranking algorithm without clear documentation:**
- Files: `src/lib/ranking/cca-ranking-metrics.ts`, `src/lib/ranking/ranking-editor.ts`, `src/lib/allocation/candidate-service.ts`
- Why fragile: Business logic for ranking scoring, metrics, and allocation is not centralized; multiple hooks and services access/modify ranking state
- Safe modification: Add comments documenting ranking semantics (e.g., "lower rank = higher priority"); add property-based tests for ranking invariants (e.g., "no duplicate ranks within position"); extract ranking validation into a pure function
- Test coverage: Some unit tests exist but not comprehensive

## Dependencies at Risk

**@opennextjs/cloudflare@1.19.11:**
- Risk: Bleeding-edge OpenNext Cloudflare adapter; used for production deployment on Workers; updates may introduce breaking changes to edge runtime behavior
- Impact: Deployment failures or unexpected edge behavior on version bump
- Migration plan: Lock version and test thoroughly before updating; review OpenNext changelog for breaking changes; maintain prepared upgrade path before using in production

**Next.js 15.1.2 (latest major):**
- Risk: Latest major version; may have undiscovered edge cases; Vercel's release cadence is rapid
- Impact: Bugs in framework could affect deployment or runtime behavior
- Migration plan: Keep on 15.x patch releases; monitor Next.js issues for regressions; have rollback procedure tested

**@supabase/ssr@0.10.2:**
- Risk: Critical for session management and auth; breaking changes in SSR cookie handling could cause session isolation bugs
- Impact: Session leakage between users if major version breaks cookie isolation
- Migration plan: Review supabase/ssr changelog before minor version bumps; test multi-user session scenarios after updates; pin version and update only when needed

## Missing Critical Features

**Error recovery and retry logic:**
- Problem: API calls fail silently in many cases; no automatic retry for transient failures (network timeouts, 5xx errors)
- Blocks: User experience degrades when network is flaky; no user feedback on retry attempts
- Recommendation: Implement exponential backoff retry in fetch wrapper or hook; add UI feedback when retrying; consider service-worker-based offline queuing for mutations

**Audit logging:**
- Problem: No audit trail of who made what changes (rankings, approvals, allocations); critical for compliance and debugging
- Blocks: Cannot investigate data inconsistencies; cannot prove audit trail to stakeholders
- Recommendation: Add `created_by` / `updated_by` / `created_at` / `updated_at` to all mutable tables; log all mutations to audit table; add UI for querying audit trail

## Scaling Limits

**Single-user performance on large CCAs:**
- Current capacity: Tested with ~5 CCAs per chair, ~50 members per CCA, ~10 ranking fields
- Limit: UI will stall when rendering tables with >500 rows on low-end mobile devices (no pagination, no virtual scrolling)
- Scaling path: Implement server-side pagination; add lazy loading; implement virtual scrolling in data tables; benchmark on target devices

**Real-time updates not implemented:**
- Current capacity: Client must refetch to see changes by other users; no WebSocket subscriptions
- Limit: When multiple chairs edit rankings simultaneously, last-write-wins; no conflict resolution
- Scaling path: Implement Supabase realtime subscriptions; add optimistic updates with conflict detection; document eventual consistency model

---

*Concerns audit: 2026-09-03*
