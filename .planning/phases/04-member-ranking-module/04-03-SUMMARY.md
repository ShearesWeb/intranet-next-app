---
phase: 04-member-ranking-module
plan: 03
subsystem: ui
tags: [react, nextjs, vitest, hooks, ranking, recap]
requires:
  - phase: 04-01
    provides: Ranking module foundation and feature structure
  - phase: 04-02
    provides: Recap types, slide builder, and useRecapData hook
provides:
  - Recap navigation/audio hooks and RecapSlideContent component
  - Feature-local PointsRecapCard composition under src/features/ranking/components/
affects: [dashboard, member-ranking, recap]
tech-stack:
  added: []
  patterns:
    - Navigation/counter animation isolated in useRecapNavigation hook
    - Audio lifecycle isolated in useRecapAudio hook
    - Slide body rendering isolated in RecapSlideContent component
key-files:
  created:
    - src/features/ranking/hooks/use-recap-navigation.ts
    - src/features/ranking/hooks/use-recap-audio.ts
    - src/features/ranking/hooks/use-recap-navigation.test.tsx
    - src/features/ranking/components/recap-slide-content.tsx
    - src/features/ranking/components/points-recap-card.tsx
  deleted:
    - src/components/dashboard/points-recap-card.tsx
  modified:
    - src/app/dashboard/page.tsx
key-decisions:
  - PointsRecapCard stays at 134 lines by delegating all animation, audio, and slide body rendering to focused modules.
  - useRecapNavigation exposes setCurrentSlide/setDirection so the parent can reset state on close without reaching into internal refs.
  - displayCount resets automatically when open becomes false via the counter useEffect, so closeRecap does not need to call setDisplayCount directly.
patterns-established:
  - "Recap hook composition pattern: thin card imports useRecapData + useRecapNavigation + useRecapAudio + RecapSlideContent."
requirements-completed: [RANK-01]
duration: 15min
completed: 2026-04-29
---

# Phase 04 Plan 03: Recap UI Decomposition Summary

**Navigation/audio hooks, RecapSlideContent, and a relocated thin PointsRecapCard**

## Performance

- **Duration:** 15 min
- **Started:** 2026-04-29
- **Completed:** 2026-04-29
- **Tasks:** 2
- **Files modified:** 7 (5 created, 1 deleted, 1 updated)

## Accomplishments
- Extracted keyboard/swipe navigation and counter animation into `useRecapNavigation` with 5 passing tests covering pagination bounds, dot-selection, and swipe threshold behavior.
- Extracted audio preload/play/stop/cleanup into `useRecapAudio`, isolating the HTMLAudioElement lifecycle.
- Created `RecapSlideContent` to render title, description, bullets, stat card, supporting text, and reveal emphasis.
- Relocated `PointsRecapCard` into `src/features/ranking/components/` at 134 lines (under the 150-line budget) composing all four modules.
- Deleted the legacy `src/components/dashboard/points-recap-card.tsx` and updated the dashboard import.

## Files Created/Modified
- `src/features/ranking/hooks/use-recap-navigation.ts` — slide index, direction, counter animation, keyboard and swipe navigation.
- `src/features/ranking/hooks/use-recap-audio.ts` — audio preload/play/stop lifecycle.
- `src/features/ranking/hooks/use-recap-navigation.test.tsx` — 5 tests: pagination bounds, dot-selection, forward/backward swipe.
- `src/features/ranking/components/recap-slide-content.tsx` — slide body rendering for copy/reveal variants.
- `src/features/ranking/components/points-recap-card.tsx` — thin 134-line composition of all four modules.
- `src/components/dashboard/points-recap-card.tsx` — DELETED.
- `src/app/dashboard/page.tsx` — import updated to feature-local path.

## Decisions Made
- Kept `setCurrentSlide` and `setDirection` in the hook's return value so `closeRecap` can reset navigation without the hook needing to watch for a close signal separately.
- Inlined the formatCount helper rather than creating a utility file for a one-time use pattern.
- Removed the unused `_downloadRecapImage` function from the new card since it was already suppressed with `void` in the original.

## Deviations from Plan

None — all acceptance criteria met and build passes.

## User Setup Required

None.

## Next Phase Readiness
- D-01 and D-09 are now complete: PointsRecapCard is a thin feature-local composition layer.
- 04-05 automated tasks (Tasks 1 and 2) are already complete; Task 3 requires the human Liquibase migration checkpoint.
- Phase 04 is blocked on the human DB migration step in 04-05 before Phase 05 can begin.

## Self-Check: PASSED

- FOUND: `src/features/ranking/hooks/use-recap-navigation.ts`
- FOUND: `src/features/ranking/hooks/use-recap-audio.ts`
- FOUND: `src/features/ranking/components/recap-slide-content.tsx`
- FOUND: `src/features/ranking/components/points-recap-card.tsx` (134 lines)
- NOT FOUND: `src/components/dashboard/points-recap-card.tsx` (deleted)
- FOUND: `src/app/dashboard/page.tsx` imports from feature-local path

---
*Phase: 04-member-ranking-module*
*Completed: 2026-04-29*
