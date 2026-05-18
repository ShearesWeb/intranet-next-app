# Phase 4: Member Ranking Module - Context

**Gathered:** 2026-04-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 4 decomposes the two large ranking components (PointsRecapCard at 1197 lines, rankMembers page at 615 lines) into focused sub-components and hooks within a `src/features/ranking/` module, cleans up the 417-line rankings API route, and fixes the non-atomic save operation in saveRankings with a Supabase RPC backed by a Liquibase migration.

This phase does **not** add new ranking features or change ranking business rules. It restructures existing code into the feature module pattern established in Phase 3 and fixes a data safety bug.

</domain>

<decisions>
## Implementation Decisions

### PointsRecapCard Decomposition
- **D-01:** Decompose by concern into 4 pieces:
  - `useRecapData` hook — CCA fetch, slide data generation via data-driven builder, seen-state management
  - `useRecapNavigation` hook — slide state, keyboard navigation, swipe/pan handling, pagination
  - `useRecapAudio` hook — audio preload, play, stop, cleanup
  - `RecapSlideContent` component — individual slide rendering (eyebrow, title, stat, bullets)
  - PointsRecapCard drops to ~100-150 lines composing these pieces
- **D-02:** Share image canvas drawing (400+ lines) → standalone utility function `createRecapImageBlob(user, ccas, recap)` returning `Promise<Blob>`. No React needed. Called from a small share button handler.
- **D-03:** Slide data generation → data-driven builder with category config array. Each category (culture, sports, committees, block, supplementary, adhoc) is a config entry with label, filter function, accent color. Reduces repetition across the 8 nearly-identical slide definitions.

### rankMembers Page Decomposition
- **D-04:** Mirror Phase 3 pattern:
  - `useRankingEditor` hook — state, fetch, save, ranking recalculation, change detection
  - `PositionRankingCard` component — per-group card with table, score selects, and remarks
  - Page drops to ~100 lines composing these pieces
- **D-05:** Ranking logic functions (recalculate rankings, build comparison snapshots, chunk payloads, get changed payloads) → `features/ranking/utils/` as pure testable functions.

### Atomic Save Fix (RANK-03)
- **D-06:** Create a Postgres function (Supabase RPC) that wraps DELETE+INSERT in a transaction for user CCA application preferences. Thin wrapper only — validation stays in TypeScript API route.
- **D-07:** Liquibase changelog goes in `db/changelog/`. User runs it through their own pipeline.
- **D-08:** `saveRankings/route.ts` updated to call the RPC instead of raw DELETE→INSERT. Route stays at `src/app/api/user/saveRankings/`.

### Module Location & File Migration
- **D-09:** PointsRecapCard and all extracted pieces move into `src/features/ranking/`. Dashboard page imports from `features/ranking/`.
- **D-10:** All ranking types (CCAMember, RankingsApiMember, PositionGroup, RankingSavePayload, etc.) → `features/ranking/types/`. Shared between hooks, components, and API routes.
- **D-11:** `cca-ranking-metrics.ts` and `cca-ranking-comments.ts` move from `src/lib/` to `features/ranking/utils/` (per Phase 3 D-05).
- **D-12:** Full cleanup of `rankings/route.ts` (417 lines) — extract helper functions to `features/ranking/utils/`, use shared types from `features/ranking/types/`.
- **D-13:** Add `memberRanking` feature flag gate to `rankMembers/layout.tsx`, consistent with the gating pattern used in holidaySubsidy and ccaAllocation layouts.

### Claude's Discretion
- Exact file naming within `features/ranking/` sub-directories
- How to split types between multiple files in `features/ranking/types/`
- Whether `RecapSlideContent` is one component or split further by slide variant (intro vs category vs reveal)
- Internal structure of the data-driven slide builder (single function vs config+builder pair)
- Whether to split `useRecapData` further (e.g., separate CCA fetch from slide generation)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase Definition
- `.planning/ROADMAP.md` — Phase 4 scope, success criteria (PointsRecapCard <200 lines, rankMembers <150 lines, atomic save).
- `.planning/REQUIREMENTS.md` — `RANK-01`, `RANK-02`, `RANK-03` requirements.
- `.planning/PROJECT.md` — Project-level priorities, refactor-only constraint.

