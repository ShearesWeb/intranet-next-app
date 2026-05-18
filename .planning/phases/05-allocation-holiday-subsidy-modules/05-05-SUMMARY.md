---
phase: 05-allocation-holiday-subsidy-modules
plan: 05
subsystem: types
tags: [typescript, holiday-subsidy, types, route-migration]
requires:
  - phase: 05-00
    provides: Holiday-subsidy utilities foundation
  - phase: 05-02
    provides: Non-declaration consumer rewiring
provides:
  - Canonical holiday-subsidy type ownership under src/features/holiday-subsidy/types/
  - Route handlers rewired to feature-local type contracts
affects: [holiday-subsidy-types, declarations-api, approvals-api, weekly-api]
tech-stack:
  added: []
key-files:
  created:
    - src/features/holiday-subsidy/types/declarations.ts
    - src/features/holiday-subsidy/types/api.ts
    - src/features/holiday-subsidy/types/weekly.ts
  modified:
    - src/app/api/holidaySubsidy/approvals/[ccaId]/route.ts
    - src/app/api/holidaySubsidy/approvals/route.ts
    - src/app/api/holidaySubsidy/approvals/weekly/[ccaId]/[weekId]/route.ts
    - src/app/api/holidaySubsidy/declarations/[ccaId]/route.ts
    - src/app/api/holidaySubsidy/weekly/[ccaId]/[weekId]/route.ts
requirements-completed: [HSUB-01 (route-level — page-level in 05-06/05-07)]
duration: ~10min
completed: 2026-04-29
---

# Phase 05 Plan 05: Holiday Subsidy Type Foundation and Route Migration Summary

## Task 1
- Created `declarations.ts` with SubsidyStatus const+type, SubsidyRow, SubsidyWithPosition, PositionOption, WeekOption, SubsidyDeclaration, DeclarationSection.
- Created `api.ts` with all route-facing join contracts (imports SubsidyStatus from declarations.ts).
- Created `weekly.ts` with WeeklyRow interface.

## Task 2
- Rewired 5 route handlers from legacy `@/types/holiday-subsidy` and `@/types/holiday-subsidy-api` to feature-local types.
- Remaining legacy consumers: approvals/[ccaName]/page.tsx and declaration/[ccaName]/types.ts — handled in 05-06/05-07.

## Deviations
None. No route semantics changed.

---
*Phase: 05-allocation-holiday-subsidy-modules*
*Completed: 2026-04-29*
