# Phase 3: CCA Management Module - Research

**Researched:** 2026-04-11
**Domain:** React component decomposition, custom hooks, feature module architecture
**Confidence:** HIGH

## Summary

Phase 3 is a client-side refactoring phase that decomposes three monolithic CCA page components into a feature module structure at `src/features/cca/`. The primary target is the ManageMembers page (1092 lines) which contains inline data fetching, mutation logic, pending changes state management, modal UI, and table rendering all in a single file. Two secondary pages (MyCCAs at 156 lines, CCA Admin at 210 lines) also need hook extraction to satisfy CCA-02.

The refactoring involves four concerns: (1) moving CCA-specific lib files from `src/lib/` to `src/features/cca/utils/` and updating all import paths across the codebase, (2) splitting CCA-specific types from `src/types/dashboard.ts` into `src/features/cca/types/`, (3) extracting data fetching and mutation logic into reusable custom hooks, and (4) decomposing the ManageMembers page into focused sub-components. No new libraries are needed -- this is purely structural reorganization using existing React patterns and shadcn/ui primitives.

**Primary recommendation:** Execute as a sequence of waves: file moves with import updates first (foundational), then type splitting, then hook extraction, then component decomposition. Each wave should result in a working build.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Full colocation -- `src/features/cca/` contains `components/`, `hooks/`, `types/`, `utils/` sub-directories. Everything CCA-specific lives together.
- **D-02:** Shared UI components (badges, tables, shadcn primitives) stay in `src/components/`. Only CCA-specific components go in `features/cca/components/`.
- **D-03:** No barrel files (index.ts). Import directly from file paths (e.g., `@/features/cca/hooks/use-cca-members`). Matches existing codebase convention.
- **D-04:** Move existing CCA lib files and update all imports in one pass. No re-export shims in `src/lib/`.
- **D-05:** Move CCA management files only: `cca-chair-access.ts`, `cca-management-access.ts`, `cca-member-management.ts`, `cca-cut-status.ts`. Leave ranking files (`cca-ranking-metrics.ts`, `cca-ranking-comments.ts`) in `src/lib/` for Phase 4 to move to `features/ranking/`.
- **D-06:** Move CCA-specific types (`CCAData`, `Member`, `Position`, `PendingChange`, `UserSearchResult`, `CutStatus`, `CommitmentPeriod`) from `src/types/dashboard.ts` to `features/cca/types/`. Shared types (`User`, `PositionType`, `CcaType`, `AuthenticatedUser`) stay in `src/types/`.
- **D-07:** Custom hooks with `useState`/`useEffect`/`fetch` -- no new libraries. Each hook returns `{ data, loading, error, refetch }` pattern. React Query is explicitly out of scope per REQUIREMENTS.md.
- **D-08:** Granular hooks -- one per data concern (e.g., `useCcaMembers()`, `useCcaList()`, `useManagedCcas()`). Pages compose multiple hooks.
- **D-09:** Hooks include mutation helpers alongside read state. `useCcaMembers()` returns both member data AND mutation functions (`addMember`, `removeMember`, `updateStatus`, `updateCommitment`, `saveAll`).
- **D-10:** Refetch after mutation -- keep current pattern of refetching the full list after a successful save. No optimistic updates.
- **D-11:** Pending changes management stays inside `useCcaMembers` as internal state. The hook handles local edits and batch save as a single cohesive unit.
- **D-12:** Decompose by concern into 4 pieces: `useCcaMembers` hook, `MemberGroupTable` component, `AddMemberModal` component, `SaveErrorDialog` component. Page becomes ~100 lines.
- **D-13:** Convert the raw div overlay Add Member modal to shadcn `Dialog` component for consistency and accessibility.
- **D-14:** Refactor all three CCA pages (ManageMembers 1111 lines, admin/page.tsx 210 lines, mycca/page.tsx 156 lines) -- not just ManageMembers.

