# Pitfalls Research

**Domain:** Next.js 15 + Supabase intranet app refactoring (SSR auth, codebase restructuring)
**Researched:** 2026-04-10
**Confidence:** HIGH (verified against official Supabase docs, Next.js docs, and codebase analysis)

## Critical Pitfalls

### Pitfall 1: SSR Session Bleed from Disabled Cookie Writes

**What goes wrong:**
The middleware's `setAll()` is a no-op (line 22-24 of `src/utils/supabase/middleware.ts`), and the server client defaults to `allowCookieWrite: false` (line 15 of `src/utils/supabase/server.ts`). When a user's access token expires, the Supabase client refreshes it server-side but *cannot write the new token back to the response*. The stale cookie persists in the browser. On the next request, middleware reads the stale cookie, may resolve to the wrong session (or no session), and the user either sees another user's data or gets silently logged out. In a shared-infrastructure environment (Vercel Fluid Compute, AWS Lambda warm starts), a module-scoped or leaked client reference compounds this into cross-user session bleed.

**Why it happens:**
The original developer disabled `setAll()` with the comment "Middleware must not mutate auth cookies server-side" and "avoid server-driven cookie state overriding the active browser session." This is a misunderstanding of the Supabase SSR auth flow. The middleware *must* write refreshed cookies back to both the request (so downstream server components see the fresh token) and the response (so the browser stores the fresh token). Without this, the browser retains an expired token, the server refreshes it transiently but discards the refresh, and subsequent requests repeat the cycle with an increasingly stale state.

**How to avoid:**
Re-enable `setAll()` in both the middleware and server client following the official Supabase pattern:

1. **Middleware `setAll()`** must write cookies to both `request.cookies` (for downstream server components) and `supabaseResponse.cookies` (for the browser). This is the canonical two-write pattern from Supabase docs.
2. **Server client `setAll()`** should attempt cookie writes in a try/catch. In server components, the write will fail silently (expected), but in route handlers and server actions it will succeed. The middleware handles the authoritative write regardless.
3. Upgrade `@supabase/ssr` from v0.7.0 to v0.10.0+, which passes cache headers (`Cache-Control`, `Expires`, `Pragma`) as a second argument to `setAll()`. Apply these headers to the response to prevent CDN caching of responses that contain refreshed tokens.
4. Verify the Supabase client is instantiated per-request (already the case in this codebase via `createClient()` calls), not stored at module scope.

**Warning signs:**
- Users report being logged out after ~1 hour (access token expiry)
- Users see another user's dashboard data after navigating
- `getClaims()` returns stale or missing claims in server components
- CloudWatch/logs show repeated "Auth session missing" errors for users who are clearly logged in on the client

**Phase to address:**
Phase 1 (Auth Fix) -- this is the highest-priority bug and must be fixed before any feature refactoring begins.

---

### Pitfall 2: Non-Atomic Delete-Then-Insert Causes Data Loss

**What goes wrong:**
Both `src/app/api/user/saveRankings/route.ts` (lines 37-53) and `src/app/api/chair/positions/[position_id]/rank/route.ts` (lines 56-79) delete all existing records first, then insert new ones as a separate operation. If the insert fails (network timeout, Supabase rate limit, constraint violation), all rankings are permanently lost. The delete already committed. There is no rollback mechanism.

Worse, in `saveRankings`, the delete error is logged but *not returned early* (lines 42-44) -- the function continues to the insert even if the delete partially failed, creating potential for duplicates or orphaned state.

**Why it happens:**
Supabase's PostgREST layer is stateless and does not support client-side transactions. Developers often don't realize that each `.delete()` and `.insert()` call is an independent HTTP request with no transactional guarantee. The pattern feels transactional but is not.

**How to avoid:**
1. **Use a Supabase RPC function (Postgres stored procedure)** that wraps the delete and insert in a single `BEGIN...COMMIT` block. This is the only way to get true atomicity through PostgREST.
2. **Alternative for simpler cases:** Use `.upsert()` with `onConflict` on a unique constraint (e.g., `(user_id, position_id)`), which avoids the delete entirely. This requires a unique constraint in the schema but is the simplest fix.
3. **At minimum:** Check the delete result before proceeding. If delete fails, return an error without attempting the insert.