### Primary Decomposition Targets
- `src/components/dashboard/points-recap-card.tsx` — 1197-line animated recap slideshow (RANK-01 target).
- `src/app/dashboard/mycca/admin/rankMembers/[ccaName]/page.tsx` — 615-line chair ranking page (RANK-02 target).
- `src/app/api/user/saveRankings/route.ts` — 61-line non-atomic save route (RANK-03 target).
- `src/app/api/cca/[ccaId]/rankings/route.ts` — 417-line rankings API (cleanup target).

### Ranking Lib Files to Migrate (D-11)
- `src/lib/cca-ranking-metrics.ts` — Score calculation, metric keys by CCA type.
- `src/lib/cca-ranking-comments.ts` — Comment field serialization/deserialization.

### Feature Flag Pattern Reference
- `src/app/dashboard/ccaAllocation/layout.tsx` — Example of feature flag gate in layout.
- `src/app/dashboard/holidaySubsidy/layout.tsx` — Another example of feature flag gate pattern.

### Phase 3 Module Pattern (template)
- `.planning/phases/03-cca-management-module/03-CONTEXT.md` — Established feature module conventions (D-01 through D-14).
- `src/features/cca/` — Reference implementation of the feature module pattern.

### Existing Shared Components
- `src/components/ui/card.tsx`, `src/components/ui/table.tsx` — Used in ranking tables.
- `src/components/ui/dialog.tsx` — Used in PointsRecapCard.
- `src/components/badges/position-type-badge.tsx` — Used in ranking tables.
- `src/components/layout/app-layout.tsx` — Page layout wrapper.

### Codebase Analysis
- `.planning/codebase/STRUCTURE.md` — Directory layout and naming conventions.
- `.planning/codebase/CONVENTIONS.md` — Code style, component patterns.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Phase 3 feature module pattern (`src/features/cca/`) — hooks, types, utils, components structure to mirror.
- `Dialog` component — already used by PointsRecapCard.
- `Card`, `Table`, `TableRow`, etc. — already used by rankMembers page.
- `PositionTypeBadge` — already used in ranking tables.
- `AppLayout`, `AppLoading`, `LoadingSpinner` — standard page wrappers.
- `AccessResult<T>` pattern — used by rankings API for authorization.
- `getManagedCcaAccess()` — already imported by rankings API from `features/cca/utils/`.
- Framer Motion (`AnimatePresence`, `motion`, `animate`) — used by PointsRecapCard for slide animations and counter.

### Established Patterns
- `useEffect` + `fetch` for data loading (no React Query).
- Hooks return `{ data, loading, error }` pattern (Phase 3).
- No barrel files — direct imports.
- `cn()` for conditional class merging.
- Feature flag gating via `isCoreServiceEnabled()` in layouts.
- Rankings POST already uses `.upsert()` with `onConflict` — atomic pattern exists.

### Integration Points
- rankMembers page calls `/api/cca/${ccaId}/rankings` for GET and POST.
- PointsRecapCard calls `/api/user/getCCAs` for CCA data.
- saveRankings route uses `user_cca_applications` table — needs RPC function.
- Rankings API imports `getManagedCcaAccess` from `features/cca/utils/` — cross-module dependency.
- Rankings API imports `extractRankingCommentFields`, `buildRankingComments` from `src/lib/cca-ranking-comments.ts` — imports update when files move.
- Dashboard page (`src/app/dashboard/page.tsx`) imports `PointsRecapCard` — import path updates when component moves.

</code_context>

<specifics>
## Specific Ideas

- The `useRankingEditor` hook should follow the same template as `useCcaMembers` from Phase 3 — fetch, mutations, pending state.
- The data-driven slide builder should make it easy to add/remove CCA categories without editing 50+ lines of slide definitions.
- The Liquibase changelog should be a standalone SQL file that can be reviewed and run independently.
- Feature flag gate in layout follows exact pattern of existing layouts (check flag, render `ServiceDisabledState` if disabled).

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 04-member-ranking-module*
*Context gathered: 2026-04-11*
