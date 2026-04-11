# Phase 5: Allocation & Holiday Subsidy Modules - Context

**Gathered:** 2026-04-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 5 decomposes the CCA allocation pages (rankApplicants 597 lines, rank 302 lines, allocation index 192 lines) and holiday subsidy pages (weekly commitment 511 lines, approvals weekly 464 lines, declarations 168 lines, guide 343 lines, subsidy index 189 lines) into consistent feature module structures at `src/features/allocation/` and `src/features/holiday-subsidy/`. It also moves `HOLIDAY_WEEKS` from hardcoded constants to a JSON config file.

This phase does **not** add new allocation or subsidy features, change API route behavior, or modify database interactions. It restructures existing client-side code into the feature module pattern established in Phases 3 and 4, and externalizes the holiday week definitions.

</domain>

<decisions>
## Implementation Decisions

### HOLIDAY_WEEKS Data Source
- **D-01:** Move HOLIDAY_WEEKS from hardcoded `HOLIDAY_WEEK_DEFS` array in `src/lib/holiday-subsidy-weeks.ts` to a JSON config file at `src/config/holiday-weeks.json`.
- **D-02:** The JSON config contains week definitions (id, label, range, start date) plus a top-level `grace_days` field (currently hardcoded as `2` in `getPreviousWeekLockDeadline`).
- **D-03:** Editability logic (which weeks are editable based on current date + grace period) stays in TypeScript. The utility reads `grace_days` from the config instead of hardcoding it.
- **D-04:** The `holiday-subsidy-weeks.ts` utility reads the JSON at build time via import. No runtime HTTP fetch needed.

### Module Boundaries
- **D-05:** Two separate feature modules: `src/features/allocation/` and `src/features/holiday-subsidy/`. They are different domains (CCA preference ranking vs weekly subsidy tracking).
- **D-06:** SportsCulture types (`SportsCulturePosition`, `GroupedPositions`, `RankablePosition`, `Applicant`, `Position`) move from `src/types/dashboard.ts` into `features/allocation/types/`. These are all CCA application/preference types.
- **D-07:** Holiday subsidy types (`holiday-subsidy.ts` and `holiday-subsidy-api.ts`) move from `src/types/` into `features/holiday-subsidy/types/`. No re-export shims.
- **D-08:** `holiday-subsidy-weeks.ts` moves from `src/lib/` into `features/holiday-subsidy/utils/`.

### Decomposition Scope
- **D-09:** All 8 pages get full hook + component decomposition, not just the largest ones. Every page gets hook extraction and component splitting.
- **D-10:** The guide page (343 lines) gets full decomposition into section components (eligibility rules, subsidy rates, FAQ, etc.).
- **D-11:** The two holiday subsidy weekly pages (commitment 511 lines, approvals 464 lines) get independent hooks — `useWeeklyCommitment` and `useWeeklyApprovals`. They fetch from different API endpoints and have different mutation logic. No shared base hook.

### Search Component Reuse
- **D-12:** PositionSearchBox stays allocation-specific — extract into `features/allocation/components/`. The search endpoints and result handling differ from CCA member search; sharing would force unnecessary abstraction.

### Claude's Discretion
- Exact file naming within feature module sub-directories
- How to split types between multiple files within each feature's `types/` directory
- Which utility functions to extract vs keep inline in hooks
- Internal structure of the guide page section components
- How to structure the JSON config schema (field names, date format)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase Definition
- `.planning/ROADMAP.md` -- Phase 5 scope, success criteria (rankApplicants <150 lines, features/allocation/ and features/holiday-subsidy/ exist, HOLIDAY_WEEKS configurable).
- `.planning/REQUIREMENTS.md` -- `ALLOC-01`, `ALLOC-02`, `HSUB-01`, `HSUB-02` requirements.

### Allocation Decomposition Targets
- `src/app/dashboard/ccaAllocation/rankApplicants/page.tsx` -- 597-line applicant ranking page (ALLOC-01 primary target).
- `src/app/dashboard/ccaAllocation/rank/page.tsx` -- 302-line CCA preference ranking page.
- `src/app/dashboard/ccaAllocation/page.tsx` -- 192-line allocation index page.
- `src/app/dashboard/ccaAllocation/layout.tsx` -- 12-line feature flag gate layout.

### Holiday Subsidy Decomposition Targets
- `src/app/dashboard/holidaySubsidy/weekly/[ccaName]/page.tsx` -- 511-line weekly commitment page (largest subsidy page).
- `src/app/dashboard/holidaySubsidy/approvals/weekly/[ccaName]/page.tsx` -- 464-line weekly approvals page.
- `src/app/dashboard/holidaySubsidy/guide/page.tsx` -- 343-line guide page.
- `src/app/dashboard/holidaySubsidy/page.tsx` -- 189-line subsidy index page.
- `src/app/dashboard/holidaySubsidy/approvals/page.tsx` -- 168-line approvals index page.
- `src/app/dashboard/holidaySubsidy/declaration/page.tsx` -- declarations page.
- `src/app/dashboard/holidaySubsidy/layout.tsx` -- 12-line feature flag gate layout.