```sql
-- Example RPC function for atomic ranking save
CREATE OR REPLACE FUNCTION save_user_rankings(
  p_user_id INT,
  p_rankings JSONB
) RETURNS VOID AS $$
BEGIN
  DELETE FROM user_cca_applications WHERE user_id = p_user_id;
  INSERT INTO user_cca_applications (user_id, position_id, ranking, application_status)
  SELECT p_user_id, (r->>'position_id')::INT, (r->>'ranking')::INT, 'pending'
  FROM jsonb_array_elements(p_rankings) AS r;
END;
$$ LANGUAGE plpgsql;
```

**Warning signs:**
- Users report "my rankings disappeared" after saving
- Insert errors in logs preceded by successful deletes for the same user
- Empty ranking lists for users who previously had rankings

**Phase to address:**
Phase 1 (Auth Fix) or Phase 2 (CCA Refactor) -- whichever phase touches ranking endpoints first. The RPC approach requires a Supabase migration, which should be prepared early.

---

### Pitfall 3: Refresh Token Race Condition During Parallel SSR Requests

**What goes wrong:**
Supabase refresh tokens are single-use. When a user's access token has expired, the first server-side request that reaches `getClaims()` or `getUser()` triggers a token refresh. If a second parallel request arrives with the same expired cookie (common in Next.js where middleware, layouts, and page components can fire concurrently), the second request tries to use the already-consumed refresh token and fails with "Invalid Refresh Token: Already Used." The user is effectively signed out or gets an auth error.

**Why it happens:**
Next.js App Router can trigger multiple parallel server-side requests during a single navigation (middleware + layout + page). Middleware runs first and should refresh the token, but if the middleware correctly writes the refreshed token to `request.cookies`, downstream server components should see the fresh token. The problem arises when middleware `setAll()` is disabled (as in this codebase), so the refresh happens again in the server component, consuming a second token.

**How to avoid:**
1. **Fix middleware `setAll()`** (Pitfall 1). When middleware correctly refreshes and writes the token to the request, downstream components see the already-refreshed token and do not attempt their own refresh.
2. **Use `getClaims()` instead of `getUser()` in middleware** (this codebase already does this correctly). `getClaims()` performs local JWT validation without a network call, so it only triggers a refresh when the token is actually expired.
3. After fixing middleware, server components should still wrap `setAll()` in try/catch (already the official pattern). The middleware handles the authoritative refresh; server components just read the result.
4. Be aware of Supabase's built-in 10-second grace period for reused refresh tokens, which provides some tolerance, but do not rely on it.

**Warning signs:**
- Intermittent "Invalid Refresh Token" errors in server logs
- Users randomly logged out after clicking a link (particularly navigation that loads multiple server components)
- Auth errors that resolve on page refresh (because the refresh token has been rotated by then)

**Phase to address:**
Phase 1 (Auth Fix) -- resolving Pitfall 1 (re-enabling `setAll()`) directly mitigates this.

---

### Pitfall 4: Next.js Caching Serves Authenticated Responses to Wrong Users

**What goes wrong:**
Next.js has multiple caching layers (Router Cache, Data Cache, Full Route Cache). If an authenticated route is cached (via ISR, static generation, or aggressive fetch caching), the cached response -- including `Set-Cookie` headers with refreshed JWTs -- can be served to a different user. This is the CDN-layer equivalent of session bleed.

Specific risks in this codebase:
- Route Handlers for GET requests can be cached by Next.js if they don't use dynamic functions. Some API routes under `/api/` may not explicitly opt out.
- If anyone adds `revalidate` or ISR configuration to authenticated pages, those pages will be cached with the first user's session data.
- The OpenNext/CloudFront deployment adds another caching layer. CloudFront's default behavior caches responses even when `Cache-Control` headers suggest otherwise (its Minimum TTL overrides `max-age=0`).