### Claude's Discretion
- Exact hook file naming within `features/cca/hooks/` (e.g., `use-cca-members.ts` vs `useCcaMembers.ts`).
- How to split types between `features/cca/types/index.ts` vs multiple files.
- Whether utility helpers like `isChairPositionType`, `formatCommitmentPeriod`, `getGroupFromStatus` go in a utils file or stay co-located with the component that uses them.
- The specific column configuration approach for MemberGroupTable (inline vs config object).

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CCA-01 | Decompose ManageMembers page (1111 lines) into hooks, sub-components, and utilities | D-12 decomposition plan; current page analysis shows 5 state groups, 7 handler functions, 2 modals, 1 render function extractable as components |
| CCA-02 | Extract CCA data fetching into reusable custom hooks | D-07/D-08/D-09 hook design; 3 pages share similar fetch-in-useEffect pattern ripe for extraction |
| CCA-03 | Establish feature module pattern (`src/features/cca/`) for reuse in subsequent refactors | D-01/D-03 module structure; D-04/D-05 file migration strategy; import dependency graph documented below |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | ^18 | Component framework | Already in project [VERIFIED: package.json] |
| Next.js | ^15.1.2 | App Router framework | Already in project [VERIFIED: package.json] |
| TypeScript | ^5.7.2 | Type safety | Already in project [VERIFIED: package.json] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @radix-ui/react-dialog | ^1.1.15 | Accessible modal dialogs | AddMemberModal conversion (D-13) [VERIFIED: package.json] |
| @radix-ui/react-dropdown-menu | ^2.1.16 | Member action menus | Already used in ManageMembers [VERIFIED: codebase] |
| sonner | ^2.0.7 | Toast notifications | Already the project standard [VERIFIED: package.json] |
| lucide-react | ^0.545.0 | Icons | Already in project [VERIFIED: package.json] |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom hooks | React Query / TanStack Query | Explicitly out of scope per REQUIREMENTS.md |
| Manual state | Zustand | Out of scope per REQUIREMENTS.md |

**Installation:**
```bash
# No new packages needed. All dependencies already installed.
```

## Architecture Patterns

### Recommended Feature Module Structure
```
src/features/cca/
  components/
    member-group-table.tsx      # Per-group table with conditional columns/actions
    add-member-modal.tsx        # User search + position/commitment form (shadcn Dialog)
    save-error-dialog.tsx       # Error display after batch save
    cca-admin-actions.tsx       # Action buttons column for admin table (optional)
  hooks/
    use-cca-members.ts          # Members fetch, mutations, pending changes for ManageMembers
    use-cca-list.ts             # CCA list fetch for MyCCAs page
    use-managed-ccas.ts         # Managed CCA fetch for Admin page
  types/
    members.ts                  # Member, PendingChange, UserSearchResult, CutStatus, CommitmentPeriod, GroupedMembers
    cca-data.ts                 # CCAData, ManagedCcaPosition (client-facing types)
  utils/
    cca-chair-access.ts         # Moved from src/lib/ (server-side, used by API routes)
    cca-management-access.ts    # Moved from src/lib/ (server-side, used by API routes)
    cca-member-management.ts    # Moved from src/lib/ (server-side, used by API routes)
    cca-cut-status.ts           # Moved from src/lib/ (server-side, used by API routes)
    member-helpers.ts           # Client-side helpers: isChairPositionType, formatCommitmentPeriod, getGroupFromStatus, getStatusLabel
```

### Pattern 1: Custom Data Fetching Hook
**What:** Encapsulate fetch + state management in a reusable hook
**When to use:** Any page that fetches data via API routes
**Example:**
```typescript
// Source: Derived from existing useRoleAuth pattern and D-07/D-08/D-09 decisions
// @/features/cca/hooks/use-cca-list.ts

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import type { CCAData } from "@/features/cca/types/cca-data";

export function useCcaList() {
  const { user } = useAuth();
  const [data, setData] = useState<CCAData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!user || !user.appointments?.length) {
      setData([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/user/getCCAs?includeAllAppointments=true");
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to fetch CCAs");
      }
      const json = await res.json();
      setData(json.data);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to fetch CCAs";
      console.error("Error fetching CCAs:", message);
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { data, loading, error, refetch };
}
```

