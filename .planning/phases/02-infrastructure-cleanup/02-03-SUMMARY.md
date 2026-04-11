---
phase: 02-infrastructure-cleanup
plan: 03
subsystem: infra
tags: [typescript, eslint, nextjs, supabase, build]

# Dependency graph
requires:
  - phase: 02-01
    provides: toast migration baseline and dependency cleanup context
  - phase: 02-02
    provides: extracted managed CCA data flow and TypeScript cleanup groundwork
provides:
  - typed Supabase join contracts for member management, holiday subsidy, and sports/culture flows
  - lint-clean Next.js build enforcement with no `ignoreDuringBuilds` escape hatch
  - removal of stale eslint suppressions blocking future refactors
affects: [phase-03-cca-management-module, phase-04-ranking-module, phase-05-allocation-module, phase-06-holiday-subsidy-module]

# Tech tracking
tech-stack:
  added: []
  patterns: [domain type files in src/types, ESLint-enforced production builds, explicit relation unwrapping for Supabase joins]

key-files:
  created:
    - src/types/cca-members.ts
    - src/types/holiday-subsidy-api.ts
    - src/types/sports-culture.ts
  modified:
    - src/app/dashboard/mycca/admin/manageMembers/[ccaName]/page.tsx
    - src/app/api/cca/[ccaId]/members/route.ts
    - src/app/api/holidaySubsidy/weekly/[ccaId]/[weekId]/route.ts
    - src/components/table/ordering-table.tsx
    - next.config.mjs
    - src/utils/supabase/middleware.ts

key-decisions:
  - "Centralized new query-shape interfaces under src/types by domain instead of scattering inline route types."
  - "Kept dormant helper code (authorizeJCRC and recap image download) in place while making ESLint treat it as intentionally retained code."

patterns-established:
  - "Use dedicated relation helper types plus local unwrap helpers for Supabase join results."
  - "Treat lint-clean builds as a hard gate instead of bypassing ESLint in next.config.mjs."

requirements-completed: [INFR-04, INFR-05]

# Metrics
duration: 3 min
completed: 2026-04-11
---

# Phase 2 Plan 03: Type safety and ESLint build gate Summary

**Typed Supabase join contracts across CCA and holiday-subsidy flows with ESLint-enforced Next.js production builds.**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-11T03:50:27Z
- **Completed:** 2026-04-11T03:53:39Z
- **Tasks:** 2
- **Files modified:** 21

## Accomplishments
- Added three domain type files to replace inline `any` usage with named interfaces.
- Removed all `no-explicit-any` suppressions and restored `npx tsc --noEmit` to a green state.
- Removed the Next.js ESLint bypass, fixed the remaining lint issues, and verified `npm run build` succeeds with linting enabled.

## Task Commits

Each task was committed atomically:

1. **Task 1: Create type definition files and replace all 27 any suppressions** - `0caa15f` (feat)
2. **Task 2: Fix remaining ESLint violations and enable build enforcement** - `0f5b17a` (fix)

## Files Created/Modified
- `src/types/cca-members.ts` - shared types for CCA member management state and route joins.
- `src/types/holiday-subsidy-api.ts` - typed holiday subsidy join/result contracts.
- `src/types/sports-culture.ts` - sports/culture appointment relation types.
- `src/app/dashboard/mycca/admin/manageMembers/[ccaName]/page.tsx` - replaced `any` state/callback annotations with typed state and safe error handling.
- `src/app/api/cca/[ccaId]/members/route.ts` - typed Supabase join rows for member transforms.
- `src/app/api/cca/[ccaId]/updateMember/route.ts` - replaced dynamic update object with typed payload.
- `src/app/api/holidaySubsidy/weekly/[ccaId]/[weekId]/route.ts` - typed appointment, subsidy, and submission mapping.
- `src/app/api/holidaySubsidy/approvals/weekly/[ccaId]/[weekId]/route.ts` - typed approval submission joins while preserving dormant auth helper.
- `src/app/api/holidaySubsidy/declarations/[ccaId]/route.ts` - removed stale unused-var suppression and made response shaping explicit.
- `src/app/api/sportsCulture/available/route.ts` - typed sports/culture appointment joins.
- `src/components/table/ordering-table.tsx` - replaced `any` cell values with `unknown` while keeping generic consumers compatible.
- `src/utils/supabase/middleware.ts` - replaced `arguments[1]` shim with rest-parameter handling.
- `next.config.mjs` - removed `ignoreDuringBuilds` so builds now fail on lint regressions.

