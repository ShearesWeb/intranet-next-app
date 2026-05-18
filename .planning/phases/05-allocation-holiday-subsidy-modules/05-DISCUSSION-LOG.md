# Phase 5: Allocation & Holiday Subsidy Modules - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md -- this log preserves the alternatives considered.

**Date:** 2026-04-11
**Phase:** 05-allocation-holiday-subsidy-modules
**Areas discussed:** HOLIDAY_WEEKS data source, Module boundaries & type migration, Decomposition scope, Search component reuse

---

## HOLIDAY_WEEKS Data Source

| Option | Description | Selected |
|--------|-------------|----------|
| Database table | Supabase table with admin UI. Requires migration and API endpoint. | |
| JSON config file | File at src/config/holiday-weeks.json. Requires commit+deploy to change. | |
| Environment variable | JSON blob in env var. Awkward to edit. | |

**User's choice:** JSON config file
**Notes:** None

### Follow-up: File location

| Option | Description | Selected |
|--------|-------------|----------|
| src/config/holiday-weeks.json | Co-located with source, imported at build time | |
| public/config/holiday-weeks.json | Fetched at runtime via HTTP | |

**User's choice:** src/config/holiday-weeks.json (Recommended)

### Follow-up: Editability logic

| Option | Description | Selected |
|--------|-------------|----------|
| Keep in TypeScript | Grace period logic stays in TS utility | |
| Move grace period to config | Add grace_days field per week in JSON | |

**User's choice:** Initially selected "Keep in TypeScript" but then revised: put grace_days in JSON config as a global-level field (not per-week). The TS utility reads it from the config.

---

## Module Boundaries & Type Migration

### Module structure

| Option | Description | Selected |
|--------|-------------|----------|
| Two separate modules | features/allocation/ + features/holiday-subsidy/ | |
| One combined module | features/subsidy-allocation/ | |

**User's choice:** Two separate modules (Recommended)

### SportsCulture types location

| Option | Description | Selected |
|--------|-------------|----------|
| Inside features/allocation/ | All CCA application/preference types together | |
| Stay in src/types/dashboard.ts | Minimal change | |
| New features/sports-culture/ module | Third feature module | |

**User's choice:** Inside features/allocation/ (Recommended)

### Holiday subsidy types

| Option | Description | Selected |
|--------|-------------|----------|
| Move both, no shims | Move to features/holiday-subsidy/types/, update all imports | |
| Merge into one file | Combine into single file | |

**User's choice:** Move both, no shims (Recommended)

### Holiday weeks utility

| Option | Description | Selected |
|--------|-------------|----------|
| Move to features/holiday-subsidy/utils/ | Consistent with feature module pattern | |
| Keep in src/lib/ | Utility stays in lib/ | |

**User's choice:** Move to features/holiday-subsidy/utils/ (Recommended)

---

## Decomposition Scope

### Page treatment level

| Option | Description | Selected |
|--------|-------------|----------|
| Big pages only | Full decomposition for 3 largest pages, lighter for rest | |
| All pages equally | Every page gets hook extraction and component splitting | |
| Strict success criteria only | Only rankApplicants gets full treatment | |

**User's choice:** All pages equally

### Guide page handling

| Option | Description | Selected |
|--------|-------------|----------|
| Light refactor only | Move to module, extract data-fetching hook, leave JSX | |
| Full decomposition | Split into section components | |
| You decide | Claude's discretion | |

**User's choice:** Full decomposition

### Weekly page hooks

| Option | Description | Selected |
|--------|-------------|----------|
| Independent hooks | Separate useWeeklyCommitment and useWeeklyApprovals | |
| Shared base hook | useWeeklyBase extended by specific hooks | |
| You decide | Claude's discretion | |

**User's choice:** Independent hooks (Recommended)

---

## Search Component Reuse

| Option | Description | Selected |
|--------|-------------|----------|
| Keep allocation-specific | Extract to features/allocation/components/ | |
| Create shared UserSearchBox | Shared component in src/components/ | |
| You decide | Claude's discretion | |

**User's choice:** Keep allocation-specific (Recommended)

---

## Claude's Discretion

- Exact file naming within feature module sub-directories
- How to split types between multiple files within each feature's types/ directory
- Which utility functions to extract vs keep inline in hooks
- Internal structure of the guide page section components
- How to structure the JSON config schema (field names, date format)

## Deferred Ideas

None -- discussion stayed within phase scope.