### Pattern 2: Complex Hook with Mutations and Internal State (useCcaMembers)
**What:** Hook that manages read state, local pending changes, and batch mutations
**When to use:** ManageMembers page where local edits accumulate before a batch save
**Example:**
```typescript
// Source: Derived from ManageMembers page analysis, D-09/D-11 decisions
// @/features/cca/hooks/use-cca-members.ts

import { useState, useCallback } from "react";
import { toast } from "sonner";
import type { Member, PendingChange, GroupedMembers, CutStatus, CommitmentPeriod } from "@/features/cca/types/members";

interface UseCcaMembersReturn {
  // Read state
  groupedMembers: GroupedMembers;
  cca: { name: string; id: number } | null;
  permissions: { canManageMembers: boolean; ccaType: string; managementMessage: string };
  memberPositionId: number | null;
  allPositions: Array<{ id: number; name: string; position_type: string }>;
  loading: boolean;
  error: string | null;
  // Pending changes
  pendingChanges: PendingChange[];
  // Mutations
  addMember: (userId: number, userName: string, userEmail: string, userRoom?: string, positionId?: number, commitmentPeriod?: CommitmentPeriod) => void;
  removeMember: (userId: number, memberName: string) => void;
  updateStatus: (userId: number, memberName: string, newStatus: CutStatus | null) => void;
  updateCommitment: (userId: number, newPeriod: CommitmentPeriod) => void;
  saveAll: () => Promise<{ successCount: number; errors: string[] }>;
  // Refetch
  refetch: () => Promise<void>;
}

export function useCcaMembers(ccaId: string | null): UseCcaMembersReturn {
  // ... implementation extracted from ManageMembers page lines 98-630
}
```

### Pattern 3: Decomposed Component with Props from Hook
**What:** Presentational component that receives data and callbacks via props
**When to use:** All extracted sub-components
**Example:**
```typescript
// Source: Derived from ManageMembers renderMemberGroup function (lines 689-852)
// @/features/cca/components/member-group-table.tsx

import { SimpleTable, SimpleTableColumn } from "@/components/table/simple-table";
import type { Member, CutStatus, CommitmentPeriod } from "@/features/cca/types/members";

interface MemberGroupTableProps {
  title: string;
  members: Member[];
  canManage: boolean;
  ccaType: string;
  onRemoveMember: (userId: number, name: string) => void;
  onUpdateStatus: (userId: number, name: string, status: CutStatus | null) => void;
  onUpdateCommitment: (userId: number, period: CommitmentPeriod) => void;
  onAddMember?: () => void;
  showActions?: boolean;
  showAddButton?: boolean;
}

export function MemberGroupTable({ title, members, canManage, ccaType, ...callbacks }: MemberGroupTableProps) {
  // Column configuration and rendering extracted from renderMemberGroup
}
```

### Anti-Patterns to Avoid
- **Circular imports between features/cca/utils/ and src/lib/:** The `cca-management-access.ts` file imports from `cca-chair-access.ts`. Both must move together into `features/cca/utils/` in the same pass. [VERIFIED: codebase grep shows dependency chain]
- **Importing feature types in shared locations:** `src/types/cca-members.ts` currently imports from `src/types/dashboard.ts`. After the split, it should import from `@/features/cca/types/members` -- but `cca-members.ts` is also used by API routes. Need to move it into the feature module too. [VERIFIED: codebase grep]
- **Leaving re-export shims:** D-04 explicitly prohibits re-export shims. All import paths must be updated in one pass.
- **Splitting the hook too granularly:** The pending changes state in `useCcaMembers` is tightly coupled to the mutation functions. Splitting them into separate hooks would create coordination complexity. Keep as one cohesive hook per D-11.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Modal dialogs | Custom div overlay with z-index | shadcn `Dialog` (Radix UI) | Focus trapping, escape handling, accessibility, scroll locking [VERIFIED: existing Dialog component at src/components/ui/dialog.tsx] |
| Dropdown menus | Custom state + absolute positioning | shadcn `DropdownMenu` (Radix UI) | Already used in ManageMembers [VERIFIED: codebase] |
| Data tables | Custom table rendering | `SimpleTable<T>` | Already built and used throughout [VERIFIED: codebase] |
| Toast notifications | Custom error banners | `sonner` via `toast.error()` / `toast.success()` | Project standard [VERIFIED: CLAUDE.md] |

