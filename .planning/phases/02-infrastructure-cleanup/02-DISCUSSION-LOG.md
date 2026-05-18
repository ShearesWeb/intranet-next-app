# Phase 2: Infrastructure Cleanup - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-11
**Phase:** 02-infrastructure-cleanup
**Areas discussed:** Type replacement depth, Shared CCA logic extraction, Dependency cleanup scope, ESLint enforcement

---

## Type Replacement Depth

| Option | Description | Selected |
|--------|-------------|----------|
| Proper interfaces (Recommended) | Define typed interfaces for every Supabase query response. More upfront work but catches regressions during later refactors. | ✓ |
| Minimal: unknown + guards | Replace `any` with `unknown` and add type guards/assertions. Fastest path but less safety. | |
| You decide | Claude picks per file. | |

**User's choice:** Proper interfaces
**Notes:** None

### Follow-up: Type location

| Option | Description | Selected |
|--------|-------------|----------|
| Centralize in src/types/ (Recommended) | Add new interface files grouped by domain. Matches existing pattern. | ✓ |
| Co-locate with usage | Define types in the files that use them. | |
| You decide | Claude decides per type. | |

**User's choice:** Centralize in src/types/

### Follow-up: Type source

| Option | Description | Selected |
|--------|-------------|----------|
| Hand-write from query shapes (Recommended) | Define interfaces based on what queries return. No Supabase CLI needed. | ✓ |
| Generate from Supabase schema | Run `supabase gen types typescript`. More accurate but requires project access. | |
| You decide | Claude picks per situation. | |

**User's choice:** Hand-write from query shapes

---

## Shared CCA Logic Extraction

| Option | Description | Selected |
|--------|-------------|----------|
| Lib function in src/lib/ (Recommended) | Extract `getManagedCcaData()` into src/lib/. Both routes call it directly. | ✓ |
| Keep in getManagedCCAs route, import directly | Export core logic from route file. Minimal file creation but couples routes. | |
| You decide | Claude picks. | |

**User's choice:** User initially asked "remove one of these routes. is this possible?" — investigation revealed both routes are needed (different client consumers: mycca/page.tsx uses getCCAs, mycca/admin/page.tsx uses getManagedCCAs). Also discovered 3 self-calling routes total, not just 1. User then approved the lib function extraction approach.

---

## Dependency Cleanup Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Just the 3 known dead deps (Recommended) | Remove aphrodite, fs, logger. Quick and safe. | |
| Full dependency audit | Run depcheck or similar. Could surface more dead weight. | ✓ |
| You decide | Claude decides. | |

**User's choice:** Full dependency audit

### Follow-up: Action on audit findings

| Option | Description | Selected |
|--------|-------------|----------|
| Remove all confirmed unused (Recommended) | If zero imports in src/, remove it. Verify with build. | ✓ |
| Flag only, remove later | Document but only remove the known 3. | |
| You decide | Claude judges per package. | |

**User's choice:** Remove all confirmed unused

---

## ESLint Enforcement

| Option | Description | Selected |
|--------|-------------|----------|
| Fix existing, no new rules (Recommended) | Remove ignoreDuringBuilds, fix violations, keep current config. | |
| Fix existing + add Prettier | Also add Prettier for consistent formatting. Addresses mixed tabs/spaces. | ✓ |
| Fix existing + stricter TS rules | Add stricter TypeScript ESLint rules. | |

**User's choice:** Fix existing + add Prettier

### Follow-up: Prettier integration

| Option | Description | Selected |
|--------|-------------|----------|
| Standalone Prettier (Recommended) | Add .prettierrc, run one-time format pass. Keeps ESLint and formatting separate. | ✓ |
| ESLint plugin integration | Install eslint-plugin-prettier. Tighter but slower. | |
| You decide | Claude picks simpler approach. | |

**User's choice:** Standalone Prettier

### Follow-up: Prettier config

| Option | Description | Selected |
|--------|-------------|----------|
| Tabs, double quotes, semis (Recommended) | Matches dominant codebase style. Minimizes diff churn. | ✓ |
| Spaces (2), double quotes, semis | 2-space indent. Larger initial diff but more standard. | |
| You decide | Claude analyzes style and picks. | |

**User's choice:** Tabs, double quotes, semis

---

## Claude's Discretion

- Specific lib function file name for extracted managed CCA logic
- Prettier print width and minor formatting options
- Whether to fix `react-hooks/exhaustive-deps` suppression or keep with comment
- `no-empty-object-type` suppression in shadcn textarea.tsx

## Deferred Ideas

None — discussion stayed within phase scope.
