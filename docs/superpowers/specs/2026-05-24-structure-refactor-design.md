# Structure Refactor: Drop features/, Adopt Next.js-Native Layout

**Date:** 2026-05-24
**Status:** Approved

## Problem

The previous refactor introduced `src/features/{domain}/` with sub-directories for components, hooks, services, types, and utils — while also keeping `src/lib/` and `src/components/` as separate organizational centers. This creates three competing homes for code with no clear rule for where anything belongs:

- `src/lib/api/auth.ts` imports FROM `src/features/cca/utils/` (lib depends on features — wrong direction)
- `src/lib/managed-cca-data.ts` imports FROM `src/features/cca/utils/` (same circular dependency)
- `src/components/auth/`, `src/components/badges/`, `src/components/feature-flags/` are feature-specific components living outside features
- `src/lib/hooks/use-mobile.ts` is an orphaned hook in lib

Next.js does not recommend a `features/` directory. The framework's own colocation tools (_components, route groups, safe colocation of non-page files) are the intended organizational mechanism.

## Target Structure

```
src/
├── app/                        # Routes + API handlers only (thin)
├── components/                 # Shared components, organized by domain
│   ├── ui/                     # shadcn primitives (unchanged)
│   ├── layout/                 # app shell: sidebar, page-header, skeletons
│   ├── table/                  # data-table, ordering-table
│   ├── auth/                   # login-form (already here)
│   ├── badges/                 # CcaTypeBadge, PositionTypeBadge (already here)
│   ├── feature-flags/          # service-disabled-state (already here)
│   ├── cca/                    # add-member-modal, member-group-table, save-error-dialog
│   ├── ranking/                # points-recap-card, position-ranking-card, recap-slide-content
│   ├── allocation/             # add-applicant-dialog, position-card, rank steps, ranking-columns
│   └── holiday-subsidy/        # approval tables, declaration cards, weekly tables, guide components
├── hooks/                      # ALL hooks (flat, no nesting)
│   ├── use-mobile.ts           # from lib/hooks/
│   ├── use-role-auth.ts        # from features/cca/hooks/
│   ├── use-cca-list.ts         # from features/cca/hooks/
│   ├── use-cca-members.ts
│   ├── use-managed-ccas.ts
│   ├── use-member-save.ts
│   ├── use-member-search.ts
│   ├── use-ranking-editor.ts
│   ├── use-recap-audio.ts
│   ├── use-recap-data.ts
│   ├── use-recap-navigation.ts
│   ├── use-applicant-rankings.ts
│   ├── use-rankable-positions.ts
│   ├── use-chair-subsidy-ccas.ts
│   ├── use-subsidy-approval-details.ts
│   ├── use-subsidy-approvals-index.ts
│   ├── use-subsidy-declarations.ts
│   ├── use-week-selection.ts
│   ├── use-weekly-approvals.ts
│   └── use-weekly-commitment.ts
├── lib/                        # Services, business logic, infra utilities
│   ├── supabase/               # client, server, middleware, helpers, cookie-eviction
│   ├── api/                    # response helpers (apiOk, apiError), errors, fetch, auth guards
│   ├── auth/                   # auth-context, fetch-user-info
│   ├── cca/                    # services + business logic (chair-access, management-access, member-service, etc.)
│   ├── ranking/                # services + business logic (ranking-metrics, comments, recap-slides, etc.)
│   ├── allocation/             # business logic (applicant-diff, ranking-changes, guide-content)
│   ├── holiday-subsidy/        # services + business logic (approval-service, weekly-service, etc.)
│   ├── feature-flags.ts
│   ├── managed-cca-data.ts
│   └── utils.ts                # cn()
├── types/                      # ALL shared types (flat)
│   ├── user.ts                 # (already here)
│   ├── cca-data.ts
│   ├── members.ts
│   ├── ranking.ts
│   ├── ranking-api.ts
│   ├── recap.ts
│   ├── applicants.ts
│   ├── preferences.ts
│   ├── declarations.ts
│   ├── holiday-subsidy-api.ts  # renamed from api.ts to avoid ambiguity
│   └── weekly.ts
├── config/                     # Static config (holiday-weeks.json)
└── test-utils/                 # Test helpers
```

