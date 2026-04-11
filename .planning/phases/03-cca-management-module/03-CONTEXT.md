# Phase 3: CCA Management Module - Context

**Gathered:** 2026-04-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 3 decomposes the monolithic CCA management pages into focused sub-components and custom hooks, then organizes them within a `src/features/cca/` module structure that serves as the pattern for all subsequent feature refactors (Phases 4-5).

This phase does **not** add new CCA features, change API routes, or modify database interactions. It restructures existing client-side code into a maintainable module architecture while preserving exact feature parity.

</domain>

<decisions>
## Implementation Decisions

### Feature Module Structure
- **D-01:** Full colocation — `src/features/cca/` contains `components/`, `hooks/`, `types/`, `utils/` sub-directories. Everything CCA-specific lives together.
- **D-02:** Shared UI components (badges, tables, shadcn primitives) stay in `src/components/`. Only CCA-specific components go in `features/cca/components/`.
- **D-03:** No barrel files (index.ts). Import directly from file paths (e.g., `@/features/cca/hooks/use-cca-members`). Matches existing codebase convention.

### Migration Strategy
- **D-04:** Move existing CCA lib files and update all imports in one pass. No re-export shims in `src/lib/`.
- **D-05:** Move CCA management files only: `cca-chair-access.ts`, `cca-management-access.ts`, `cca-member-management.ts`, `cca-cut-status.ts`. Leave ranking files (`cca-ranking-metrics.ts`, `cca-ranking-comments.ts`) in `src/lib/` for Phase 4 to move to `features/ranking/`.
- **D-06:** Move CCA-specific types (`CCAData`, `Member`, `Position`, `PendingChange`, `UserSearchResult`, `CutStatus`, `CommitmentPeriod`) from `src/types/dashboard.ts` to `features/cca/types/`. Shared types (`User`, `PositionType`, `CcaType`, `AuthenticatedUser`) stay in `src/types/`.

### Hook Design & Data Fetching
- **D-07:** Custom hooks with `useState`/`useEffect`/`fetch` — no new libraries. Each hook returns `{ data, loading, error, refetch }` pattern. React Query is explicitly out of scope per REQUIREMENTS.md.
- **D-08:** Granular hooks — one per data concern (e.g., `useCcaMembers()`, `useCcaList()`, `useManagedCcas()`). Pages compose multiple hooks.
- **D-09:** Hooks include mutation helpers alongside read state. `useCcaMembers()` returns both member data AND mutation functions (`addMember`, `removeMember`, `updateStatus`, `updateCommitment`, `saveAll`).
- **D-10:** Refetch after mutation — keep current pattern of refetching the full list after a successful save. No optimistic updates.
- **D-11:** Pending changes management stays inside `useCcaMembers` as internal state. The hook handles local edits and batch save as a single cohesive unit.

### ManageMembers Decomposition
- **D-12:** Decompose by concern into 4 pieces:
  - `useCcaMembers` hook — fetch, mutations, pending changes state
  - `MemberGroupTable` component — per-group table rendering with conditional columns and actions
  - `AddMemberModal` component — user search, form, selection
  - `SaveErrorDialog` component — error display after batch save
  - Page becomes ~100 lines composing these pieces
- **D-13:** Convert the raw div overlay Add Member modal to shadcn `Dialog` component for consistency and accessibility.
- **D-14:** Refactor all three CCA pages (ManageMembers 1111 lines, admin/page.tsx 210 lines, mycca/page.tsx 156 lines) — not just ManageMembers. Apply hook extraction pattern to all three for CCA-02 completeness.

### Claude's Discretion
- Exact hook file naming within `features/cca/hooks/` (e.g., `use-cca-members.ts` vs `useCcaMembers.ts`).
- How to split types between `features/cca/types/index.ts` vs multiple files.
- Whether utility helpers like `isChairPositionType`, `formatCommitmentPeriod`, `getGroupFromStatus` go in a utils file or stay co-located with the component that uses them.
- The specific column configuration approach for MemberGroupTable (inline vs config object).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase Definition
- `.planning/ROADMAP.md` — Phase 3 scope, success criteria (ManageMembers <150 lines, reusable hooks, `src/features/cca/` exists).
- `.planning/REQUIREMENTS.md` — `CCA-01`, `CCA-02`, `CCA-03` requirements and constraints.
- `.planning/PROJECT.md` — Project-level priorities, refactor-only constraint, locked tech stack.

