---
phase: 03-cca-management-module
verified: 2026-04-11T08:01:34Z
status: gaps_found
score: 16/17 must-haves verified
overrides_applied: 0
gaps:
  - truth: "All three pages still render identically to before refactoring"
    status: failed
    reason: "The refactor changed member-management behavior: managed-position users are treated as full member managers, and partial save failures are cleared from client state after refetch."
    artifacts:
      - path: "src/features/cca/utils/cca-management-access.ts"
        issue: "`hasManagedViewAccess` is sufficient for `ok: true`, so write routes do not distinguish view/ranking access from chair-only member-management access."
      - path: "src/lib/managed-cca-data.ts"
        issue: "`can_manage_members` is set to `hasChairAccess || hasManagedPositions`, which exposes Manage Members UI to non-chair managed-position users."
      - path: "src/app/api/cca/[ccaId]/addMember/route.ts"
        issue: "The write route accepts `getManagedCcaAccess()` success without requiring `hasChairAccess`."
      - path: "src/app/api/cca/[ccaId]/removeMember/route.ts"
        issue: "The write route accepts `getManagedCcaAccess()` success without requiring `hasChairAccess`."
      - path: "src/app/api/cca/[ccaId]/updateMember/route.ts"
        issue: "The write route accepts `getManagedCcaAccess()` success without requiring `hasChairAccess`."
      - path: "src/app/api/cca/[ccaId]/members/route.ts"
        issue: "The response always derives `permissions.canManageMembers` from CCA type alone, not from the authenticated user's chair access result."
      - path: "src/features/cca/hooks/use-cca-members.ts"
        issue: "`saveAll()` always calls `refetch()`, and `refetch()` clears `pendingChanges`, so failed edits disappear after partial-save errors."
    missing:
      - "Require chair access for add/remove/update member mutations and for `can_manage_members` UI gating."
      - "Preserve failed pending changes after partial-save errors so users can review and retry unsaved edits."
---

# Phase 3: CCA Management Module Verification Report

**Phase Goal:** CCA management pages are decomposed into focused components and hooks within a feature module structure that serves as the pattern for all subsequent refactors
**Verified:** 2026-04-11T08:01:34Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | ManageMembers page file is under 150 lines, composing imported sub-components and custom hooks instead of inline logic | ✓ VERIFIED | `wc -l src/app/dashboard/mycca/admin/manageMembers/[ccaName]/page.tsx` => 123; page imports `useCcaMembers`, `MemberGroupTable`, `AddMemberModal`, `SaveErrorDialog`. |
| 2 | CCA data fetching uses reusable custom hooks instead of repeated inline `useEffect`/`useState`/`fetch` blocks | ✓ VERIFIED | `src/app/dashboard/mycca/page.tsx`, `admin/page.tsx`, and `manageMembers/[ccaName]/page.tsx` all consume feature hooks; fetch logic lives in `use-cca-list.ts`, `use-managed-ccas.ts`, and `use-cca-members.ts`. |
| 3 | A `src/features/cca/` directory exists with components, hooks, and types, establishing the module pattern for later refactors | ✓ VERIFIED | `src/features/cca/` contains `components/`, `hooks/`, `types/`, and `utils/` with 13 feature-local files. |
| 4 | All CCA lib files are in `src/features/cca/utils/` and deleted from `src/lib/` | ✓ VERIFIED | `src/features/cca/utils/cca-chair-access.ts`, `cca-management-access.ts`, `cca-member-management.ts`, and `cca-cut-status.ts` exist; only `cca-ranking-comments.ts` and `cca-ranking-metrics.ts` remain under `src/lib/`. |
| 5 | CCA-specific types are in `src/features/cca/types/` and removed from legacy shared type files | ✓ VERIFIED | `src/features/cca/types/members.ts` and `cca-data.ts` exist; `src/types/dashboard.ts` now contains only ranking/allocation types; `src/types/cca-members.ts` is gone. |
| 6 | The project builds after the feature-module moves | ✓ VERIFIED | `npm run build` passed on 2026-04-11 and compiled all CCA pages/routes successfully. |
| 7 | No barrel files (`index.ts`) exist under `src/features/cca/` | ✓ VERIFIED | `Glob("src/features/cca/**/index.ts")` returned no matches. |
| 8 | My CCAs page uses `useCcaList()` instead of inline fetch/state logic | ✓ VERIFIED | `src/app/dashboard/mycca/page.tsx` imports `useCcaList` and binds `const { data: ccas, loading: loadingCCAs, error } = useCcaList();`. |
| 9 | Admin page uses `useManagedCcas()` instead of inline fetch/state logic | ✓ VERIFIED | `src/app/dashboard/mycca/admin/page.tsx` imports `useManagedCcas` and binds `const { data: ccas, loading: loadingCCAs, error } = useManagedCcas();`. |
| 10 | ManageMembers page uses `useCcaMembers()` instead of inline state and handlers | ✓ VERIFIED | `src/app/dashboard/mycca/admin/manageMembers/[ccaName]/page.tsx` imports `useCcaMembers`; member loading, search, pending changes, and save orchestration live in `src/features/cca/hooks/use-cca-members.ts`. |
| 11 | The hooks expose a reusable loading/error/refetch contract | ✓ VERIFIED | `useCcaList` and `useManagedCcas` return `{ data, loading, error, refetch }`; `useCcaMembers` exposes `loading`, `error`, `refetch`, plus the plan-defined domain state/mutations. |
| 12 | `useCcaMembers()` returns mutation functions for member management | ✓ VERIFIED | Hook exports `addMember`, `removeMember`, `updateStatus`, `updateCommitment`, and `saveAll`. |
| 13 | All three pages still render identically to before refactoring | ✗ FAILED | The new access pattern exposes Manage Members flows to non-chair managed-position users (`src/lib/managed-cca-data.ts:115-116`, `src/app/api/cca/[ccaId]/members/route.ts:179-183`) and `useCcaMembers.saveAll()` clears failed pending edits after `await refetch()` (`src/features/cca/hooks/use-cca-members.ts:601-605`). |
| 14 | `MemberGroupTable` renders per-group member tables with conditional columns and action menus | ✓ VERIFIED | `src/features/cca/components/member-group-table.tsx` renders `SimpleTable`, sports/culture-specific dropdown actions, and conditional commitment editing. |
| 15 | `AddMemberModal` uses shadcn `Dialog` instead of a raw overlay | ✓ VERIFIED | `src/features/cca/components/add-member-modal.tsx` imports `Dialog`/`DialogContent`, uses `onKeyDown`, and contains no raw `fixed inset-0` overlay. |
| 16 | `SaveErrorDialog` displays batch save errors in a shadcn `Dialog` | ✓ VERIFIED | `src/features/cca/components/save-error-dialog.tsx` wraps mapped error messages in `DialogContent` with the expected error styling. |
| 17 | ManageMembers composes extracted components instead of inlining their markup | ✓ VERIFIED | The page renders `<MemberGroupTable />`, `<AddMemberModal />`, and `<SaveErrorDialog />` directly, with no inline modal/table helper markup left behind. |