**Why it happens:**
Next.js 15 changed caching defaults to uncached-by-default (a positive change), but developers may add caching for performance without realizing it captures auth state. Additionally, `@supabase/ssr` v0.7.0 (the installed version) does not automatically pass cache-busting headers to `setAll()` -- that feature was added in v0.10.0. So even with `setAll()` re-enabled, the response may lack the `Cache-Control: private, no-store` headers needed to prevent CDN caching.

**How to avoid:**
1. **Upgrade `@supabase/ssr` to v0.10.0+** so the library automatically includes cache headers when tokens are refreshed.
2. **Add `export const dynamic = 'force-dynamic'`** to any page or route handler that accesses auth state. This opts out of all Next.js caching for that route.
3. **Never use ISR on authenticated routes.** The `revalidate` export and ISR are only safe for public, unauthenticated content.
4. **Configure CloudFront correctly:** Set Minimum TTL to 0 on the distribution's cache behavior for `/dashboard/*` and `/api/*` paths. Alternatively, use `Cache-Control: no-cache="Set-Cookie"` to strip auth cookies from cached responses.
5. **Audit all API GET route handlers** for caching behavior. In Next.js 15, GET route handlers that don't use `cookies()`, `headers()`, or other dynamic functions may be statically optimized.

**Warning signs:**
- Two users see the same dashboard data
- CloudFront cache hit ratio is suspiciously high on authenticated routes
- Response headers show `x-nextjs-cache: HIT` on pages that should be dynamic
- After deploying, the first user to visit a page "sets" the data for all subsequent visitors

**Phase to address:**
Phase 1 (Auth Fix) -- the `@supabase/ssr` upgrade and cache header configuration are part of the auth fix. CloudFront configuration should be verified during deployment validation.

---

### Pitfall 5: API Routes Unprotected by Middleware Matcher

**What goes wrong:**
The middleware matcher (line 10-13 of `src/middleware.ts`) only covers `/dashboard/:path*` and `/auth/:path*`. All 27 API routes under `/api/*` are completely outside middleware protection. Any unauthenticated request to `/api/user/getCCAs`, `/api/cca/[ccaId]/members`, etc. bypasses the middleware's auth check entirely. Individual route handlers must check auth themselves, but several do not (documented in CONCERNS.md under "No authentication on several API GET endpoints").

**Why it happens:**
The middleware matcher was likely configured to protect only visible pages. API routes were assumed to handle their own auth, but this was not consistently implemented. The pattern of "middleware guards pages, routes guard themselves" creates gaps when developers forget to add auth checks to new routes.

**How to avoid:**
1. **Add `/api/:path*` to the middleware matcher.** The middleware should verify the session on every API request, not just page requests. This provides defense-in-depth.
2. **Keep per-route auth checks** even with middleware protection. The CVE-2025-29927 vulnerability (patched in Next.js 15.2.3, and this app runs 15.5.6) demonstrated that middleware can be bypassed. Auth checks at the data access layer are the true security boundary.
3. **Create a shared auth utility** (e.g., `requireAuth()`) that every API route handler calls as its first operation. This returns the authenticated user or throws a 401. Consolidate `fetchUserInfo()` and `fetchUserId()` into this single pattern.

**Warning signs:**
- API routes returning data without checking cookies
- Accessing `/api/user/getCCAs` in an incognito browser returns data instead of 401
- New routes added without auth checks (no linting rule to catch this)

**Phase to address:**
Phase 1 (Auth Fix) -- middleware matcher expansion and auth utility consolidation.

---

### Pitfall 6: Auth Pattern Fragmentation Causes Inconsistent Security

**What goes wrong:**
The codebase has three overlapping auth mechanisms:
1. **AuthContext** (`src/context/AuthContext.tsx`) -- client-side, wraps entire app in `layout.tsx`, manages session state via `onAuthStateChange`
2. **withAuth HOC** (`src/hoc/withAuth.tsx`) -- client-side, wraps individual page components, uses `useAuth()` from AuthContext
3. **Middleware** (`src/utils/supabase/middleware.ts`) -- server-side, checks `getClaims()` and redirects

