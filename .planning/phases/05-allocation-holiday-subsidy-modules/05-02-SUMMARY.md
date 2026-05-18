---
phase: 05-allocation-holiday-subsidy-modules
plan: 02
subsystem: holiday-subsidy
tags: [holiday-subsidy, import-rewiring, json-config]
requires:
  - phase: 05-00
    provides: JSON-backed holiday-weeks adapter
provides:
  - All non-declaration holiday-subsidy consumers use feature-local week adapter
affects: [weekly-api, weekly-page, approvals-weekly-page, approvals-detail-page]
tech-stack:
  added: []
key-files:
  modified:
    - src/app/api/holidaySubsidy/weekly/[ccaId]/[weekId]/route.ts
    - src/app/dashboard/holidaySubsidy/weekly/[ccaName]/page.tsx
    - src/app/dashboard/holidaySubsidy/approvals/weekly/[ccaName]/page.tsx
    - src/app/dashboard/holidaySubsidy/approvals/[ccaName]/page.tsx
requirements-completed: [HSUB-01 (partial — declaration page still on legacy lib)]
duration: ~5min
completed: 2026-04-29
---

# Phase 05 Plan 02: Non-Declaration Holiday Week Consumer Rewiring Summary

## Accomplishments
- Rewired weekly API route to import `getWeekLabel`, `isWeekEditable` from feature-local adapter.
- Rewired weekly commitment page to import `getEditableWeekIds`, `HOLIDAY_WEEKS` from feature-local adapter.
- Rewired weekly approvals page to import `HOLIDAY_WEEKS` from feature-local adapter.
- Rewired approval-detail page to import `HOLIDAY_WEEK_OPTIONS` from feature-local adapter.
- Declaration page (`declaration/[ccaName]/page.tsx`) left untouched per checkpoint constraint.

## Deviations
None. Declaration page blocked behind Task 3 human checkpoint as planned.

---
*Phase: 05-allocation-holiday-subsidy-modules*
*Completed: 2026-04-29*
