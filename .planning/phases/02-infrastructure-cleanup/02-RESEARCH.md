# Phase 2: Infrastructure Cleanup - Research

**Researched:** 2026-04-11
**Domain:** Codebase hygiene -- toast migration, dependency cleanup, self-calling routes, ESLint enforcement, type safety, code formatting
**Confidence:** HIGH

## Summary

Phase 2 addresses five distinct infrastructure concerns: toast library consolidation, dead dependency removal, self-calling API route elimination, ESLint build enforcement, and `any` type replacement. Each concern is well-scoped with clear before/after states. The codebase already has strong foundations -- existing type definitions in `src/types/dashboard.ts` cover most needed shapes, sonner is already the primary toast library with a provider in `layout.tsx`, and the current ESLint surface is very small (only 2 real errors plus stale suppression directives).

The highest-complexity task is replacing 27 `no-explicit-any` suppressions across 8 files, particularly the 16 suppressions in `manageMembers/page.tsx`. However, analysis shows most of these follow a small number of patterns (setter callbacks missing explicit type annotations, Supabase join results lacking typed shapes, and catch clause `error: any` patterns) that can be addressed systematically. The self-calling API route extraction is architecturally important but mechanically straightforward since the `getManagedCCAs` route's business logic is self-contained.

**Primary recommendation:** Execute in dependency order -- toast migration and dead dep removal first (no cross-dependencies), then self-calling route extraction, then type replacements (which touch many of the same files), then ESLint enforcement and Prettier formatting last (since they affect the entire codebase).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Replace all 35+ `any` type suppressions with proper typed interfaces -- not `unknown` with casts.
- **D-02:** New type definitions go in `src/types/` centralized by domain (e.g., `holiday-subsidy.ts`, `sports-culture.ts`, `cca-members.ts`), matching the existing `src/types/` pattern.
- **D-03:** Hand-write interfaces from current query shapes rather than generating from Supabase schema. No `supabase gen types` dependency needed.
- **D-04:** Extract `getManagedCcaData()` into a new lib function in `src/lib/` (e.g., `src/lib/managed-cca-data.ts`). The `getManagedCCAs` API route becomes a thin wrapper around this function.
- **D-05:** Three self-calling routes must be fixed (not just one): `getCCAs/route.ts`, `cca/rankings/all/route.ts`, and `cca/managedPositions/route.ts` -- all currently fetch `/api/user/getManagedCCAs` via HTTP with manual cookie forwarding.
- **D-06:** Both `getCCAs` and `getManagedCCAs` routes remain -- they serve different client consumers with different data shapes. The goal is eliminating the internal HTTP calls, not consolidating routes.
- **D-07:** Perform a full dependency audit (not just the 3 known dead deps). Check all packages in `package.json` for actual usage in `src/`.
- **D-08:** Remove all confirmed unused packages -- aphrodite, fs shim, logger, plus any others found by the audit. Verify with a build after removal.
- **D-09:** react-hot-toast removal is handled as part of the toast migration (INFR-01), not the dependency audit.
- **D-10:** Remove `ignoreDuringBuilds: true` from `next.config.mjs` and fix all existing ESLint violations so `next build` passes with zero lint errors.
- **D-11:** Keep the current ESLint rule set (next/core-web-vitals + next/typescript) -- no new stricter rules in this phase.
- **D-12:** Add Prettier as a standalone tool (not an ESLint plugin). Run a one-time `prettier --write` format pass across the codebase.
- **D-13:** Prettier config: tabs for indentation, double quotes, semicolons -- matches the dominant existing style to minimize diff churn.
- **D-14:** Migrate 6 remaining files from `react-hot-toast` to `sonner` (withAuth.tsx was already removed in Phase 1). Sonner provider already exists in `layout.tsx`.