During refactoring, it is easy to:
- Remove the AuthContext thinking middleware handles everything (breaks client-side session state, toast notifications, sign-out)
- Remove middleware thinking AuthContext handles everything (removes server-side protection, enables FOUC of protected content)
- Keep all three but make them disagree on auth state (middleware says "authenticated", AuthContext says "loading", withAuth redirects to login)
- Introduce a fourth pattern (e.g., server-component-level auth checks with `fetchUserInfo()`) without deprecating the others

**Why it happens:**
Each pattern was added at different times to solve different problems. The AuthContext gives client components access to user state. The withAuth HOC adds redirect logic per-page. The middleware provides server-side gating. They overlap but serve genuinely different purposes. Refactoring without understanding all three leads to regressions.

**How to avoid:**
1. **Define the target auth architecture before touching code:**
   - Middleware: server-side session refresh, redirect unauthenticated users from protected routes, pass valid token to downstream components
   - Server utility (`requireAuth()`): per-route/per-component auth verification in server components and API routes
   - AuthContext: client-side session state for UI elements (user name, avatar, sign-out button). NOT for security gating.
   - withAuth HOC: deprecate entirely. Its functionality is covered by middleware (redirect) + AuthContext (loading state).
2. **Migrate one pattern at a time.** Fix middleware first (Pitfall 1). Then consolidate server auth into `requireAuth()`. Then simplify AuthContext. Then remove withAuth.
3. **Never have two patterns checking auth on the same request path.** If middleware checks auth for `/dashboard/*`, page-level `withAuth` is redundant and adds latency.

**Warning signs:**
- Different pages use different auth patterns (some use withAuth, some rely on middleware, some check directly)
- A page loads briefly with unauthenticated state before redirecting (FOUC from client-side-only auth)
- Sign-out works on some pages but not others
- `useAuth()` returns stale data that disagrees with actual session state

**Phase to address:**
Phase 1 (Auth Fix) for the architecture decision and middleware fix. Phase 2+ for progressively removing withAuth HOC from individual pages as they are refactored.

---

### Pitfall 7: Breaking Client Components When Extracting Server Components

**What goes wrong:**
All 15+ dashboard pages are currently `"use client"` components that fetch data via `useEffect` + `fetch()` to API routes. During refactoring, the natural instinct is to convert them to server components that fetch data directly. But:

1. **Event handlers cannot be passed from server to client components.** A server component cannot pass an `onClick` callback as a prop to a child. The handler must live in a client component.
2. **Hooks (`useState`, `useEffect`, `useAuth()`) cannot be used in server components.** Every page currently uses `useAuth()` to get user state. Moving to server components means replacing `useAuth()` with server-side `fetchUserInfo()`.
3. **The AuthContext wraps the entire app in `layout.tsx`.** AuthContext is a client component, which means everything below it in the tree is already in a client boundary. To create server components inside this tree, you must restructure the component hierarchy so server components are above the AuthContext boundary, or accept that "server" pages are actually client-rendered.
4. **Existing pages are 500-1000+ lines.** Splitting them into server/client pieces while maintaining behavior is extremely error-prone without tests.

**Why it happens:**
The server/client boundary in Next.js App Router is subtle. A component is a server component by default *only if* no ancestor in its render tree is a client component. Since `AuthProvider` in `layout.tsx` is `"use client"`, every page rendered within it is effectively a client component regardless of whether it has `"use client"` at the top. To truly leverage server components, the AuthProvider must be restructured (e.g., moved to a dashboard layout, or replaced with a server-side auth pattern at the layout level).

**How to avoid:**
1. **Do not attempt a wholesale "make everything server components" conversion.** This is not necessary for a refactor. The existing client-component pattern works; the goal is to clean up the code, not change the rendering model.
2. **Extract logic, not rendering boundaries.** Break 1000-line client components into smaller client components with custom hooks. This achieves the refactoring goal without the risk of server/client boundary issues.
3. **If server components are desired for specific pages:** Create a new dashboard layout that does server-side auth (via `fetchUserInfo()`) and passes user data as props. Client sub-components receive user data as props instead of calling `useAuth()`. But this is a Phase 3+ optimization, not a Phase 1-2 requirement.
4. **Add tests before any boundary changes.** Zero test coverage (current state) makes any server/client restructuring extremely risky.

