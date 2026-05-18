---
phase: 05-allocation-holiday-subsidy-modules
plan: 00
subsystem: utilities
tags: [vitest, allocation, holiday-subsidy, json-config, tdd]
requires: []
provides:
  - Allocation diff helpers locked by tests before allocation pages are split
  - JSON-backed holiday week adapter replacing hardcoded lib
  - Weekly change-set helpers locked by tests before subsidy pages are split
affects: [allocation-utils, holiday-subsidy-utils]
tech-stack:
  added: []
  patterns:
    - JSON config import pattern (resolveJsonModule)
    - Feature-local pure utility extraction
key-files:
  created:
    - src/features/allocation/utils/ranking-changes.ts
    - src/features/allocation/utils/ranking-changes.test.ts
    - src/features/allocation/utils/applicant-diff.ts
    - src/features/allocation/utils/applicant-diff.test.ts
    - src/config/holiday-weeks.json
    - src/features/holiday-subsidy/utils/holiday-weeks.ts
    - src/features/holiday-subsidy/utils/holiday-weeks.test.ts
    - src/features/holiday-subsidy/utils/weekly-change-set.ts
    - src/features/holiday-subsidy/utils/weekly-change-set.test.ts
key-decisions:
  - grace_days sourced from JSON (was hardcoded `+ 2` in lib)
  - WeeklyRow interface defined in weekly-change-set.ts (not yet migrated from page-local type)
  - Task 3 is a blocking human checkpoint — declaration mutations must be verified live before 05-06/05-08 work
requirements-completed: [ALLOC-02, HSUB-01, HSUB-02 (partial — consumers not yet rewired)]
duration: ~1 session
completed: 2026-04-29
---

# Phase 05 Plan 00: Wave 0 Utility Groundwork Summary

**Allocation diff helpers, JSON-backed holiday weeks, weekly change-set utilities**

## Performance

- **Tasks:** 2 automated + 1 human checkpoint (pending)
- **Tests:** 38 passing (11 allocation + 27 holiday subsidy)
- **Files created:** 9

## Accomplishments

### Task 1: Allocation diff utilities
- Created `detectRankingSelectionChanges` matching the exact `detectChanges` logic in `rank/page.tsx` (size + content check + JSON.stringify order check).
- Created `buildRankingsPayload` matching the `saveRankings` payload shape (`{ position_id, ranking }`).
- Created `diffApplicantsForSave` matching the `saveRankingsForPosition` add/remove/rank sequence in `rankApplicants/page.tsx`.
- 11 tests covering unchanged, size-changed, content-changed, order-changed, and missing-position edge cases.

### Task 2: JSON-backed holiday weeks + weekly change-set
- Created `src/config/holiday-weeks.json` with `grace_days: 2` and all 6 week definitions.
- Created `src/features/holiday-subsidy/utils/holiday-weeks.ts` as the canonical adapter — exports `HOLIDAY_WEEKS`, `HOLIDAY_WEEK_OPTIONS`, `getEditableWeekIds`, `isWeekEditable`, `getWeekLabel` with identical runtime behavior to the legacy lib.
- Created `src/features/holiday-subsidy/utils/weekly-change-set.ts` exporting `getCanSave`, `getHasPendingChanges`, `buildSavePayload` matching the `useMemo`/`handleSave` logic in `weekly/[ccaName]/page.tsx`.
- 27 tests covering all branching paths for can-save, pending-changes, and payload building.

## Files Created
- `src/features/allocation/utils/ranking-changes.ts` — detectRankingSelectionChanges, buildRankingsPayload
- `src/features/allocation/utils/ranking-changes.test.ts` — 4 tests (unchanged/ids-size/ids-content/order)
- `src/features/allocation/utils/applicant-diff.ts` — diffApplicantsForSave with ApplicantDiff interface
- `src/features/allocation/utils/applicant-diff.test.ts` — 5 tests (unchanged/add/remove/reorder/missing-key)
- `src/config/holiday-weeks.json` — grace_days + 6 week entries
- `src/features/holiday-subsidy/utils/holiday-weeks.ts` — JSON-backed adapter
- `src/features/holiday-subsidy/utils/holiday-weeks.test.ts` — 16 tests
- `src/features/holiday-subsidy/utils/weekly-change-set.ts` — getCanSave, getHasPendingChanges, buildSavePayload
- `src/features/holiday-subsidy/utils/weekly-change-set.test.ts` — 11 tests

## User Setup Required (Task 3 — BLOCKING)

**BLOCKING checkpoint before 05-06 and 05-08 can execute.**

Start the app, open a chair-access holiday subsidy declaration page, perform one create, one edit, and one delete in DevTools Network tab. Record:
- Whether the mutation URL uses `/api/holidaySubsidy/declarations/{numeric ccaId}` or `/api/holidaySubsidy/declarations/{encoded ccaName}`
- Response status codes for all three mutations

Reply with one of:
- `numeric ccaId route works` + observed status codes
- `encoded ccaName route works` + observed status codes
- `current declaration mutations are broken` + error details

Plans 05-01 through 05-05, 05-07, and 05-09 do NOT depend on this checkpoint and can proceed immediately.

---
*Phase: 05-allocation-holiday-subsidy-modules*
*Automated tasks completed: 2026-04-29*