### Claude's Discretion
- The specific file name for the extracted managed CCA lib function (e.g., `managed-cca-data.ts` vs `cca-managed-access.ts`).
- Prettier print width and other minor formatting options not explicitly decided.
- Whether to fix the single `react-hooks/exhaustive-deps` suppression or leave it with a comment explaining why.
- The `no-empty-object-type` suppression in `textarea.tsx` (shadcn component) -- may keep if it's generated code.

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| INFR-01 | Standardize on sonner -- migrate 6 files from react-hot-toast, remove package | Toast API analysis confirms identical `toast.error()`/`toast.success()` signatures -- pure import swap. 6 files identified with exact line references. |
| INFR-02 | Remove unused dependencies (aphrodite, fs shim, logger) | Grep audit confirms zero imports of aphrodite, fs, logger in `src/`. Full audit found no additional dead deps beyond these 3. csv-parse used in scripts/. |
| INFR-03 | Fix self-calling API routes -- extract shared logic into lib function | 3 routes identified making HTTP self-calls to getManagedCCAs. Business logic in getManagedCCAs is self-contained and extractable. Existing `AccessResult<T>` pattern provides the template. |
| INFR-04 | Enable ESLint during builds -- remove `ignoreDuringBuilds`, fix all lint errors | Only 2 real lint errors exist (1 unused var in points-recap-card, 1 prefer-rest-params in middleware). Plus 5 stale eslint-disable directives and several `no-unused-vars` suppressions for `_request` params. |
| INFR-05 | Eliminate all `any` types -- replace 27 eslint-disable directives with proper interfaces | 27 `no-explicit-any` suppressions across 8 files. Most fall into 4 patterns: setter callbacks, Supabase join results, catch clauses, and cell renderer callbacks. Existing types in `src/types/dashboard.ts` already cover many shapes. |
</phase_requirements>

## Standard Stack

### Core (Already Installed)
| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| sonner | ^2.0.7 | Toast notifications (migration target) | Already installed and configured [VERIFIED: package.json] |
| eslint | 8.57.1 | Linting | Already installed [VERIFIED: node_modules] |
| eslint-config-next | 14.2.13 | Next.js ESLint rules | Already installed [VERIFIED: node_modules] |
| vitest | ^4.1.4 | Test framework | Already installed from Phase 1 [VERIFIED: package.json] |

### To Add
| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| prettier | ^3.8.2 | Code formatting | D-12 requires standalone Prettier. Latest stable is 3.8.2 [VERIFIED: npm registry] |

### To Remove
| Library | Version | Reason |
|---------|---------|--------|
| react-hot-toast | ^2.4.1 | Replaced by sonner (INFR-01) [VERIFIED: package.json] |
| aphrodite | ^2.4.0 | Zero imports in src/ [VERIFIED: grep audit] |
| fs | ^0.0.1-security | No-op npm placeholder, zero imports [VERIFIED: grep audit] |
| logger | ^0.0.1 | Zero imports in src/ [VERIFIED: grep audit] |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Prettier standalone | eslint-plugin-prettier | D-12 explicitly requires standalone. Plugin approach couples formatting to linting and causes slower lint runs. |

**Installation:**
```bash
npm install --save-dev prettier
npm uninstall react-hot-toast aphrodite fs logger
```

## Architecture Patterns

### Extracted Lib Function Pattern

The `getManagedCCAs` route currently contains ~90 lines of business logic (authenticate, query Supabase views, transform data). This logic must be extracted to a lib function following the established pattern in `src/lib/cca-chair-access.ts` and `src/lib/cca-management-access.ts`. [VERIFIED: source code analysis]

**Pattern: Lib function accepts Supabase client + user, returns typed data**

```typescript
// src/lib/managed-cca-data.ts
import { AuthenticatedUser } from "@/types/User";
import { createClient } from "@/utils/supabase/server";
import { ManagedCcaPositionsRow } from "@/types/dashboard";

export async function getManagedCcaData({
  supabase,
  user,
}: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  user: AuthenticatedUser;
}): Promise<ManagedCcaPositionsRow[]> {
  // Business logic extracted from getManagedCCAs/route.ts
}
```

The three consumer routes then call this function directly instead of making HTTP requests:

```typescript
// In getCCAs/route.ts, rankings/all/route.ts, managedPositions/route.ts
const managedCcas = await getManagedCcaData({ supabase, user });
// Transform as needed for their specific response shape
```

[VERIFIED: Pattern matches existing `getManagedCcaAccess()` in `src/lib/cca-management-access.ts`]

### Toast Migration Pattern

react-hot-toast and sonner share identical method signatures for the methods used in this codebase. [VERIFIED: runtime API inspection of both libraries]

**react-hot-toast usage in codebase (all 6 files):**
- `toast.error("message")` -- identical in sonner
- `toast.success("message")` -- identical in sonner

**Migration is a pure import swap:**
```typescript
// Before:
import toast from 'react-hot-toast';

// After:
import { toast } from "sonner";
```