**Warning signs:**
- "Functions cannot be passed directly to Client Components" build errors
- "You're importing a component that needs useState/useEffect" build errors
- Pages that render correctly in dev but break in production (dev mode is more lenient about boundaries)
- Hydration mismatches after moving components across boundaries

**Phase to address:**
Phase 2+ (Feature Refactoring) -- but with the explicit constraint that refactoring means "extract into smaller client components and hooks," NOT "convert to server components."

---

### Pitfall 8: @supabase/ssr Upgrade Breaking Cookie Format

**What goes wrong:**
Upgrading `@supabase/ssr` from v0.7.0 to v0.10.0+ changes cookie handling behavior. Older versions used `get`/`set`/`remove` cookie methods; newer versions use `getAll`/`setAll` (which this codebase already uses, so the API migration is done). However, the upgrade can still break:

1. **Cookie size and chunking:** Supabase stores auth state in cookies that can exceed browser limits (~4KB per cookie). `@supabase/ssr` chunks large cookies into multiple parts (`sb-<ref>-auth-token.0`, `sb-<ref>-auth-token.1`, etc.). Version changes may alter chunking behavior, causing existing sessions to fail to parse.
2. **Cache header injection (v0.10.0+):** The `setAll()` callback signature changes to include a second `headers` parameter. If the middleware's `setAll()` implementation does not handle this new parameter, cache headers are silently dropped, leaving responses vulnerable to CDN caching (Pitfall 4).
3. **Existing browser sessions:** After upgrading, users with old-format cookies may fail to authenticate until they clear cookies or the old session expires.

**Why it happens:**
`@supabase/ssr` is still pre-1.0 (v0.7.0 to v0.10.0), and the API is evolving. The library changelog notes deprecations and new features that affect cookie handling. The jump from 0.7 to 0.10 spans multiple minor versions with incremental changes.

**How to avoid:**
1. **Read the changelog** for every version between 0.7.0 and the target version. Check https://github.com/supabase/ssr/blob/main/CHANGELOG.md for breaking changes.
2. **Update `setAll()` implementation** to accept and apply the `headers` parameter (second argument) to the response.
3. **Test with existing sessions.** Log in, note the cookie values, upgrade, and verify the session still works. Also test the token refresh cycle (wait for token expiry, confirm refresh succeeds).
4. **Add a cookie cleanup step** in the auth callback route that clears old-format cookies if they exist.
5. **Deploy during low-traffic hours** and monitor auth error rates immediately after.

**Warning signs:**
- "Auth session missing" errors spike after deployment
- Users report being logged out after the upgrade
- Cookie parse errors in server logs
- `setAll()` receiving arguments it does not expect (check function signature)

**Phase to address:**
Phase 1 (Auth Fix) -- the upgrade is a prerequisite for fixing the session bleed bug.

---

### Pitfall 9: Feature Parity Regression During Refactoring Without Tests

**What goes wrong:**
With zero test coverage (confirmed: no test files, no test framework, no test script in package.json), every refactoring change is a gamble. Extracting a 1111-line component into smaller pieces, changing auth patterns, consolidating toast libraries, or modifying API routes can break business logic invisibly. Regressions are only caught when a user reports them in production.

Specific high-risk areas:
- `saveRankings` logic (ranking order, deduplication, application_status)
- CCA chair authorization checks (`checkCcaAuthorization`)
- Holiday subsidy weekly/approval calculations
- JCRC role resolution and position-based access control

**Why it happens:**
The codebase was built without tests and has grown to 27 API routes and 15+ pages. Adding tests retroactively feels slow compared to "just refactoring." Teams skip tests to move faster, then spend 3x the time debugging regressions.

