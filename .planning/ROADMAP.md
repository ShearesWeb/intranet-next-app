# Roadmap: Intranet Next App -- Refactor & Overhaul

## Overview

This roadmap takes a working but structurally compromised intranet application and transforms it into a secure, well-organized codebase. The journey starts with fixing a critical SSR session bleed bug, then establishes shared infrastructure patterns, before systematically decomposing each feature area (CCA, ranking, allocation, subsidies) into modular, well-typed components. It ends with a cross-cutting UI consistency and hardening pass. Every phase preserves existing feature parity -- this is purely a refactor, not a feature release.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Auth Fix & Security** - Fix SSR session bleed, upgrade Supabase packages, consolidate auth patterns, add test safety net (Completed 2026-04-11)
- [ ] **Phase 2: Infrastructure Cleanup** - Standardize toast library, remove dead dependencies, fix self-calling API route, enable ESLint, eliminate any types
- [ ] **Phase 3: CCA Management Module** - Decompose monolithic CCA pages into hooks and components, establish feature module pattern
- [ ] **Phase 4: Member Ranking Module** - Decompose ranking pages, fix non-atomic save operation with database transaction
- [ ] **Phase 5: Allocation & Holiday Subsidy Modules** - Decompose remaining feature areas into consistent module structure
- [ ] **Phase 6: UI Consistency & Hardening** - Standardize UI patterns, add error boundaries and loading states across all pages

## Phase Details

### Phase 1: Auth Fix & Security
**Goal**: Users can authenticate without any risk of seeing another user's data, with all auth patterns consolidated into a single clear approach
**Depends on**: Nothing (first phase)
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05
**Success Criteria** (what must be TRUE):
  1. User logs in via Google OAuth and their session persists correctly across page navigations and SSR renders -- no other user's data ever appears
  2. Refreshed auth tokens are written back to browser cookies by middleware, verified by inspecting Set-Cookie headers on SSR responses
  3. Auth follows exactly two patterns throughout the codebase: middleware for route protection and token refresh, AuthContext for client-side user state -- no withAuth HOC remains
  4. At least auth flow tests exist and pass via Vitest, covering login, session refresh, and route protection
**Plans:** 4 plans

Plans:
- [x] 01-01-PLAN.md -- Vitest setup and test scaffolds for all Phase 1 auth behaviors
- [x] 01-02-PLAN.md -- Supabase package upgrade and middleware session bleed fix
- [x] 01-03-PLAN.md -- Auth consolidation: remove withAuth HOC, unify redirects to /auth/login
- [x] 01-04-PLAN.md -- Final verification suite and manual Set-Cookie header inspection

### Phase 2: Infrastructure Cleanup
**Goal**: The codebase has a single toast library, no dead dependencies, no self-calling API routes, ESLint enforced on builds, and no `any` type suppressions
**Depends on**: Phase 1
**Requirements**: INFR-01, INFR-02, INFR-03, INFR-04, INFR-05
**Success Criteria** (what must be TRUE):
  1. All toast notifications use sonner -- react-hot-toast is uninstalled and zero imports of it remain in the codebase
  2. `npm ls aphrodite` and `npm ls logger` show these packages are not installed; no fs browser shim exists
  3. getCCAs and getManagedCCAs share logic via a lib function -- no API route calls another API route via HTTP
  4. `next build` runs ESLint and passes with zero errors; `ignoreDuringBuilds` is removed from next.config
  5. Zero `eslint-disable` directives for `@typescript-eslint/no-explicit-any` remain in the codebase -- all replaced with proper interfaces
**Plans:** 4 plans

Plans:
- [x] 02-01-PLAN.md -- Toast migration (react-hot-toast to sonner) and dead dependency removal
- [x] 02-02-PLAN.md -- Self-calling API route extraction into shared lib function
- [x] 02-03-PLAN.md -- Type safety (replace all any suppressions) and ESLint build enforcement
- [x] 02-04-PLAN.md -- Prettier setup and one-time codebase format pass

### Phase 3: CCA Management Module
**Goal**: CCA management pages are decomposed into focused components and hooks within a feature module structure that serves as the pattern for all subsequent refactors
**Depends on**: Phase 2
**Requirements**: CCA-01, CCA-02, CCA-03
**Success Criteria** (what must be TRUE):
  1. ManageMembers page file is under 150 lines, composing imported sub-components and custom hooks instead of containing inline logic
  2. CCA data fetching uses reusable custom hooks (not raw useEffect/useState/fetch repeated in each component)
  3. A `src/features/cca/` directory exists with components, hooks, and types -- establishing the module pattern for ranking, allocation, and subsidy refactors
**Plans:** 3 plans

Plans:
- [x] 03-01-PLAN.md -- Feature module structure, type splitting, and CCA lib file migration
- [ ] 03-02-PLAN.md -- Custom hook extraction for all three CCA pages
- [ ] 03-03-PLAN.md -- ManageMembers component decomposition (MemberGroupTable, AddMemberModal, SaveErrorDialog)

### Phase 4: Member Ranking Module
**Goal**: Ranking pages are decomposed into manageable components and the ranking save operation is atomic -- no data loss on partial failure
**Depends on**: Phase 3
**Requirements**: RANK-01, RANK-02, RANK-03
**Success Criteria** (what must be TRUE):
  1. PointsRecapCard file is under 200 lines, with ranking display, editing, and summary extracted into separate components
  2. rankMembers page file is under 150 lines, using custom hooks for state management and data fetching
  3. Saving rankings uses an atomic database operation (Supabase RPC or upsert) -- if the operation partially fails, previously saved rankings are not lost
**Plans**: TBD
**UI hint**: yes

### Phase 5: Allocation & Holiday Subsidy Modules
**Goal**: The remaining feature areas (allocation and holiday subsidies) are refactored into consistent module structures matching the CCA and ranking patterns
**Depends on**: Phase 4
**Requirements**: ALLOC-01, ALLOC-02, HSUB-01, HSUB-02
**Success Criteria** (what must be TRUE):
  1. rankApplicants page file is under 150 lines, with allocation logic extracted into utilities and components in `src/features/allocation/`
  2. Holiday subsidy pages follow the same module structure, with components and hooks in `src/features/holiday-subsidy/`
  3. `HOLIDAY_WEEKS` is loaded from a configurable data source (database or config file) -- not hardcoded in page components
**Plans**: TBD
**UI hint**: yes

### Phase 6: UI Consistency & Hardening
**Goal**: All pages share consistent visual patterns and gracefully handle errors and loading states instead of crashing or showing blank screens
**Depends on**: Phase 5
**Requirements**: UI-01, UI-02, UI-03
**Success Criteria** (what must be TRUE):
  1. Spacing, colors, and component usage patterns are consistent across all pages -- no page uses a visually different card, button, or layout style from others
  2. Every route segment under `/dashboard` has an `error.tsx` boundary so a broken component shows a recovery UI instead of crashing the page
  3. Every page that fetches data shows a skeleton or loading indicator during fetch -- no blank screens while data loads
**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Auth Fix & Security | 4/4 | Complete | 2026-04-11 |
| 2. Infrastructure Cleanup | 0/4 | Planning complete | - |
| 3. CCA Management Module | 0/3 | Planning complete | - |
| 4. Member Ranking Module | 0/? | Not started | - |
| 5. Allocation & Holiday Subsidy Modules | 0/? | Not started | - |
| 6. UI Consistency & Hardening | 0/? | Not started | - |
