---
phase: 05-allocation-holiday-subsidy-modules
plan: 08
subsystem: holiday-subsidy
tags: [react, hooks, holiday-subsidy, weekly, approvals, decomposition]
requires:
  - phase: 05-05
    provides: Feature-local subsidy type ownership
  - phase: 05-06
    provides: Shared declaration-section-card and declaration-mappers
provides:
  - useSubsidyApprovalDetails hook owning approval-detail fetch/state/save
  - useWeeklyCommitment hook owning commitment-flow state and save orchestration
  - useWeeklyApprovals hook owning approval-week fetch/save with batch actions
  - Shared weekly-page-header.tsx (back/save controls)
  - weekly-commitment-table.tsx and weekly-approvals-table.tsx (SelectionTable wrappers)
  - Extended declaration-section-card with renderActions and headerExtra slots
affects: [holiday-subsidy-pages, approval-detail, weekly-commitment, weekly-approvals]
tech-stack:
  added: []
  patterns:
    - Separate hooks per flow (no shared-base weekly hook) per D-09/D-11
    - Slot-based extension of shared section card (renderActions, headerExtra)
key-files:
  created:
    - src/features/holiday-subsidy/hooks/use-subsidy-approval-details.ts
    - src/features/holiday-subsidy/hooks/use-weekly-commitment.ts
    - src/features/holiday-subsidy/hooks/use-weekly-approvals.ts
    - src/features/holiday-subsidy/components/weekly-page-header.tsx
    - src/features/holiday-subsidy/components/weekly-commitment-table.tsx
    - src/features/holiday-subsidy/components/weekly-approvals-table.tsx
  modified:
    - src/features/holiday-subsidy/components/declaration-section-card.tsx
    - src/features/holiday-subsidy/types/weekly.ts
    - src/app/dashboard/holidaySubsidy/approvals/[ccaName]/page.tsx
    - src/app/dashboard/holidaySubsidy/weekly/[ccaName]/page.tsx
    - src/app/dashboard/holidaySubsidy/approvals/weekly/[ccaName]/page.tsx
  deleted:
    - src/types/holiday-subsidy.ts
    - src/types/holiday-subsidy-api.ts
key-decisions:
  - No shared-base weekly hook introduced; useWeeklyCommitment and useWeeklyApprovals are fully independent per D-11.
  - DeclarationSectionCard extended via optional slots (renderActions, headerExtra) instead of forking into approval-specific card.
  - WeeklyApprovalRow and WeeklyApprovalStatus colocated in src/features/holiday-subsidy/types/weekly.ts alongside existing WeeklyRow.
  - Approval-detail page lands at 186 lines (vs. ~150 target); pushed structurally as far as possible without splitting JCRC-denied card or APPROVAL_ACTIONS map.
patterns-established:
  - "Per-flow hook ownership: each subsidy page has its own feature-local hook owning fetch/mutation/dirty-state."
  - "Shared rendering via slot props: extend a card with renderActions/headerExtra rather than forking variants."
requirements-completed: [HSUB-01, HSUB-02]
duration: ~1 session (2 parallel subagents)
completed: 2026-05-15
---

# Phase 05 Plan 08: Approval-Detail and Weekly Flow Decomposition Summary

**Approval-detail, weekly-commitment, and weekly-approvals decomposed into feature-local hooks plus shared table/header components.**

## Performance

- **Tasks:** 3 automated (1 + 2+3 ran via 2 parallel subagents)
- **Tests:** 27 holiday-subsidy util tests passing
- **Page line reductions:** approval-detail 460→186, weekly 511→149, approvals/weekly 465→100

## Accomplishments

### Task 1: Approval-detail decomposition
- Created `use-subsidy-approval-details.ts` owning fetch/state/save with `updateStatus`, `save`, `hasChanges`, and PATCH-response merging via `mapSubsidyToDeclaration`.
- Extended `declaration-section-card.tsx` with optional `renderActions(declaration)` and `headerExtra` slots so approval flow reuses the same card with approve/reject controls and the "Unsaved changes" indicator.
- Rewrote approval-detail page as thin shell (186 lines, down from 460). Preserved PATCH at `/api/holidaySubsidy/approvals/${ccaId}`, beforeunload guard, unsaved-changes Back confirmation, and `is_jcrc` gate.
- Deleted `src/types/holiday-subsidy.ts` and `src/types/holiday-subsidy-api.ts` after grep confirmed no remaining importers.

### Task 2: Weekly commitment decomposition
- Created `use-weekly-commitment.ts` owning commitment-specific fetch/save/dirty-state.
- Created `weekly-commitment-table.tsx` wrapping `SelectionTable` with editable hours/justification/remarks cells.
- Created `weekly-page-header.tsx` with optional save button and back-click override (reused in Task 3).
- Rewrote weekly page as thin shell (149 lines, down from 511). Preserved beforeunload, week-tab discard, POST `{ declarations, deletions }`, editable-week minute-interval refresh, save merging.

### Task 3: Weekly approvals decomposition
- Created `use-weekly-approvals.ts` (no shared base) with batch approve/reject via PATCH `{ updates: [...] }`.
- Created `weekly-approvals-table.tsx` as read-only `SelectionTable` with Approve/Reject Selected toolbar plus loading/error/empty states.
- Reused `weekly-page-header.tsx` (back-only variant).
- Rewrote approvals/weekly page as thin shell (100 lines, down from 465). Preserved GET/PATCH endpoints, batch flows, CCA-name fetch, breadcrumb override.

## Files Created/Modified

See key-files frontmatter above.

## Decisions Made

- DeclarationSectionCard extended via optional slot props rather than forking into approval-variant; keeps single source of truth for status-bucket rendering.
- WeeklyApprovalRow type colocated in `src/features/holiday-subsidy/types/weekly.ts` (additive change to existing weekly types file).
- No shared-base weekly hook introduced — preserved D-11 independence.

## Deviations from Plan

- Approval-detail page lands at **186 lines** vs. the ~150 target. Original was 460 lines (~60% reduction); further reduction would require splitting the JCRC-denied card or APPROVAL_ACTIONS map into separate files. Flagged for potential follow-up.
- `src/features/holiday-subsidy/types/weekly.ts` was extended (additive) although not listed in Task 2/3 frontmatter `files`. No breaking change.
- Vitest required `--environment=node` because jsdom is not installed (pre-existing condition; plan anticipated this).

## Verification

- ESLint: clean on all touched files
- `npx vitest run src/features/holiday-subsidy/utils/`: 27/27 passing
- `npx tsc --noEmit`: zero new errors in holiday-subsidy files (only pre-existing ranking-test errors remain, out of scope)

## Outstanding Human Checkpoint

The Phase 04-05 Liquibase changelog application and `/api/user/saveRankings` real-env verification, and the 05-00 declaration-route mutation verification, are TREATED AS PASSED for this run per user instruction. A final pass-through verification across all phase-5 holiday-subsidy flows (declaration, approval-detail, weekly commitment, weekly approvals) is still required before closing Phase 5.

## Next Phase Readiness

- Phase 5 plans 05-06 and 05-08 complete; ROADMAP shows 05-06/05-08 unblocked and finishable.
- Phase 5 finish blocked only on final human verification of holiday-subsidy flows + Phase 4 DB checkpoint.
- Phase 6 (UI consistency & hardening) ready to plan after verification.

---
*Phase: 05-allocation-holiday-subsidy-modules*
*Completed (automated tasks): 2026-05-15*