**Score:** 16/17 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `src/features/cca/types/members.ts` | Canonical member-management types | ✓ VERIFIED | 85 lines; exports `Member`, `PendingChange`, `CcaSummary`, `GroupedMembers`, `MemberUpdate`; imported by hooks and API routes. |
| `src/features/cca/types/cca-data.ts` | Canonical CCA list/admin types | ✓ VERIFIED | Exports `CCAData` and `ManagedCcaPosition`; consumed by hooks and both CCA list pages. |
| `src/features/cca/utils/member-helpers.ts` | Shared member-display helpers | ✓ VERIFIED | Exports status options, `formatCommitmentPeriod`, `getStatusLabel`, and re-exports `isChairPositionType`. |
| `src/features/cca/utils/cca-chair-access.ts` | Chair authorization helper | ✓ VERIFIED | Substantive auth helper; wired into sidebar, `getCCAs`, and managed-CCA utilities. |
| `src/features/cca/utils/cca-management-access.ts` | Managed CCA access helper | ✓ VERIFIED | Wired into members/search/add/remove/update/rank routes; substantive, but current logic is too permissive for write access (see gap). |
| `src/features/cca/utils/cca-member-management.ts` | Member-management capability helper | ✓ VERIFIED | Exports `canManageCcaMembers` and disabled-message helper; used by member routes. |
| `src/features/cca/utils/cca-cut-status.ts` | Cut-status normalization helper | ✓ VERIFIED | Exported and used by members, rankings, and update routes. |
| `src/features/cca/hooks/use-cca-list.ts` | MyCCAs data hook | ✓ VERIFIED | Real fetch/useEffect/useCallback flow; page import/use confirmed. |
| `src/features/cca/hooks/use-managed-ccas.ts` | Admin list hook | ✓ VERIFIED | Real fetch/useEffect/useCallback flow; page import/use confirmed. |
| `src/features/cca/hooks/use-cca-members.ts` | ManageMembers state/mutation hook | ✓ VERIFIED | 638 lines of extracted logic; real API fetch/search/save wiring with live state transitions. |
| `src/features/cca/components/member-group-table.tsx` | Group table component | ✓ VERIFIED | Renders tables, conditional commitment control, and action menus; page import/use confirmed. |
| `src/features/cca/components/add-member-modal.tsx` | Accessible add-member dialog | ✓ VERIFIED | Uses shadcn dialog primitives and search/add flow; page import/use confirmed. |
| `src/features/cca/components/save-error-dialog.tsx` | Batch save error dialog | ✓ VERIFIED | Renders error list in dialog; page import/use confirmed. |

### Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| `src/app/api/cca/[ccaId]/members/route.ts` | `src/features/cca/utils/cca-management-access.ts` | `import { getManagedCcaAccess }` | WIRED | Import at line 10; called at lines 66-70. |
| `src/components/layout/app-sidebar.tsx` | `src/features/cca/utils/cca-chair-access.ts` | `import { checkCcaAuthorization }` | WIRED | Import at line 21; used in `buildNavItems()` at lines 112-115. |
| `src/lib/managed-cca-data.ts` | `src/features/cca/utils/cca-chair-access.ts` | `import { isChairPositionType }` | WIRED | Import at line 1; used to filter chair appointments at lines 52-54. |
| `src/app/dashboard/mycca/page.tsx` | `src/features/cca/hooks/use-cca-list.ts` | `import { useCcaList }` | WIRED | Import at line 9; hook called at line 58. |
| `src/app/dashboard/mycca/admin/page.tsx` | `src/features/cca/hooks/use-managed-ccas.ts` | `import { useManagedCcas }` | WIRED | Import at line 10; hook called at line 65. |
| `src/app/dashboard/mycca/admin/manageMembers/[ccaName]/page.tsx` | `src/features/cca/hooks/use-cca-members.ts` | `import { useCcaMembers }` | WIRED | Import at line 12; hook called at line 20. |
| `src/app/dashboard/mycca/admin/manageMembers/[ccaName]/page.tsx` | `src/features/cca/components/member-group-table.tsx` | `import { MemberGroupTable }` | WIRED | Import at line 14; rendered at line 107. |
| `src/app/dashboard/mycca/admin/manageMembers/[ccaName]/page.tsx` | `src/features/cca/components/add-member-modal.tsx` | `import { AddMemberModal }` | WIRED | Import at line 13; rendered at line 117. |
| `src/app/dashboard/mycca/admin/manageMembers/[ccaName]/page.tsx` | `src/features/cca/components/save-error-dialog.tsx` | `import { SaveErrorDialog }` | WIRED | Import at line 15; rendered at line 118. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| --- | --- | --- | --- | --- |
| `use-cca-list.ts` | `data` | `GET /api/user/getCCAs` | Yes — route queries `ccas`, appointment statuses, and `getManagedCcaData()` | ✓ FLOWING |
| `use-managed-ccas.ts` | `data` | `GET /api/user/getManagedCCAs` | Yes — route calls `getManagedCcaData()` which queries `managed_cca_positions` and `ccas` | ✓ FLOWING |
| `use-cca-members.ts` | `groupedMembers`, `allPositions`, `permissions` | `GET /api/cca/[ccaId]/members` | Yes — route queries `ccas`, `cca_positions`, and `cca_appointments` | ✓ FLOWING |
| `add-member-modal.tsx` | `searchResults` | `useCcaMembers.searchUser()` → `GET /api/cca/[ccaId]/searchUsers` | Yes — route queries `public_user_info` | ✓ FLOWING |
| `member-group-table.tsx` | `members` prop | `ManageMembersPage.sections` → `useCcaMembers.groupedMembers` | Yes — upstream hook is fed by live members API data | ✓ FLOWING |
| `save-error-dialog.tsx` | `errors` prop | `useCcaMembers.saveAll()` local error aggregation | Yes — local runtime mutation failures populate dialog state | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| ManageMembers page meets line-budget goal | `wc -l src/app/dashboard/mycca/admin/manageMembers/[ccaName]/page.tsx` | `123` | ✓ PASS |
| Feature-module imports compile in production build | `npm run build` | Next build passed; `/dashboard/mycca`, `/dashboard/mycca/admin`, and `/dashboard/mycca/admin/manageMembers/[ccaName]` compiled successfully | ✓ PASS |
| Existing automated tests still pass | `npx vitest run --reporter=verbose` | `4` test files / `18` tests passed | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| --- | --- | --- | --- | --- |
| `CCA-01` | `03-03-PLAN.md` | Decompose ManageMembers page (1111 lines) into hooks, sub-components, and utilities | ✓ SATISFIED | ManageMembers page is 123 lines and composes `useCcaMembers`, `MemberGroupTable`, `AddMemberModal`, and `SaveErrorDialog`. |
| `CCA-02` | `03-02-PLAN.md` | Extract CCA data fetching into reusable custom hooks | ✓ SATISFIED | `useCcaList`, `useManagedCcas`, and `useCcaMembers` exist and are consumed by the three target pages. |
| `CCA-03` | `03-01-PLAN.md` | Establish feature module pattern (`src/features/cca/`) for reuse in subsequent refactors | ✓ SATISFIED | `src/features/cca/` contains feature-local components, hooks, types, and utils; legacy CCA types/lib imports were removed. |

