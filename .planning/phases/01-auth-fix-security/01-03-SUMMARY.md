---
phase: 01-auth-fix-security
plan: 03
subsystem: auth
tags:
  - auth
  - redirects
  - oauth
  - vitest
  - cleanup
requires:
  - phase: 01-02
    provides: Supabase SSR middleware refresh contract and login reason=session_expired flow
provides:
  - Canonical /auth/login redirects for AuthContext and OAuth callback failures
  - Login-form messaging for user_not_found, session_expired, no_code, and code_exchange_failed reasons
  - Removal of the legacy withAuth HOC and testPage consumer
affects:
  - auth
  - oauth-callback
  - login-ux
  - middleware
tech-stack:
  added: []
  patterns:
    - canonical login redirect reasons across client and callback auth flows
    - middleware plus AuthContext as the only auth enforcement patterns
    - compatibility shim for Supabase SSR setAll headers during current build type-checking
key-files:
  created:
    - .planning/phases/01-auth-fix-security/01-03-SUMMARY.md
  modified:
    - src/app/auth/__tests__/callback.test.ts
    - src/context/AuthContext.tsx
    - src/app/auth/callback/route.ts
    - src/components/auth/login-form.tsx
    - src/utils/supabase/middleware.ts
  deleted:
    - src/hoc/withAuth.tsx
    - src/app/testPage/page.tsx
key-decisions:
  - Missing-user, expired-session, and callback failure flows now converge on /auth/login with reason params instead of splitting between login and auth-error.
  - The legacy withAuth HOC was removed completely rather than kept as a temporary client-side guard.
  - Middleware keeps a backward-compatible arguments[1] header shim so the current @supabase/ssr typing mismatch does not break production builds while preserving cache-header propagation in tests/runtime.
requirements-completed:
  - AUTH-03
  - AUTH-04
duration: 5m
completed: 2026-04-11
---

# Phase 01 Plan 03: Auth redirect consolidation and HOC removal summary

**Auth now relies on exactly two patterns—middleware and AuthContext—while every missing-user or expired-session flow returns users to `/auth/login` with a consistent reason contract.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-04-11T00:52:31Z
- **Completed:** 2026-04-11T00:57:22Z
- **Tasks:** 2
- **Files modified:** 5
- **Files deleted:** 2

## Accomplishments

- Updated the AuthContext redirect contract to send missing or mismatched users to `/auth/login?reason=user_not_found`.
- Updated the OAuth callback so no-code and code-exchange failures also return to `/auth/login` instead of `/auth/auth-error`.
- Expanded login-form reason handling so the sign-in page can explain `user_not_found`, `session_expired`, `no_code`, and `code_exchange_failed` flows.
- Removed the obsolete `withAuth` HOC and its last `testPage` consumer so auth enforcement is limited to middleware plus AuthContext.
- Preserved build health by making the middleware `setAll` callback compatible with the installed `@supabase/ssr` type signature while still honoring the header argument at runtime/tests.

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: add failing auth redirect regressions** - `fdd09c0` (test)
2. **Task 1 GREEN: unify auth redirects on the login flow** - `24dc5e6` (feat)
3. **Task 2: remove withAuth and testPage, plus build-blocking middleware compatibility fix** - `47968e0` (fix)

## Files Created/Modified

- `src/app/auth/__tests__/callback.test.ts` - updated callback redirect expectations and added code-exchange failure coverage.
- `src/context/AuthContext.tsx` - switched missing-user redirect target from `/auth/auth-error` to `/auth/login`.
- `src/app/auth/callback/route.ts` - redirected no-code and code-exchange failure paths to `/auth/login`.
- `src/components/auth/login-form.tsx` - mapped all supported `reason` query params to user-facing toast messages.
- `src/utils/supabase/middleware.ts` - used `arguments[1]` to preserve optional header handling without violating the installed SSR type signature.
- `src/hoc/withAuth.tsx` - deleted redundant client-side auth HOC.
- `src/app/testPage/page.tsx` - deleted last HOC consumer.

## Verification

### Automated checks run
1. `npx vitest run src/context/__tests__/AuthContext.test.tsx src/app/auth/__tests__/callback.test.ts --reporter=verbose`
   - Passed after implementation: 8/8 tests green.
2. `npx vitest run src/utils/supabase/__tests__/middleware.test.ts --reporter=verbose`
   - Passed: 6/6 middleware tests green after the compatibility shim.
3. `npx vitest run src/context/__tests__/AuthContext.test.tsx src/app/auth/__tests__/callback.test.ts src/utils/supabase/__tests__/middleware.test.ts --reporter=verbose`
   - Passed: 14/14 auth regression tests green.
4. `npm run build`
   - Passed production build and type-check after the middleware callback signature fix.
5. Source verification
   - Confirmed no `auth-error` references remain in `src/context/` or `src/app/auth/callback/`.
   - Confirmed no `withAuth`, `testPage`, or `from.*hoc/` references remain under `src/`.
   - Confirmed `src/hoc/withAuth.tsx`, `src/app/testPage/page.tsx`, `src/hoc/`, and `src/app/testPage/` no longer exist.

## Decisions Made

- Kept `/auth/auth-error` intact for now, but removed it from active auth recovery flows so `/auth/login` becomes the canonical path per the phase decisions.
- Treated the middleware build failure as a blocking issue for this plan because Task 2 explicitly required a successful build after the auth cleanup.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed Supabase middleware callback typing so the build could pass**
- **Found during:** Task 2 verification (`npm run build`)
- **Issue:** `src/utils/supabase/middleware.ts` used a two-argument `setAll` callback signature that the installed `@supabase/ssr` types reject during Next.js type-checking.
- **Fix:** Changed the callback signature to the installed one-argument form and read the optional headers object through `arguments[1]`, preserving runtime/test header propagation without breaking type-checking.
- **Files modified:** `src/utils/supabase/middleware.ts`
- **Verification:** `npx vitest run src/utils/supabase/__tests__/middleware.test.ts --reporter=verbose` and `npm run build`
- **Committed in:** `47968e0`

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** No scope expansion; the deviation was required to satisfy the plan's build-success acceptance criteria.

## Issues Encountered

- `npm run build` initially failed on a Supabase SSR callback typing mismatch in middleware; this was resolved inline without changing plan scope.

## Known Stubs

None.

## Threat Flags

None.

## Next Phase Readiness

- Auth enforcement is now reduced to middleware plus AuthContext, which matches the phase target architecture.
- Login error handling is unified around `reason` query params, so the final verification plan can validate a single recovery contract.

## Self-Check: PASSED

- Verified files exist: `.planning/phases/01-auth-fix-security/01-03-SUMMARY.md`, `src/context/AuthContext.tsx`, `src/app/auth/callback/route.ts`, `src/components/auth/login-form.tsx`, `src/utils/supabase/middleware.ts`
- Verified deletions: `src/hoc/withAuth.tsx`, `src/app/testPage/page.tsx`
- Verified commits exist: `fdd09c0`, `24dc5e6`, `47968e0`
