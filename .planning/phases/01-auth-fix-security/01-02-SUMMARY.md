---
phase: 01-auth-fix-security
plan: 02
subsystem: auth
tags:
  - supabase
  - ssr
  - middleware
  - nextjs
  - vitest
requires:
  - phase: 01-01
    provides: Vitest auth regression coverage for middleware behavior
provides:
  - Supabase package upgrades to @supabase/ssr 0.10.2 and @supabase/supabase-js 2.103.0
  - Middleware dual cookie-write for refreshed SSR auth tokens
  - Cache-control header propagation from Supabase SSR setAll headers
  - Login redirect contract preserving reason=session_expired and next destination
affects:
  - auth
  - middleware
  - server-side-supabase-client
tech-stack:
  added: []
  patterns:
    - dual cookie-write via request.cookies.set plus response.cookies.set
    - middleware-owned cache-control propagation for authenticated SSR responses
key-files:
  created: []
  modified:
    - package.json
    - package-lock.json
    - src/utils/supabase/middleware.ts
    - src/utils/supabase/server.ts
key-decisions:
  - Middleware now applies Supabase SSR v0.10.2 cache headers while server.ts keeps header handling out of Server Components.
  - Redirects for expired or missing dashboard sessions now always preserve context with reason=session_expired and next.
patterns-established:
  - "Refresh tokens must be written to both the mutable request and outgoing response during middleware refresh."
  - "Server cookie writes remain opt-in via allowCookieWrite and are guarded with try/catch for read-only Server Component contexts."
requirements-completed:
  - AUTH-01
  - AUTH-02
duration: 5m
completed: 2026-04-11
---

# Phase 01 Plan 02: Supabase SSR auth hardening summary

**Supabase SSR 0.10.2 now refreshes auth cookies into both the request and browser response while attaching no-cache headers and preserving dashboard login recovery context.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-04-11T00:44:32Z
- **Completed:** 2026-04-11T00:49:42Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Upgraded the Supabase auth packages to the planned SSR-compatible versions in both `package.json` and `package-lock.json`.
- Replaced the middleware no-op `setAll` callback with the dual cookie-write pattern required to stop SSR session bleed.
- Applied Supabase-provided cache headers and standardized redirects to `/auth/login?reason=session_expired&next=...` for missing or expired dashboard sessions.

## Task Commits

Each task was committed atomically:

1. **Task 1: Upgrade Supabase packages to target versions** - `004614e` (chore)
2. **Task 2: Fix middleware updateSession with dual cookie-write, cache headers, and redirect contract** - `af9af58` (fix)

## Files Created/Modified
- `package.json` - upgraded declared Supabase auth package ranges.
- `package-lock.json` - locked Supabase SSR 0.10.2, Supabase JS 2.103.0, and related transitive updates.
- `src/utils/supabase/middleware.ts` - restored cookie writeback, applied cache headers, and implemented the redirect contract.
- `src/utils/supabase/server.ts` - kept server cookie writes opt-in and safe for read-only Server Component contexts.

## Verification

### Automated checks run
1. `npm --prefix "/tmp/intranet-next-app-plan-01-02-verify" ci`
   - Installed dependencies in a clean temporary workspace because the repo-local `node_modules` tree is root-owned.
2. `npm --prefix "/tmp/intranet-next-app-plan-01-02-verify" ls @supabase/ssr @supabase/supabase-js`
   - Confirmed `@supabase/ssr@0.10.2` and `@supabase/supabase-js@2.103.0`.
3. `npm --prefix "/tmp/intranet-next-app-plan-01-02-verify" exec -- vitest run src/utils/supabase/__tests__/middleware.test.ts --reporter=verbose`
   - Passed: 6/6 middleware tests green.
4. `npm --prefix "/tmp/intranet-next-app-plan-01-02-verify" run build`
   - Passed production build and type-check.
5. Source verification:
   - `setAll(cookiesToSet, headers)` present in `src/utils/supabase/middleware.ts`
   - `request.cookies.set`, `supabaseResponse.cookies.set`, `supabaseResponse.headers.set`, and `reason=session_expired` confirmed in middleware source.

## Decisions Made
- Accepted `@supabase/supabase-js@2.103.0` as the concrete lockfile resolution because it satisfies the plan requirement of `>= 2.102.1` and the `@supabase/ssr@0.10.2` peer range.
- Kept cache-header application exclusively in middleware, matching the plan's trust boundary between SSR refresh handling and Server Component safety.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Verified in a temporary workspace instead of the repo-local install**
- **Found during:** Task 1 and Task 2 verification
- **Issue:** The repository `node_modules/` tree is root-owned, so direct `npm install` and lockfile-only npm operations fail with `EACCES`.
- **Fix:** Used `/tmp/intranet-next-app-plan-01-02-verify` as a clean verification workspace, ran `npm ci` there, and executed package/version/build checks against the copied repo state.
- **Files modified:** None in the main repository
- **Verification:** `npm ls` and `npm run build` both succeeded in the temporary workspace.
- **Committed in:** N/A (verification-only environment fix)

**2. [Rule 3 - Blocking] Added a temporary jsdom install for Vitest execution**
- **Found during:** Task 2 verification
- **Issue:** Vitest could not start in the temporary workspace because `jsdom` is not declared in the repository manifest, yet the project test config uses the jsdom environment.
- **Fix:** Installed `jsdom` with `--no-save` in the temporary workspace only, then re-ran the middleware suite.
- **Files modified:** None in the main repository
- **Verification:** `vitest run src/utils/supabase/__tests__/middleware.test.ts --reporter=verbose` passed all 6 tests.
- **Committed in:** N/A (verification-only environment fix)

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Verification required environment workarounds, but the repository changes stayed within plan scope and all acceptance checks passed.

## Issues Encountered
- Repo-local package installation is still blocked by root-owned `node_modules`; future in-repo npm operations will continue to fail until ownership is corrected.
- The verification workspace needed a transient `jsdom` install because the repo manifest does not currently declare it even though Vitest is configured for jsdom.

## Known Stubs

None.

## User Setup Required

None - no external service configuration required.

## Threat Flags

None.

## Next Phase Readiness
- The SSR session-bleed fix is implemented and covered by the existing middleware regression suite.
- Future auth plans can build on the new redirect contract and middleware cache-header behavior.

## Self-Check: PASSED

- Verified files exist: `.planning/phases/01-auth-fix-security/01-02-SUMMARY.md`, `package.json`, `package-lock.json`, `src/utils/supabase/middleware.ts`, `src/utils/supabase/server.ts`
- Verified commits exist: `004614e`, `af9af58`

---
*Phase: 01-auth-fix-security*
*Completed: 2026-04-11*