**Key insight:** This phase does not need any new UI primitives. The shadcn Dialog component already exists and has the exact API needed for the AddMemberModal conversion. The current ManageMembers page uses a raw `<div className="fixed inset-0">` overlay (lines 946-1077) which lacks focus trapping, keyboard navigation, and proper ARIA attributes.

## Common Pitfalls

### Pitfall 1: Import Path Update Misses
**What goes wrong:** After moving files from `src/lib/` to `src/features/cca/utils/`, some import paths are missed, causing build failures or runtime errors.
**Why it happens:** The files being moved have consumers across many directories -- API routes, layout components, hooks, and other lib files. The grep analysis shows:
- `cca-chair-access.ts`: 11 import sites (API routes, components, other lib files)
- `cca-management-access.ts`: 6 import sites (all API routes)
- `cca-member-management.ts`: 4 import sites (API routes)
- `cca-cut-status.ts`: 3 import sites (API routes)
**How to avoid:** Run `npm run build` after each file move to catch missing imports immediately. Use the grep results documented in this research to create a checklist.
**Warning signs:** TypeScript errors about missing modules.

### Pitfall 2: Type Split Breaking Cross-Feature Consumers
**What goes wrong:** Moving types from `src/types/dashboard.ts` breaks imports in files outside the CCA feature (allocation pages, ranking pages, points-recap-card).
**Why it happens:** `dashboard.ts` is a catch-all type file. Some types being moved (`CCAData`, `CutStatus`, `CommitmentPeriod`) are also imported by:
- `src/components/dashboard/points-recap-card.tsx` (imports `CCAData`)
- `src/app/dashboard/mycca/admin/rankMembers/[ccaName]/page.tsx` (imports `CutStatus`, `CommitmentPeriod`)
- `src/app/dashboard/ccaAllocation/rankApplicants/page.tsx` (imports `UserSearchResult`)
- `src/types/cca-members.ts` (imports `CommitmentPeriod`, `CutStatus`, `Member`)
**How to avoid:** After moving types to `features/cca/types/`, update ALL consumers -- not just the CCA pages. The types are now canonical in `features/cca/types/` and other features import from there. Verify with `npm run build`.
**Warning signs:** Build errors in files not directly being refactored.

### Pitfall 3: Stale State in Hook After Navigation
**What goes wrong:** Hook retains data from a previous CCA when navigating to manage a different CCA.
**Why it happens:** React component may not fully unmount/remount when only the dynamic route parameter changes in Next.js App Router.
**How to avoid:** The `useCcaMembers` hook must use `ccaId` in its dependency array for `useEffect`, and reset all state when `ccaId` changes. Current code does this via `fetchMembers` depending on `ccaId` -- preserve this pattern.
**Warning signs:** Seeing members from a different CCA briefly before new data loads.

### Pitfall 4: Breaking the managed-cca-data.ts Dependency
**What goes wrong:** `managed-cca-data.ts` imports `isChairPositionType` from `cca-chair-access.ts`. If `cca-chair-access.ts` moves but `managed-cca-data.ts` doesn't, the import breaks.
**Why it happens:** `managed-cca-data.ts` is NOT in the D-05 move list, but it has a dependency on a file that IS being moved.
**How to avoid:** When moving `cca-chair-access.ts`, update the import in `managed-cca-data.ts` to point to the new path `@/features/cca/utils/cca-chair-access`. This is a cross-boundary import (a `src/lib/` file importing from `src/features/cca/`) which is acceptable since the function is a pure utility.
**Warning signs:** Build failure in `managed-cca-data.ts`.