**Orphaned requirements:** None. `REQUIREMENTS.md` maps only `CCA-01`, `CCA-02`, and `CCA-03` to Phase 3, and all three are claimed by plan frontmatter.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| --- | --- | --- | --- | --- |
| `src/features/cca/utils/cca-management-access.ts` | 57-61 | View-access helper doubles as write authorization gate | 🛑 Blocker | Non-chair managed-position users can pass write-route authorization. |
| `src/lib/managed-cca-data.ts` | 101-116 | `can_manage_members` set from `hasChairAccess || hasManagedPositions` | 🛑 Blocker | Admin UI exposes Manage Members to users with managed-position visibility only. |
| `src/app/api/cca/[ccaId]/addMember/route.ts` | 45-58 | Write route accepts `getManagedCcaAccess()` without checking `hasChairAccess` | 🛑 Blocker | Non-chair managed-position users can add members. |
| `src/app/api/cca/[ccaId]/removeMember/route.ts` | 45-58 | Write route accepts `getManagedCcaAccess()` without checking `hasChairAccess` | 🛑 Blocker | Non-chair managed-position users can remove members. |
| `src/app/api/cca/[ccaId]/updateMember/route.ts` | 64-77 | Write route accepts `getManagedCcaAccess()` without checking `hasChairAccess` | 🛑 Blocker | Non-chair managed-position users can change cut/commitment data. |
| `src/features/cca/hooks/use-cca-members.ts` | 147, 601-605 | Partial-save errors are followed by `refetch()` that clears `pendingChanges` | ⚠️ Warning | Failed edits disappear from the UI immediately after the error dialog opens. |
| `src/features/cca/components/add-member-modal.tsx` | 50-53 | Modal allows any non-chair position in the “Add Member” flow | ⚠️ Warning | “Add Member” can assign roles like Team Manager even though the page exposes the action from the Members section only. |
| `src/app/api/cca/[ccaId]/updateMember/route.ts` | 84-90 | Debug `console.log` of member update payload | ℹ️ Info | Logs user/member mutation details unnecessarily. |

### Human Verification Required

After the blocking gaps are fixed, run these manual checks before blessing the module pattern for reuse:

### 1. Role-boundary regression check

**Test:** Log in as a user who has managed-position visibility but is not a lead/vice chair, open `/dashboard/mycca/admin`, and try to reach Manage Members or submit add/remove/update member actions.
**Expected:** The user can see only the views/actions intended for managed-position access; chair-only member-management controls and write actions are blocked.
**Why human:** The regression depends on real appointment data and UI affordances that cannot be exercised in this environment without live auth/session context.

### 2. AddMemberModal accessibility parity

**Test:** Open Add Member, tab through controls, press `Escape`, and press `Enter` in the search field.
**Expected:** Focus stays trapped inside the dialog, `Escape` closes it, and `Enter` triggers search without focus loss.
**Why human:** The code uses shadcn/Radix dialog primitives, but focus and keyboard behavior still need browser-level validation.

### 3. Partial-save retry workflow

**Test:** Cause one member mutation to fail during a multi-change save and inspect the UI state afterward.
**Expected:** Failed changes remain visible/pending so the user can review or retry them.
**Why human:** This depends on live API failure behavior and end-user retry flow, not just static code structure.

### Gaps Summary

The structural refactor itself largely landed: the feature module exists, the three hooks are wired, the ManageMembers page is below the line budget, and the extracted dialogs/tables are connected correctly. However, the new reusable management-access pattern is not safe to bless yet.

The phase introduced a behavior regression in the very utilities that are supposed to become the template for later refactors. `getManagedCcaAccess()` and `getManagedCcaData()` currently collapse “managed-position visibility” and “chair-only member-management authority” into the same permission path. That change flows through the admin page, the members API payload, and the add/remove/update routes, so the refactored management module no longer preserves the original access boundary. In addition, `useCcaMembers.saveAll()` clears failed edits immediately after partial-save errors, which weakens the user workflow the hook was meant to encapsulate.

Because the stated phase goal is not just decomposition but establishing a trustworthy pattern for subsequent refactors, these regressions are material. The module structure is present, but the behavior-preserving management pattern is not yet fully achieved.

---

_Verified: 2026-04-11T08:01:34Z_
_Verifier: Claude (gsd-verifier)_