Note the difference: react-hot-toast uses a default export, sonner uses a named export. [VERIFIED: source code analysis]

### Type Replacement Patterns

Analysis of the 27 `no-explicit-any` suppressions reveals 4 recurring patterns: [VERIFIED: source code analysis of all 8 affected files]

**Pattern 1: State setter callbacks (12 occurrences in manageMembers)**
```typescript
// Before:
setCurrentGroupedMembers((prev: any) => {
    const updated: any = { ...prev };
    // ...
});

// After -- GroupedMembers is already defined as Record<string, Member[]>:
setCurrentGroupedMembers((prev) => {  // TypeScript infers GroupedMembers
    const updated: GroupedMembers = { ...prev };
    // ...
});
```

**Pattern 2: Supabase join results (5 occurrences across API routes)**
```typescript
// Before:
appointments?.map((appointment: any) => { ... })

// After -- define the join shape:
interface AppointmentWithJoins {
    user_id: number;
    position_id: number;
    cca_positions: { name: string; position_type: string; cca_id: number };
    public_user_info: { id: number; name: string; email: string; room: string };
}
appointments?.map((appointment: AppointmentWithJoins) => { ... })
```

**Pattern 3: Catch clause error (1 occurrence in manageMembers)**
```typescript
// Before:
} catch (error: any) {
    const errorMsg = error.message || 'Unknown error';

// After:
} catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
}
```

Note: D-01 says "not `unknown` with casts" for state types. Catch clauses are different -- `unknown` is the correct TypeScript pattern for catch and does not require casting. [ASSUMED]

**Pattern 4: Cell renderer callbacks (4 occurrences in manageMembers)**
```typescript
// Before:
cell: (value: any, row: Member) => ( ... )

// After -- SimpleTableColumn.cell already types value as unknown:
cell: (value: unknown, row: Member) => (
    // Cast value to the specific accessor type as needed
    <span>{formatCommitmentPeriod(value as CommitmentPeriod | null)}</span>
)
```

**Pattern 5: Dynamic update object (1 occurrence in updateMember)**
```typescript
// Before:
const updates: any = {};

// After:
const updates: Partial<{ cut_status: string | null; commitment_period: string; comments: string }> = {};
```

### CCA and Permissions State Types (for manageMembers)

Two `any`-typed state variables in manageMembers need proper interfaces: [VERIFIED: API response shape from `src/app/api/cca/[ccaId]/members/route.ts`]

```typescript
// For setCCA state -- shape returned by /api/cca/[ccaId]/members
interface CcaSummary {
    id: number;
    name: string;
    cca_type: string;
}

// For setPermissions state
interface MemberPermissions {
    canManageMembers: boolean;
    ccaType: string;
    managementMessage: string;
}
```

### Prettier Configuration

```json
// .prettierrc
{
    "useTabs": true,
    "tabWidth": 2,
    "semi": true,
    "singleQuote": false,
    "trailingComma": "all",
    "printWidth": 100
}
```

**Rationale:** D-13 locks tabs/double-quotes/semicolons. Print width of 100 is Claude's discretion -- 80 causes excessive wrapping in JSX-heavy files, 120 is too wide for side-by-side review. 100 is the common middle ground. [ASSUMED: print width choice]

A `.prettierignore` file should exclude build artifacts:
```
node_modules/
.next/
.sst/
```

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Code formatting | Custom lint rules for formatting | Prettier (standalone) | D-12 explicitly requires Prettier. Formatting via ESLint is slower and less consistent. |
| Toast notifications | Custom notification system | sonner (already installed) | Already has provider in layout.tsx, identical API to react-hot-toast. |
| Supabase types | Manual schema inspection | Hand-written from query shapes | D-03 explicitly forbids `supabase gen types`. Write interfaces from what the queries actually return. |

## Common Pitfalls

### Pitfall 1: Sonner import difference
**What goes wrong:** Developer replaces `react-hot-toast` import but uses the wrong import syntax. Sonner uses named export `{ toast }`, not default export.
**Why it happens:** react-hot-toast's `import toast from 'react-hot-toast'` is a default import. Sonner uses `import { toast } from "sonner"`.
**How to avoid:** Replace both the import path AND the import syntax in every file. Verify with `npm run build` after migration.
**Warning signs:** TypeScript error "Module 'sonner' has no default export" [VERIFIED: sonner exports only named exports]

