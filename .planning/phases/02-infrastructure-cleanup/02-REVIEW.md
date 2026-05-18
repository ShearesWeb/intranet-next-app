---
phase: 02-infrastructure-cleanup
reviewed: 2026-04-11T04:08:35Z
depth: standard
files_reviewed: 21
files_reviewed_list:
  - next.config.mjs
  - package.json
  - src/app/api/cca/[ccaId]/members/route.ts
  - src/app/api/cca/managedPositions/route.ts
  - src/app/api/cca/rankings/all/route.ts
  - src/app/api/holidaySubsidy/weekly/[ccaId]/[weekId]/route.ts
  - src/app/api/user/getCCAs/route.ts
  - src/app/api/user/getManagedCCAs/route.ts
  - src/app/dashboard/ccaAllocation/rank/page.tsx
  - src/app/dashboard/ccaAllocation/rankApplicants/page.tsx
  - src/app/dashboard/mycca/admin/manageMembers/[ccaName]/page.tsx
  - src/app/dashboard/mycca/admin/page.tsx
  - src/app/dashboard/mycca/admin/rankMembers/[ccaName]/page.tsx
  - src/app/dashboard/mycca/page.tsx
  - src/components/table/ordering-table.tsx
  - src/lib/__tests__/managed-cca-data.test.ts
  - src/lib/managed-cca-data.ts
  - src/types/cca-members.ts
  - src/types/holiday-subsidy-api.ts
  - src/types/sports-culture.ts
  - src/utils/supabase/middleware.ts
findings:
  critical: 2
  warning: 2
  info: 1
  total: 5
status: issues_found
---

# Phase 02: Code Review Report

**Reviewed:** 2026-04-11T04:08:35Z
**Depth:** standard
**Files Reviewed:** 21
**Status:** issues_found

## Summary

Reviewed the 21 source files in scope at standard depth and filtered out `package-lock.json` as a lockfile. The main risk area is the holiday subsidy API: it currently trusts request payloads too much and does not perform the same auth/access checks used by the other CCA routes in this change set.

I also found a user-facing workflow bug in the member-management modal, an API contract problem that hides backend failures as empty states, and a maintainability issue in the generic ordering table.

## Critical Issues

### CR-01: Holiday subsidy endpoints do not authenticate or authorize access to the target CCA

**File:** `src/app/api/holidaySubsidy/weekly/[ccaId]/[weekId]/route.ts:21-50,202-233`
**Issue:** Both `GET` and `POST` execute against arbitrary `ccaId` / `weekId` values after only checking the feature flag and parsing params. Unlike the other reviewed CCA APIs, this route never calls `fetchUserInfo()` and never verifies that the caller belongs to or manages the target CCA before reading appointments or mutating `user_subsidies`. That creates an authorization gap and leaves this route one policy mistake away from cross-CCA data exposure or modification.
**Fix:** Authenticate the caller first, then enforce per-CCA access before any query or mutation.

```ts
const supabase = await createClient();
const user = await fetchUserInfo();

if (!user) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

const access = await getManagedCcaAccess({
  supabase,
  requestingUser: user,
  cca: { id: ccaId },
});

if (!access.ok) {
  return NextResponse.json({ error: access.error }, { status: access.status });
}
```

### CR-02: Raw JSON values are interpolated into the delete filter, allowing over-broad deletion

**File:** `src/app/api/holidaySubsidy/weekly/[ccaId]/[weekId]/route.ts:245-251,313-323`
**Issue:** The `deletions` payload is only checked for truthiness, then `user_id` and `position_id` are concatenated directly into a Supabase `.or()` filter string. Because `request.json()` is untyped, a crafted string can change the filter expression and delete rows beyond the intended `(user_id, position_id)` pairs for the week.
**Fix:** Coerce and validate IDs as integers before use, then avoid building the filter string from raw input.

```ts
const parsedDeletions = deletions.map((del) => ({
  user_id: Number(del.user_id),
  position_id: Number(del.position_id),
}));

if (
  parsedDeletions.some(
    ({ user_id, position_id }) =>
      !Number.isInteger(user_id) || !Number.isInteger(position_id),
  )
) {
  return NextResponse.json({ error: "Invalid deletion payload" }, { status: 400 });
}

for (const del of parsedDeletions) {
  const { error } = await supabase
    .from("user_subsidies")
    .delete()
    .eq("week_id", weekIdNum)
    .eq("user_id", del.user_id)
    .eq("position_id", del.position_id);

  if (error) throw error;
}
```

## Warnings

### WR-01: Add-member modal can submit an invalid `position_id: 0`

**File:** `src/app/dashboard/mycca/admin/manageMembers/[ccaName]/page.tsx:125-131,1032-1046,1076-1084`
**Issue:** The modal state initializes `positionId` to `0`, but the position `<select>` only renders real position IDs and never synchronizes the first valid option into state. If the user selects a member and clicks **Confirm Add** without manually changing the dropdown, the page can submit `position_id: 0`, which causes avoidable add/update failures.
**Fix:** Initialize the form with the first valid selectable position and block confirmation when no valid position exists.

```ts
const selectablePositions = allPositions.filter(
  (pos) => !isChairPositionType(pos.position_type),
);

setAddForm({
  positionId: selectablePositions[0]?.id ?? 0,
  commitmentPeriod: "full-year",
});

if (!addForm.positionId) {
  toast.error("Please select a position");
  return;
}
```

### WR-02: `getCCAs` reports server failures as a successful empty list

**File:** `src/app/api/user/getCCAs/route.ts:50-53,123-125`
**Issue:** When the CCA metadata query fails, or when the handler hits its top-level catch, the route returns `200 { data: [] }` instead of an error. That makes production failures indistinguishable from a legitimate “no CCAs” state, so the dashboard can silently hide data and the UI loses the ability to show a retry/error state.
**Fix:** Return an explicit 5xx response for backend failures and let the caller render an error state.

```ts
if (ccasError) {
  console.error("Error fetching CCA metadata:", ccasError);
  return NextResponse.json({ error: "Failed to load CCA metadata" }, { status: 500 });
}

// ...

} catch (error) {
  console.error("Error fetching user CCAs:", error);
  return NextResponse.json({ error: "Failed to fetch user CCAs" }, { status: 500 });
}
```

## Info

### IN-01: Generic ordering table keys rows by index

**File:** `src/components/table/ordering-table.tsx:189-216`
**Issue:** `TableRow` uses `key={rowIndex}`. In a draggable list component, index keys cause React to preserve DOM/component state by slot rather than by logical item after a reorder. That is easy to miss now, but it becomes a real source of focus, animation, and state-mismatch bugs as soon as a row contains stateful children.
**Fix:** Accept a stable row-key getter and use it instead of the array index.

```ts
interface OrderingTableProps<TData> {
  data: TData[];
  columns: OrderingTableColumn<TData>[];
  onReorder: (newData: TData[]) => void;
  getRowKey: (row: TData) => React.Key;
}

// ...

<TableRow key={getRowKey(row)}>
```

---

_Reviewed: 2026-04-11T04:08:35Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