## File Move Map

### features/cca/ → components/cca/ + lib/cca/ + hooks/ + types/

| Old Path | New Path |
|----------|----------|
| `features/cca/components/add-member-modal.tsx` | `components/cca/add-member-modal.tsx` |
| `features/cca/components/member-group-table.tsx` | `components/cca/member-group-table.tsx` |
| `features/cca/components/save-error-dialog.tsx` | `components/cca/save-error-dialog.tsx` |
| `features/cca/hooks/use-cca-list.ts` | `hooks/use-cca-list.ts` |
| `features/cca/hooks/use-cca-members.ts` | `hooks/use-cca-members.ts` |
| `features/cca/hooks/use-managed-ccas.ts` | `hooks/use-managed-ccas.ts` |
| `features/cca/hooks/use-member-save.ts` | `hooks/use-member-save.ts` |
| `features/cca/hooks/use-member-search.ts` | `hooks/use-member-search.ts` |
| `features/cca/hooks/use-role-auth.ts` | `hooks/use-role-auth.ts` |
| `features/cca/hooks/member-status-helpers.ts` | `lib/cca/member-status-helpers.ts` |
| `features/cca/services/member-service.ts` | `lib/cca/member-service.ts` |
| `features/cca/services/position-service.ts` | `lib/cca/position-service.ts` |
| `features/cca/types/cca-data.ts` | `types/cca-data.ts` |
| `features/cca/types/members.ts` | `types/members.ts` |
| `features/cca/utils/cca-chair-access.ts` | `lib/cca/cca-chair-access.ts` |
| `features/cca/utils/cca-management-access.ts` | `lib/cca/cca-management-access.ts` |
| `features/cca/utils/cca-cut-status.ts` | `lib/cca/cca-cut-status.ts` |
| `features/cca/utils/cca-member-management.ts` | `lib/cca/cca-member-management.ts` |
| `features/cca/utils/member-helpers.ts` | `lib/cca/member-helpers.ts` |

### features/ranking/ → components/ranking/ + lib/ranking/ + hooks/ + types/

| Old Path | New Path |
|----------|----------|
| `features/ranking/components/points-recap-card.tsx` | `components/ranking/points-recap-card.tsx` |
| `features/ranking/components/position-ranking-card.tsx` | `components/ranking/position-ranking-card.tsx` |
| `features/ranking/components/recap-slide-content.tsx` | `components/ranking/recap-slide-content.tsx` |
| `features/ranking/hooks/use-ranking-editor.ts` | `hooks/use-ranking-editor.ts` |
| `features/ranking/hooks/use-recap-audio.ts` | `hooks/use-recap-audio.ts` |
| `features/ranking/hooks/use-recap-data.ts` | `hooks/use-recap-data.ts` |
| `features/ranking/hooks/use-recap-navigation.ts` | `hooks/use-recap-navigation.ts` |
| `features/ranking/services/user-ranking-service.ts` | `lib/ranking/user-ranking-service.ts` |
| `features/ranking/types/ranking.ts` | `types/ranking.ts` |
| `features/ranking/types/ranking-api.ts` | `types/ranking-api.ts` |
| `features/ranking/types/recap.ts` | `types/recap.ts` |
| `features/ranking/utils/cca-ranking-comments.ts` | `lib/ranking/cca-ranking-comments.ts` |
| `features/ranking/utils/cca-ranking-metrics.ts` | `lib/ranking/cca-ranking-metrics.ts` |
| `features/ranking/utils/create-recap-image-blob.ts` | `lib/ranking/create-recap-image-blob.ts` |
| `features/ranking/utils/ranking-editor.ts` | `lib/ranking/ranking-editor.ts` |
| `features/ranking/utils/ranking-route.ts` | `lib/ranking/ranking-route.ts` |
| `features/ranking/utils/recap-slides.ts` | `lib/ranking/recap-slides.ts` |

