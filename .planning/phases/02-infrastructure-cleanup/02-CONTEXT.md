# Phase 2: Infrastructure Cleanup - Context

**Gathered:** 2026-04-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 2 cleans up codebase infrastructure: migrates to a single toast library (sonner), removes all dead dependencies, eliminates self-calling API routes, enables ESLint on builds with zero errors, adds Prettier for consistent formatting, and replaces all `any` type suppressions with proper interfaces.

This phase does **not** refactor page components or change feature behavior. It establishes a clean, typed, consistently formatted codebase for the feature refactors in Phases 3-6.

</domain>

<decisions>
## Implementation Decisions

### Type Replacement (INFR-05)
- **D-01:** Replace all 35+ `any` type suppressions with proper typed interfaces — not `unknown` with casts.
- **D-02:** New type definitions go in `src/types/` centralized by domain (e.g., `holiday-subsidy.ts`, `sports-culture.ts`, `cca-members.ts`), matching the existing `src/types/` pattern.
- **D-03:** Hand-write interfaces from current query shapes rather than generating from Supabase schema. No `supabase gen types` dependency needed.

### Shared CCA Logic Extraction (INFR-03)
- **D-04:** Extract `getManagedCcaData()` into a new lib function in `src/lib/` (e.g., `src/lib/managed-cca-data.ts`). The `getManagedCCAs` API route becomes a thin wrapper around this function.
- **D-05:** Three self-calling routes must be fixed (not just one): `getCCAs/route.ts`, `cca/rankings/all/route.ts`, and `cca/managedPositions/route.ts` — all currently fetch `/api/user/getManagedCCAs` via HTTP with manual cookie forwarding.
- **D-06:** Both `getCCAs` and `getManagedCCAs` routes remain — they serve different client consumers with different data shapes. The goal is eliminating the internal HTTP calls, not consolidating routes.

### Dependency Cleanup (INFR-02)
- **D-07:** Perform a full dependency audit (not just the 3 known dead deps). Check all packages in `package.json` for actual usage in `src/`.
- **D-08:** Remove all confirmed unused packages — aphrodite, fs shim, logger, plus any others found by the audit. Verify with a build after removal.
- **D-09:** react-hot-toast removal is handled as part of the toast migration (INFR-01), not the dependency audit.

### ESLint Enforcement (INFR-04)
- **D-10:** Remove `ignoreDuringBuilds: true` from `next.config.mjs` and fix all existing ESLint violations so `next build` passes with zero lint errors.
- **D-11:** Keep the current ESLint rule set (next/core-web-vitals + next/typescript) — no new stricter rules in this phase.
- **D-12:** Add Prettier as a standalone tool (not an ESLint plugin). Run a one-time `prettier --write` format pass across the codebase.
- **D-13:** Prettier config: tabs for indentation, double quotes, semicolons — matches the dominant existing style to minimize diff churn.

### Toast Migration (INFR-01)
- **D-14:** Migrate 6 remaining files from `react-hot-toast` to `sonner` (withAuth.tsx was already removed in Phase 1). Sonner provider already exists in `layout.tsx`.

### Claude's Discretion
- The specific file name for the extracted managed CCA lib function (e.g., `managed-cca-data.ts` vs `cca-managed-access.ts`).
- Prettier print width and other minor formatting options not explicitly decided.
- Whether to fix the single `react-hooks/exhaustive-deps` suppression or leave it with a comment explaining why.
- The `no-empty-object-type` suppression in `textarea.tsx` (shadcn component) — may keep if it's generated code.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase Definition
- `.planning/ROADMAP.md` — Phase 2 scope, success criteria, and sequencing.
- `.planning/REQUIREMENTS.md` — `INFR-01` through `INFR-05`, constraints.
- `.planning/PROJECT.md` — Project-level priorities and locked refactor direction.

### Self-Calling API Routes (INFR-03)
- `src/app/api/user/getCCAs/route.ts` — Lines 61-78: self-call to getManagedCCAs via HTTP.
- `src/app/api/user/getManagedCCAs/route.ts` — Full route with core managed CCA logic to extract.
- `src/app/api/cca/rankings/all/route.ts` — Line 16: self-call to getManagedCCAs.
- `src/app/api/cca/managedPositions/route.ts` — Line 19: self-call to getManagedCCAs.