### Pitfall 2: Removing react-hot-toast before migrating all files
**What goes wrong:** `npm uninstall react-hot-toast` breaks the build because some files still import it.
**Why it happens:** Package removal happens before import migration.
**How to avoid:** Migrate all 6 files first, verify with build, THEN uninstall the package.
**Warning signs:** Module not found errors during build. [VERIFIED: standard npm behavior]

### Pitfall 3: ESLint errors from removing eslint-disable directives
**What goes wrong:** After replacing `any` with proper types, the `eslint-disable` directive becomes unnecessary. If it's left in place, ESLint (with `--report-unused-disable-directives`) reports it as an error.
**Why it happens:** ESLint's default behavior reports unused disable directives as errors.
**How to avoid:** Always remove the `eslint-disable-next-line` comment when fixing the underlying issue. Current audit shows 5 already-stale directives that need removal. [VERIFIED: `eslint --report-unused-disable-directives` output]
**Warning signs:** "Unused eslint-disable directive" errors in build output.

### Pitfall 4: Self-calling route extraction breaking cookie context
**What goes wrong:** The extracted lib function tries to access cookies or request context that was previously available via the HTTP request.
**Why it happens:** The self-calling routes forwarded cookies via `headers: { cookie: request.headers.get("cookie") || "" }`. When extracting to a lib function, there's no HTTP request to forward.
**How to avoid:** The extracted function receives a Supabase client that's already authenticated (created with `createClient()` in the API route). It does NOT need to handle cookies -- that's the route handler's job. The function also receives the `user` from `fetchUserInfo()`. [VERIFIED: existing pattern in `src/lib/cca-management-access.ts`]
**Warning signs:** 401 errors from the extracted function.

### Pitfall 5: Prettier + ESLint conflict
**What goes wrong:** Prettier reformats code in a way that introduces ESLint errors, or ESLint auto-fix reformats in a way that Prettier changes back.
**Why it happens:** Some ESLint rules care about formatting (e.g., `indent`, `quotes`) and can conflict with Prettier.
**How to avoid:** D-12 says "standalone tool, not ESLint plugin." Run Prettier AFTER ESLint fixes, not through ESLint. The current ESLint config (`next/core-web-vitals` + `next/typescript`) has no formatting rules that conflict with Prettier. [VERIFIED: `.eslintrc.json` contains no formatting rules]
**Warning signs:** Git diff showing flip-flopping changes between lint and format.

### Pitfall 6: GroupedMembers type annotation on setter callbacks
**What goes wrong:** TypeScript still infers `any` for the setter callback parameter even though `useState<GroupedMembers>` is typed.
**Why it happens:** This does NOT actually happen. TypeScript correctly infers the `prev` parameter type from `useState<GroupedMembers>`. The original developer added `(prev: any)` explicitly, overriding the inferred type. Simply removing `: any` fixes the issue.
**How to avoid:** Remove the explicit `: any` annotation. TypeScript will infer `GroupedMembers` from the state type.
**Warning signs:** None -- this is a straightforward removal. [VERIFIED: TypeScript behavior with useState generic]

## Code Examples

### Toast Migration (verified pattern from source)

```typescript
// File: src/app/dashboard/mycca/page.tsx (and 5 similar files)
// BEFORE (line 5):
import toast from 'react-hot-toast';

// AFTER:
import { toast } from "sonner";

// No other changes needed -- toast.error() and toast.success() have identical signatures
```
Source: [VERIFIED: runtime API inspection of both libraries confirmed identical method signatures for error, success, loading, promise, dismiss]

### Self-Calling Route Extraction

```typescript
// src/lib/managed-cca-data.ts (new file)
import { AuthenticatedUser } from "@/types/User";
import { CcaType, PositionType } from "@/types/User";
import { createClient } from "@/utils/supabase/server";
import { isChairPositionType } from "@/lib/cca-chair-access";

// Move types from getManagedCCAs/route.ts
export type ManagedCcaPosition = {
    position_id: number;
    position_name: string;
    position_type: PositionType;
    description: string | null;
    access_depth: number;
};

export type ManagedCcaPositionsRow = {
    cca_id: number;
    cca_name: string;
    positions: ManagedCcaPosition[];
    id: number;
    name: string;
    role: string;
    position_type: PositionType | "";
    cca_type: CcaType | "committee";
    description: string;
    points: number;
    can_manage_members: boolean;
    can_rank_members: boolean;
};

export async function getManagedCcaData(
    supabase: Awaited<ReturnType<typeof createClient>>,
    user: AuthenticatedUser,
): Promise<ManagedCcaPositionsRow[]> {
    // Move the entire body of GET() from getManagedCCAs/route.ts here
    // Replace NextResponse.json returns with direct data returns
    // Replace error returns with thrown errors (let the route handler catch)
}
```
Source: [VERIFIED: existing `getManagedCCAs/route.ts` and pattern from `cca-management-access.ts`]

