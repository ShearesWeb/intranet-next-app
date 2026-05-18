# Phase 05: Allocation & Holiday Subsidy Modules - Research

**Researched:** 2026-04-11 [VERIFIED: session date]
**Domain:** Next.js App Router feature-module refactor for allocation and holiday subsidy pages, plus build-time JSON-backed holiday week configuration. [VERIFIED: 05-CONTEXT.md + ROADMAP.md + codebase]
**Confidence:** MEDIUM [VERIFIED: research synthesis]

<user_constraints>
## User Constraints (from CONTEXT.md)

The items in this section are copied verbatim from `05-CONTEXT.md`. [VERIFIED: /Users/bytedance/intranet-next-app/.planning/phases/05-allocation-holiday-subsidy-modules/05-CONTEXT.md]

### Locked Decisions
- **D-01:** Move HOLIDAY_WEEKS from hardcoded `HOLIDAY_WEEK_DEFS` array in `src/lib/holiday-subsidy-weeks.ts` to a JSON config file at `src/config/holiday-weeks.json`.
- **D-02:** The JSON config contains week definitions (id, label, range, start date) plus a top-level `grace_days` field (currently hardcoded as `2` in `getPreviousWeekLockDeadline`).
- **D-03:** Editability logic (which weeks are editable based on current date + grace period) stays in TypeScript. The utility reads `grace_days` from the config instead of hardcoding it.
- **D-04:** The `holiday-subsidy-weeks.ts` utility reads the JSON at build time via import. No runtime HTTP fetch needed.
- **D-05:** Two separate feature modules: `src/features/allocation/` and `src/features/holiday-subsidy/`. They are different domains (CCA preference ranking vs weekly subsidy tracking).
- **D-06:** SportsCulture types (`SportsCulturePosition`, `GroupedPositions`, `RankablePosition`, `Applicant`, `Position`) move from `src/types/dashboard.ts` into `features/allocation/types/`. These are all CCA application/preference types.
- **D-07:** Holiday subsidy types (`holiday-subsidy.ts` and `holiday-subsidy-api.ts`) move from `src/types/` into `features/holiday-subsidy/types/`. No re-export shims.
- **D-08:** `holiday-subsidy-weeks.ts` moves from `src/lib/` into `features/holiday-subsidy/utils/`.
- **D-09:** All 8 pages get full hook + component decomposition, not just the largest ones. Every page gets hook extraction and component splitting.
- **D-10:** The guide page (343 lines) gets full decomposition into section components (eligibility rules, subsidy rates, FAQ, etc.).
- **D-11:** The two holiday subsidy weekly pages (commitment 511 lines, approvals 464 lines) get independent hooks — `useWeeklyCommitment` and `useWeeklyApprovals`. They fetch from different API endpoints and have different mutation logic. No shared base hook.
- **D-12:** PositionSearchBox stays allocation-specific — extract into `features/allocation/components/`. The search endpoints and result handling differ from CCA member search; sharing would force unnecessary abstraction.