### Pitfall 5: app-sidebar.tsx Import of cca-chair-access
**What goes wrong:** The sidebar component (`src/components/layout/app-sidebar.tsx`) imports `checkCcaAuthorization` from `@/lib/cca-chair-access`. This is a shared layout component, not a CCA-specific one.
**Why it happens:** Authorization check is used in the sidebar to determine which navigation items to show.
**How to avoid:** Update the import path in `app-sidebar.tsx` to `@/features/cca/utils/cca-chair-access`. The sidebar is a shared component that depends on CCA logic -- the import crossing the boundary is intentional and acceptable.
**Warning signs:** Sidebar navigation breaks after file move.

## Code Examples

### Verified: Current Add Member Modal (to be converted to shadcn Dialog)
```typescript
// Source: ManageMembers page.tsx lines 946-1077
// CURRENT (raw div overlay -- lacks accessibility):
{showAddMemberModal && isSportsCulture && (
  <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50">
    <div className="bg-white p-6 rounded-xl w-[90%] max-w-[750px] max-h-[80vh] overflow-auto">
      {/* ... modal content ... */}
    </div>
  </div>
)}

// TARGET (shadcn Dialog -- accessible, keyboard-navigable):
<Dialog open={showAddMemberModal} onOpenChange={setShowAddMemberModal}>
  <DialogContent className="max-w-[750px] max-h-[80vh] overflow-auto">
    <DialogHeader>
      <DialogTitle>Add Member</DialogTitle>
    </DialogHeader>
    {/* ... same content, wrapped properly ... */}
  </DialogContent>
</Dialog>
```
[VERIFIED: Both the raw overlay pattern (ManageMembers page) and the Dialog component (src/components/ui/dialog.tsx) exist in codebase]

### Verified: Existing Error Dialog Pattern (reusable for SaveErrorDialog)
```typescript
// Source: ManageMembers page.tsx lines 1079-1106
// This already uses shadcn Dialog -- extract as standalone component:
<Dialog open={saveErrors.length > 0} onOpenChange={(open) => !open && setSaveErrors([])}>
  <DialogContent className="border-l-4 border-red-500 max-w-[500px]">
    <DialogHeader>
      <DialogTitle className="text-red-600 flex items-center gap-2">
        <AlertCircleIcon className="h-5 w-5" />
        Errors Occurred
      </DialogTitle>
      <DialogDescription>
        The following errors prevented some changes from being saved:
      </DialogDescription>
    </DialogHeader>
    <div className="space-y-2 my-4 max-h-60 overflow-y-auto">
      {saveErrors.map((err, idx) => (
        <div key={idx} className="p-3 bg-red-50 text-red-700 rounded-md text-sm border border-red-100 break-words">
          {err}
        </div>
      ))}
    </div>
  </DialogContent>
</Dialog>
```
[VERIFIED: codebase -- already uses shadcn Dialog]

### Verified: Duplicate Fetch Pattern Across Three Pages
```typescript
// Source: All three CCA pages share this exact pattern:
// mycca/page.tsx lines 66-100
// mycca/admin/page.tsx lines 77-111
// ManageMembers page.tsx lines 128-163

// All follow:
const [data, setData] = useState<T[]>([]);
const [loading, setLoading] = useState(true);
const [error, setError] = useState<string | null>(null);

useEffect(() => {
  if (!user) { setData([]); setLoading(false); return; }
  setLoading(true); setError(null);
  fetch('/api/...')
    .then(async (res) => { /* parse */ })
    .then((data) => { setData(data.data); })
    .catch((error) => { setError("..."); toast.error("..."); })
    .finally(() => { setLoading(false); });
}, [user]);
```
[VERIFIED: codebase -- identical pattern in all three files]

## Complete Import Dependency Map

This is the full list of files that import from the four lib files being moved. Every path listed must be updated when files move to `src/features/cca/utils/`.