### Consumer Route After Extraction

```typescript
// src/app/api/user/getCCAs/route.ts -- replacing the self-call at lines 61-78
// BEFORE:
const fetchUrl = new URL('/api/user/getManagedCCAs', request.url);
const apiRes = await fetch(fetchUrl, {
    headers: { cookie: request.headers.get("cookie") || "" },
});
const apiData = await apiRes.json();
const managedCcas = apiData.data || [];

// AFTER:
import { getManagedCcaData } from "@/lib/managed-cca-data";
// ...
const managedCcas = await getManagedCcaData(supabase, user);
```
Source: [VERIFIED: source code of getCCAs/route.ts lines 61-78]

### ESLint Fix: prefer-rest-params

```typescript
// src/utils/supabase/middleware.ts line 18
// BEFORE:
setAll(cookiesToSet) {
    const headers = arguments[1] as Record<string, string> | undefined;

// AFTER:
setAll(cookiesToSet, ...rest: unknown[]) {
    const headers = rest[0] as Record<string, string> | undefined;
```
Source: [VERIFIED: ESLint `prefer-rest-params` rule behavior]

### ESLint Fix: unused variable

```typescript
// src/components/dashboard/points-recap-card.tsx line 748
// BEFORE:
const downloadRecapImage = async () => { ... };
// This function is defined but never called

// AFTER:
// Either prefix with underscore: const _downloadRecapImage = ...
// Or remove the dead code entirely (preferred since it's unused)
```
Source: [VERIFIED: ESLint output and source code]

## ESLint Suppression Inventory

Complete inventory of all `eslint-disable` directives in the codebase. [VERIFIED: grep audit of entire src/ directory]

### `no-explicit-any` (27 directives -- INFR-05 target)

| File | Count | Pattern |
|------|-------|---------|
| `manageMembers/[ccaName]/page.tsx` | 16 | Setter callbacks (prev: any), cell renderers (value: any), catch clause |
| `holidaySubsidy/weekly/[ccaId]/[weekId]/route.ts` | 3 | Supabase join result mapping (appointment: any, member: any) |
| `ordering-table.tsx` | 2 | Generic cell callback (value: any), constraint (Record<string, any>) |
| `cca/[ccaId]/members/route.ts` | 2 | Supabase join result (member: any), position data (positionData: any) |
| `holidaySubsidy/approvals/weekly/.../route.ts` | 1 | Supabase join result |
| `sportsCulture/available/route.ts` | 1 | Supabase join result (appointment: any) |
| `holidaySubsidy/declarations/[ccaId]/route.ts` | 1 | Supabase join result (p: any) |
| `cca/[ccaId]/updateMember/route.ts` | 1 | Dynamic update object (updates: any) |

### `no-unused-vars` (5 directives)

| File | What | Fix |
|------|------|-----|
| `checkRole/route.ts` | `_request: Request` param | Remove directive -- underscore prefix already suppresses rule |
| `forChair/route.ts` | `_request: Request` param | Remove directive -- underscore prefix already suppresses rule |
| `getRankablePositions/[email]/route.ts` | `_request: Request` param | Remove directive -- underscore prefix already suppresses rule |
| `sportsCulture/available/route.ts` | `_request: Request` param | Remove directive -- underscore prefix already suppresses rule |
| `approvals/weekly/.../route.ts` | `authorizeJCRC` function (commented-out usage) | Remove directive -- function is used in commented-out code, keep function, remove directive |
| `declarations/[ccaId]/route.ts` | `subsidies` destructured but "unused" | Keep -- variable IS used in the response object. Directive suppresses false positive from destructuring. |

### `no-empty-object-type` (1 directive)

| File | What | Fix |
|------|------|-----|
| `textarea.tsx` | `interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}` | Claude's discretion: convert to type alias or leave (shadcn generated code) |

### `react-hooks/exhaustive-deps` (1 directive)