### HOLIDAY_WEEKS Source (D-01)
- `src/lib/holiday-subsidy-weeks.ts` -- 85-line utility with hardcoded HOLIDAY_WEEK_DEFS, editability logic, and week label helpers. Target for config migration.

### Types to Migrate
- `src/types/dashboard.ts` -- Contains allocation types (RankablePosition, SportsCulturePosition, GroupedPositions, Applicant, Position). Move to features/allocation/types/.
- `src/types/holiday-subsidy.ts` -- 57-line subsidy types (SubsidyStatus, SubsidyRow, SubsidyWithPosition, etc.). Move to features/holiday-subsidy/types/.
- `src/types/holiday-subsidy-api.ts` -- API-specific subsidy types. Move to features/holiday-subsidy/types/.

### API Routes (import paths update when types/utils move)
- `src/app/api/holidaySubsidy/declarations/[ccaId]/route.ts` -- 335 lines
- `src/app/api/holidaySubsidy/approvals/route.ts` -- 220 lines
- `src/app/api/holidaySubsidy/approvals/[ccaId]/route.ts` -- 231 lines
- `src/app/api/holidaySubsidy/approvals/weekly/[ccaId]/[weekId]/route.ts` -- 224 lines
- `src/app/api/holidaySubsidy/weekly/[ccaId]/[weekId]/route.ts` -- 350 lines
- `src/app/api/sportsCulture/apply/route.ts` -- 196 lines
- `src/app/api/sportsCulture/available/route.ts` -- 203 lines

### Phase 3 Module Pattern (template)
- `.planning/phases/03-cca-management-module/03-CONTEXT.md` -- Established feature module conventions (D-01 through D-14).
- `src/features/cca/` -- Reference implementation of the feature module pattern.

### Phase 4 Module Pattern (template)
- `.planning/phases/04-member-ranking-module/04-CONTEXT.md` -- Ranking module conventions.
- `src/features/ranking/` -- Second feature module implementation.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Phase 3 feature module pattern (`src/features/cca/`) -- hooks, types, utils, components structure to mirror.
- Phase 4 feature module pattern (`src/features/ranking/`) -- second module following the same pattern.
- `SelectionTable` component (`src/components/table/selection-table.tsx`) -- used by weekly commitment page.
- `SimpleTable` component (`src/components/table/simple-table.tsx`) -- available for tabular data.
- `Card`, `Tabs`, `Alert`, `Dialog` -- shadcn primitives already used across allocation and subsidy pages.
- `PositionTypeBadge` -- already used in allocation pages.
- `AppLayout`, `AppLoading`, `LoadingSpinner` -- standard page wrappers.
- `isCoreServiceEnabled()` + `ServiceDisabledState` -- feature flag gating pattern in layouts.

### Established Patterns
- `useEffect` + `fetch` for data loading (no React Query).
- Hooks return `{ data, loading, error }` pattern.
- No barrel files -- direct imports.
- `cn()` for conditional class merging.
- Feature flag gating via `isCoreServiceEnabled()` in layouts.
- `AccessResult<T>` pattern for authorization checks.
- No re-export shims when migrating files (Phase 3 D-04).
- Granular hooks, one per data concern (Phase 3 D-08).
- Hooks include mutation helpers alongside read state (Phase 3 D-09).

### Integration Points
- rankApplicants page calls `/api/cca/${ccaId}/searchUsers` -- shares search endpoint with CCA management.
- rank page calls `/api/sportsCulture/available` and `/api/sportsCulture/apply`.
- allocation index calls `/api/user/getCCAs` or similar for CCA list.
- Weekly commitment pages call `/api/holidaySubsidy/weekly/${ccaId}/${weekId}`.
- Approval pages call `/api/holidaySubsidy/approvals/` endpoints.
- Declaration page calls `/api/holidaySubsidy/declarations/${ccaId}`.
- `UserSearchResult` type is imported from `@/features/cca/types/members` by rankApplicants -- cross-module dependency.

</code_context>

<specifics>
## Specific Ideas

- The JSON config file at `src/config/holiday-weeks.json` should include a top-level `grace_days` field alongside the week definitions array, so the grace period is configurable without code changes.
- All 8 pages get equal treatment -- no "light touch" pages. The guide page should be decomposed into section components.
- Independent hooks for the two weekly pages despite structural similarity -- avoids premature abstraction.
- PositionSearchBox stays allocation-specific to avoid forced abstraction with the CCA search pattern.

</specifics>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope.

</deferred>

---

*Phase: 05-allocation-holiday-subsidy-modules*
*Context gathered: 2026-04-11*
