# Phase 3: CCA Management Module - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-11
**Phase:** 03-cca-management-module
**Areas discussed:** Feature module structure, Migration strategy, Hook design & data fetching, ManageMembers decomposition

---

## Feature Module Structure

### Internal Organization

| Option | Description | Selected |
|--------|-------------|----------|
| Full colocation (Recommended) | src/features/cca/ contains components/, hooks/, types/, utils/. Shared UI stays in src/components/ui/. Existing lib files move into features/cca/utils/. | ✓ |
| Hooks + components only | Only new hooks and extracted sub-components in features/cca/. Existing lib stays in src/lib/. | |
| Flat feature folder | No sub-folders, all files flat in features/cca/. | |

**User's choice:** Full colocation
**Notes:** Sets the pattern for Phases 4-5 (ranking, allocation, subsidies).

### Shared UI Components

| Option | Description | Selected |
|--------|-------------|----------|
| Stay in src/components/ (Recommended) | Badges and tables are genuinely shared UI across features. Only CCA-specific components go in features/cca/. | ✓ |
| Copy into each feature | Each feature module gets its own copy. Maximum isolation but duplication. | |
| Move to features/shared/ | Create a cross-feature shared module. | |

**User's choice:** Stay in src/components/
**Notes:** None

### Barrel Files

| Option | Description | Selected |
|--------|-------------|----------|
| No barrel files (Recommended) | Import directly from file paths. Matches existing codebase pattern. | ✓ |
| Single barrel at root | features/cca/index.ts re-exports public API. | |

**User's choice:** No barrel files
**Notes:** None

---

## Migration Strategy

### File Migration Approach

| Option | Description | Selected |
|--------|-------------|----------|
| Move and update imports (Recommended) | Move files to features/cca/utils/, update all import paths in one pass. No re-export shims. | ✓ |
| Move with re-export shims | Move files but leave re-export shims in src/lib/ for zero breakage. | |
| Leave in src/lib/ | Don't move existing files. Only new code in features/. | |

**User's choice:** Move and update imports
**Notes:** Phase 2 adds Prettier so the diff from import changes is manageable.

### Which Files to Move

| Option | Description | Selected |
|--------|-------------|----------|
| CCA management only (Recommended) | Move 4 files (chair-access, management-access, member-management, cut-status). Leave ranking files for Phase 4. | ✓ |
| Move all CCA files | Move all 6 cca-*.ts files now. | |
| You decide | Claude decides based on import analysis. | |

**User's choice:** CCA management only
**Notes:** Clean boundary between CCA management and ranking domains.

### Type Migration

| Option | Description | Selected |
|--------|-------------|----------|
| Move CCA-specific types (Recommended) | CCAData, Member, Position, PendingChange move to features/cca/types/. Shared types stay in src/types/. | ✓ |
| Keep all types in src/types/ | Don't move types. | |
| You decide | Claude decides based on usage analysis. | |

**User's choice:** Move CCA-specific types
**Notes:** None

---

## Hook Design & Data Fetching

### State Management Pattern

| Option | Description | Selected |
|--------|-------------|----------|
| Custom hooks with useState/fetch (Recommended) | Wrap existing fetch pattern in hooks. Returns { data, loading, error, refetch }. No new dependencies. | ✓ |
| Introduce React Query | Add @tanstack/react-query. More powerful but explicitly excluded in REQUIREMENTS.md. | |
| You decide | Claude picks based on complexity. | |

**User's choice:** Custom hooks with useState/fetch
**Notes:** Matches project constraint of no React Query/SWR.

### Hook Granularity

| Option | Description | Selected |
|--------|-------------|----------|
| Granular hooks (Recommended) | One hook per data concern. Pages compose multiple hooks. Reusable across pages. | ✓ |
| Composite hooks per page | One hook per page. Simpler but not reusable. | |
| Both — granular + composed | Granular building blocks plus optional composite hooks. | |

**User's choice:** Granular hooks
**Notes:** None

### Mutation Handling

| Option | Description | Selected |
|--------|-------------|----------|
| Include mutations (Recommended) | Hooks return both data AND mutation functions. All member state management in one place. | ✓ |
| Read-only hooks | Hooks only handle fetching. Mutations stay inline. | |
| Separate mutation hooks | Read hooks and mutation hooks as separate exports. | |

**User's choice:** Include mutations
**Notes:** None

### Update Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Refetch after mutation (Recommended) | After successful save, refetch full list. Simple, consistent with server state. | ✓ |
| Optimistic local updates | Update local state immediately, sync with server. Snappier but complex. | |
| You decide | Claude picks based on data size. | |

**User's choice:** Refetch after mutation
**Notes:** Acceptable for CCA member list sizes (typically <100 members).

---

## ManageMembers Decomposition

### Decomposition Granularity

| Option | Description | Selected |
|--------|-------------|----------|
| By concern (Recommended) | useCcaMembers hook + MemberGroupTable + AddMemberModal + SaveErrorDialog. Page becomes ~100 lines. | ✓ |
| Minimal extraction | Only hook + modal. Page ~300 lines. | |
| Maximum extraction | Separate everything. Most files. | |

**User's choice:** By concern
**Notes:** None

### Add Member Modal Pattern

| Option | Description | Selected |
|--------|-------------|----------|
| Convert to Dialog (Recommended) | Replace raw div overlay with shadcn Dialog. Consistent UI, proper accessibility. | ✓ |
| Keep current overlay | Extract as-is, defer UI fix to Phase 6. | |
| You decide | Claude decides based on effort/risk. | |

**User's choice:** Convert to Dialog
**Notes:** None

### Pending Changes Location

| Option | Description | Selected |
|--------|-------------|----------|
| Inside useCcaMembers (Recommended) | Keep pending changes as internal state of the main hook. Simpler API. | ✓ |
| Separate usePendingChanges hook | Extract into its own hook. More modular but more coordination. | |
| You decide | Claude decides based on state dependencies. | |

**User's choice:** Inside useCcaMembers
**Notes:** None

### Page Scope

| Option | Description | Selected |
|--------|-------------|----------|
| All three CCA pages (Recommended) | Refactor ManageMembers + admin/page.tsx + mycca/page.tsx. Gets CCA-02 fully done. | ✓ |
| ManageMembers only | Focus on the 1111-line file only. | |
| You decide | Claude decides based on effort analysis. | |

**User's choice:** All three CCA pages
**Notes:** None

---

## Claude's Discretion

- Hook file naming convention within features/cca/hooks/
- Type file organization within features/cca/types/
- Placement of small utility helpers (isChairPositionType, formatCommitmentPeriod, etc.)
- Column configuration approach for MemberGroupTable

## Deferred Ideas

None — discussion stayed within phase scope.