### Primary Decomposition Target
- `src/app/dashboard/mycca/admin/manageMembers/[ccaName]/page.tsx` — 1111-line monolithic page (primary target for CCA-01).
- `src/app/dashboard/mycca/page.tsx` — 156-line MyCCAs page (secondary target for CCA-02).
- `src/app/dashboard/mycca/admin/page.tsx` — 210-line admin page (secondary target for CCA-02).

### CCA Lib Files to Migrate (D-05)
- `src/lib/cca-chair-access.ts` — Chair authorization checks, `AccessResult<T>` pattern.
- `src/lib/cca-management-access.ts` — Managed CCA access verification.
- `src/lib/cca-member-management.ts` — Member management permission rules.
- `src/lib/cca-cut-status.ts` — Cut status normalization logic.

### Existing Types to Split (D-06)
- `src/types/dashboard.ts` — Contains CCA-specific types (`CCAData`, `Member`, `Position`, `PendingChange`, `UserSearchResult`, `CutStatus`, `CommitmentPeriod`) mixed with other feature types.
- `src/types/User.ts` — Shared types that stay (`AuthenticatedUser`, `CcaType`, `PositionType`).
- `src/types/CCAPosition.ts` — CCA position interface.

### Existing Shared Components (stay in src/components/)
- `src/components/table/simple-table.tsx` — Used by ManageMembers for member tables.
- `src/components/badges/position-type-badge.tsx` — Used in member table columns.
- `src/components/layout/app-layout.tsx` — Page layout wrapper.
- `src/components/ui/dialog.tsx` — Target component for Add Member modal conversion (D-13).

### Prior Phase Context
- `.planning/phases/02-infrastructure-cleanup/02-CONTEXT.md` — Phase 2 decisions on types, Prettier, lib function patterns.

### Codebase Analysis
- `.planning/codebase/STRUCTURE.md` — Directory layout and naming conventions.
- `.planning/codebase/CONVENTIONS.md` — Code style, component patterns, import organization.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `SimpleTable<T>` component — generic sortable/filterable table with column config, already used in ManageMembers.
- `PositionTypeBadge` — badge component used in member table columns.
- `AppLayout` — page wrapper with sidebar and breadcrumbs.
- `Dialog`, `DropdownMenu` — shadcn primitives already imported in ManageMembers.
- `AccessResult<T>` pattern in `cca-chair-access.ts` and `cca-management-access.ts` — established authorization pattern.
- `LoadingSpinner` — existing loading component.

### Established Patterns
- Pages use `"use client"` + `useAuth()` + `useEffect` fetch pattern.
- API routes follow authenticate → fetch → authorize → mutate → respond pattern.
- Types exported from `src/types/` imported via `@/` alias.
- No barrel files anywhere — direct file path imports.
- `cn()` utility for conditional class merging.

### Integration Points
- ManageMembers page calls 4 API endpoints: `/api/cca/${ccaId}/members`, `/api/cca/${ccaId}/searchUsers`, `/api/cca/${ccaId}/addMember`, `/api/cca/${ccaId}/removeMember`, `/api/cca/${ccaId}/updateMember`.
- These API routes import from `src/lib/cca-chair-access.ts` and `src/lib/cca-management-access.ts` — imports must be updated when files move to `features/cca/utils/`.
- `src/app/dashboard/mycca/page.tsx` calls `/api/user/getCCAs`.
- `src/app/dashboard/mycca/admin/page.tsx` calls `/api/user/getManagedCCAs`.

</code_context>

<specifics>
## Specific Ideas

- The ManageMembers Add Member modal should be converted from raw div overlay to shadcn Dialog for consistency and accessibility.
- The `useCcaMembers` hook should be the flagship example of the hook pattern — subsequent phases will follow this template.
- All three CCA pages get refactored, not just ManageMembers, to fully satisfy CCA-02 (reusable hooks).

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 03-cca-management-module*
*Context gathered: 2026-04-11*
