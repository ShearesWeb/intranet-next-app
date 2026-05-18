---
phase: 04-member-ranking-module
plan: 01
subsystem: ui
tags: [nextjs, typescript, vitest, ranking, feature-module]
requires:
  - phase: 03-cca-management-module
    provides: feature-module layout, direct feature imports, and colocated type/utility conventions
provides:
  - canonical ranking domain contracts under src/features/ranking/types
  - feature-local ranking metrics and comment helpers under src/features/ranking/utils
  - regression coverage for ranking metric selection, score totals, and comment serialization behavior
affects: [04-02 recap extraction, 04-04 ranking editor extraction, 04-05 ranking route cleanup]
tech-stack:
  added: []
  patterns: [feature-owned ranking contracts, feature-local helper migration, ranking regression tests]
key-files:
  created:
    - src/features/ranking/types/ranking.ts
    - src/features/ranking/types/ranking-api.ts
    - src/features/ranking/utils/cca-ranking-metrics.test.ts
    - src/features/ranking/utils/cca-ranking-comments.test.ts
  modified:
    - src/features/ranking/utils/cca-ranking-metrics.ts
    - src/features/ranking/utils/cca-ranking-comments.ts
    - src/app/dashboard/mycca/admin/rankMembers/[ccaName]/page.tsx
    - src/app/api/cca/[ccaId]/rankings/route.ts
    - src/components/dashboard/points-recap-card.tsx
    - src/app/api/cca/[ccaId]/updateMember/route.ts
key-decisions:
  - "Ranking page constants and domain contracts now come from src/features/ranking/types/ranking as the canonical source for later ranking plans."
  - "The ranking route now imports shared API contracts from src/features/ranking/types/ranking-api instead of re-declaring them inline."
  - "Two remaining helper consumers outside the planned file list were repointed to feature-local imports so deleting src/lib copies would not break the build."
patterns-established:
  - "Ranking-specific helpers live under src/features/ranking/utils and are imported directly from feature paths."
  - "Pure ranking helper behavior is locked with local Vitest files before larger ranking UI decomposition starts."
requirements-completed: [RANK-02]
duration: 8 min
completed: 2026-04-11
---

# Phase 4 Plan 1: Ranking module foundation: shared types plus migrated metrics/comment helpers Summary

**Shared ranking contracts, feature-local scoring/comment helpers, and regression tests now anchor the member-ranking refactor on stable `@/features/ranking/...` imports**

## Performance

- **Duration:** 8 min
- **Started:** 2026-04-11T15:03:39Z
- **Completed:** 2026-04-11T15:11:53Z
- **Tasks:** 3
- **Files modified:** 10

## Accomplishments
- Created canonical ranking contracts in `src/features/ranking/types/` for page, route, and later hook/component plans.
- Moved ranking metrics and ranking comment serialization into `src/features/ranking/utils/` and rewired current consumers to the feature-local paths.
- Added focused Vitest regression coverage for sports/culture/resident metric handling and legacy ranking-comment fallback behavior.

## Task Commits

Each task was committed atomically:

1. **Task 1: Create the shared ranking contract files that later plans will import** - `335098d` (refactor)
2. **Task 2: Migrate ranking metrics/comment helpers into the feature module and update current consumers** - `519acd3` (refactor)
3. **Task 3: Add regression tests for migrated metrics and comment serialization helpers** - `2b79ede` (test)

**Plan metadata:** pending final documentation commit

## Files Created/Modified
- `src/features/ranking/types/ranking.ts` - Canonical member ranking contracts and constants for the ranking UI.
- `src/features/ranking/types/ranking-api.ts` - Shared route-facing ranking payload and response contracts.
- `src/features/ranking/utils/cca-ranking-metrics.ts` - Feature-local ranking metric selection and score helpers.
- `src/features/ranking/utils/cca-ranking-comments.ts` - Feature-local ranking comment parsing and serialization helpers.
- `src/features/ranking/utils/cca-ranking-metrics.test.ts` - Regression tests for ranking metric keys, required-input checks, and score totals.
- `src/features/ranking/utils/cca-ranking-comments.test.ts` - Regression tests for empty comment parsing, legacy fallback behavior, and comment serialization.
- `src/app/dashboard/mycca/admin/rankMembers/[ccaName]/page.tsx` - Now imports canonical ranking contracts/constants and feature-local metric helpers.
- `src/app/api/cca/[ccaId]/rankings/route.ts` - Now imports shared ranking API contracts plus feature-local metrics/comment helpers.
- `src/components/dashboard/points-recap-card.tsx` - Import path updated to the feature-local ranking metrics helper to keep the build green after migration.
- `src/app/api/cca/[ccaId]/updateMember/route.ts` - Import path updated to the feature-local ranking comments helper to keep the build green after migration.

## Decisions Made
- Kept the ranking page's local response typing in place for now, while moving the reusable page contracts/constants into `ranking.ts` and the route contracts into `ranking-api.ts`, so later plans can adopt the shared sources incrementally without behavior changes in this foundation step.
- Treated the remaining `points-recap-card` and `updateMember` helper imports as blocking fallout from deleting the old `src/lib` files, so they were rewritten immediately to preserve a passing build.
- Treated Task 3 as regression coverage against already-preserved helper behavior; the new tests passed immediately, so the task completed with a single test commit rather than requiring a follow-up implementation commit.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Rewired remaining ranking helper consumers outside the primary task file list**
- **Found during:** Task 2 (Migrate ranking metrics/comment helpers into the feature module and update current consumers)
- **Issue:** Deleting `src/lib/cca-ranking-metrics.ts` and `src/lib/cca-ranking-comments.ts` caused `npm run build` to fail because `src/components/dashboard/points-recap-card.tsx` and `src/app/api/cca/[ccaId]/updateMember/route.ts` still imported the legacy paths.
- **Fix:** Updated those two import sites to the new `@/features/ranking/utils/...` paths without changing any runtime logic.
- **Files modified:** `src/components/dashboard/points-recap-card.tsx`, `src/app/api/cca/[ccaId]/updateMember/route.ts`
- **Verification:** `npm run build`; `grep` counts for legacy helper imports under `src/app` and `src/components` returned no matches.
- **Committed in:** `519acd3` (part of task commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** The extra import rewrites were necessary to complete the planned helper migration safely. No behavior or scope changes beyond keeping the repository buildable.

## Authentication Gates

None.

## Known Stubs

None.

## Threat Flags

None.

## Issues Encountered

- Task 3's planned TDD RED step did not produce a failing test because the migrated helper behavior already matched the required regression scenarios; I recorded the regression suite in a single test commit and verified it passes.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Later ranking plans can now import canonical contracts from `src/features/ranking/types/` and feature-local helpers from `src/features/ranking/utils/` instead of re-declaring inline shapes.
- The repository build passes with no remaining `@/lib/cca-ranking-metrics` or `@/lib/cca-ranking-comments` imports under `src/app` or `src/components`.
- Ranking helper regression tests are in place before the larger recap and ranking page decomposition plans begin.

## Self-Check: PASSED

- Verified `.planning/phases/04-member-ranking-module/04-01-SUMMARY.md` exists on disk.
- Verified task commits `335098d`, `519acd3`, and `2b79ede` exist in git history.

---
*Phase: 04-member-ranking-module*
*Completed: 2026-04-11*
