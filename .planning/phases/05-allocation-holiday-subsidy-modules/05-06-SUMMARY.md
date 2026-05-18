---
phase: 05-allocation-holiday-subsidy-modules
plan: 06
subsystem: holiday-subsidy
tags: [next15, holiday-subsidy, feature-extraction, thin-shell]
requires: [05-00, 05-05]
provides:
  - Feature-local declaration hook owning fetch/mutation/dialog state
  - Feature-local declaration form dialog and status-bucket section card
  - Shared declaration mapper utilities (API row -> view model)
  - Thin declaration page driven by feature modules and the JSON-backed week adapter
affects: [holiday-subsidy-declaration-page, legacy-week-util]
tech-stack:
  added: []
  patterns:
    - Feature-local hook owns fetch + dialog state for a page flow
    - Page renders status-bucket sections via a dedicated card component
    - Mutation URLs target the verified `[ccaId]` route segment
key-files:
  created:
    - src/features/holiday-subsidy/hooks/use-subsidy-declarations.ts
    - src/features/holiday-subsidy/components/subsidy-declaration-form-dialog.tsx
    - src/features/holiday-subsidy/components/declaration-section-card.tsx
    - src/features/holiday-subsidy/utils/declaration-mappers.ts
  modified:
    - src/app/dashboard/holidaySubsidy/declaration/[ccaName]/page.tsx
  deleted:
    - src/app/dashboard/holidaySubsidy/declaration/[ccaName]/subsidy-declaration-form-dialog.tsx
    - src/app/dashboard/holidaySubsidy/declaration/[ccaName]/types.ts
    - src/lib/holiday-subsidy-weeks.ts
key-decisions:
  - Mutation URL uses the numeric `ccaId` query param (the route file is `[ccaId]/route.ts` and `parseInt`s the segment) — the dialog now refuses to render if `ccaId` is absent rather than falling back to encoded ccaName
  - `mapSubsidyToDeclaration` flattens an array-shaped `cca_positions` join in the mapper utility, so route responses with single-row joins behave identically to the legacy inline mapper
  - `DeclarationSectionCard` collapses the rejected/approved column variants (both render the same `Edit & Resubmit` button) while preserving exact button labels and variants
  - Feature-local week adapter `@/features/holiday-subsidy/utils/holiday-weeks` is the sole source of `HOLIDAY_WEEK_OPTIONS`; the legacy `src/lib/holiday-subsidy-weeks.ts` is removed
requirements-completed: [HSUB-01]
duration: ~1 session
completed: 2026-05-15
---

# Phase 05 Plan 06: Declaration Page Thin-Shell Summary

**Feature-local declaration hook, dialog, section card, and mappers replace the in-page implementation**

## Performance

- **Tasks:** 1 automated
- **Page line count:** 147 lines (target: <150)
- **Files created:** 4
- **Files deleted:** 3

## Accomplishments

### Task 1: Decompose declaration page into feature modules
- Extracted fetch/mutation/dialog orchestration into `useSubsidyDeclarations(ccaId)`. The hook owns positions, declarations, loading/error, dialog open state, editing target, delete handler, and a stable `mapApiSubsidy` projector.
- Moved the dialog into `src/features/holiday-subsidy/components/subsidy-declaration-form-dialog.tsx` and switched its POST/PATCH calls to the verified `/api/holidaySubsidy/declarations/{ccaId}` shape (was `encodeURIComponent(ccaName)` in the legacy page-local copy).
- Added `DeclarationSectionCard` to encapsulate the per-status table (pending/approved/rejected) including the columns, action buttons, and `SimpleTable` configuration.
- Added `declaration-mappers.ts` exporting `buildPositionMap`, `mapSubsidyToDeclaration`, `coerceSubsidyStatus`, and `formatSubsidyStatus` so the same projection can be reused by approval-detail in 05-08.
- Rewrote `src/app/dashboard/holidaySubsidy/declaration/[ccaName]/page.tsx` as a thin shell (147 lines) that wires the hook to the dialog and three section tabs.
- Removed the legacy in-page dialog (`subsidy-declaration-form-dialog.tsx`), the page-local re-export `types.ts`, and the legacy week util `src/lib/holiday-subsidy-weeks.ts` after confirming the page no longer references any of them.

## Files Created
- `src/features/holiday-subsidy/hooks/use-subsidy-declarations.ts` — fetch + mutation + dialog state owner
- `src/features/holiday-subsidy/components/subsidy-declaration-form-dialog.tsx` — feature-local form dialog targeting `[ccaId]`
- `src/features/holiday-subsidy/components/declaration-section-card.tsx` — per-status section card with action columns
- `src/features/holiday-subsidy/utils/declaration-mappers.ts` — API row to view model mapper + status helpers

## Files Modified
- `src/app/dashboard/holidaySubsidy/declaration/[ccaName]/page.tsx` — thin shell (147 lines)

## Files Deleted
- `src/app/dashboard/holidaySubsidy/declaration/[ccaName]/subsidy-declaration-form-dialog.tsx`
- `src/app/dashboard/holidaySubsidy/declaration/[ccaName]/types.ts`
- `src/lib/holiday-subsidy-weeks.ts`

## Verification

- `npx eslint` on all five primary files: clean, zero warnings.
- `wc -l` on the page: **147 lines** (acceptance target: under ~150).
- `npx tsc --noEmit` filtered to holiday-subsidy/declaration: clean. (Unrelated pre-existing ranking test typing errors remain outside this plan's scope.)
- `npx vitest run --environment=node src/features/holiday-subsidy/utils/holiday-weeks.test.ts src/features/holiday-subsidy/utils/weekly-change-set.test.ts`: 27 passed (node environment required because the repo lacks jsdom — unrelated pre-existing condition).
- Grep for `lib/holiday-subsidy-weeks` and the deleted page-local files across `src`: zero remaining references.

## Deviations
- The legacy page sent mutation requests to `/api/holidaySubsidy/declarations/${encodeURIComponent(ccaName)}` even though the route segment is `[ccaId]` and `parseInt`s the path segment. Per the user-supplied checkpoint resolution (verified-as-passed treating the route contract as authoritative), the new dialog uses the numeric `ccaId` query param.
- The dialog is only mounted when `ccaId` is present in the query string. Without `ccaId` the form is hidden (an upstream link from the holiday subsidy index always supplies it).

---
*Phase: 05-allocation-holiday-subsidy-modules*
*Plan 06 completed: 2026-05-15*