### Toast Migration (INFR-01)
- `src/app/dashboard/mycca/page.tsx` — react-hot-toast import
- `src/app/dashboard/mycca/admin/page.tsx` — react-hot-toast import
- `src/app/dashboard/mycca/admin/manageMembers/[ccaName]/page.tsx` — react-hot-toast import
- `src/app/dashboard/mycca/admin/rankMembers/[ccaName]/page.tsx` — react-hot-toast import
- `src/app/dashboard/ccaAllocation/rank/page.tsx` — react-hot-toast import
- `src/app/dashboard/ccaAllocation/rankApplicants/page.tsx` — react-hot-toast import

### Type Suppressions (INFR-05)
- `src/app/dashboard/mycca/admin/manageMembers/[ccaName]/page.tsx` — 16 `no-explicit-any` suppressions (heaviest file)
- `src/app/api/holidaySubsidy/weekly/[ccaId]/[weekId]/route.ts` — 3 suppressions
- `src/app/api/holidaySubsidy/approvals/weekly/[ccaId]/[weekId]/route.ts` — 1 suppression
- `src/app/api/cca/[ccaId]/members/route.ts` — 2 suppressions
- `src/app/api/cca/[ccaId]/updateMember/route.ts` — 1 suppression
- `src/app/api/holidaySubsidy/declarations/[ccaId]/route.ts` — 1 suppression
- `src/app/api/sportsCulture/available/route.ts` — 1 suppression
- `src/components/table/ordering-table.tsx` — 2 suppressions

### ESLint Config (INFR-04)
- `next.config.mjs` — `ignoreDuringBuilds: true` to remove
- `.eslintrc.json` — Current ESLint config

### Existing Types
- `src/types/User.ts` — User, CcaType, PositionType
- `src/types/CCAPosition.ts` — CCA position types
- `src/types/dashboard.ts` — Dashboard view model types
- `src/types/holiday-subsidy.ts` — Holiday subsidy types

### Codebase Analysis
- `.planning/codebase/CONCERNS.md` — Detailed tech debt analysis for all INFR items
- `.planning/codebase/CONVENTIONS.md` — Coding patterns to follow

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/types/User.ts` — Already defines `CcaType`, `PositionType`, `AuthenticatedUser`. New interfaces should align with these.
- `src/types/dashboard.ts` — Has view model types that some pages already use.
- `src/lib/cca-chair-access.ts` — Uses the `AccessResult<T>` pattern; new lib functions should follow this convention.
- `src/lib/cca-management-access.ts` — Same `AccessResult<T>` pattern.
- `src/app/layout.tsx` — Already has `<Toaster />` from sonner — no provider setup needed for toast migration.

### Established Patterns
- API routes follow authenticate → fetch → authorize → mutate → respond pattern.
- Types exported from `src/types/` are imported via `@/types/...` alias.
- Lib functions in `src/lib/` are pure business logic with no React dependencies.
- `getManagedCCAs` already has well-typed exports (`ManagedCcaPosition`, `ManagedCcaPositionsRow`) that can move to the extracted lib function.

### Integration Points
- `next.config.mjs` — ESLint build enforcement toggle.
- `package.json` — Dependencies to audit and remove.
- All 6 react-hot-toast files — Toast API migration points.
- 3 self-calling API routes — HTTP fetch calls to replace with direct lib function calls.
- 8 source files with `any` suppressions — Type interface additions.

</code_context>

<specifics>
## Specific Ideas

- The user wants a full dependency audit, not just the 3 known dead packages. Any confirmed unused package should be removed.
- Three self-calling routes were discovered (not just one as listed in ROADMAP.md requirements). All three must be fixed.
- Prettier should use tabs/double-quotes/semicolons to match dominant codebase style and minimize churn.
- The user preferred the recommended approach on most decisions, indicating trust in standard best practices.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 02-infrastructure-cleanup*
*Context gathered: 2026-04-11*