### features/allocation/ → components/allocation/ + lib/allocation/ + hooks/ + types/

| Old Path | New Path |
|----------|----------|
| `features/allocation/components/add-applicant-dialog.tsx` | `components/allocation/add-applicant-dialog.tsx` |
| `features/allocation/components/allocation-algorithm-steps.tsx` | `components/allocation/allocation-algorithm-steps.tsx` |
| `features/allocation/components/allocation-faq.tsx` | `components/allocation/allocation-faq.tsx` |
| `features/allocation/components/allocation-guide-hero.tsx` | `components/allocation/allocation-guide-hero.tsx` |
| `features/allocation/components/allocation-tips.tsx` | `components/allocation/allocation-tips.tsx` |
| `features/allocation/components/position-card.tsx` | `components/allocation/position-card.tsx` |
| `features/allocation/components/rank-ordering-step.tsx` | `components/allocation/rank-ordering-step.tsx` |
| `features/allocation/components/rank-selection-step.tsx` | `components/allocation/rank-selection-step.tsx` |
| `features/allocation/hooks/use-applicant-rankings.ts` | `hooks/use-applicant-rankings.ts` |
| `features/allocation/hooks/use-rankable-positions.ts` | `hooks/use-rankable-positions.ts` |
| `features/allocation/types/applicants.ts` | `types/applicants.ts` |
| `features/allocation/types/preferences.ts` | `types/preferences.ts` |
| `features/allocation/utils/allocation-guide-content.ts` | `lib/allocation/allocation-guide-content.ts` |
| `features/allocation/utils/applicant-diff.ts` | `lib/allocation/applicant-diff.ts` |
| `features/allocation/utils/ranking-changes.ts` | `lib/allocation/ranking-changes.ts` |
| `features/allocation/utils/ranking-columns.tsx` | `components/allocation/ranking-columns.tsx` |

### features/holiday-subsidy/ → components/holiday-subsidy/ + lib/holiday-subsidy/ + hooks/ + types/

