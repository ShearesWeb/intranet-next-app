---
phase: 03-cca-management-module
reviewed: 2026-04-11T07:57:41Z
depth: standard
files_reviewed: 22
files_reviewed_list:
  - src/features/cca/types/members.ts
  - src/features/cca/types/cca-data.ts
  - src/features/cca/utils/member-helpers.ts
  - src/features/cca/utils/cca-chair-access.ts
  - src/features/cca/utils/cca-management-access.ts
  - src/features/cca/utils/cca-member-management.ts
  - src/features/cca/utils/cca-cut-status.ts
  - src/features/cca/hooks/use-cca-list.ts
  - src/features/cca/hooks/use-managed-ccas.ts
  - src/features/cca/hooks/use-cca-members.ts
  - src/features/cca/components/member-group-table.tsx
  - src/features/cca/components/add-member-modal.tsx
  - src/features/cca/components/save-error-dialog.tsx
  - src/types/dashboard.ts
  - src/lib/managed-cca-data.ts
  - src/components/layout/app-sidebar.tsx
  - src/app/api/cca/[ccaId]/members/route.ts
  - src/app/api/cca/[ccaId]/addMember/route.ts
  - src/app/api/cca/[ccaId]/updateMember/route.ts
  - src/app/dashboard/mycca/page.tsx
  - src/app/dashboard/mycca/admin/page.tsx
  - src/app/dashboard/mycca/admin/manageMembers/[ccaName]/page.tsx
findings:
  critical: 1
  warning: 2
  info: 1
  total: 4
status: issues_found
---

# Phase 03: Code Review Report

**Reviewed:** 2026-04-11T07:57:41Z
**Depth:** standard
**Files Reviewed:** 22
**Status:** issues_found

## Summary

Reviewed the phase 03 CCA management module additions and integrations across the new hooks/components, the member-management API routes, and the managed-CCA navigation flow.

The feature is generally coherent, but there is one high-impact authorization regression: users with managed-position visibility are currently treated as full member managers. I also found two workflow/logic problems in the member-add/save flows and one leftover debug log.

## Critical Issues

### CR-01: Managed-position access is escalated into full member-management authority

**Files:**
- `src/features/cca/utils/cca-management-access.ts:57-61`
- `src/lib/managed-cca-data.ts:115-116`
- `src/app/api/cca/[ccaId]/addMember/route.ts:44-58`
- `src/app/api/cca/[ccaId]/updateMember/route.ts:64-77`
- `src/app/api/cca/[ccaId]/members/route.ts:179-183`

**Issue:** `getManagedCcaAccess()` grants access whenever a CCA has any managed positions (`hasManagedViewAccess`), and both write routes accept that result as sufficient authorization. On top of that, the API response marks `canManageMembers` true for `hasManagedPositions`, so the UI also exposes destructive controls. The route comment in `addMember/route.ts` says this should be limited to lead/vice users, but the implementation now lets non-chair managed-position users add members, remove members, and change cut/commitment data.

**Fix:** split read/ranking access from member-management access, and require chair access for add/remove/member-status mutations.

```ts
// src/features/cca/utils/cca-management-access.ts
export async function getManagedCcaAccess(...) {
  // ...existing lookup...

  return {
    ok: true,
    data: {
      hasChairAccess,
      hasManagedViewAccess,
      managedPositionIds,
      managedCca,
    },
  };
}

// src/app/api/cca/[ccaId]/addMember/route.ts
const authResult = await getManagedCcaAccess({ supabase, requestingUser, cca: ccaData });
if (!authResult.ok || !authResult.data.hasChairAccess) {
  return NextResponse.json({ error: "You are not authorized to manage this CCA" }, { status: 403 });
}

// src/lib/managed-cca-data.ts
can_manage_members: hasChairAccess,
can_rank_members: hasManagedPositions,
```

## Warnings

### WR-01: “Add Member” flow can still assign protected non-member positions

**Files:**
- `src/features/cca/components/add-member-modal.tsx:50-53`
- `src/app/dashboard/mycca/admin/manageMembers/[ccaName]/page.tsx:28-37`
- `src/app/api/cca/[ccaId]/addMember/route.ts:110-144`

**Issue:** the sports/culture manage-members page only exposes the add button from the `Members` section, and the `Team Manager` section is intentionally rendered without add/edit controls. However, `AddMemberModal` allows every non-chair position, and the backend accepts any position in the same CCA. That means a chair can use “Add Member” to appoint users directly into `team manager` (or any other non-chair role) even though the page layout implies those positions are not editable through this flow.

**Fix:** constrain the modal and the API to member-safe positions only for this workflow.

```ts
// add-member-modal.tsx
const availablePositions = useMemo(
  () => allPositions.filter((position) => position.position_type === "member"),
  [allPositions],
);

// addMember/route.ts
if (positionInfo.position_type !== "member") {
  return NextResponse.json({ error: "Only member positions can be added from this flow" }, { status: 400 });
}
```

### WR-02: Partial save failures are discarded after the automatic refetch

**File:** `src/features/cca/hooks/use-cca-members.ts:147,601-605`

**Issue:** when one or more mutations fail, `saveAll()` stores the error messages and then immediately calls `refetch()`. `refetch()` always resets `pendingChanges` to `[]`, so the failed edits disappear from client state even though they were not persisted. Users see an error dialog, but they cannot retry or inspect the unsaved changes from the UI anymore.

**Fix:** preserve failed changes instead of clearing everything on every refetch, or skip the refetch when `errorCount > 0` and only remove successfully applied entries.

```ts
if (errorCount > 0) {
  setSaveErrorsState(currentErrors);
  setPendingChanges(failedChanges);
} else {
  await refetch();
}
```

## Info

### IN-01: Debug logging leaks request payload details into server logs

**File:** `src/app/api/cca/[ccaId]/updateMember/route.ts:84-90`

**Issue:** the route still emits a `console.log` with user IDs, position IDs, cut status, commitment period, and comments. This is a leftover debug artifact and creates unnecessary log noise around member-management actions.

**Fix:** remove the log entirely or replace it with structured, non-sensitive debug logging behind an environment guard.

---

_Reviewed: 2026-04-11T07:57:41Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