## Decisions Made
- Centralized all new join/result contracts under `src/types/` so later refactor phases can import stable domain types instead of rebuilding query shapes.
- Preserved currently-unused helper code in the approval and recap flows, but marked it as intentional to keep the lint gate clean without deleting future-facing logic.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Repaired downstream TypeScript fallout from stricter shared typing**
- **Found during:** Task 1 (Create type definition files and replace all 27 any suppressions)
- **Issue:** Tightening shared table generics and relation typing surfaced compile failures in `AuthContext` and managed-CCA tests.
- **Fix:** Relaxed the ordering table generic to `object` with typed accessor reads and updated the affected tests/fixtures to match current application types.
- **Files modified:** `src/components/table/ordering-table.tsx`, `src/context/__tests__/AuthContext.test.tsx`, `src/lib/__tests__/managed-cca-data.test.ts`
- **Verification:** `npx tsc --noEmit --project /Users/bytedance/intranet-next-app/tsconfig.json`
- **Committed in:** `0caa15f`

**2. [Rule 3 - Blocking] Adjusted lint fixes to match the repository's actual no-unused-vars behavior**
- **Found during:** Task 2 (Fix remaining ESLint violations and enable build enforcement)
- **Issue:** Removing stale directives exposed that this ESLint config still flags underscore-prefixed unused values, so the planned underscore-only approach did not pass.
- **Fix:** Removed unused route parameters entirely, used explicit `void` references for intentionally retained helpers, and reshaped subsidy declarations without unused destructuring.
- **Files modified:** `src/app/api/user/checkRole/route.ts`, `src/app/api/chair/positions/forChair/route.ts`, `src/app/api/user/getRankablePositions/[email]/route.ts`, `src/app/api/holidaySubsidy/approvals/weekly/[ccaId]/[weekId]/route.ts`, `src/app/api/holidaySubsidy/declarations/[ccaId]/route.ts`, `src/components/dashboard/points-recap-card.tsx`, `src/app/api/sportsCulture/available/route.ts`
- **Verification:** `npx eslint /Users/bytedance/intranet-next-app/src --report-unused-disable-directives` and `npm --prefix /Users/bytedance/intranet-next-app run build`
- **Committed in:** `0f5b17a`

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Both deviations were verification-driven corrections needed to satisfy the plan's TypeScript and build gates. No scope creep.

## Issues Encountered
- The plan referenced two route paths that no longer exist (`src/app/api/chair/forChair/route.ts` and `src/app/api/chair/getRankablePositions/[email]/route.ts`). The equivalent live routes were `src/app/api/chair/positions/forChair/route.ts` and `src/app/api/user/getRankablePositions/[email]/route.ts`, and those were updated instead.

## Known Stubs
- `src/components/dashboard/points-recap-card.tsx:748` - TODO marker keeps the unused recap-download helper discoverable for a later ranking/recap reconnect; it does not block this plan's lint/build goal.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 2 now has typed member/subsidy/sports-culture data contracts and an enforced lint gate, reducing refactor risk for the remaining feature phases.
- Plan `02-04` can build on this baseline without reintroducing `any` suppressions or hidden lint debt.

## Self-Check: PASSED
- Found `.planning/phases/02-infrastructure-cleanup/02-03-SUMMARY.md`
- Found commit `0caa15f`
- Found commit `0f5b17a`

---
*Phase: 02-infrastructure-cleanup*
*Completed: 2026-04-11*