| Old Path | New Path |
|----------|----------|
| `features/holiday-subsidy/components/approval-cca-table.tsx` | `components/holiday-subsidy/approval-cca-table.tsx` |
| `features/holiday-subsidy/components/chair-cca-table.tsx` | `components/holiday-subsidy/chair-cca-table.tsx` |
| `features/holiday-subsidy/components/declaration-section-card.tsx` | `components/holiday-subsidy/declaration-section-card.tsx` |
| `features/holiday-subsidy/components/guide-faq.tsx` | `components/holiday-subsidy/guide-faq.tsx` |
| `features/holiday-subsidy/components/guide-phase-card.tsx` | `components/holiday-subsidy/guide-phase-card.tsx` |
| `features/holiday-subsidy/components/guide-process-overview.tsx` | `components/holiday-subsidy/guide-process-overview.tsx` |
| `features/holiday-subsidy/components/subsidy-declaration-form-dialog.tsx` | `components/holiday-subsidy/subsidy-declaration-form-dialog.tsx` |
| `features/holiday-subsidy/components/weekly-approvals-table.tsx` | `components/holiday-subsidy/weekly-approvals-table.tsx` |
| `features/holiday-subsidy/components/weekly-commitment-table.tsx` | `components/holiday-subsidy/weekly-commitment-table.tsx` |
| `features/holiday-subsidy/components/weekly-page-header.tsx` | `components/holiday-subsidy/weekly-page-header.tsx` |
| `features/holiday-subsidy/hooks/use-chair-subsidy-ccas.ts` | `hooks/use-chair-subsidy-ccas.ts` |
| `features/holiday-subsidy/hooks/use-subsidy-approval-details.ts` | `hooks/use-subsidy-approval-details.ts` |
| `features/holiday-subsidy/hooks/use-subsidy-approvals-index.ts` | `hooks/use-subsidy-approvals-index.ts` |
| `features/holiday-subsidy/hooks/use-subsidy-declarations.ts` | `hooks/use-subsidy-declarations.ts` |
| `features/holiday-subsidy/hooks/use-week-selection.ts` | `hooks/use-week-selection.ts` |
| `features/holiday-subsidy/hooks/use-weekly-approvals.ts` | `hooks/use-weekly-approvals.ts` |
| `features/holiday-subsidy/hooks/use-weekly-commitment.ts` | `hooks/use-weekly-commitment.ts` |
| `features/holiday-subsidy/services/approval-service.ts` | `lib/holiday-subsidy/approval-service.ts` |
| `features/holiday-subsidy/services/declaration-service.ts` | `lib/holiday-subsidy/declaration-service.ts` |
| `features/holiday-subsidy/services/weekly-service.ts` | `lib/holiday-subsidy/weekly-service.ts` |
| `features/holiday-subsidy/types/api.ts` | `types/holiday-subsidy-api.ts` |
| `features/holiday-subsidy/types/declarations.ts` | `types/declarations.ts` |
| `features/holiday-subsidy/types/weekly.ts` | `types/weekly.ts` |
| `features/holiday-subsidy/utils/declaration-mappers.ts` | `lib/holiday-subsidy/declaration-mappers.ts` |
| `features/holiday-subsidy/utils/holiday-subsidy-guide-content.ts` | `lib/holiday-subsidy/holiday-subsidy-guide-content.ts` |
| `features/holiday-subsidy/utils/holiday-weeks.ts` | `lib/holiday-subsidy/holiday-weeks.ts` |
| `features/holiday-subsidy/utils/weekly-change-set.ts` | `lib/holiday-subsidy/weekly-change-set.ts` |

### lib/ cleanup (existing files that stay or move)

| Old Path | New Path | Reason |
|----------|----------|--------|
| `lib/hooks/use-mobile.ts` | `hooks/use-mobile.ts` | hooks belong in hooks/ |
| `lib/api/auth.ts` | `lib/api/auth.ts` | stays — but fix import from features → lib/cca |
| `lib/managed-cca-data.ts` | `lib/managed-cca-data.ts` | stays — but fix import from features → lib/cca |
| `lib/auth/*` | `lib/auth/*` | stays |
| `lib/supabase/*` | `lib/supabase/*` | stays |
| `lib/api/*` | `lib/api/*` | stays |
| `lib/feature-flags.ts` | `lib/feature-flags.ts` | stays |
| `lib/utils.ts` | `lib/utils.ts` | stays |

### Test files

All `.test.ts` and `.test.tsx` files move alongside their source file (colocated tests).

## Import Rewrite Rules

All `@/features/{domain}/components/` → `@/components/{domain}/`
All `@/features/{domain}/hooks/` → `@/hooks/`
All `@/features/{domain}/services/` → `@/lib/{domain}/`
All `@/features/{domain}/types/` → `@/types/`
All `@/features/{domain}/utils/` → `@/lib/{domain}/`
`@/lib/hooks/use-mobile` → `@/hooks/use-mobile`
`@/features/holiday-subsidy/types/api` → `@/types/holiday-subsidy-api`

## Post-Move Cleanup

1. Delete empty `src/features/` directory tree
2. Delete empty `src/lib/hooks/` directory
3. Verify `npm run build` passes
4. Verify `npm run lint` passes
5. Update CLAUDE.md conventions to remove all references to `features/`

## Non-Goals

- No changes to `app/` route structure
- No changes to component internals or business logic
- No renaming of functions or variables
- No performance refactoring (that's a separate task using the Vercel skill)
