---
phase: 05-allocation-holiday-subsidy-modules
plan: 05-07
subsystem: holiday-subsidy-landing-approvals-index
tags: [typescript, holiday-subsidy, decomposition, thin-shell]
requires:
  - phase: 05-05
    provides: Feature-local holiday-subsidy types
provides:
  - Chair-facing holiday-subsidy landing decomposed into hook + table component
  - JCRC approvals-index decomposed into hook + table component
  - Both index pages reduced to thin shells
affects: [holiday-subsidy-landing, holiday-subsidy-approvals-index]
tech-stack:
  added: []
key-files:
  created:
    - src/features/holiday-subsidy/hooks/use-chair-subsidy-ccas.ts
    - src/features/holiday-subsidy/hooks/use-subsidy-approvals-index.ts
    - src/features/holiday-subsidy/components/chair-cca-table.tsx
    - src/features/holiday-subsidy/components/approval-cca-table.tsx
  modified:
    - src/app/dashboard/holidaySubsidy/page.tsx
    - src/app/dashboard/holidaySubsidy/approvals/page.tsx
requirements-completed: [HSUB-landing-decompose, HSUB-approvals-index-decompose]
duration: ~15min
completed: 2026-04-29
---

# Phase 05 Plan 07: Holiday Landing + Approvals Index Decomposition Summary

## Task 1 — Feature-local hooks and table components
- Created `use-chair-subsidy-ccas.ts`: derives chair CCAs from `user.appointments`, returns `{ subsidyData, loading, error, hasChairAccess }`. Filters by `CHAIR_POSITION_TYPES = new Set(["lead", "vice"])`.
- Created `chair-cca-table.tsx`: `ChairCcaTable({ data })` wraps `SimpleTable` with columns for CCA name, position badge, and declaration/weekly action links.
- Created `use-subsidy-approvals-index.ts`: fetches `/api/holidaySubsidy/approvals`, maps `ccas[]` to `CcaApprovalRow[]`, returns `{ rows, loading, error }`.
- Created `approval-cca-table.tsx`: `ApprovalCcaTable({ rows, error })` wraps `SimpleTable` with columns for CCA name, pending counts, and approve-declarations/approve-weekly action buttons.

## Task 2 — Thin shell rewrites
- `src/app/dashboard/holidaySubsidy/page.tsx`: 81 lines. Composes `useChairSubsidyCcas` + `ChairCcaTable`. Preserves loading spinner, no-access card, and guide button.
- `src/app/dashboard/holidaySubsidy/approvals/page.tsx`: 57 lines. Composes `useSubsidyApprovalsIndex` + `ApprovalCcaTable`. Preserves JCRC-only guard and loading spinner.

## Deviations
None. All navigation destinations, empty states, loading states, and page copy preserved exactly.

---
*Phase: 05-allocation-holiday-subsidy-modules*
*Completed: 2026-04-29*