### Claude's Discretion
- Exact file naming within feature module sub-directories
- How to split types between multiple files within each feature's `types/` directory
- Which utility functions to extract vs keep inline in hooks
- Internal structure of the guide page section components
- How to structure the JSON config schema (field names, date format)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ALLOC-01 | Decompose rankApplicants page (573 lines) into hooks and components. [VERIFIED: REQUIREMENTS.md] | The current `rankApplicants/page.tsx` is 597 lines and mixes applicant search, diffing, reorder logic, and save orchestration, so the planner should split it into feature-local hooks, utilities, and presentational cards. [VERIFIED: wc -l + rankApplicants/page.tsx + 05-CONTEXT.md] |
| ALLOC-02 | Extract allocation business logic from page components into utilities. [VERIFIED: REQUIREMENTS.md] | The current allocation pages contain pure change-detection, ordering, payload-building, and column-definition logic that can move into `src/features/allocation/utils/` without changing endpoints or UI structure. [VERIFIED: rank/page.tsx + rankApplicants/page.tsx + src/features/cca/ + src/features/ranking/] |
| HSUB-01 | Refactor holiday subsidy pages -- consistent patterns matching CCA module structure. [VERIFIED: REQUIREMENTS.md] | The holiday subsidy area currently spans page-local types, a page-local dialog component, shared `src/types/holiday-subsidy*.ts`, and a `src/lib/holiday-subsidy-weeks.ts` helper; the planner should consolidate them under `src/features/holiday-subsidy/` with thin pages and direct imports. [VERIFIED: holiday subsidy pages + types files + lib/holiday-subsidy-weeks.ts + 05-CONTEXT.md] |
| HSUB-02 | Move hardcoded `HOLIDAY_WEEKS` to configurable data source. [VERIFIED: REQUIREMENTS.md] | `tsconfig.json` enables `resolveJsonModule`, the current week utility already derives `endExclusive`, `HOLIDAY_WEEK_OPTIONS`, and editability from a single definition source, and the context locks the target to build-time JSON import with TypeScript date logic preserved. [VERIFIED: tsconfig.json + src/lib/holiday-subsidy-weeks.ts + 05-CONTEXT.md][CITED: https://www.typescriptlang.org/tsconfig/resolveJsonModule.html] |
</phase_requirements>

## Summary

Phase 05 should be planned as two parallel-but-separate feature refactors: `src/features/allocation/` for CCA application and applicant ranking flows, and `src/features/holiday-subsidy/` for declaration, approval, weekly commitment, and guide flows. The repo already has the intended precedent in `src/features/cca/` and `src/features/ranking/`: feature-local `hooks/`, `types/`, and `utils/`; thin App Router pages; direct imports; and `useEffect` + `fetch` hooks instead of new data libraries. [VERIFIED: src/features/cca/ + src/features/ranking/ + 03-CONTEXT.md + 04-CONTEXT.md + CONVENTIONS.md]

The highest-value planning move is to extract pure logic before moving UI. Allocation already contains testable logic for selection change detection, applicant diffing, reorder persistence, and table column definitions. Holiday subsidy already contains testable logic for week normalization, editable-week calculation, declaration mapping, pending-change calculation, and status grouping. Planning should schedule those utility extractions early so Nyquist validation can attach to stable pure functions before the pages are cut apart. [VERIFIED: rank/page.tsx + rankApplicants/page.tsx + holidaySubsidy/weekly/[ccaName]/page.tsx + holidaySubsidy/declaration/[ccaName]/page.tsx + .planning/config.json]

The JSON migration for `HOLIDAY_WEEKS` is structurally safe only if the planner preserves the current TypeScript-derived behavior. The current utility stores `Date` values for `start` and derived `endExclusive`, builds `HOLIDAY_WEEK_OPTIONS`, computes editability with a `grace_days` equivalent of 2, and is consumed by both pages and API routes. The new JSON file should therefore hold plain week metadata and `grace_days`, while the moved TypeScript utility remains the canonical adapter that converts config into runtime dates and editability helpers. [VERIFIED: src/lib/holiday-subsidy-weeks.ts + grep import graph + 05-CONTEXT.md][CITED: https://www.typescriptlang.org/tsconfig/resolveJsonModule.html]

**Primary recommendation:** Plan Phase 05 in dependency order: scaffold both feature modules and migrate shared types/utilities first, introduce `src/config/holiday-weeks.json` plus a feature-local adapter second, extract pure hooks/utilities third, then thin each App Router page into composition-only shells with build-and-line-budget verification at every wave. [VERIFIED: 05-CONTEXT.md + ROADMAP.md + codebase + .planning/config.json]

## Project Constraints (from .trae/rules/)

- No `.trae/rules/` directory exists in the repository root, so there are no additional project rule files beyond repo conventions. [VERIFIED: LS /Users/bytedance/intranet-next-app/.trae -> not found]
- No `.trae/skills/` or `.agents/skills/` directories exist, so there are no project skill indexes to incorporate into this phase plan. [VERIFIED: LS /Users/bytedance/intranet-next-app/.trae -> not found + LS /Users/bytedance/intranet-next-app/.agents -> not found]
- Nyquist validation is enabled, so the plan should include a dedicated validation artifact and Wave 0 tests for newly extracted pure utilities. [VERIFIED: .planning/config.json]
- Security enforcement is explicitly disabled for this planning cycle, so the planner does not need a `## Security Domain` section for this phase research. [VERIFIED: .planning/config.json]
- Existing repo conventions still constrain the plan: keep feature-local code in `src/features/{domain}/`, avoid barrel files, keep dashboard pages in App Router `page.tsx` files, and preserve feature-flag gating in layout files. [VERIFIED: src/features/cca/ + src/features/ranking/ + holidaySubsidy/layout.tsx + ccaAllocation/layout.tsx + CONVENTIONS.md][CITED: https://nextjs.org/docs/app/api-reference/file-conventions]

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js App Router | `15.5.6` installed; npm latest `16.2.3` published `2026-04-08T18:46:32.059Z`. [VERIFIED: `npm ls next` + npm registry] | Keeps `page.tsx` and `layout.tsx` route structure stable while pages become thin composition shells. [VERIFIED: dashboard route tree][CITED: https://nextjs.org/docs/app/api-reference/file-conventions] | This phase is a refactor, so it should preserve the existing App Router structure rather than move routes or introduce a new rendering model. [VERIFIED: REQUIREMENTS.md out-of-scope + ROADMAP.md] |
| React | `18.3.1` installed; npm latest `19.2.0` published `2025-10-01T21:38:32.757Z`. [VERIFIED: `npm ls react` + npm registry] | Powers all client pages and feature hooks. [VERIFIED: codebase] | The current pages are all client components with local state, and the feature-module pattern in Phases 3-4 already assumes that shape. [VERIFIED: current pages + Phase 3/4 feature modules] |
| TypeScript | `5.9.3` CLI available; npm latest `6.0.2`; `resolveJsonModule: true` enabled in repo config. [VERIFIED: `npx tsc --version` + npm registry + tsconfig.json] | Enables safe shared types and build-time JSON import for `holiday-weeks.json`. [VERIFIED: tsconfig.json][CITED: https://www.typescriptlang.org/tsconfig/resolveJsonModule.html] | The config migration depends on direct JSON import support, and the refactor depends on shared type contracts across pages and API routes. [VERIFIED: tsconfig.json + import graph] |
| Sonner | `2.0.7` installed and latest, published `2025-08-02T19:50:00.471Z`. [VERIFIED: `npm ls sonner` + npm registry] | Preserves current user-visible success/error feedback during extracted mutations. [VERIFIED: allocation and subsidy pages] | Toast behavior is already standardized on Sonner, so hooks should continue surfacing toast-driven user feedback rather than inventing a new notification layer. [VERIFIED: package.json + pages] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@tanstack/react-table` via repo wrappers | `8.21.3` installed and latest, published `2025-04-14T20:20:18.966Z`. [VERIFIED: `npm ls @tanstack/react-table` + npm registry] | Backs `SimpleTable`, `SelectionTable`, and `OrderingTable`. [VERIFIED: package.json + table components] | Reuse existing wrappers for selection, approvals, and reordering flows instead of building feature-specific tables from scratch. [VERIFIED: allocation and subsidy pages + table components] |
| Vitest | `4.1.4` installed and latest, published `2026-04-09T07:36:52.741Z`. [VERIFIED: `npx vitest --version` + npm registry + vitest.config.mts] | Tests extracted pure utilities for allocation and holiday subsidy logic. [VERIFIED: vitest.config.mts + existing tests] | Use for Wave 0 tests because there are currently no allocation or holiday-subsidy tests, but there is already working Vitest infrastructure in the repo. [VERIFIED: glob test files + vitest.config.mts] |
| shadcn/ui repo-local primitives | repo-local. [VERIFIED: src/components/ui/] | Supplies cards, dialogs, tabs, alerts, inputs, textareas, and buttons already used in the target pages. [VERIFIED: target pages] | Keep shared UI primitives in `src/components/ui/` and move only domain-specific compositions into feature modules. [VERIFIED: 03-CONTEXT.md + target pages] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Feature-local hooks with `useEffect` + `fetch`. [VERIFIED: repo pattern] | React Query / Zustand / Redux. [VERIFIED: REQUIREMENTS.md out-of-scope] | New state/data libraries contradict locked project scope and would add non-refactor behavior risk. [VERIFIED: REQUIREMENTS.md + Phase 3/4 patterns] |
| Build-time JSON import for holiday weeks. [VERIFIED: 05-CONTEXT.md] | Runtime HTTP fetch or database-backed config. [VERIFIED: ROADMAP.md allows config file; context locks JSON import] | Runtime config adds loading/error states and new failure modes that are explicitly unnecessary for this phase. [VERIFIED: 05-CONTEXT.md] |
| Two separate weekly hooks: `useWeeklyCommitment` and `useWeeklyApprovals`. [VERIFIED: 05-CONTEXT.md] | One generic weekly hook. [VERIFIED: current pages hit different endpoints and mutations] | Shared abstraction would hide materially different fetch, save, and approval behavior and would increase refactor risk. [VERIFIED: weekly pages + API routes] |
| One-pass direct import migration with no shims. [VERIFIED: 05-CONTEXT.md + Phase 3 precedent] | Re-export bridge files in `src/lib/` or page folders. [VERIFIED: declaration/[ccaName]/types.ts is already a local shim] | Shims prolong split ownership and contradict the established Phase 3 rule of direct canonical imports. [VERIFIED: 03-CONTEXT.md + declaration/[ccaName]/types.ts] |

**Installation:**
```bash
# No new npm packages are required for Phase 05.
```
[VERIFIED: package.json + REQUIREMENTS.md]

**Version verification:** `next`, `react`, `typescript`, `sonner`, `@tanstack/react-table`, `vitest`, `@supabase/ssr`, and `@supabase/supabase-js` were checked in this session against installed packages and the npm registry. [VERIFIED: `npm ls ...` + `npm view ...` outputs]

## Architecture Patterns

### Recommended Project Structure

```text
src/
├── app/
│   └── dashboard/
│       ├── ccaAllocation/                          # Thin page.tsx/layout.tsx shells only [VERIFIED: target routes]
│       └── holidaySubsidy/                         # Thin page.tsx/layout.tsx shells only [VERIFIED: target routes]
├── config/
│   └── holiday-weeks.json                          # New build-time config source [VERIFIED: 05-CONTEXT.md]
└── features/
    ├── allocation/
    │   ├── components/
    │   │   ├── position-card.tsx                  # Extracted from rankApplicants page [VERIFIED: rankApplicants/page.tsx]
    │   │   ├── position-search-box.tsx            # Locked as allocation-specific [VERIFIED: 05-CONTEXT.md + rankApplicants/page.tsx]
    │   │   ├── rank-selection-step.tsx            # SelectionTable wrapper for rank/page.tsx [VERIFIED: rank/page.tsx]
    │   │   ├── rank-ordering-step.tsx             # OrderingTable wrapper for rank/page.tsx [VERIFIED: rank/page.tsx]
    │   │   └── guide/                             # Hero, algorithm cards, FAQ sections [VERIFIED: allocation index page]
    │   ├── hooks/
    │   │   ├── use-applicant-rankings.ts          # rankApplicants fetch/save orchestration [VERIFIED: rankApplicants/page.tsx]
    │   │   └── use-rankable-positions.ts          # user ranking flow state [VERIFIED: rank/page.tsx]
    │   ├── types/
    │   │   ├── applicant-rankings.ts              # `Applicant`, `Position` [VERIFIED: src/types/dashboard.ts]
    │   │   └── preferences.ts                     # `RankablePosition`, `SportsCulturePosition`, `GroupedPositions` [VERIFIED: src/types/dashboard.ts]
    │   └── utils/
    │       ├── applicant-diff.ts                  # toAdd / toRemove / reorder helpers [VERIFIED: rankApplicants/page.tsx]
    │       ├── ranking-changes.ts                 # selected-id and order diff helpers [VERIFIED: rank/page.tsx]
    │       └── columns.tsx                        # SelectionTable / OrderingTable column builders [VERIFIED: rank/page.tsx]
    └── holiday-subsidy/
        ├── components/
        │   ├── subsidy-declaration-form-dialog.tsx # Move from page folder [VERIFIED: subsidy-declaration-form-dialog.tsx]
        │   ├── declaration-section-card.tsx        # Pending/approved/rejected blocks [VERIFIED: declaration page]
        │   ├── weekly-commitment-table.tsx         # SelectionTable wrapper [VERIFIED: weekly commitment page]
        │   ├── weekly-approvals-table.tsx          # SelectionTable wrapper [VERIFIED: weekly approvals page]
        │   └── guide/                              # Eligibility/rates/FAQ/process sections [VERIFIED: guide page]
        ├── hooks/
        │   ├── use-subsidy-declarations.ts         # declaration page fetch/mutate state [VERIFIED: declaration page]
        │   ├── use-subsidy-approval-details.ts     # approval detail page state [VERIFIED: approvals/[ccaName]/page.tsx]
        │   ├── use-weekly-commitment.ts            # locked separate hook [VERIFIED: 05-CONTEXT.md]
        │   └── use-weekly-approvals.ts             # locked separate hook [VERIFIED: 05-CONTEXT.md]
        ├── types/
        │   ├── declarations.ts                     # `SubsidyDeclaration`, `DeclarationSection`, `PositionOption`, `WeekOption` [VERIFIED: src/types/holiday-subsidy.ts]
        │   ├── weekly.ts                           # weekly row view-models [VERIFIED: weekly pages]
        │   └── api.ts                              # joined API contracts [VERIFIED: src/types/holiday-subsidy-api.ts]
        └── utils/
            ├── holiday-weeks.ts                    # moved adapter/logic file [VERIFIED: 05-CONTEXT.md]
            ├── declaration-mappers.ts              # API → view-model transforms [VERIFIED: declaration page + approvals/[ccaName]/page.tsx]
            └── weekly-change-set.ts                # save payload + dirty-state helpers [VERIFIED: weekly commitment page]
```

### Pattern 1: Thin App Router pages that only compose feature code
**What:** Keep `page.tsx` and `layout.tsx` files in `src/app/dashboard/...`, but move business logic, derived state, and domain-specific UI into feature modules so each page becomes a thin composition shell. [VERIFIED: current route tree + Next file conventions][CITED: https://nextjs.org/docs/app/api-reference/file-conventions]

**When to use:** Use this for every target page in Phase 05, including the index/guide pages, not only the largest pages. [VERIFIED: 05-CONTEXT.md]

**Example:**
```typescript
// Source: /Users/bytedance/intranet-next-app/src/features/cca/hooks/use-cca-members.ts
export function useCcaMembers(ccaId: string | null): UseCcaMembersReturn {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    const response = await fetch(`/api/cca/${ccaId}/members`);
    // state updates and error handling...
  }, [ccaId]);

  return { loading, error, refetch /* plus domain state and mutations */ };
}
```
[VERIFIED: codebase]

### Pattern 2: Extract pure allocation logic before moving applicant UI
**What:** Move diffing and change-detection logic out of `rankApplicants/page.tsx` and `rank/page.tsx` into pure utilities that the hooks can call. [VERIFIED: rankApplicants/page.tsx + rank/page.tsx]

**When to use:** Use for `checkForChanges`, selection/order diffing, add/remove payload creation, and column-definition helpers. [VERIFIED: rankApplicants/page.tsx + rank/page.tsx]

**Why this matters:** `rankApplicants` currently performs three save phases per position — add missing applicants, remove deleted applicants, then persist order — and that orchestration should stay behaviorally identical while the implementation becomes testable. [VERIFIED: rankApplicants/page.tsx]

### Pattern 3: Keep holiday-week derivation in TypeScript, move only raw config to JSON
**What:** Store week metadata and `grace_days` in `src/config/holiday-weeks.json`, then let a moved `src/features/holiday-subsidy/utils/holiday-weeks.ts` import that JSON and derive `HOLIDAY_WEEKS`, `HOLIDAY_WEEK_OPTIONS`, `getEditableWeekIds`, `isWeekEditable`, and `getWeekLabel`. [VERIFIED: 05-CONTEXT.md + src/lib/holiday-subsidy-weeks.ts + tsconfig.json][CITED: https://www.typescriptlang.org/tsconfig/resolveJsonModule.html]

**When to use:** Use for every existing consumer of `@/lib/holiday-subsidy-weeks`, including the weekly API route and all holiday subsidy pages. [VERIFIED: grep import graph]

**Example:**
```typescript
// Source: /Users/bytedance/intranet-next-app/src/lib/holiday-subsidy-weeks.ts
export const HOLIDAY_WEEKS: HolidayWeek[] = HOLIDAY_WEEK_DEFS.map((week, index) => {
  const nextStart = HOLIDAY_WEEK_DEFS[index + 1]?.start;
  const endExclusive = nextStart ? new Date(nextStart) : addDays(week.start, 7);

  return {
    ...week,
    start: new Date(week.start),
    endExclusive,
  } satisfies HolidayWeek;
});
```
[VERIFIED: codebase]

### Pattern 4: Migrate imports in one pass, with no bridge files
**What:** Update all direct imports to feature-local paths in the same wave that moves the owning files. [VERIFIED: 05-CONTEXT.md + Phase 3 precedent]

**When to use:** Use for types, week utilities, and the page-local declaration shim. [VERIFIED: grep import graph]

**Import impact map:**
- `src/app/dashboard/ccaAllocation/rank/page.tsx` and `rankApplicants/page.tsx` currently import from `@/types/dashboard`; both must switch to `@/features/allocation/types/...`. [VERIFIED: grep results]
- `src/app/api/holidaySubsidy/approvals/[ccaId]/route.ts`, `approvals/route.ts`, `declarations/[ccaId]/route.ts`, `approvals/weekly/[ccaId]/[weekId]/route.ts`, and `weekly/[ccaId]/[weekId]/route.ts` currently import from `@/types/holiday-subsidy*` or `@/lib/holiday-subsidy-weeks`; all must switch directly to `@/features/holiday-subsidy/types/...` and `@/features/holiday-subsidy/utils/holiday-weeks`. [VERIFIED: grep results]
- `src/app/dashboard/holidaySubsidy/declaration/[ccaName]/types.ts` is already a local re-export shim and should disappear once consumers import canonical feature-local types directly. [VERIFIED: declaration/[ccaName]/types.ts + 05-CONTEXT.md]

### Anti-Patterns to Avoid
- **One giant weekly hook:** The context explicitly rejects a shared base hook for weekly commitment and weekly approvals, and the pages hit different endpoints with different mutation semantics. [VERIFIED: 05-CONTEXT.md + weekly pages + weekly API routes]
- **JSON file containing application logic:** `grace_days` and raw week metadata belong in JSON, but date parsing and editability calculation should stay in TypeScript. [VERIFIED: 05-CONTEXT.md + current week utility]
- **Page-folder-only type ownership:** The declaration page already has a local shim file, which is the opposite of the desired feature-local source of truth. [VERIFIED: declaration/[ccaName]/types.ts]
- **Accidental behavior cleanup during refactor:** Current flows include minute-based editable-week polling, beforeunload unsaved-change prompts, and sequential mutation/save ordering; moving code must preserve those behaviors unless a separate requirement says otherwise. [VERIFIED: weekly commitment page + approvals/[ccaName]/page.tsx + rankApplicants/page.tsx]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Selection and approval tables | Feature-specific table implementations. [VERIFIED: current pages already use wrappers] | Existing `SimpleTable`, `SelectionTable`, and `OrderingTable`. [VERIFIED: target pages + table components] | The wrappers already encode sorting, searching, selection, and drag-reorder behavior used by the target pages. [VERIFIED: codebase] |
| Modal primitives | Custom overlays or raw dialog state containers. [VERIFIED: repo has shared dialogs] | Existing shadcn `Dialog` primitives and the extracted `SubsidyDeclarationFormDialog`. [VERIFIED: subsidy-declaration-form-dialog.tsx + src/components/ui/dialog.tsx] | Shared dialog behavior keeps accessibility and visual parity consistent during refactor. [VERIFIED: codebase] |
| New async state/data layer | React Query, Redux, Zustand, or bespoke fetch cache. [VERIFIED: REQUIREMENTS.md out-of-scope] | Feature-local hooks using `useEffect`, `fetch`, and local React state. [VERIFIED: Phase 3/4 patterns + current pages] | The codebase standard is already established and the milestone explicitly excludes new state libraries. [VERIFIED: REQUIREMENTS.md + src/features/cca/ + src/features/ranking/] |
| Runtime holiday week loader | Client fetch to `/api/config` or a second storage layer. [VERIFIED: alternatives] | Build-time JSON import + TypeScript adapter. [VERIFIED: 05-CONTEXT.md + tsconfig.json][CITED: https://www.typescriptlang.org/tsconfig/resolveJsonModule.html] | This keeps week config deterministic, testable, and available to both pages and API routes without new runtime failure paths. [VERIFIED: current import graph + week utility] |
| Temporary import shims | Re-export files in page folders or legacy `src/lib/` / `src/types/` locations. [VERIFIED: current declaration shim + Phase 3 rule] | Direct imports from `src/features/allocation/...` and `src/features/holiday-subsidy/...`. [VERIFIED: 05-CONTEXT.md + 03-CONTEXT.md] | Shims obscure ownership and make future refactors harder to reason about. [VERIFIED: Phase 3 pattern + current shim file] |

**Key insight:** Phase 05 does not need new infrastructure packages; it needs disciplined extraction order, direct import ownership, and targeted utility tests that lock current behavior before pages are reduced below their line-budget targets. [VERIFIED: package.json + ROADMAP.md + .planning/config.json]

## Runtime State Inventory

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | Existing database-backed flows use `user_cca_applications`, `cca_user_ranking`, `subsidies`, and `user_subsidies`, but Phase 05 does not change table names or row shapes. [VERIFIED: allocation and holiday subsidy API routes] | Code edit only; no data migration was identified from repo evidence. [VERIFIED: route signatures + REQUIREMENTS.md refactor scope] |
| Live service config | No external dashboard/service/UI-managed config for allocation or holiday subsidy was found in the repo; the only planned config migration is from a TS constant to a repo-owned JSON file. [VERIFIED: grep results + 05-CONTEXT.md] | Create `src/config/holiday-weeks.json` and update imports; no separate service patch was identified. [VERIFIED: 05-CONTEXT.md + Glob src/config/* -> none] |
| OS-registered state | None found; this phase does not rename binaries, services, schedulers, or package identifiers. [VERIFIED: repo scope + target files] | None. [VERIFIED: research synthesis] |
| Secrets/env vars | No allocation/holiday-subsidy-specific env vars were found; Supabase access remains through existing shared clients. [VERIFIED: grep results + `src/utils/supabase/*`] | None; preserve current environment usage. [VERIFIED: codebase] |
| Build artifacts | `src/config/` does not exist yet, so the JSON config file and its imports will be new build inputs. [VERIFIED: Glob src/config/* -> none] | Code edit plus build verification; no reinstall or artifact migration was identified. [VERIFIED: repo layout + next build flow] |

**Nothing found in category:** OS-registered state — none found from repo inspection. [VERIFIED: codebase]

## Common Pitfalls

### Pitfall 1: Moving `HOLIDAY_WEEKS` to JSON without a normalization layer
**What goes wrong:** Pages and the weekly API route can lose correct date/editability behavior if the plan treats JSON as a drop-in replacement for the current derived `HolidayWeek[]` structure. [VERIFIED: src/lib/holiday-subsidy-weeks.ts + weekly route + weekly pages]

**Why it happens:** The current utility does more than store labels; it builds `Date` objects, derives `endExclusive`, exposes options, and computes editable weeks. [VERIFIED: src/lib/holiday-subsidy-weeks.ts]

**How to avoid:** Keep JSON limited to raw week definitions plus `grace_days`, and preserve all derivation logic in the moved TypeScript utility. [VERIFIED: 05-CONTEXT.md + current utility]

**Warning signs:** A plan that imports JSON directly into pages or API routes and duplicates date logic in multiple files. [VERIFIED: research synthesis]

### Pitfall 2: Over-sharing the weekly commitment and weekly approvals codepaths
**What goes wrong:** A generic weekly abstraction can blur distinct save semantics, endpoint contracts, and authorization behavior between chair declarations and JCRC approvals. [VERIFIED: weekly pages + weekly API routes + 05-CONTEXT.md]

**Why it happens:** Both pages render tabs and a selection table, but one edits member hours and deletion payloads while the other batches approval-status updates. [VERIFIED: weekly commitment page + weekly approvals page]

**How to avoid:** Share only small presentational pieces or row mappers if they stay obviously identical; keep separate hooks and separate mutation builders. [VERIFIED: 05-CONTEXT.md + page logic]

**Warning signs:** A plan that proposes `useWeeklyBase` or a merged endpoint abstraction before pure behaviors are extracted and tested. [VERIFIED: research synthesis]

### Pitfall 3: Import-path drift during type migration
**What goes wrong:** Pages and API routes can compile against split type sources or stale shims if the move from `src/types/dashboard.ts`, `src/types/holiday-subsidy.ts`, `src/types/holiday-subsidy-api.ts`, and `src/lib/holiday-subsidy-weeks.ts` is not done in one wave. [VERIFIED: grep import graph]

**Why it happens:** Allocation and holiday subsidy types are currently consumed from both pages and API routes, and one page folder already has a local compatibility shim. [VERIFIED: grep results + declaration/[ccaName]/types.ts]

**How to avoid:** Move each ownership boundary once, update all importers together, and delete the old source immediately instead of leaving compatibility files behind. [VERIFIED: 05-CONTEXT.md + Phase 3 precedent]

**Warning signs:** A plan step that keeps old files in place “temporarily” or adds `index.ts` / re-export bridges. [VERIFIED: 03-CONTEXT.md + 05-CONTEXT.md]

### Pitfall 4: Accidentally changing save behavior while extracting allocation logic
**What goes wrong:** The allocation refactor can silently change when toasts fire, when saving indicators appear, or the exact order of add/remove/rank operations for applicants. [VERIFIED: rankApplicants/page.tsx]

**Why it happens:** `rankApplicants` currently mixes UI state and sequential persistence steps in one file, and `rank/page.tsx` mixes selection and order-diff logic with the page shell. [VERIFIED: rankApplicants/page.tsx + rank/page.tsx]

**How to avoid:** Extract pure diff helpers first, keep existing endpoint URLs and sequential save order intact, and let hooks orchestrate the same API calls from the same user actions. [VERIFIED: current pages + Phase 3 hook pattern]

**Warning signs:** A utility extraction that changes the mutation sequence or collapses multiple save calls into a different contract without a requirement change. [VERIFIED: research synthesis]

### Pitfall 5: Planning around assumed behavior in the subsidy declaration flow
**What goes wrong:** The plan can write incorrect regression expectations if it assumes the declaration create/edit/delete path is already aligned with the API route parameters. [VERIFIED: declaration page + subsidy-declaration-form-dialog.tsx + declarations/[ccaId]/route.ts]

**Why it happens:** The declaration page fetches via `/api/holidaySubsidy/declarations/${ccaId}` but the form dialog and delete flow call `/api/holidaySubsidy/declarations/${encodeURIComponent(ccaName)}`, while the route parameter is named `[ccaId]` and parsed numerically. [VERIFIED: declaration page + subsidy-declaration-form-dialog.tsx + declarations/[ccaId]/route.ts]

**How to avoid:** Treat this as an explicit validation checkpoint before freezing parity tests; decide whether it is a real bug or an unseen runtime assumption before implementation starts. [VERIFIED: codebase contradiction]

**Warning signs:** A plan that says “preserve current declaration behavior” without first verifying what the current behavior actually is in a running app. [VERIFIED: research synthesis]

## Code Examples

Verified patterns from the current codebase:

### Hook-owned fetch and state pattern
```typescript
// Source: /Users/bytedance/intranet-next-app/src/features/ranking/hooks/use-recap-data.ts
export function useRecapData(user: User): UseRecapDataResult {
  const [loadingCcas, setLoadingCcas] = useState(Boolean(user.appointments?.length));
  const [ccas, setCcas] = useState<CCAData[]>([]);

  useEffect(() => {
    let isActive = true;
    fetch("/api/user/getCCAs")
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to fetch CCA recap data");
        return res.json();
      })
      .then((data) => {
        if (!isActive) return;
        setCcas(Array.isArray(data.data) ? data.data : []);
      })
      .finally(() => {
        if (!isActive) return;
        setLoadingCcas(false);
      });

    return () => {
      isActive = false;
    };
  }, [user]);

  return { ccas, loadingCcas /* ... */ };
}
```
[VERIFIED: codebase]

### Sequential applicant-save orchestration to preserve
```typescript
// Source: /Users/bytedance/intranet-next-app/src/app/dashboard/ccaAllocation/rankApplicants/page.tsx
const toAdd = currentApplicantIds.filter((id) => !originalApplicantIds.includes(id));
const toRemove = originalApplicantIds.filter((id) => !currentApplicantIds.includes(id));

for (const userId of toAdd) {
  await fetch(`/api/chair/positions/${position.id}/addApplicant`, { method: "POST" });
}

for (const userId of toRemove) {
  await fetch(`/api/chair/positions/${position.id}/removeApplicant`, { method: "POST" });
}

await fetch(`/api/chair/positions/${position.id}/rank`, {
  method: "POST",
  body: JSON.stringify({ rankings }),
});
```
[VERIFIED: codebase]

### Build-time config adapter pattern to keep
```typescript
// Source shape: /Users/bytedance/intranet-next-app/src/lib/holiday-subsidy-weeks.ts
export const HOLIDAY_WEEK_OPTIONS = HOLIDAY_WEEKS.map((week) => ({
  id: week.id,
  label: `${week.label} (${week.range})`,
}));

export function getEditableWeekIds(now = new Date()): number[] {
  const currentWeekIndex = findCurrentWeekIndex(now);
  if (currentWeekIndex === -1) return [];

  const editableWeeks = [HOLIDAY_WEEKS[currentWeekIndex].id];
  // keep previous-week grace logic in TypeScript
  return editableWeeks;
}
```
[VERIFIED: codebase]

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Monolithic feature pages holding data, domain logic, and UI together. [VERIFIED: current allocation/subsidy pages] | Feature-local `hooks/`, `types/`, `utils/`, and thin App Router pages. [VERIFIED: src/features/cca/ + src/features/ranking/] | Established in Phases 3-4 during 2026-04-11 work. [VERIFIED: Phase 3/4 context + repo state] | Phase 05 should reuse this proven pattern instead of inventing a third module style. [VERIFIED: Phase 3/4 modules + 05-CONTEXT.md] |
| Holiday week definitions hardcoded in `src/lib/holiday-subsidy-weeks.ts`. [VERIFIED: codebase] | Build-time JSON config plus feature-local TypeScript adapter. [VERIFIED: 05-CONTEXT.md] | Planned in Phase 05. [VERIFIED: ROADMAP.md + 05-CONTEXT.md] | The planner should schedule config introduction before import/path cleanup so downstream files move once. [VERIFIED: research synthesis] |
| Allocation-only types live in the shared `src/types/dashboard.ts`. [VERIFIED: codebase] | Allocation types owned by `src/features/allocation/types/`. [VERIFIED: 05-CONTEXT.md] | Planned in Phase 05. [VERIFIED: 05-CONTEXT.md] | This reduces cross-feature type sprawl and makes future allocation refactors local. [VERIFIED: Phase intent + current import graph] |
| Holiday subsidy declarations use a page-local re-export shim. [VERIFIED: declaration/[ccaName]/types.ts] | Direct imports from `src/features/holiday-subsidy/types/...`. [VERIFIED: 05-CONTEXT.md + Phase 3 precedent] | Planned in Phase 05. [VERIFIED: 05-CONTEXT.md] | The planner should explicitly delete the shim rather than preserve it. [VERIFIED: current file + no-shim rule] |

**Deprecated/outdated:**
- `src/types/dashboard.ts` as the home for allocation-specific contracts becomes outdated once Phase 05 moves those contracts into `src/features/allocation/types/`. [VERIFIED: 05-CONTEXT.md + grep import graph]
- `src/types/holiday-subsidy.ts`, `src/types/holiday-subsidy-api.ts`, and `src/lib/holiday-subsidy-weeks.ts` become outdated import roots once feature-local ownership is established. [VERIFIED: 05-CONTEXT.md + grep import graph]
- `src/app/dashboard/holidaySubsidy/declaration/[ccaName]/types.ts` is already an outdated compatibility layer relative to the no-shim module pattern. [VERIFIED: declaration/[ccaName]/types.ts + 03-CONTEXT.md]

## Assumptions Log

No `[ASSUMED]` claims were required for this research; all recommendations below are either verified directly in the repo or cited from official docs. [VERIFIED: research synthesis]

## Open Questions (RESOLVED)

1. **Declaration route contract resolution for planning:** treat the `ccaName` vs `ccaId` mismatch as an explicitly unresolved runtime behavior that must be handled by a blocking manual verification checkpoint before any declaration-page or declaration-route refactor work begins. [VERIFIED: declaration page + subsidy-declaration-form-dialog.tsx + declarations/[ccaId]/route.ts]
   - Planning consequence: pre-checkpoint plans may move week utilities and non-declaration types, but must not modify declaration mutation wiring or declaration route assumptions.
   - Execution consequence: downstream declaration refactor plans must depend on the manual checkpoint summary and follow the verified live contract rather than repo guesswork.

2. **Weekly approvals authorization stance for Phase 05:** preserve the current behavior exactly and do not change authorization semantics in this phase. [VERIFIED: weekly approvals API route + REQUIREMENTS.md scope]
   - Planning consequence: weekly approvals decomposition may move code into hooks/components, but must retain the current TODO/commented authorization posture and avoid introducing new guards or relaxed access.
   - Execution consequence: approval-flow plans should include regression checks that behavior is unchanged, but should not treat authorization cleanup as in-scope work.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | `next build`, Vitest, TypeScript, local scripts. [VERIFIED: package.json scripts] | ✓ [VERIFIED: `node --version`] | `v22.22.0`. [VERIFIED: shell] | — |
| npm | Package scripts and registry verification. [VERIFIED: package.json] | ✓ [VERIFIED: `npm --version`] | `11.10.1`. [VERIFIED: shell] | — |
| Next CLI | Production build verification. [VERIFIED: package.json] | ✓ [VERIFIED: `npx next --version`] | `15.5.6`. [VERIFIED: shell] | `npm run build` uses the local package script anyway. [VERIFIED: package.json] |
| Vitest | Utility/unit validation. [VERIFIED: vitest.config.mts] | ✓ [VERIFIED: `npx vitest --version`] | `4.1.4`. [VERIFIED: shell] | — |
| TypeScript compiler | Type-checking and JSON-module support verification. [VERIFIED: tsconfig.json] | ✓ [VERIFIED: `npx tsc --version`] | `5.9.3`. [VERIFIED: shell] | — |

**Missing dependencies with no fallback:**
- None identified. [VERIFIED: environment audit]

**Missing dependencies with fallback:**
- None identified. [VERIFIED: environment audit]

## Validation Architecture

Nyquist validation should materially influence plan structure for this phase because there are currently no allocation or holiday-subsidy tests in the repo, yet the phase moves shared types, shared utility ownership, and multi-page business logic. Wave 0 should therefore create pure utility tests before the broad file-move waves begin. [VERIFIED: .planning/config.json + glob test files + grep no allocation/holiday-subsidy tests]

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest `4.1.4`. [VERIFIED: vitest.config.mts + `npx vitest --version`] |
| Config file | `vitest.config.mts`. [VERIFIED: codebase] |
| Quick run command | `npx vitest run src/features/allocation src/features/holiday-subsidy`. [VERIFIED: viable command once Wave 0 files exist] |
| Full suite command | `npm run test && npm run build`. [VERIFIED: package.json scripts] |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ALLOC-01 | `src/app/dashboard/ccaAllocation/rankApplicants/page.tsx` becomes a thin page under the line-budget target and composes extracted hook/components. [VERIFIED: ROADMAP.md + current file] | smoke + build | `wc -l src/app/dashboard/ccaAllocation/rankApplicants/page.tsx && npm run build`. [VERIFIED: existing commands] | N/A (shell/build check). [VERIFIED: command type] |
| ALLOC-02 | Allocation change detection, applicant diffing, and ranking helpers move into pure utilities with stable behavior. [VERIFIED: rank/page.tsx + rankApplicants/page.tsx] | unit | `npx vitest run src/features/allocation/utils`. [VERIFIED: target validation pattern] | ❌ Wave 0. [VERIFIED: no current allocation tests/files] |
| HSUB-01 | Holiday subsidy pages become thin shells with feature-local hooks/components and unchanged route behavior. [VERIFIED: 05-CONTEXT.md + current pages] | smoke + build | `wc -l src/app/dashboard/holidaySubsidy/weekly/[ccaName]/page.tsx src/app/dashboard/holidaySubsidy/approvals/weekly/[ccaName]/page.tsx src/app/dashboard/holidaySubsidy/declaration/[ccaName]/page.tsx src/app/dashboard/holidaySubsidy/guide/page.tsx && npm run build`. [VERIFIED: current file set + commands] | N/A (shell/build check). [VERIFIED: command type] |
| HSUB-02 | JSON-backed holiday week config produces the same week options, labels, and editable-week behavior as the current TypeScript constant source. [VERIFIED: 05-CONTEXT.md + current utility] | unit | `npx vitest run src/features/holiday-subsidy/utils/holiday-weeks.test.ts`. [VERIFIED: target validation pattern] | ❌ Wave 0. [VERIFIED: file absent] |

### Sampling Rate
- **Per task commit:** run targeted Vitest files for the touched feature utility set, then run `npm run build` after any import-path or route-consumer move. [VERIFIED: nyquist_validation=true + import-move risk]
- **Per wave merge:** `npm run test && npm run build`. [VERIFIED: package.json]
- **Phase gate:** full suite green, line-budget checks green, and manual verification of the declaration-flow route mismatch question before `/gsd-verify-work`. [VERIFIED: ROADMAP.md + Open Questions section]

### Wave 0 Gaps
- [ ] `src/features/allocation/utils/applicant-diff.test.ts` — covers add/remove/reorder diff behavior now embedded in `rankApplicants/page.tsx`. [VERIFIED: current page logic]
- [ ] `src/features/allocation/utils/ranking-changes.test.ts` — covers selected-id and ranking-order change detection now embedded in `rank/page.tsx`. [VERIFIED: current page logic]
- [ ] `src/features/holiday-subsidy/utils/holiday-weeks.test.ts` — locks JSON→runtime normalization, `HOLIDAY_WEEK_OPTIONS`, and editable-week behavior. [VERIFIED: current week utility + HSUB-02]
- [ ] `src/features/holiday-subsidy/utils/weekly-change-set.test.ts` — covers dirty-row/save payload logic currently embedded in weekly commitment page. [VERIFIED: weekly commitment page]
- [ ] Manual declaration-flow verification note — confirm current POST/PATCH/DELETE routing behavior before refactor tasks assume parity semantics. [VERIFIED: open question]

## Sources

### Primary (HIGH confidence)
- Codebase analysis via Read/Grep/Glob/Bash: allocation pages, holiday subsidy pages, feature modules, API routes, `tsconfig.json`, `package.json`, `vitest.config.mts`, and file line counts. [VERIFIED: tool outputs in this session]
- npm registry metadata for `next`, `react`, `typescript`, `sonner`, `@tanstack/react-table`, `vitest`, `@supabase/ssr`, and `@supabase/supabase-js`. [VERIFIED: `npm view ...` outputs]
- Official TypeScript docs: `resolveJsonModule`. [CITED: https://www.typescriptlang.org/tsconfig/resolveJsonModule.html]
- Official Next.js docs: App Router file-system conventions for `page.js` / `layout.js` and route-segment structure. [CITED: https://nextjs.org/docs/app/api-reference/file-conventions]

### Secondary (MEDIUM confidence)
- `.planning/codebase/CONVENTIONS.md` for naming and module-ownership patterns, used only where it matched live code. [VERIFIED: file read + live code cross-check]

### Tertiary (LOW confidence)
- None. [VERIFIED: research synthesis]

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — package versions, installed versions, and JSON-import support were verified directly. [VERIFIED: npm and config checks]
- Architecture: HIGH — recommendations are based on existing Phase 3/4 feature modules and direct inspection of current target pages/routes. [VERIFIED: codebase]
- Pitfalls: MEDIUM — most are directly evidenced, but two depend on unresolved runtime-behavior questions in the current declaration and weekly-approval flows. [VERIFIED: codebase contradictions + Open Questions]

**Research date:** 2026-04-11 [VERIFIED: session date]
**Valid until:** 2026-05-11 for repo-structure findings; re-check package versions and docs earlier if implementation is delayed or a framework upgrade lands first. [VERIFIED: research synthesis]
