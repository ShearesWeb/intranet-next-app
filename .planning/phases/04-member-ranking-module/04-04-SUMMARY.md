---
phase: 04-member-ranking-module
plan: 04
subsystem: ui
tags: [react, nextjs, vitest, ranking, hooks, feature-module]
requires:
  - phase: 04-01
    provides: canonical ranking contracts and feature-local ranking helper foundations
provides:
  - Pure ranking editor helpers with shared ranking constants and API response normalization
  - Feature-local useRankingEditor hook for fetch/save/change-detection orchestration
  - Reusable position ranking card plus a thin rankMembers composition page
affects: [04-05, member-ranking, rankings-api, rankMembers]
tech-stack:
  added: []
  patterns:
    - Feature-local ranking editor orchestration through a dedicated hook
    - Per-position table rendering through a reusable ranking card component
    - Pure ranking helper coverage before page-level refactor changes
key-files:
  created:
    - src/features/ranking/utils/ranking-editor.ts
    - src/features/ranking/utils/ranking-editor.test.ts
    - src/features/ranking/hooks/use-ranking-editor.ts
    - src/features/ranking/hooks/use-ranking-editor.test.tsx
    - src/features/ranking/components/position-ranking-card.tsx
  modified:
    - src/app/dashboard/mycca/admin/rankMembers/[ccaName]/page.tsx
key-decisions:
  - "Kept the rankMembers page focused on routing, page chrome, and empty/loading states while useRankingEditor owns all fetch/save and ranking recalculation behavior."
  - "Reused the extracted ranking-editor helpers for normalization, grouping, diffing, and chunking instead of re-implementing any page math in the hook or component."
  - "Used a local ReactDOM hook harness in Vitest rather than adding a new testing dependency, keeping the plan inside the existing repo toolchain."
patterns-established:
  - "Ranking editor pages can mirror the Phase 03 pattern: hook for data/mutations, component for repeated table UI, page for composition only."
  - "Ranking editor save flows preserve existing endpoint URLs and user-facing toast strings while delegating payload chunking to pure helpers."
requirements-completed: [RANK-02]
duration: 1h 37m
completed: 2026-04-11
---

# Phase 4 Plan 4: Ranking editor extraction summary

**Feature-local ranking editor helpers, hook-driven save orchestration, and reusable per-position cards now replace the monolithic chair ranking page**

## Performance

- **Duration:** 1h 37m
- **Started:** 2026-04-11T15:58:55Z
- **Completed:** 2026-04-11T17:36:24Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Extracted the rankMembers page ranking math, snapshot diffing, payload chunking, and API member normalization into `src/features/ranking/utils/ranking-editor.ts` with focused Vitest coverage.
- Added `useRankingEditor` so the ranking page now reads fetch/save state, grouped members, and change detection from a feature-local hook.
- Created `PositionRankingCard` and reduced the rankMembers page to a 76-line composition layer that preserves the existing UI strings, table structure, and save behavior.

## Task Commits

Each task was committed atomically:

1. **Task 1: Extract pure ranking editor helpers and lock their behavior with unit tests** - `ca24397`, `4824702` (test, feat)
2. **Task 2: Create useRankingEditor and PositionRankingCard, then shrink the rankMembers page to composition only** - `abacb8b` (feat)

**Plan metadata:** pending final documentation commit

_Note: Task 1 followed TDD, so it produced separate RED and GREEN commits._

## Files Created/Modified
- `src/features/ranking/utils/ranking-editor.ts` - Pure ranking editor helpers for recalculation, grouping, diffing, chunking, formatting, and API-response normalization.
- `src/features/ranking/utils/ranking-editor.test.ts` - Regression tests for sports and resident ranking logic plus payload diffing and chunk overflow behavior.
- `src/features/ranking/hooks/use-ranking-editor.ts` - Feature-local ranking editor hook that owns GET/POST flows, change detection, grouping, and save feedback.
- `src/features/ranking/hooks/use-ranking-editor.test.tsx` - Hook tests for successful loads, failed saves, and ranking recomputation after field edits.
- `src/features/ranking/components/position-ranking-card.tsx` - Reusable per-position ranking card that preserves the existing table headers, selects, textarea styling, and remarks editing.
- `src/app/dashboard/mycca/admin/rankMembers/[ccaName]/page.tsx` - Thin composition page that renders page controls, status alerts, and one `PositionRankingCard` per group.

## Decisions Made
- Kept `layout.tsx` untouched because it already preserved the required `isCoreServiceEnabled("memberRanking", { isJcrc: user?.is_jcrc })` gate and disabled-state return exactly as specified.
- Let `useRankingEditor` surface save failures through its `error` state in addition to toasts so the extracted logic remains observable in tests and future composition layers.
- Kept the existing `/api/cca/${ccaId}/rankings` GET/POST URLs and success strings unchanged while moving orchestration into the hook, preserving behavioral parity during the refactor.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Replaced a missing hook-test dependency with a local ReactDOM harness**
- **Found during:** Task 2 (Create useRankingEditor and PositionRankingCard, then shrink the rankMembers page to composition only)
- **Issue:** `@testing-library/react` is not installed in this repository, so the first hook-test implementation could not run.
- **Fix:** Reworked `use-ranking-editor.test.tsx` to render the hook through a lightweight local ReactDOM harness using the existing React/Vitest stack.
- **Files modified:** `src/features/ranking/hooks/use-ranking-editor.test.tsx`
- **Verification:** `npx vitest run src/features/ranking/utils/ranking-editor.test.ts src/features/ranking/hooks/use-ranking-editor.test.tsx`; `npm run build`
- **Committed in:** `abacb8b` (part of task commit)

**2. [Rule 3 - Blocking] Narrowed ranking API fields to the shared member enum types for production build safety**
- **Found during:** Task 2 (Create useRankingEditor and PositionRankingCard, then shrink the rankMembers page to composition only)
- **Issue:** `npm run build` failed because `RankingsApiMember` exposes `cut_status` and `commitment_period` as route strings, while `CCAMember` expects the shared CCA enum types.
- **Fix:** Updated `mapRankingsApiMemberToEditorMember` to normalize those fields to the shared `CutStatus` and `CommitmentPeriod` types during editor mapping.
- **Files modified:** `src/features/ranking/utils/ranking-editor.ts`
- **Verification:** `npx vitest run src/features/ranking/utils/ranking-editor.test.ts src/features/ranking/hooks/use-ranking-editor.test.tsx`; `npm run build`
- **Committed in:** `abacb8b` (part of task commit)

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Both fixes were required to complete the refactor within the existing toolchain and keep the extracted ranking flow build-safe. No scope creep.

## Authentication Gates

None.

## Known Stubs

None.

## Threat Flags

None.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Plan 04-05 can now clean up the ranking route and related save flows against a stable feature-local hook/component boundary instead of a 600+ line page.
- The rankMembers page is below the 150-line target and now imports only feature-local ranking modules for its editing workflow.
- Shared tracking files were intentionally left untouched for the orchestrator.

## Self-Check: PASSED

- FOUND: `.planning/phases/04-member-ranking-module/04-04-SUMMARY.md`
- FOUND: commit `ca24397`
- FOUND: commit `4824702`
- FOUND: commit `abacb8b`

---
*Phase: 04-member-ranking-module*
*Completed: 2026-04-11*