### cca-chair-access.ts (11 consumers)
| Consumer File | Import Used |
|---------------|-------------|
| `src/lib/cca-management-access.ts` | `checkCcaAuthorization` |
| `src/lib/managed-cca-data.ts` | `isChairPositionType` |
| `src/app/api/user/checkRole/route.ts` | `checkCcaAuthorization` |
| `src/app/api/chair/positions/forChair/route.ts` | `checkCcaAuthorization` |
| `src/app/api/user/search/route.ts` | `checkCcaAuthorization` |
| `src/app/api/holidaySubsidy/declarations/[ccaId]/route.ts` | `checkCcaAuthorization` |
| `src/components/layout/app-sidebar.tsx` | `checkCcaAuthorization` |
| `src/app/api/user/getCCAs/route.ts` | `isChairPositionType` |
| `src/app/api/chair/positions/[position_id]/addApplicant/route.ts` | `checkCcaAuthorization` |
| `src/app/api/chair/positions/[position_id]/rank/route.ts` | `checkCcaAuthorization` |
| `src/app/api/chair/positions/[position_id]/removeApplicant/route.ts` | `checkCcaAuthorization` |

### cca-management-access.ts (6 consumers)
| Consumer File | Import Used |
|---------------|-------------|
| `src/app/api/cca/[ccaId]/members/route.ts` | `getManagedCcaAccess` |
| `src/app/api/cca/[ccaId]/addMember/route.ts` | `getManagedCcaAccess` |
| `src/app/api/cca/[ccaId]/rankings/route.ts` | `getManagedCcaAccess` |
| `src/app/api/cca/[ccaId]/searchUsers/route.ts` | `getManagedCcaAccess` |
| `src/app/api/cca/[ccaId]/removeMember/route.ts` | `getManagedCcaAccess` |
| `src/app/api/cca/[ccaId]/updateMember/route.ts` | `getManagedCcaAccess` |

### cca-member-management.ts (4 consumers)
| Consumer File | Import Used |
|---------------|-------------|
| `src/app/api/cca/[ccaId]/members/route.ts` | `canManageCcaMembers`, `getCcaMemberManagementDisabledMessage` |
| `src/app/api/cca/[ccaId]/updateMember/route.ts` | `canManageCcaMembers`, `getCcaMemberManagementDisabledMessage` |
| `src/app/api/cca/[ccaId]/addMember/route.ts` | `canManageCcaMembers`, `getCcaMemberManagementDisabledMessage` |
| `src/app/api/cca/[ccaId]/removeMember/route.ts` | `canManageCcaMembers`, `getCcaMemberManagementDisabledMessage` |

### cca-cut-status.ts (3 consumers)
| Consumer File | Import Used |
|---------------|-------------|
| `src/app/api/cca/[ccaId]/members/route.ts` | `normalizeCutStatusForCca` |
| `src/app/api/cca/[ccaId]/updateMember/route.ts` | `normalizeCutStatusForCca` |
| `src/app/api/cca/[ccaId]/rankings/route.ts` | `normalizeCutStatusForCca` |

### dashboard.ts Type Consumers (types to be moved per D-06)
| Consumer File | Types Used |
|---------------|------------|
| `src/app/dashboard/mycca/page.tsx` | `CCAData` |
| `src/app/dashboard/mycca/admin/page.tsx` | `CCAData` |
| `src/app/dashboard/mycca/admin/manageMembers/[ccaName]/page.tsx` | `Member`, `PendingChange`, `UserSearchResult`, `CutStatus`, `CommitmentPeriod` |
| `src/app/dashboard/mycca/admin/rankMembers/[ccaName]/page.tsx` | `CutStatus`, `CommitmentPeriod` |
| `src/app/dashboard/ccaAllocation/rankApplicants/page.tsx` | `Applicant`, `Position`, `UserSearchResult` |
| `src/app/dashboard/ccaAllocation/rank/page.tsx` | `RankablePosition` |
| `src/components/dashboard/points-recap-card.tsx` | `CCAData` |
| `src/types/cca-members.ts` | `CommitmentPeriod`, `CutStatus`, `Member` |

### cca-members.ts (Must also move to features/cca/types/)
The file `src/types/cca-members.ts` defines `GroupedMembers`, `MemberPermissions`, `MemberJoinPosition`, `MemberJoinUser`, `MemberWithJoins`, `MemberUpdate`. It imports from `dashboard.ts` and is consumed by the members API route. This file should move to `src/features/cca/types/` as well.

