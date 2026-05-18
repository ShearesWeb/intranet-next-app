# Phase 04: member-ranking-module - Research

**Researched:** 2026-04-11 [VERIFIED: session date]
**Domain:** Next.js feature-module refactor for ranking UX plus atomic Supabase-backed ranking persistence [VERIFIED: 04-CONTEXT.md + codebase]
**Confidence:** MEDIUM [VERIFIED: research synthesis]

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
Copied verbatim from `04-CONTEXT.md`. [VERIFIED: 04-CONTEXT.md]

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
Copied verbatim from `04-CONTEXT.md`. [VERIFIED: 04-CONTEXT.md]

- Exact file naming within `features/ranking/` sub-directories
- How to split types between multiple files in `features/ranking/types/`
- Whether `RecapSlideContent` is one component or split further by slide variant (intro vs category vs reveal)
- Internal structure of the data-driven slide builder (single function vs config+builder pair)
- Whether to split `useRecapData` further (e.g., separate CCA fetch from slide generation)

### Deferred Ideas (OUT OF SCOPE)
Copied verbatim from `04-CONTEXT.md`. [VERIFIED: 04-CONTEXT.md]

None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| RANK-01 | Decompose PointsRecapCard (1097 lines) into focused sub-components [VERIFIED: REQUIREMENTS.md] | Feature-module colocation, data-driven slide builder, extracted audio/navigation/data hooks, and pure canvas utility patterns support this split. [VERIFIED: 04-CONTEXT.md + points-recap-card.tsx + src/features/cca/] |
| RANK-02 | Decompose rankMembers page (565 lines) into hooks and components [VERIFIED: REQUIREMENTS.md] | Phase 3 hook/component pattern, current pure ranking helpers already embedded in the page, and existing shadcn/table composition patterns support a `useRankingEditor` + `PositionRankingCard` design. [VERIFIED: 04-CONTEXT.md + rankMembers page + use-cca-members.ts + member-group-table.tsx] |
| RANK-03 | Fix non-atomic delete-then-insert in saveRankings with Supabase RPC transaction [VERIFIED: REQUIREMENTS.md] | Supabase `rpc()` plus a Postgres function is the safest fit because the current route replaces the whole preference set and the current allocation UI allows deselection/removal, which plain upsert alone does not cover. [VERIFIED: saveRankings route + rank/page.tsx][CITED: https://supabase.com/docs/reference/javascript/rpc][CITED: https://supabase.com/docs/reference/javascript/upsert][CITED: https://www.postgresql.org/docs/18/tutorial-transactions.html] |
</phase_requirements>

## Summary

Phase 04 should be planned as a targeted feature-module refactor, not a behavior rewrite. The codebase already established the desired pattern in `src/features/cca/`: colocated `components/`, `hooks/`, `types/`, and `utils/`; direct imports; and hook-driven page composition. The ranking phase should mirror that exact structure for both the dashboard recap and the chair ranking UI. [VERIFIED: 03-CONTEXT.md + src/features/cca/ + CONVENTIONS.md]

The most important technical distinction is between the two ranking flows. Chair/member ranking already saves atomically enough for its semantics because `cca_member_rankings` uses `upsert(..., { onConflict: "user_id, position_id" })`, while user preference ranking still performs a destructive DELETE followed by INSERT in separate calls. Because the preference UI sends the full selected set and allows items to be removed, a pure upsert is not sufficient to preserve replacement semantics; an RPC-backed Postgres function that performs DELETE+INSERT inside one all-or-nothing database operation is the correct planning target. [VERIFIED: src/app/api/cca/[ccaId]/rankings/route.ts + src/app/api/user/saveRankings/route.ts + src/app/dashboard/ccaAllocation/rank/page.tsx][CITED: https://supabase.com/docs/reference/javascript/rpc][CITED: https://supabase.com/docs/reference/javascript/upsert][CITED: https://www.postgresql.org/docs/current/sql-insert.html][CITED: https://www.postgresql.org/docs/18/tutorial-transactions.html]

The highest planning risks are structural, not conceptual: the repo currently has no `db/` directory for Liquibase artifacts, the recap component mixes data fetch, slideshow state, audio lifecycle, and a very large canvas export utility in a single file, and the RPC migration still needs real-environment verification for grants/RLS after implementation. Plan Wave 0 around scaffolding, shared types/utils extraction, and tests for pure helpers before cutting the UI apart, then gate the atomic-save work on the explicit live-environment checkpoint in Plan 04-05. [VERIFIED: LS db not found + points-recap-card.tsx + STATE.md + 04-CONTEXT.md]

**Primary recommendation:** Mirror the Phase 3 feature-module pattern, extract ranking math and recap generation into pure utilities first, then switch `saveRankings` to a Supabase `rpc()`-called Postgres replacement function delivered through a new Liquibase changelog. [VERIFIED: 03-CONTEXT.md + 04-CONTEXT.md + codebase][CITED: https://supabase.com/docs/reference/javascript/rpc]

## Project Constraints (from .trae/rules/)

- No `.trae/rules/` directory exists in the repository root, so there are no additional project rule files to obey beyond existing repo conventions. [VERIFIED: LS /Users/bytedance/intranet-next-app/.trae -> not found]
- No `.trae/skills/` or `.agents/skills/` directories exist, so there are no project skill indexes to incorporate into this phase plan. [VERIFIED: LS /Users/bytedance/intranet-next-app/.trae -> not found + LS /Users/bytedance/intranet-next-app/.agents -> not found]
- Existing repo conventions still constrain planning: keep feature code under `src/features/{domain}/`, prefer direct `@/` imports, do not introduce barrel files, keep client data fetching on `useEffect` + `fetch`, and use `isCoreServiceEnabled()` for feature-gated layouts. [VERIFIED: CONVENTIONS.md + STRUCTURE.md + src/features/cca/ + existing layouts]

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@supabase/ssr` | `0.10.2` installed; latest `0.10.2` published `2026-04-09` [VERIFIED: package.json + npm registry] | Builds the auth-aware server client used by API routes. [VERIFIED: src/utils/supabase/server.ts] | This repo already centralizes server access through `createServerClient`, so the ranking refactor should keep using that path instead of inventing a second DB client layer. [VERIFIED: src/utils/supabase/server.ts + saveRankings route] |
| `@supabase/supabase-js` | `2.103.0` installed; latest `2.103.0` published `2026-04-09` [VERIFIED: package.json + npm registry] | Provides `rpc()` and `upsert()` semantics for ranking persistence. [CITED: https://supabase.com/docs/reference/javascript/rpc][CITED: https://supabase.com/docs/reference/javascript/upsert] | The repo already depends on Supabase for all ranking reads/writes, so the atomic save fix should use first-party primitives instead of custom HTTP/database glue. [VERIFIED: package.json + ranking routes] |
| `framer-motion` | `12.4.10` installed; npm latest is `12.38.0` published `2026-03-17` [VERIFIED: package.json + npm registry] | Powers recap slide animation, drag gestures, and number tweening. [VERIFIED: points-recap-card.tsx] | The phase is a refactor-only slice, so planning should preserve the installed animation library and just relocate responsibility into hooks/components. [VERIFIED: REQUIREMENTS.md out-of-scope + points-recap-card.tsx] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Vitest | `4.1.4` installed; latest `4.1.4` published `2026-04-09` [VERIFIED: package.json + vitest.config.mts + npm registry] | Unit-test extracted ranking and recap utilities. [VERIFIED: vitest.config.mts + existing tests] | Use for all new pure helper tests and route contract tests added in Wave 0. [VERIFIED: existing `*.test.*` files + nyquist_validation=true] |
| Liquibase formatted SQL changelog | Local CLI `4.33.0` available; repo folder absent [VERIFIED: liquibase --version + LS db not found] | Ships the Postgres function required by `saveRankings`. [VERIFIED: 04-CONTEXT.md] | Use for the RPC database function because the context explicitly says the user runs changelogs through their own pipeline. [VERIFIED: 04-CONTEXT.md][CITED: https://www.liquibase.com/secure/user-guide-5-1/sql-changelog-example] |
| shadcn/ui repo-local primitives (`Card`, `Table`, `Dialog`, `Button`, `Textarea`) | repo-local [VERIFIED: codebase] | Supplies the existing UI shell for ranking cards and recap dialog. [VERIFIED: points-recap-card.tsx + rankMembers page + member-group-table.tsx] | Reuse instead of creating new design-system wrappers during this refactor. [VERIFIED: codebase] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Postgres RPC replacement function [VERIFIED: recommendation] | Plain `upsert()` only [CITED: https://supabase.com/docs/reference/javascript/upsert] | `upsert()` handles insert/update conflicts, but it does not remove rows that disappear from the submitted preference set, so it does not match current replacement semantics by itself. [VERIFIED: saveRankings route + rank/page.tsx][CITED: https://www.postgresql.org/docs/current/sql-insert.html] |
| `useEffect` + `fetch` hooks [VERIFIED: repo pattern] | React Query / Zustand / Redux [VERIFIED: REQUIREMENTS.md out of scope] | New state/data libraries contradict explicit project scope and Phase 3 precedent. [VERIFIED: REQUIREMENTS.md + 03-CONTEXT.md + CONVENTIONS.md] |
| Feature-local `src/features/ranking/` module [VERIFIED: 04-CONTEXT.md] | Continue keeping ranking types/utils spread across page files and `src/lib/` [VERIFIED: current codebase] | Keeping ranking code split across pages and legacy libs is what made the current files exceed 417/615/1197 lines. [VERIFIED: wc -l + codebase] |

**Installation:**
```bash
# No new npm packages are required for Phase 04.
```
[VERIFIED: package.json + REQUIREMENTS.md out-of-scope]

**Version verification:** `@supabase/supabase-js`, `@supabase/ssr`, `framer-motion`, and `vitest` were checked against the npm registry in this session. [VERIFIED: npm view outputs]

## Architecture Patterns

### Recommended Project Structure
```text
src/
├── features/
│   └── ranking/                 # New feature-local ranking module [VERIFIED: 04-CONTEXT.md]
│       ├── components/          # UI-only recap and ranking card components [VERIFIED: 04-CONTEXT.md]
│       ├── hooks/               # `useRecap*` and `useRankingEditor` hooks [VERIFIED: 04-CONTEXT.md]
│       ├── types/               # Shared ranking contracts used by pages and routes [VERIFIED: 04-CONTEXT.md]
│       └── utils/               # Pure ranking math, slide builders, canvas helper, migrated metrics/comments [VERIFIED: 04-CONTEXT.md]
├── app/
│   ├── dashboard/               # Thin composition pages after extraction [VERIFIED: codebase + 04-CONTEXT.md]
│   └── api/                     # Existing route locations remain stable [VERIFIED: 04-CONTEXT.md]
└── components/
    └── ui/                      # Shared shadcn primitives stay shared [VERIFIED: 03-CONTEXT.md + STRUCTURE.md]
```

### Pattern 1: Feature-module colocation matching Phase 3
**What:** Put ranking-specific hooks, components, types, and pure utilities in `src/features/ranking/`, mirroring the working `src/features/cca/` structure. [VERIFIED: src/features/cca/ + 03-CONTEXT.md + 04-CONTEXT.md]

**When to use:** Use this for every extracted artifact that is specific to ranking behavior or recap rendering; keep generic UI primitives and shared app shell components outside the feature module. [VERIFIED: 03-CONTEXT.md + STRUCTURE.md]

**Example:**
```typescript
// Source: /Users/bytedance/intranet-next-app/src/features/cca/hooks/use-cca-members.ts
export function useCcaMembers(ccaId: string | null): UseCcaMembersReturn {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    const response = await fetch(`/api/cca/${ccaId}/members`);
    // state update and error handling...
  }, [ccaId]);

  return { loading, error, refetch, /* domain state + mutations */ };
}
```
[VERIFIED: codebase]

### Pattern 2: Extract ranking math into pure utilities before moving UI
**What:** Move `recalculateRankings`, snapshot builders, diffing, and chunking into `features/ranking/utils/` so the page hook coordinates state while pure functions own ordering logic. [VERIFIED: 04-CONTEXT.md + rankMembers page]

**When to use:** Use this for any logic that depends only on input arrays/records and not on React lifecycle or browser APIs. [VERIFIED: current rankMembers helper functions]

**Example:**
```typescript
// Source: /Users/bytedance/intranet-next-app/src/app/dashboard/mycca/admin/rankMembers/[ccaName]/page.tsx
const recalculateRankings = (items: CCAMember[], ccaType: string): CCAMember[] => {
  const grouped = new Map<number, CCAMember[]>();
  items.forEach((member) => {
    const existing = grouped.get(member.position_id) || [];
    existing.push(member);
    grouped.set(member.position_id, existing);
  });

  const ranked: CCAMember[] = [];
  grouped.forEach((positionMembers) => {
    ranked.push(...rankMembersWithinPosition(positionMembers, ccaType));
  });

  return ranked;
};
```
[VERIFIED: codebase]

### Pattern 3: Use an RPC boundary for whole-set preference replacement
**What:** Keep validation in the route, but move the destructive replace operation into a Postgres function invoked through `supabase.rpc()`. [VERIFIED: 04-CONTEXT.md][CITED: https://supabase.com/docs/reference/javascript/rpc]

**When to use:** Use this only for the user preference ranking flow that semantically replaces the entire saved set. Continue using direct `upsert()` for `cca_member_rankings`, where per-row insert/update semantics already match the feature. [VERIFIED: saveRankings route + rankings route][CITED: https://supabase.com/docs/reference/javascript/upsert]

**Example:**
```typescript
// Source pattern: https://supabase.com/docs/reference/javascript/rpc
const { error } = await supabase.rpc("replace_user_cca_rankings", {
  p_user_id: userId,
  p_rankings: preferences,
});
```
[CITED: https://supabase.com/docs/reference/javascript/rpc]

### Anti-Patterns to Avoid
- **Monolithic feature files:** Keeping fetch state, slideshow state, audio lifecycle, canvas export, and JSX in `points-recap-card.tsx` or `rankMembers/page.tsx` will preserve the exact maintainability problem this phase is meant to remove. [VERIFIED: points-recap-card.tsx + rankMembers page + file line counts]
- **JS-managed DELETE then INSERT for whole-set save:** The current `saveRankings` route can lose previously saved rankings if insertion fails after deletion. [VERIFIED: saveRankings route][CITED: https://www.postgresql.org/docs/18/tutorial-transactions.html]
- **Introducing new client-state libraries:** React Query, Redux, and Zustand are explicitly out of scope. [VERIFIED: REQUIREMENTS.md]
- **Adding a second feature-flag gate path:** `rankMembers/layout.tsx` already gates `memberRanking` with the JCRC override path, so the plan should preserve or adjust that file rather than duplicate the check inside the page. [VERIFIED: src/app/dashboard/mycca/admin/rankMembers/layout.tsx + src/lib/feature-flags.ts]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Whole-set preference replacement | A route-level DELETE call followed by a separate INSERT call [VERIFIED: current saveRankings route] | Postgres function called via `supabase.rpc()` [VERIFIED: 04-CONTEXT.md][CITED: https://supabase.com/docs/reference/javascript/rpc] | PostgreSQL transactions provide all-or-nothing behavior for multi-step updates, which is exactly what this route lacks today. [CITED: https://www.postgresql.org/docs/18/tutorial-transactions.html] |
| Per-row ranking merge logic | Custom handwritten conflict resolution SQL for `cca_member_rankings` [VERIFIED: existing route] | Supabase `.upsert(..., { onConflict: "user_id, position_id" })` [VERIFIED: rankings route][CITED: https://supabase.com/docs/reference/javascript/upsert] | The repo already uses the right primitive for row-level ranking updates; keep it and just relocate helpers/types. [VERIFIED: rankings route] |
| Repeated recap slide definitions | Eight near-identical inline slide objects plus duplicated category filters [VERIFIED: points-recap-card.tsx + 04-CONTEXT.md] | Data-driven category config + slide builder [VERIFIED: 04-CONTEXT.md] | A config-driven builder is easier to test, shorter, and safer to change than duplicated slide declarations. [VERIFIED: 04-CONTEXT.md + points-recap-card.tsx] |
| Custom modal or table shells for ranking UI | New ad-hoc layout primitives [VERIFIED: current codebase has shared UI] | Existing `Dialog`, `Card`, `Table`, `Button`, `Textarea`, and badge components [VERIFIED: codebase] | Shared primitives already cover the required UX and keep Phase 04 inside refactor scope. [VERIFIED: points-recap-card.tsx + rankMembers page + member-group-table.tsx] |

**Key insight:** The only genuinely new infrastructure this phase needs is a database function plus its migration artifact; everything else should be an extraction and reassembly of patterns that already work elsewhere in this repo. [VERIFIED: 04-CONTEXT.md + src/features/cca/ + saveRankings route]

## Runtime State Inventory

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `user_cca_applications` stores the preference rankings that `saveRankings` replaces, and `cca_member_rankings` stores chair ranking data already saved with upsert semantics. [VERIFIED: saveRankings route + getRankablePositions route + rankings route] | `user_cca_applications`: code edit **plus** DB migration for a replacement RPC; no historical backfill was identified from repo evidence. `cca_member_rankings`: code edit only when moving helper imports/types. [VERIFIED: codebase][ASSUMED: no hidden data backfill is required because row shape is unchanged] |
| Live service config | No external UI-managed ranking service configuration was found in the repo; feature gating is code-based in `src/lib/feature-flags.ts`, and `rankMembers/layout.tsx` already consumes it. [VERIFIED: feature-flags.ts + rankMembers/layout.tsx] | None in git-managed code; preserve existing `memberRanking` gate and verify no remote dashboards/workflows depend on the old file paths if the team has external observability outside this repo. [VERIFIED: codebase][ASSUMED: no external service config exists outside git] |
| OS-registered state | None found in the repository, and this phase does not rename binaries, services, schedulers, or app identifiers. [VERIFIED: codebase scope + 04-CONTEXT.md] | None. [VERIFIED: research synthesis] |
| Secrets/env vars | Supabase access continues to use `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY`, and `NEXT_PUBLIC_SUPABASE_ANON_KEY`; no ranking-specific env var names were found. [VERIFIED: src/utils/supabase/server.ts + sst.config.ts + grep results] | No env rename required; RPC should continue through the existing authenticated server client. [VERIFIED: src/utils/supabase/server.ts][ASSUMED: current auth/RLS policy is sufficient for the new function without extra secret material] |
| Build artifacts | No ranking-specific generated artifacts were found, but the repo also has no `db/` directory yet. [VERIFIED: LS db not found] | Create `db/changelog/` as new source-controlled scaffolding for the Liquibase file; no reinstall/rebuild artifact migration was identified. [VERIFIED: 04-CONTEXT.md + LS db not found] |

**Nothing found in category:** OS-registered state — none found from repo inspection. [VERIFIED: codebase]

## Common Pitfalls

### Pitfall 1: Treating `upsert()` as a whole-set replacement tool
**What goes wrong:** Deleted preferences remain in `user_cca_applications` if the new payload omits them, because upsert only inserts new rows or updates conflicting rows. [VERIFIED: rank/page.tsx + saveRankings route][CITED: https://supabase.com/docs/reference/javascript/upsert][CITED: https://www.postgresql.org/docs/current/sql-insert.html]

**Why it happens:** The allocation UI sends the currently selected positions only, and the current route explicitly models save as “replace everything for this user.” [VERIFIED: rank/page.tsx + saveRankings route]

**How to avoid:** Keep replacement semantics in the database with one RPC-backed function that deletes the old set and inserts the new set atomically. [VERIFIED: 04-CONTEXT.md][CITED: https://supabase.com/docs/reference/javascript/rpc][CITED: https://www.postgresql.org/docs/18/tutorial-transactions.html]

**Warning signs:** A plan that proposes `.upsert(preferences)` with no deletion strategy, or one that still performs two separate DB calls from the route. [VERIFIED: research synthesis]

### Pitfall 2: Using `SECURITY DEFINER` carelessly on the new RPC function
**What goes wrong:** A definer function can accidentally run with broader privileges than intended or resolve objects through an unsafe `search_path`. [CITED: https://supabase.com/docs/guides/database/functions][CITED: https://www.postgresql.org/docs/current/sql-createfunction.html]

**Why it happens:** PostgreSQL defaults to `SECURITY INVOKER`, but teams sometimes switch to `SECURITY DEFINER` to bypass permission issues without locking down execute grants and schema qualification. [CITED: https://www.postgresql.org/docs/current/sql-createfunction.html][CITED: https://supabase.com/docs/guides/database/functions]

**How to avoid:** Prefer `SECURITY INVOKER` unless verified RLS or privilege constraints force something else; if `SECURITY DEFINER` is necessary, set `search_path` explicitly and restrict execute privileges. [CITED: https://supabase.com/docs/guides/database/functions][CITED: https://www.postgresql.org/docs/current/sql-createfunction.html]

**Warning signs:** The migration adds `SECURITY DEFINER` with no `search_path`, no schema qualification, or no grant/revoke review. [CITED: https://www.postgresql.org/docs/current/sql-createfunction.html]

### Pitfall 3: Breaking behavioral parity while extracting hooks/components
**What goes wrong:** Refactor tasks accidentally change fetch URLs, toast messages, page navigation, or score/ranking recalculation timing. [VERIFIED: rankMembers page + STATE.md]

**Why it happens:** The current pages interleave domain logic with UI concerns, so moving code around can subtly alter when state recalculates or when errors surface. [VERIFIED: points-recap-card.tsx + rankMembers page]

**How to avoid:** Extract pure utilities first, keep existing endpoint URLs and user-visible strings stable, and make the new hooks return data/loading/error/mutation state in the same style as Phase 3. [VERIFIED: 03-CONTEXT.md + use-cca-members.ts + STATE.md]

**Warning signs:** New hooks that rename endpoints, change toast copy, or recompute ranking order in more than one place. [VERIFIED: research synthesis]

### Pitfall 4: Planning a Liquibase change without repo scaffolding
**What goes wrong:** The planner assumes an existing migration structure, but the repository currently has no `db/` directory to hold the changelog. [VERIFIED: LS db not found]

**Why it happens:** The context decided on Liquibase, but the codebase has not yet been prepared for it. [VERIFIED: 04-CONTEXT.md + LS db not found]

**How to avoid:** Put `db/changelog/` creation in Wave 0 and confirm the exact root changelog/include convention the user pipeline expects before finalizing file names. [VERIFIED: 04-CONTEXT.md][ASSUMED: the user pipeline wants a root/include convention rather than one-off manual execution]

**Warning signs:** A plan that names a changelog file but never creates the directory structure or never states how the file gets discovered by the pipeline. [VERIFIED: research synthesis]

## Code Examples

Verified patterns from official sources and the current codebase:

### Calling a Postgres function with Supabase JS
```typescript
// Source: https://supabase.com/docs/reference/javascript/rpc
const { data, error } = await supabase.rpc("hello_world");
```
[CITED: https://supabase.com/docs/reference/javascript/rpc]

### Upserting row-level rankings by conflict key
```typescript
// Source pattern: https://supabase.com/docs/reference/javascript/upsert
const { error } = await supabase
  .from("cca_member_rankings")
  .upsert(rankingsToUpsert, { onConflict: "user_id, position_id" });
```
[CITED: https://supabase.com/docs/reference/javascript/upsert][VERIFIED: src/app/api/cca/[ccaId]/rankings/route.ts]

### Thin page hook pattern to mirror from Phase 3
```typescript
// Source: /Users/bytedance/intranet-next-app/src/features/cca/hooks/use-cca-members.ts
const refetch = useCallback(async () => {
  try {
    setLoading(true);
    const response = await fetch(`/api/cca/${ccaId}/members`);
    if (!response.ok) throw new Error("Failed to fetch members");
    const data = await response.json();
    setError(null);
    return data;
  } finally {
    setLoading(false);
  }
}, [ccaId]);
```
[VERIFIED: codebase]

### Pure helper extraction target from `rankMembers`
```typescript
// Source: /Users/bytedance/intranet-next-app/src/app/dashboard/mycca/admin/rankMembers/[ccaName]/page.tsx
const getChangedRankingPayloads = (members: CCAMember[], initialMembers: CCAMember[]) => {
  const initialSnapshots = new Map(
    initialMembers.map((member) => [member.row_key, buildMemberComparisonSnapshot(member)]),
  );

  return [...members]
    .sort((a, b) => a.position_id - b.position_id || a.ranking - b.ranking || a.user_id - b.user_id)
    .filter((member) => initialSnapshots.get(member.row_key) !== buildMemberComparisonSnapshot(member))
    .map(toRankingSavePayload);
};
```
[VERIFIED: codebase]

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Large dashboard/admin feature files with inline domain logic [VERIFIED: current ranking files] | Feature-local modules with colocated hooks/components/types/utils [VERIFIED: Phase 3 implementation] | Phase 3 established this on `2026-04-11`. [VERIFIED: 03-CONTEXT.md + STATE.md] | Phase 04 should reuse a proven repo pattern instead of inventing a new structure. [VERIFIED: research synthesis] |
| Route-managed delete then insert for full preference replacement [VERIFIED: current saveRankings route] | Database-managed transactional replacement via RPC-backed function [VERIFIED: 04-CONTEXT.md][CITED: https://supabase.com/docs/reference/javascript/rpc][CITED: https://www.postgresql.org/docs/18/tutorial-transactions.html] | Required by Phase 04. [VERIFIED: 04-CONTEXT.md + REQUIREMENTS.md] | Prevents partial-failure data loss. [VERIFIED: research synthesis] |
| Inline duplicated recap slide/category logic [VERIFIED: points-recap-card.tsx] | Data-driven category config + builder [VERIFIED: 04-CONTEXT.md] | Planned for Phase 04. [VERIFIED: 04-CONTEXT.md] | Makes recap behavior easier to test and extend without another 1000-line component. [VERIFIED: research synthesis] |

**Deprecated/outdated:**
- `src/lib/cca-ranking-metrics.ts` and `src/lib/cca-ranking-comments.ts` are legacy locations for ranking-specific helpers and should move to `src/features/ranking/utils/` during this phase. [VERIFIED: 04-CONTEXT.md + current file locations]
- The planning docs in `.planning/codebase/STRUCTURE.md` say no tests exist, but the current repo now has Vitest config and several `*.test.*` files, so planning should trust the live codebase over that older snapshot. [VERIFIED: STRUCTURE.md + vitest.config.mts + Glob results]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | No hidden data backfill is required for `user_cca_applications` because the row shape is unchanged and only the write path changes. [ASSUMED] | Runtime State Inventory | A hidden schema-side dependency could require a data migration task, not just a function swap. |
| A2 | No external service configuration outside git depends on old ranking file paths or module names. [ASSUMED] | Runtime State Inventory | External dashboards/workflows could break silently after refactor if they import or scrape these paths. |
| A3 | Planning now locks the first implementation to `SECURITY INVOKER` because the current authenticated route already performs the same table writes directly; real-environment verification in Plan 04-05 must capture any grants/RLS failure before merge. [RESOLVED FOR PLANNING] | Runtime State Inventory / Open Questions | If the environment rejects the RPC, execution must stop with the exact error so a follow-up can decide whether policies or function privileges need adjustment. |
| A4 | Planning no longer assumes a repo-side Liquibase root/include convention; the repo will ship a single leaf changelog under `db/changelog/`, and the user's existing pipeline remains responsible for discovery/inclusion. [RESOLVED FOR PLANNING] | Common Pitfalls / Open Questions | If the pipeline needs extra registration, it happens in the user's normal deployment flow rather than through guessed repo structure. |
| A5 | Suggested file names inside `src/features/ranking/` can follow the repo's mixed hook naming conventions without extra constraints. [ASSUMED] | Architecture Patterns | Naming churn is low risk, but planner tasks could be less aligned with user preference than necessary. |

## Open Questions (RESOLVED FOR PLANNING)

1. **Does `user_cca_applications` have a unique constraint or unique index on `(user_id, position_id)`?**
   - Resolution: This no longer blocks planning because the phase is locked to a whole-set replacement RPC, not an upsert fallback. The implementation should not depend on any `(user_id, position_id)` uniqueness guarantee. [VERIFIED: 04-CONTEXT.md D-06 + revised Plan 04-05]
   - Planning effect: `saveRankings` will call `replace_user_cca_rankings` only; if schema details later matter, they are execution-time migration concerns rather than planning-time design forks. [VERIFIED: revised Plan 04-05]

2. **What exact Liquibase root-file/include convention does the user pipeline expect?**
   - Resolution: The repo plan now delivers a single leaf changelog at `db/changelog/04-member-ranking-replace-user-cca-rankings.sql` and intentionally does not guess a root/include convention. [VERIFIED: 04-CONTEXT.md D-07 + revised Plan 04-05]
   - Planning effect: The user’s existing Liquibase pipeline remains responsible for discovery/inclusion of that leaf file, and the manual checkpoint explicitly calls this out. [VERIFIED: revised Plan 04-05]

3. **Will the RPC function run safely as `SECURITY INVOKER`, or will grants/RLS force `SECURITY DEFINER`?**
   - Resolution: Planning now locks the first implementation to `SECURITY INVOKER`, because the current authenticated route already performs the same table writes directly. [VERIFIED: src/utils/supabase/server.ts + saveRankings route + revised Plan 04-05]
   - Planning effect: Plan 04-05 contains an explicit real-environment verification checkpoint that must capture the exact grants/RLS error before any future switch to `SECURITY DEFINER` is considered. [VERIFIED: revised Plan 04-05]

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Next.js scripts and Vitest execution [VERIFIED: package.json] | ✓ [VERIFIED: `node --version`] | `v22.22.0` [VERIFIED: `node --version`] | — |
| npm | Running tests and checking registry versions [VERIFIED: package.json + research flow] | ✓ [VERIFIED: `npm --version`] | `11.10.1` [VERIFIED: `npm --version`] | — |
| Vitest CLI | Validation Architecture quick/full test commands [VERIFIED: vitest.config.mts] | ✓ [VERIFIED: `npx vitest --version`] | `4.1.4` [VERIFIED: `npx vitest --version`] | `npm test` uses the same runner. [VERIFIED: package.json] |
| Liquibase CLI | Optional local validation of the formatted SQL changelog [VERIFIED: 04-CONTEXT.md] | ✓ [VERIFIED: `liquibase --version`] | `4.33.0` [VERIFIED: `liquibase --version`] | User pipeline can still run the changelog even if local execution is skipped. [VERIFIED: 04-CONTEXT.md] |
| Remote Supabase project/schema access | Real verification of the new RPC against live schema and policies [VERIFIED: project architecture] | ✗ not probed from this repo-only session [VERIFIED: no connection/test run performed] | — | Use the user's existing Supabase environment/pipeline for final migration verification. [VERIFIED: research synthesis] |

**Missing dependencies with no fallback:**
- Direct access to the real Supabase schema/policies was not available in this session, so the plan must include a real-environment verification step for the RPC migration. [VERIFIED: research synthesis]

**Missing dependencies with fallback:**
- None locally; Node, npm, Vitest, and Liquibase are available on this machine. [VERIFIED: command outputs]

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest `4.1.4` with `jsdom` environment. [VERIFIED: vitest.config.mts + npx vitest --version] |
| Config file | `vitest.config.mts`. [VERIFIED: codebase] |
| Quick run command | `npx vitest run src/features/ranking/**/*.test.ts src/app/api/user/saveRankings/**/*.test.ts` [ASSUMED] |
| Full suite command | `npm test` (`vitest run`). [VERIFIED: package.json] |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| RANK-01 | Recap decomposition preserves slide generation, totals, and seen-state/canvas helper boundaries. [VERIFIED: 04-CONTEXT.md + points-recap-card.tsx] | unit | `npx vitest run src/features/ranking/utils/recap-slides.test.ts src/features/ranking/utils/create-recap-image-blob.test.ts` [ASSUMED] | ❌ Wave 0 [VERIFIED: no such file in current repo] |
| RANK-02 | Ranking editor recalculates order, groups by position, detects changes, and saves only changed payloads. [VERIFIED: rankMembers page + 04-CONTEXT.md] | unit | `npx vitest run src/features/ranking/utils/ranking-editor.test.ts src/features/ranking/hooks/use-ranking-editor.test.ts` [ASSUMED] | ❌ Wave 0 [VERIFIED: no ranking feature test files in current repo] |
| RANK-03 | `saveRankings` calls a single RPC-backed replacement operation and surfaces errors without data-loss-prone route logic. [VERIFIED: 04-CONTEXT.md + saveRankings route] | unit + manual integration | `npx vitest run src/app/api/user/saveRankings/route.test.ts` [ASSUMED] | ❌ Wave 0 [VERIFIED: no such file in current repo] |

### Sampling Rate
- **Per task commit:** Run the most local ranking test file(s) touched by the task. [VERIFIED: testing best fit for current Vitest setup]
- **Per wave merge:** Run `npm test`. [VERIFIED: package.json]
- **Phase gate:** Run `npm test` and manually verify the RPC migration against a real Supabase environment before `/gsd-verify-work`. [VERIFIED: research synthesis]

### Wave 0 Gaps
- [ ] `src/features/ranking/utils/recap-slides.test.ts` — verifies category filtering, cumulative totals, and reveal-slide generation. [ASSUMED]
- [ ] `src/features/ranking/utils/create-recap-image-blob.test.ts` — verifies the extracted canvas helper returns a PNG blob and writes the existing export headings/labels without React coupling. [ASSUMED]
- [ ] `src/features/ranking/utils/ranking-editor.test.ts` — verifies ranking recalculation, diffing, snapshot comparison, and chunking. [ASSUMED]
- [ ] `src/app/api/user/saveRankings/route.test.ts` — verifies the route calls RPC and handles Supabase errors. [ASSUMED]
- [ ] Manual migration verification step against the real Supabase project — required because remote schema/policy access was not available locally. [VERIFIED: Environment Availability]

## Sources

### Primary (HIGH confidence)
- Codebase files inspected in this session: `src/components/dashboard/points-recap-card.tsx`, `src/app/dashboard/mycca/admin/rankMembers/[ccaName]/page.tsx`, `src/app/api/user/saveRankings/route.ts`, `src/app/api/cca/[ccaId]/rankings/route.ts`, `src/utils/supabase/server.ts`, `src/lib/feature-flags.ts`, `src/app/dashboard/mycca/admin/rankMembers/layout.tsx`, `src/features/cca/hooks/use-cca-members.ts`, `src/features/cca/components/member-group-table.tsx`, `vitest.config.mts`, `package.json`. [VERIFIED: codebase]
- Phase planning inputs: `04-CONTEXT.md`, `REQUIREMENTS.md`, `STATE.md`, `03-CONTEXT.md`, `.planning/codebase/CONVENTIONS.md`, `.planning/codebase/STRUCTURE.md`. [VERIFIED: planning docs]
- npm registry metadata gathered with `npm view` for `@supabase/supabase-js`, `@supabase/ssr`, `framer-motion`, and `vitest`. [VERIFIED: npm registry]
- Supabase JS RPC reference: https://supabase.com/docs/reference/javascript/rpc [CITED: official docs]
- Supabase JS upsert reference: https://supabase.com/docs/reference/javascript/upsert [CITED: official docs]
- PostgreSQL transactions tutorial: https://www.postgresql.org/docs/18/tutorial-transactions.html [CITED: official docs]
- PostgreSQL `INSERT` / `ON CONFLICT`: https://www.postgresql.org/docs/current/sql-insert.html [CITED: official docs]
- Supabase database functions guide: https://supabase.com/docs/guides/database/functions [CITED: official docs]
- PostgreSQL `CREATE FUNCTION`: https://www.postgresql.org/docs/current/sql-createfunction.html [CITED: official docs]
- Liquibase SQL changelog example: https://www.liquibase.com/secure/user-guide-5-1/sql-changelog-example [CITED: official docs]

### Secondary (MEDIUM confidence)
- None. [VERIFIED: source audit]

### Tertiary (LOW confidence)
- None. [VERIFIED: source audit]

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - recommendations are mostly existing repo dependencies verified against the npm registry plus official Supabase/PostgreSQL docs. [VERIFIED: package.json + npm registry + official docs]
- Architecture: HIGH - the plan follows explicit locked decisions and an already-implemented Phase 3 feature-module pattern. [VERIFIED: 04-CONTEXT.md + 03-CONTEXT.md + src/features/cca/]
- Pitfalls: MEDIUM - the atomic-save risks are well verified, but Liquibase root-file conventions and live Supabase schema constraints remain unresolved from repo-only context. [VERIFIED: STATE.md + LS db not found + Open Questions]

**Research date:** 2026-04-11 [VERIFIED: session date]
**Valid until:** 2026-05-11 for repo-structure findings; re-check registry/docs sooner if Supabase or Liquibase versions become part of the implementation scope. [VERIFIED: research synthesis]