**How to avoid:**
1. **Add test infrastructure before any refactoring.** Install Vitest (lighter than Jest for Next.js). Configure with `@testing-library/react` for component tests.
2. **Write characterization tests for critical paths before changing them:**
   - API route auth checks (does each route reject unauthenticated requests?)
   - `saveRankings` / `rank` endpoint behavior (correct data in, correct data out)
   - `fetchUserInfo` / `fetchUserId` resolution logic
   - Feature flag gating (does disabling a flag return 503?)
3. **Use the "test, then refactor" pattern:** For each component being refactored, write tests that capture current behavior, then refactor, then verify tests still pass.
4. **At minimum:** Add smoke tests for auth flows (login, token refresh, sign-out) before touching auth code.

**Warning signs:**
- "I'll add tests after the refactor" (they never get added)
- A refactored page looks correct but breaks on edge cases (empty state, error state, large datasets)
- Bug reports increase after a refactoring phase
- Developers are afraid to change code because they don't know what will break

**Phase to address:**
Phase 1 (Auth Fix) should include test infrastructure setup and auth smoke tests. Every subsequent phase should include tests for the code being refactored.

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Disabling `setAll()` to "avoid overriding browser session" | Eliminates a perceived race condition | Session bleed, token refresh failure, users logged out | Never -- the official pattern requires `setAll()` |
| `eslint: { ignoreDuringBuilds: true }` | Builds succeed despite lint errors | 35+ suppressed warnings hide real bugs; no CI quality gate | Never in production -- fix lint errors, then enable |
| Client-side role caching in localStorage (5 min TTL) | Reduces API calls for role checks | Revoked roles stay active for up to 5 minutes; stale auth on shared devices | Only if server-side auth is also enforced (currently not always the case) |
| Hardcoded holiday week dates | Fast to implement initially | System silently breaks every holiday period; test data mixed with production | Never for production -- use database-driven configuration |
| `any` types on state and callbacks | Faster initial development | Compiler cannot catch regressions; refactoring without types is flying blind | Only during initial prototyping, must be replaced before production |

## Integration Gotchas

Common mistakes when connecting to external services.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Supabase PostgREST | Assuming delete + insert is atomic | Use RPC stored procedures for transactional operations, or `.upsert()` with `onConflict` |
| Supabase `.or()` / `.in()` filters | Interpolating user input directly into filter strings | Use `.ilike()` on individual columns, or sanitize input for special PostgREST characters (commas, parentheses, dots) |
| Supabase `.in()` with large arrays | Building URL query strings that exceed 8KB PostgREST limit | Batch into chunks of 20-50 (already done for PATCH in approval routes), or use RPC |
| OpenNext/CloudFront | Assuming `Cache-Control` headers prevent caching | CloudFront's Minimum TTL overrides `max-age=0`. Must set Minimum TTL to 0 on cache behaviors for authenticated routes |
| Self-calling API routes (`getCCAs` calling `getManagedCCAs`) | Seems like code reuse | Extra HTTP round-trip, fragile cookie forwarding, base URL may differ across environments. Extract shared logic into a lib function |

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Repeated `fetchUserInfo()` per request (2-4 Supabase round-trips) | API response latency grows linearly with auth checks | Use React `cache()` or a request-scoped Map to cache user info per request | Noticeable with >50 concurrent users |
| No caching on read-heavy endpoints (getCCAs, getManagedCCAs) | Every page load hits Supabase directly | Add short TTL caching (30-60s `stale-while-revalidate`) for endpoints that change infrequently | Noticeable with >20 simultaneous navigations |
| N+1 query pattern in weekly subsidy loading | Large CCAs with many members create huge IN clauses | Use Supabase RPC for server-side joins | IN clause exceeds 8KB URL limit at ~100+ members |
| All pages are client components fetching via API routes | Every page load: middleware check + client render + API fetch + Supabase query chain | For read-heavy pages, consider server components with direct Supabase queries (Phase 3+ optimization) | Latency compounds with each hop |

## Security Mistakes

Domain-specific security issues beyond general web security.

