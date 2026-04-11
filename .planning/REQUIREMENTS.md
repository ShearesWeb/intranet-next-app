# Requirements: Intranet Next App -- Refactor & Overhaul

**Defined:** 2026-04-11
**Core Value:** Users can securely authenticate and manage CCA operations without session bleed or data leaking between accounts.

## v1 Requirements

Requirements for this milestone. Each maps to roadmap phases.

### Authentication & Security

- [x] **AUTH-01**: Fix SSR session bleed -- re-enable `setAll()` in middleware with proper cookie forwarding
- [x] **AUTH-02**: Upgrade `@supabase/ssr` to ^0.10.2 and `@supabase/supabase-js` to ^2.102.1
- [x] **AUTH-03**: Consolidate auth into two patterns -- middleware (route protection + token refresh) and AuthContext (client state)
- [x] **AUTH-04**: Remove `withAuth` HOC -- replace all usages with middleware + AuthContext pattern
- [x] **AUTH-05**: Set up Vitest with at least auth flow tests as safety net

### Infrastructure Cleanup

- [ ] **INFR-01**: Standardize on sonner -- migrate 7 files from react-hot-toast, remove package
- [ ] **INFR-02**: Remove unused dependencies (aphrodite, fs shim, logger)
- [ ] **INFR-03**: Fix self-calling API route -- extract shared logic from getCCAs/getManagedCCAs into lib function
- [ ] **INFR-04**: Enable ESLint during builds -- remove `ignoreDuringBuilds`, fix all lint errors
- [ ] **INFR-05**: Eliminate all `any` types -- replace 35+ eslint-disable directives with proper interfaces

### CCA Management Refactor

- [ ] **CCA-01**: Decompose ManageMembers page (1111 lines) into hooks, sub-components, and utilities
- [x] **CCA-02**: Extract CCA data fetching into reusable custom hooks
- [x] **CCA-03**: Establish feature module pattern (`src/features/cca/`) for reuse in subsequent refactors

### Member Ranking Refactor

- [ ] **RANK-01**: Decompose PointsRecapCard (1097 lines) into focused sub-components
- [ ] **RANK-02**: Decompose rankMembers page (565 lines) into hooks and components
- [ ] **RANK-03**: Fix non-atomic delete-then-insert in saveRankings with Supabase RPC transaction

### Allocation Refactor

- [ ] **ALLOC-01**: Decompose rankApplicants page (573 lines) into hooks and components
- [ ] **ALLOC-02**: Extract allocation business logic from page components into utilities

### Holiday Subsidy Refactor

- [ ] **HSUB-01**: Refactor holiday subsidy pages -- consistent patterns matching CCA module structure
- [ ] **HSUB-02**: Move hardcoded `HOLIDAY_WEEKS` to configurable data source

### UI Consistency

- [ ] **UI-01**: Standardize spacing, colors, and component patterns across all pages
- [ ] **UI-02**: Add error boundaries so broken components don't crash entire pages
- [ ] **UI-03**: Implement consistent loading/skeleton states across all pages

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Security Hardening

- **SEC-01**: Per-route auth checks inside API route handlers

### Developer Experience

- **FLAG-01**: Move feature flags from hardcoded constants to environment variables
- **SC-01**: Selective Server Component migration for read-heavy pages
- **DB-01**: Generate Supabase database types via `supabase gen types typescript`

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| New features beyond current functionality | This is a refactor, not a feature release |
| React Query / Redux / Zustand | Existing fetch + context pattern is sufficient |
| Server Actions replacing API routes | High risk, low ROI for this refactor |
| Mobile app | Web-only |
| Migration away from Supabase or Next.js | Framework stays |
| Real-time / websocket features | Not needed for current use cases |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 1 | Complete |
| AUTH-02 | Phase 1 | Complete |
| AUTH-03 | Phase 1 | Complete |
| AUTH-04 | Phase 1 | Complete |
| AUTH-05 | Phase 1 | Complete |
| INFR-01 | Phase 2 | Pending |
| INFR-02 | Phase 2 | Pending |
| INFR-03 | Phase 2 | Pending |
| INFR-04 | Phase 2 | Pending |
| INFR-05 | Phase 2 | Pending |
| CCA-01 | Phase 3 | Pending |
| CCA-02 | Phase 3 | Complete |
| CCA-03 | Phase 3 | Complete |
| RANK-01 | Phase 4 | Pending |
| RANK-02 | Phase 4 | Pending |
| RANK-03 | Phase 4 | Pending |
| ALLOC-01 | Phase 5 | Pending |
| ALLOC-02 | Phase 5 | Pending |
| HSUB-01 | Phase 5 | Pending |
| HSUB-02 | Phase 5 | Pending |
| UI-01 | Phase 6 | Pending |
| UI-02 | Phase 6 | Pending |
| UI-03 | Phase 6 | Pending |

**Coverage:**
- v1 requirements: 23 total
- Mapped to phases: 23
- Unmapped: 0

---
*Requirements defined: 2026-04-11*
*Last updated: 2026-04-11 after Phase 1 completion*