[VERIFIED: All dependency data from codebase grep]

## Discretion Recommendations

### Hook File Naming: Use kebab-case
**Recommendation:** `use-cca-members.ts`, `use-cca-list.ts`, `use-managed-ccas.ts`
**Rationale:** The existing codebase has mixed conventions (`use-mobile.ts` vs `useRoleAuth.ts`), but the kebab-case pattern matches the dominant file naming convention across `src/components/` and `src/lib/`. Since this is establishing a new feature module pattern, use the more common convention. [VERIFIED: codebase file listing shows kebab-case dominant]

### Type File Organization: Separate files, no index
**Recommendation:** Use two files in `features/cca/types/`:
- `members.ts` -- `Member`, `PendingChange`, `PendingChangeType`, `UserSearchResult`, `CutStatus`, `CommitmentPeriod`, `GroupedMembers`, `MemberPermissions`, `MemberJoinPosition`, `MemberJoinUser`, `MemberWithJoins`, `MemberUpdate`
- `cca-data.ts` -- `CCAData`, `ManagedCcaPosition`
**Rationale:** Matches D-03 (no barrel files). Keeps member-related types separate from CCA list types. The `cca-members.ts` types merge into `members.ts` since they are the same domain. [ASSUMED]

### Utility Helper Placement: Dedicated utils file
**Recommendation:** Create `features/cca/utils/member-helpers.ts` for client-side helpers (`isChairPositionType` duplicate, `formatCommitmentPeriod`, `getGroupFromStatus`, `getStatusLabel`, status option constants).
**Rationale:** These are used by both the hook and the component. Co-locating with either would create an import dependency in the wrong direction. A shared utils file within the feature module keeps them accessible to both. Note: The `isChairPositionType` in ManageMembers (line 38) is a duplicate of the one in `cca-chair-access.ts` -- the hook should import from `@/features/cca/utils/cca-chair-access` directly. [VERIFIED: duplicate function exists at ManageMembers line 38-41 and cca-chair-access.ts line 9-11]

### Column Configuration: Inline with helper
**Recommendation:** Define base `memberTableColumns` as a const array in `member-group-table.tsx`. Build the dynamic columns (actions, commitment) inside the component based on props. This matches the existing pattern where `ccaTableColumns` is defined at module scope in both `mycca/page.tsx` and `admin/page.tsx`.
**Rationale:** The column definitions are tightly coupled to the rendering concerns of the table component. Externalizing them adds indirection without benefit. [VERIFIED: existing pattern in mycca/page.tsx lines 15-58]

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Monolithic page components with inline logic | Feature modules with hooks + components | React 16.8+ (hooks, 2019) | Standard practice for any React codebase at scale [ASSUMED] |
| Raw div overlays for modals | Headless UI primitives (Radix Dialog) | 2022+ | Better accessibility, focus management, keyboard support [ASSUMED] |

**Deprecated/outdated:**
- `onKeyPress` is used in ManageMembers line 1016. This is deprecated in React 18 in favor of `onKeyDown`. Should be updated during the AddMemberModal extraction. [VERIFIED: React docs deprecation, codebase usage]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Two separate type files (members.ts, cca-data.ts) is the right granularity for the types directory | Discretion Recommendations | Low -- easy to merge or split further |
| A2 | Feature module pattern (src/features/) is the established React convention for domain organization | State of the Art | Very low -- widely adopted pattern |

## Open Questions

1. **Types shared across features after the split**
   - What we know: `CutStatus`, `CommitmentPeriod`, and `UserSearchResult` are used by both CCA management pages AND allocation/ranking pages. After moving them to `features/cca/types/`, other features will import from the CCA feature module.
   - What's unclear: Whether Phase 4/5 will want to re-export these types from their own feature modules or continue importing from `@/features/cca/types/`.
   - Recommendation: For now, other features import from `@/features/cca/types/members` directly. If Phase 4/5 finds this creates problematic coupling, the types can be promoted to a shared `src/types/` file at that point. This is a low-risk decision that can be revisited.