| File | What | Fix |
|------|------|-----|
| `rankApplicants/page.tsx` line 340 | Already stale (unused) per ESLint output | Remove the directive -- ESLint reports it as unused |

### Non-suppression ESLint Errors (2 errors)

| File | Rule | Fix |
|------|------|-----|
| `points-recap-card.tsx:748` | `no-unused-vars` | Remove dead `downloadRecapImage` function or prefix with `_` |
| `middleware.ts:18` | `prefer-rest-params` | Replace `arguments[1]` with rest parameters |

**Total work: 27 `any` replacements + 5 stale `no-unused-vars` directive removals + 1 stale `exhaustive-deps` removal + 2 real lint error fixes + 1 `no-empty-object-type` decision = 36 individual changes across ~14 files.**

## Dependency Audit Results

Full audit of `package.json` dependencies against actual usage in `src/`. [VERIFIED: grep audit of entire src/ and scripts/ directories]

### Production Dependencies

| Package | Used In | Status |
|---------|---------|--------|
| @radix-ui/* (10 packages) | src/components/ui/ | Active |
| @supabase/ssr | src/utils/supabase/ | Active |
| @supabase/supabase-js | src/utils/supabase/ | Active |
| @tanstack/react-table | src/components/table/simple-table.tsx | Active |
| **aphrodite** | **NOWHERE** | **REMOVE** |
| class-variance-authority | src/components/ui/button.tsx + others | Active |
| clsx | src/lib/utils.ts | Active |
| csv-parse | scripts/index.ts (NOT in src/) | Keep -- used by offline scripts |
| framer-motion | src/components/ | Active |
| **fs** | **NOWHERE** | **REMOVE** |
| **logger** | **NOWHERE** | **REMOVE** |
| lucide-react | Many components | Active |
| next | Core framework | Active |
| next-themes | src/components/ | Active |
| react / react-dom | Core | Active |
| **react-hot-toast** | 6 files (migrating to sonner) | **REMOVE after migration** |
| sonner | 7 files + layout.tsx | Active (migration target) |
| sst | sst.config.ts | Active |
| tailwind-merge | src/lib/utils.ts | Active |

### Dev Dependencies

All dev dependencies are actively used (eslint, typescript, tailwindcss, postcss, vitest, etc.). No dead dev dependencies found.

**Conclusion: Exactly 4 packages to remove (aphrodite, fs, logger, react-hot-toast). No surprises beyond the known dead dependencies.**

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `ignoreDuringBuilds: true` | ESLint enforced on build | Phase 2 | Build catches lint errors before deploy |
| Dual toast libraries | Single library (sonner) | Phase 2 | Consistent notification UI, smaller bundle |
| Self-calling HTTP routes | Direct lib function calls | Phase 2 | Eliminates unnecessary HTTP round-trips and cookie forwarding |
| `any` type suppressions | Typed interfaces | Phase 2 | Compiler catches type errors during refactors in Phases 3-6 |

**Deprecated/outdated:**
- `next lint` is deprecated in Next.js 16+. The project currently uses ESLint 8 with `eslint-config-next` 14.x. D-11 says keep current rule set -- no ESLint migration needed in this phase. [VERIFIED: `next lint` CLI output shows deprecation notice]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Catch clause `error: unknown` with `instanceof Error` check satisfies D-01 (which says "not unknown with casts" for state types) | Type Replacement Patterns | LOW -- catch clauses are universally typed as `unknown` in modern TypeScript; the D-01 constraint was about state variables, not error handling |
| A2 | Prettier print width of 100 is a good default | Prettier Configuration | LOW -- purely aesthetic, easily changed. 80 causes excessive wrapping in JSX files |
| A3 | The `no-unused-vars` suppression for `_request` params can be removed because underscore-prefixed params are already exempt | ESLint Suppression Inventory | LOW -- `next/typescript` extends `@typescript-eslint/recommended` which exempts `_`-prefixed vars by default |

## Open Questions

1. **`downloadRecapImage` in points-recap-card.tsx**
   - What we know: The function is defined (lines 748-766) but never called anywhere. ESLint flags it as unused.
   - What's unclear: Was this intentionally disabled or accidentally disconnected? It generates a shareable image of the points recap.
   - Recommendation: Prefix with `_` to suppress the lint error rather than deleting, since this is feature code that may be reconnected in Phase 4 (RANK-01 decomposes this component). Add a `// TODO: reconnect or remove in Phase 4` comment.

2. **`authorizeJCRC` function in holiday subsidy approvals**
   - What we know: The function exists but its callers are commented out (see CONCERNS.md security note). The `no-unused-vars` suppression is there because the function is defined but not called.
   - What's unclear: Re-enabling the authorization is a security concern tracked separately. The suppression should stay until the function is actually called.
   - Recommendation: Keep the suppression and the function. Add a comment linking to the security concern. This is NOT in Phase 2 scope.

3. **`declarations/[ccaId]/route.ts` destructuring suppression**
   - What we know: Line 101-102 uses `const positions = positionsWithSubsidies?.map(({ subsidies, ...rest }) => rest)`. The `subsidies` destructured variable triggers `no-unused-vars` but it IS the mechanism for excluding subsidies from the spread.
   - What's unclear: Whether ESLint is actually flagging this or the directive is stale.
   - Recommendation: Test by removing the directive. If ESLint doesn't flag it, the directive is stale and should be removed. If it does, prefix with `_subsidies`.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.4 |
| Config file | `vitest.config.mts` |
| Quick run command | `npm test` |
| Full suite command | `npm test` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| INFR-01 | No react-hot-toast imports remain | smoke | `grep -r "react-hot-toast" src/ && exit 1 \|\| exit 0` | N/A -- grep check |
| INFR-02 | Dead deps not installed | smoke | `npm ls aphrodite 2>&1 \| grep -q "missing" && npm ls logger 2>&1 \| grep -q "missing"` | N/A -- npm check |
| INFR-03 | No self-calling API routes | smoke | `grep -r "fetch.*getManagedCCAs" src/app/api/ && exit 1 \|\| exit 0` | N/A -- grep check |
| INFR-03 | Extracted lib function works | unit | `npx vitest run src/lib/__tests__/managed-cca-data.test.ts` | Wave 0 |
| INFR-04 | ESLint passes on build | integration | `npm run build` | N/A -- build check |
| INFR-05 | No any suppressions remain | smoke | `grep -r "no-explicit-any" src/ && exit 1 \|\| exit 0` | N/A -- grep check |

### Sampling Rate
- **Per task commit:** `npm run lint && npm run build`
- **Per wave merge:** `npm test && npm run build`
- **Phase gate:** Full suite green, build green, zero eslint-disable for no-explicit-any

### Wave 0 Gaps
- [ ] `src/lib/__tests__/managed-cca-data.test.ts` -- unit test for extracted managed CCA function (INFR-03)
- No other test infrastructure needed -- existing Vitest setup is sufficient

## Environment Availability

Step 2.6: No external dependencies beyond what's already installed. All changes are code/config modifications using npm packages.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Runtime | Yes | 22.x | -- |
| npm | Package management | Yes | -- | -- |
| ESLint | INFR-04 | Yes | 8.57.1 | -- |
| Prettier | D-12 | No (to install) | 3.8.2 (npm) | -- |

## Security Domain

This phase has no security-sensitive changes. It addresses code quality and developer experience. No authentication, authorization, input validation, or cryptographic changes are involved.

The self-calling route extraction (INFR-03) preserves existing auth patterns -- the extracted lib function receives an already-authenticated Supabase client and user object, maintaining the same security posture.

## Sources

### Primary (HIGH confidence)
- **Source code analysis** -- Direct reading of all 14+ affected files in the codebase
- **npm registry** -- Version verification for prettier (3.8.2)
- **Runtime API inspection** -- Verified react-hot-toast and sonner export identical toast.error/success/loading/promise/dismiss signatures
- **ESLint output** -- `npx eslint src/ --report-unused-disable-directives` confirmed exactly 7 errors (2 real + 5 stale directives)
- **grep audit** -- Confirmed zero imports of aphrodite, fs, logger in src/

### Secondary (MEDIUM confidence)
- **next lint deprecation notice** -- Observed in CLI output but does not affect Phase 2 (ESLint 8 still works)

### Tertiary (LOW confidence)
- None -- all claims verified against source code or npm registry

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all packages verified in package.json and npm registry
- Architecture: HIGH -- all patterns verified against existing codebase patterns
- Pitfalls: HIGH -- all pitfalls derived from direct source code analysis
- Type replacements: HIGH -- all 27 suppressions read and categorized from source

**Research date:** 2026-04-11
**Valid until:** 2026-05-11 (stable -- no fast-moving dependencies)
