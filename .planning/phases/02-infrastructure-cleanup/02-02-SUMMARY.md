---
phase: 02-infrastructure-cleanup
plan: 02
subsystem: api
tags: [nextjs, supabase, vitest, api-routes, managed-cca]
requires:
  - phase: 01-auth-fix-security
    provides: SSR-safe Supabase auth flow and shared authenticated user loading via fetchUserInfo
provides:
  - Extracted managed CCA business logic in a reusable lib function
  - Thin getManagedCCAs wrapper endpoint for existing client consumers
  - Direct lib-based managed CCA loading in getCCAs, rankings/all, and managedPositions routes
  - Unit coverage for empty, merge, transform, and sorting behavior
affects: [02-03, ranking-routes, cca-management, shared-api-logic]
tech-stack:
  added: []
  patterns:
    - Pass the authenticated Supabase server client and hydrated user into shared lib functions instead of self-calling API routes
    - Keep route handlers responsible for auth and HTTP responses while moving reusable data transformation into src/lib
key-files:
  created:
    - src/lib/managed-cca-data.ts
    - src/lib/__tests__/managed-cca-data.test.ts
    - .planning/phases/02-infrastructure-cleanup/02-02-SUMMARY.md
  modified:
    - src/app/api/user/getManagedCCAs/route.ts
    - src/app/api/user/getCCAs/route.ts
    - src/app/api/cca/rankings/all/route.ts
    - src/app/api/cca/managedPositions/route.ts
key-decisions:
  - "Kept getManagedCCAs as a wrapper endpoint and re-exported the moved types so existing route consumers stay compatible."
  - "Reused the caller's authenticated Supabase client inside getManagedCcaData to preserve RLS behavior without cookie-forwarded self-fetches."
patterns-established:
  - "API route extraction: reusable managed CCA queries now live in src/lib/managed-cca-data.ts and are injected with user plus Supabase context."
  - "TDD for server-side transformations: write behavior-focused Vitest cases first, then implement the shared loader against the verified contract."
requirements-completed: [INFR-03]
duration: 5 min
completed: 2026-04-11
---

# Phase 02 Plan 02: Managed CCA Self-Call Removal Summary

**Managed CCA loading now runs through a shared Supabase-backed lib function, eliminating internal HTTP self-calls while preserving the getManagedCCAs endpoint and its consumer data shapes.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-04-11T03:36:00Z
- **Completed:** 2026-04-11T03:40:53Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Extracted the managed CCA query and transformation logic into `src/lib/managed-cca-data.ts` with exported shared types.
- Added Vitest coverage for the extracted loader's empty-state, transformation, sorting, and chair-merge behavior.
- Replaced internal `/api/user/getManagedCCAs` fetches in three routes with direct function calls while keeping `getManagedCCAs` as a thin wrapper endpoint.

## Task Commits

Each task was committed atomically:

1. **Task 1: Create managed-cca-data lib function with test** - `5efe9b8` (test), `5193c51` (feat)
2. **Task 2: Refactor 4 routes to use getManagedCcaData directly** - `118709c` (refactor)

## Files Created/Modified
- `.planning/phases/02-infrastructure-cleanup/02-02-SUMMARY.md` - Execution summary for this plan.
- `src/lib/managed-cca-data.ts` - Shared managed CCA data loader and exported row types.
- `src/lib/__tests__/managed-cca-data.test.ts` - Unit tests covering the extracted loader contract.
- `src/app/api/user/getManagedCCAs/route.ts` - Thin wrapper endpoint around `getManagedCcaData` with type re-exports for compatibility.
- `src/app/api/user/getCCAs/route.ts` - Replaced internal fetch with a direct managed CCA loader call for rankable CCA detection.
- `src/app/api/cca/rankings/all/route.ts` - Directly loads managed CCA rows from the shared lib instead of self-fetching the route.
- `src/app/api/cca/managedPositions/route.ts` - Directly loads managed CCA rows from the shared lib while preserving `ccaId` filtering behavior.

## Decisions Made
- Kept `getManagedCCAs` as a standalone endpoint and re-exported the moved types to avoid breaking existing imports or client consumers.
- Injected the already-authenticated Supabase client and hydrated user into the shared loader so RLS behavior stays unchanged without HTTP round-trips.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- The initial RED-phase test helper expected an options object and crashed before exercising the missing module case; the helper default parameter was corrected so the intended TDD cycle could proceed.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All known managed CCA self-calling routes now use direct lib imports instead of internal HTTP calls.
- Ready for the remaining Phase 02 infrastructure tasks.

## Self-Check: PASSED

- Found `.planning/phases/02-infrastructure-cleanup/02-02-SUMMARY.md` on disk.
- Verified task commit `5efe9b8` exists in git history.
- Verified task commit `5193c51` exists in git history.
- Verified task commit `118709c` exists in git history.

---
*Phase: 02-infrastructure-cleanup*
*Completed: 2026-04-11*