2. **Whether `src/types/cca-members.ts` should move to `features/cca/types/`**
   - What we know: It defines server-side types (`MemberWithJoins`, `MemberJoinPosition`) used by the members API route, plus `GroupedMembers` which is a client-side type.
   - What's unclear: D-06 lists specific types to move but doesn't mention `cca-members.ts` by name.
   - Recommendation: Move it. The types are CCA-specific and the API route will import from `@/features/cca/types/` just like it imports from `@/features/cca/utils/` for the lib files. Keeps the CCA domain fully colocated per D-01.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.4 |
| Config file | `vitest.config.mts` |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run --reporter=verbose` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CCA-01 | ManageMembers page < 150 lines | smoke (line count) | `wc -l src/app/dashboard/mycca/admin/manageMembers/[ccaName]/page.tsx` | N/A (shell check) |
| CCA-02 | Custom hooks exist and export correct shape | unit | `npx vitest run src/features/cca/hooks/ -x` | Wave 0 |
| CCA-03 | Feature module directory structure exists | smoke | `ls src/features/cca/{components,hooks,types,utils}` | N/A (shell check) |
| CCA-03 | All imports resolve after file moves | build | `npm run build` | N/A (build check) |
| CCA-01 | useCcaMembers hook returns expected interface | unit | `npx vitest run src/features/cca/hooks/use-cca-members.test.ts -x` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npm run build` (ensures no broken imports)
- **Per wave merge:** `npx vitest run --reporter=verbose` + `npm run build`
- **Phase gate:** Full suite green + build passes + ManageMembers < 150 lines

### Wave 0 Gaps
- [ ] `src/features/cca/hooks/__tests__/use-cca-members.test.ts` -- covers CCA-01/CCA-02 hook shape verification
- [ ] `src/features/cca/hooks/__tests__/use-cca-list.test.ts` -- covers CCA-02 hook extraction
- [ ] `src/features/cca/hooks/__tests__/use-managed-ccas.test.ts` -- covers CCA-02 hook extraction

**Note:** Component-level testing (MemberGroupTable, AddMemberModal) would require significant setup (React Testing Library, mock providers) and is lower priority than verifying the build succeeds and hooks have the correct interface. The primary validation for this refactoring phase is `npm run build` passing after each step.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | N/A -- no auth changes in this phase |
| V3 Session Management | no | N/A -- no session changes |
| V4 Access Control | yes (read-only) | Existing `checkCcaAuthorization` and `getManagedCcaAccess` patterns preserved -- files move but logic is unchanged |
| V5 Input Validation | no | N/A -- no new inputs, existing validation preserved |
| V6 Cryptography | no | N/A |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Authorization bypass via moved file | Tampering | Verify all API routes still import and call authorization checks after file moves [VERIFIED: dependency map above] |

**Security note:** This phase moves authorization utility files but does NOT modify any authorization logic. The `AccessResult<T>` pattern, `checkCcaAuthorization`, and `getManagedCcaAccess` functions remain functionally identical. The only risk is accidentally breaking an import that would cause an API route to skip authorization -- mitigated by the build check (`npm run build`) which will fail if imports are missing.

## Sources

### Primary (HIGH confidence)
- Codebase analysis via Read/Grep tools -- all file contents, import graphs, line counts verified directly
- `vitest.config.mts` -- test framework configuration verified
- `package.json` -- all dependency versions verified against installed packages

### Secondary (MEDIUM confidence)
- React documentation -- `onKeyPress` deprecation in favor of `onKeyDown`

### Tertiary (LOW confidence)
- None -- all findings verified against codebase

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new dependencies, all verified in package.json
- Architecture: HIGH -- feature module pattern derived directly from locked decisions and existing codebase patterns
- Pitfalls: HIGH -- complete import dependency graph verified via codebase grep
- Decomposition plan: HIGH -- full ManageMembers page read and analyzed line-by-line

**Research date:** 2026-04-11
**Valid until:** 2026-05-11 (stable -- refactoring phase, no external dependencies changing)