| Mistake | Risk | Prevention |
|---------|------|------------|
| Authorization disabled on JCRC approval endpoints (commented-out `authorizeJCRC`) | Any authenticated user can approve/reject holiday subsidies when feature flag is enabled | Uncomment authorization checks immediately; add integration tests that verify auth enforcement |
| API routes outside middleware matcher (`/api/*` not in matcher) | Unauthenticated requests reach API handlers; some handlers lack their own auth checks | Add `/api/:path*` to middleware matcher AND add per-route auth checks (defense in depth) |
| Commented-out credentials in `scripts/index.ts` | Supabase service role key and Firebase admin key visible in git history | Rotate both keys immediately; use BFG Repo Cleaner to purge from git history |
| No CSRF protection on mutating endpoints | Cookie-based auth is vulnerable to cross-site request forgery | Implement CSRF tokens or use `SameSite=Lax` cookies (Supabase SSR cookies may already set this, verify) |
| Client-side role caching without server validation | Cached role survives revocation for 5 minutes; combined with disabled server-side auth on some routes, this creates a real privilege escalation window | Always enforce authorization server-side; treat client cache as UX optimization only |

## UX Pitfalls

Common user experience mistakes in this domain.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Dual toast libraries (react-hot-toast + sonner) with different styles | Inconsistent notification appearance confuses users (different colors, positions, animations) | Standardize on sonner (already has provider in layout.tsx); migrate all react-hot-toast imports |
| Silent auth failures (middleware redirects without explanation) | User clicks a link, lands on login page with no message about why | Add query parameter to login redirect (e.g., `?reason=session_expired`) and display a toast on the login page |
| Rankings lost without recovery on save failure | User spends time ordering rankings, saves, and all data is gone | Show error toast and preserve client-side state so user can retry; implement atomic save (Pitfall 2) |
| Loading spinner with no timeout or error state | If auth check or data fetch hangs, user sees infinite spinner | Add timeout (10s) with "Something went wrong, try refreshing" message |
| Feature flags silently return 503 | User navigates to a feature page and sees a cryptic error | Show a user-friendly "This feature is currently unavailable" page instead of a raw 503 |

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **Auth fix:** Re-enabling `setAll()` is not enough -- verify token refresh actually works end-to-end (expire a token, confirm it refreshes, confirm new token is in browser cookies, confirm next request uses new token)
- [ ] **Auth fix:** Verify the auth callback route (`/auth/callback`) still works after `setAll()` changes -- it uses `allowCookieWrite: true` explicitly, which may interact differently with the new pattern
- [ ] **Middleware expansion:** Adding `/api/*` to the middleware matcher may break unauthenticated API routes (if any exist intentionally, like health checks) -- audit before adding
- [ ] **Toast migration:** After replacing react-hot-toast with sonner, verify the `withAuth` HOC (which uses react-hot-toast) still shows error toasts during the transition period before withAuth is fully removed
- [ ] **Component extraction:** After breaking a 1000-line component into pieces, verify all state flows correctly between parent and children -- especially callback chains that update multiple state variables
- [ ] **CloudFront cache:** After fixing auth cookies, verify CloudFront is not caching authenticated responses -- check with `curl -I` and inspect `x-cache` and `age` headers
- [ ] **Rankings save:** After making the operation atomic (RPC), verify it handles empty rankings array (user deselects all) -- this is an edge case the current code may handle differently

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Session bleed (user sees another's data) | HIGH | Immediately disable server-side caching; rotate all Supabase API keys; notify affected users; audit access logs for data exposure |
| Rankings data loss (delete succeeded, insert failed) | MEDIUM | If Supabase has point-in-time recovery enabled, restore from backup. Otherwise, ask users to re-submit. No automated recovery possible with current schema. |
| Auth regression after refactoring (users locked out) | LOW | Revert the deployment via SST rollback. All auth state is in cookies + Supabase, so reverting code restores previous behavior immediately. |
| CDN serving stale authenticated pages | MEDIUM | Invalidate CloudFront cache (`aws cloudfront create-invalidation`). Add `Cache-Control: private, no-store` to affected routes. First 1000 invalidations/month are free. |
| Feature breaks without tests catching it | HIGH | Manual QA of all affected features. This is why adding tests before refactoring is critical -- recovery without tests means manual verification of every user flow. |

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| SSR Session Bleed (P1) | Phase 1: Auth Fix | End-to-end test: expire token, refresh, verify new cookie in browser. Test with two different user sessions. |
| Non-Atomic Delete-Insert (P2) | Phase 1-2: Auth Fix or CCA Refactor | Integration test: simulate insert failure after delete, verify data is not lost |
| Refresh Token Race Condition (P3) | Phase 1: Auth Fix | Open two tabs simultaneously with expired session, verify both load correctly |
| Next.js Caching + Auth (P4) | Phase 1: Auth Fix | Check response headers on authenticated routes for `Cache-Control: private, no-store`. Verify no `x-nextjs-cache: HIT`. |
| API Routes Unprotected (P5) | Phase 1: Auth Fix | Automated test: hit every API route without auth cookies, verify 401 response |
| Auth Pattern Fragmentation (P6) | Phase 1 (architecture), Phase 2+ (migration) | After Phase 1: all routes use middleware + `requireAuth()`. After Phase 2+: withAuth HOC removed from all pages. |
| Server/Client Component Boundaries (P7) | Phase 2+: Feature Refactoring | Build succeeds with no boundary errors. Pages render correctly in production mode (not just dev). |
| @supabase/ssr Upgrade (P8) | Phase 1: Auth Fix | Existing sessions survive upgrade. Token refresh works. Cache headers present in responses. |
| No Test Coverage (P9) | Phase 1: Test Setup, then every phase | Test infrastructure configured. Auth smoke tests pass. Each refactored module has characterization tests. |

## Sources

- [Supabase SSR Client Creation Docs](https://supabase.com/docs/guides/auth/server-side/creating-a-client) -- official pattern for `setAll()` in middleware and server components
- [Supabase Advanced SSR Guide](https://supabase.com/docs/guides/auth/server-side/advanced-guide) -- session bleed via ISR/CDN, cache header handling, token refresh
- [Supabase Next.js Setup Guide](https://supabase.com/docs/guides/auth/server-side/nextjs) -- middleware pattern, `getClaims()` vs `getUser()` security
- [Supabase Auth Helpers to SSR Migration](https://supabase.com/docs/guides/troubleshooting/how-to-migrate-from-supabase-auth-helpers-to-ssr-package-5NRunM) -- breaking changes between package versions
- [getClaims vs getUser Discussion (GitHub #39947)](https://github.com/supabase/supabase/issues/39947) -- performance and security differences
- [getClaims vs getUser Clarification (GitHub #40985)](https://github.com/supabase/supabase/issues/40985) -- when to use each method
- [@supabase/ssr Roadmap to v1.0 (GitHub Discussion #27037)](https://github.com/orgs/supabase/discussions/27037) -- API evolution, deprecations
- [Refresh Token Race Condition (GitHub #18981)](https://github.com/supabase/supabase/issues/18981) -- single-use refresh token issues with parallel SSR
- [Next.js Caching Guide](https://nextjs.org/docs/app/getting-started/caching) -- caching behavior changes in Next.js 15
- [Next.js Authentication Guide](https://nextjs.org/docs/app/guides/authentication) -- defense-in-depth, middleware vs data access layer
- [CVE-2025-29927 Postmortem (Vercel)](https://vercel.com/blog/postmortem-on-next-js-middleware-bypass) -- middleware bypass vulnerability, why middleware alone is not sufficient for auth
- [CVE-2025-29927 Technical Analysis (ProjectDiscovery)](https://projectdiscovery.io/blog/nextjs-middleware-authorization-bypass) -- detailed exploit mechanics
- [Supabase PostgREST Transactions Discussion (GitHub #526)](https://github.com/orgs/supabase/discussions/526) -- why PostgREST has no transactions, RPC alternative
- [OpenNext Caching Documentation](https://opennext.js.org/aws/inner_workings/caching) -- CloudFront caching behavior with Next.js

---
*Pitfalls research for: Next.js 15 + Supabase intranet app refactoring*
*Researched: 2026-04-10*
