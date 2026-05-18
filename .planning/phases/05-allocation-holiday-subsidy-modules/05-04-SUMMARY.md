---
phase: 05-allocation-holiday-subsidy-modules
plan: 04
subsystem: ui
tags: [react, nextjs, allocation, hooks, decomposition]
requires:
  - phase: 05-01
    provides: Feature-local allocation types
  - phase: 05-00
    provides: diffApplicantsForSave
provides:
  - Thin rankApplicants/page.tsx shell (83 lines)
  - useApplicantRankings hook owning fetch/state/save
  - PositionSearchBox and PositionCard components
  - Thin ccaAllocation/page.tsx shell (19 lines) composing guide sections
affects: [rank-applicants-page, allocation-landing-page, allocation-hooks, allocation-components]
tech-stack:
  added: []
key-files:
  created:
    - src/features/allocation/hooks/use-applicant-rankings.ts
    - src/features/allocation/components/position-search-box.tsx
    - src/features/allocation/components/position-card.tsx
    - src/features/allocation/components/allocation-guide-hero.tsx
    - src/features/allocation/components/allocation-algorithm-steps.tsx
    - src/features/allocation/components/allocation-faq.tsx
    - src/features/allocation/utils/allocation-guide-content.ts
  modified:
    - src/app/dashboard/ccaAllocation/rankApplicants/page.tsx
    - src/app/dashboard/ccaAllocation/page.tsx
requirements-completed: [ALLOC-01, ALLOC-02]
duration: ~15min
completed: 2026-04-29
---

# Phase 05 Plan 04: Applicant Ranking + Allocation Landing Decomposition Summary

## Task 1 (rankApplicants decomposition)
- Created `useApplicantRankings` hook using `diffApplicantsForSave` from 05-00 for exact add→remove→rank mutation order.
- Extracted `PositionSearchBox` into `src/features/allocation/components/` as allocation-local component.
- Extracted `PositionCard` into feature-local component with same UI as before.
- Reduced `rankApplicants/page.tsx` to 83 lines (budget: 150).

## Task 2 (allocation landing guide extraction)
- Created `allocation-guide-content.ts` with `ALGORITHM_STEPS` and `FAQ_ITEMS` typed constants.
- Created `AllocationGuideHero`, `AllocationAlgorithmSteps`, `AllocationFAQ` components.
- Reduced `ccaAllocation/page.tsx` to 19 lines.

## Deviations
None. All endpoints, toast copy, and save semantics preserved.

---
*Phase: 05-allocation-holiday-subsidy-modules*
*Completed: 2026-04-29*
