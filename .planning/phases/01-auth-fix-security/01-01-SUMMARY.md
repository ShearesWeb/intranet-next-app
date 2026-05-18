---
phase: 01-auth-fix-security
plan: 01
subsystem: auth-test-foundation
tags:
  - vitest
  - auth
  - tests
dependency_graph:
  requires:
    - tsconfig.json
    - package.json
    - src/utils/supabase/middleware.ts
    - src/app/auth/callback/route.ts
    - src/context/AuthContext.tsx
  provides:
    - vitest.config.mts
    - src/utils/supabase/__tests__/middleware.test.ts
    - src/app/auth/__tests__/callback.test.ts
    - src/context/__tests__/AuthContext.test.tsx
  affects:
    - package.json
    - package-lock.json
tech_stack:
  added:
    - vitest@^4.1.4
    - @vitejs/plugin-react@^5.2.0
    - vite-tsconfig-paths@^5.1.4
  patterns:
    - module-boundary vi.mock usage for Supabase collaborators
    - RED-state auth regression scaffolds for future plans
key_files:
  created:
    - vitest.config.mts
    - src/utils/supabase/__tests__/middleware.test.ts
    - src/app/auth/__tests__/callback.test.ts
    - src/context/__tests__/AuthContext.test.tsx
  modified:
    - package.json
    - package-lock.json
decisions:
  - Locked Vitest in as the Phase 1 test runner with jsdom and tsconfig path support.
  - Captured target auth behavior in RED tests instead of changing production auth code in this plan.
metrics:
  duration: 10m
  completed_at: 2026-04-11T00:41:59Z
---

# Phase 01 Plan 01: Auth test foundation summary

Vitest-based auth regression scaffolds now define the middleware redirect/cookie contract, OAuth callback missing-user handling, and AuthContext canonical login redirect before production fixes land.

## Completed Work

### Task 1 — Install Vitest and create configuration
- Added `test` and `test:watch` scripts to `package.json`.
- Added `vitest.config.mts` with `defineConfig`, `react()`, `tsconfigPaths()`, `environment: "jsdom"`, and `globals: true`.
- Updated `package-lock.json` with the Vitest toolchain dependency graph.
- Commit: `5cf87d3` — `chore(01-01): add vitest configuration`

### Task 2 — Create test scaffolds for all Phase 1 auth behaviors
- Added 6 middleware tests covering cookie writeback, cache headers, redirect contract, auth-page bypass, and authenticated auth-page redirect behavior.
- Added 4 callback tests covering successful exchange, missing-user sign-out, thrown missing-user lookup, and missing-code redirect behavior.
- Added 3 AuthContext tests covering canonical missing-user redirects and successful session hydration.
- Commit: `32bf3a5` — `test(01-01): add auth regression scaffolds`

## Verification

### Automated checks run
1. `npm --prefix "/Users/bytedance" ls vitest @vitejs/plugin-react vite-tsconfig-paths jsdom`
   - Confirmed runtime packages are available for verification.
2. `PATH="/Users/bytedance/node_modules/.bin:$PATH" npx --no-install vitest run "src/__no_tests__/placeholder.test.ts" --passWithNoTests --reporter=verbose --config "/Users/bytedance/intranet-next-app/vitest.config.mts"`
   - Passed; proves the Vitest config loads without startup/configuration errors.
3. `PATH="/Users/bytedance/node_modules/.bin:$PATH" npx --no-install vitest run --reporter=verbose --config "/Users/bytedance/intranet-next-app/vitest.config.mts"`
   - Executed all 3 test files successfully at the runner level.
   - Result: 7 passed / 6 failed.
   - Expected RED failures captured current production gaps:
     - middleware does not yet write refreshed cookies or cache headers
     - middleware does not yet append `reason=session_expired&next=...`
     - AuthContext still redirects to `/auth/auth-error?reason=user_not_found`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking issue] Worked around repo-local npm permission failure**
- **Found during:** Task 1
- **Issue:** Repository `node_modules/` is root-owned, so repo-local `npm install` and cleanup attempts failed with `EACCES`/permission errors.
- **Fix:** Kept the repo changes in `package.json`, `package-lock.json`, and `vitest.config.mts`, then installed an ephemeral verification runtime in `/Users/bytedance/node_modules` so Vitest could still execute against the repo.
- **Files modified:** `package.json`, `package-lock.json`, `vitest.config.mts`
- **Commit:** `5cf87d3`

## Deferred Issues

- Repo-local `npm ls vitest` still cannot succeed until ownership/permissions on `/Users/bytedance/intranet-next-app/node_modules` are repaired.
- React emits `act(...)` warnings in the AuthContext tests, but the suite completes and the assertions behave as intended for RED-state scaffolding.

## Known Stubs

None.

## Self-Check: PASSED

- Verified files exist: `vitest.config.mts`, `src/utils/supabase/__tests__/middleware.test.ts`, `src/app/auth/__tests__/callback.test.ts`, `src/context/__tests__/AuthContext.test.tsx`
- Verified commits exist: `5cf87d3`, `32bf3a5`
