---
phase: 06-ui-consistency-hardening
plan: 03
subsystem: ui
tags: [shared-layout, shadcn, semantic-tokens, button-as-child, consistency]
requires:
  - phase: 06-01
    provides: DashboardError component
  - phase: 06-02
    provides: dashboard-skeletons module
provides:
  - Shared src/app/dashboard/layout.tsx wrapping AppLayout once
  - Consistent shadcn Card / Button / spacing / semantic-color usage across all 15 dashboard pages
affects: [dashboard-pages, layout-chrome, button-styling, card-styling]
tech-stack:
  added: []
  patterns:
    - Shared route-segment layout supplying chrome once
    - <Button asChild><Link>...</Link></Button> instead of <Link><Button>...</Button></Link>
    - Semantic Tailwind tokens (bg-card, text-muted-foreground, border-destructive/40 bg-destructive/5)
key-files:
  created:
    - src/app/dashboard/layout.tsx
  modified:
    - src/components/layout/dashboard-error.tsx (removed self-wrapping AppLayout)
    - src/components/feature-flags/service-disabled-state.tsx (removed AppLayout wrap; normalized heading)
    - src/features/allocation/components/rank-selection-step.tsx (removed AppLayout wrap)
    - src/features/allocation/components/rank-ordering-step.tsx (removed AppLayout wrap)
    - src/app/dashboard/page.tsx
    - src/app/dashboard/mycca/page.tsx
    - src/app/dashboard/mycca/admin/page.tsx
    - src/app/dashboard/mycca/admin/rankMembers/[ccaName]/page.tsx
    - src/app/dashboard/mycca/admin/manageMembers/[ccaName]/page.tsx
    - src/app/dashboard/ccaAllocation/page.tsx
    - src/app/dashboard/ccaAllocation/rank/page.tsx
    - src/app/dashboard/ccaAllocation/rankApplicants/page.tsx
    - src/app/dashboard/holidaySubsidy/page.tsx
    - src/app/dashboard/holidaySubsidy/guide/page.tsx
    - src/app/dashboard/holidaySubsidy/approvals/page.tsx
    - src/app/dashboard/holidaySubsidy/approvals/[ccaName]/page.tsx
    - src/app/dashboard/holidaySubsidy/approvals/weekly/[ccaName]/page.tsx
    - src/app/dashboard/holidaySubsidy/weekly/[ccaName]/page.tsx
    - src/app/dashboard/holidaySubsidy/declaration/[ccaName]/page.tsx
key-decisions:
  - Introduced shared dashboard/layout.tsx so AppLayout is invoked exactly once.
  - Removed AppLayout wraps from DashboardError, ServiceDisabledState, allocation step components, and all 15 dashboard pages.
  - Dropped breadcrumbOverride prop usage in approvals/weekly/[ccaName] — auto-generated breadcrumbs are now canonical.
  - Replaced AppLoading inside pages with bare LoadingSpinner to avoid double-wrapping SidebarProvider.
patterns-established:
  - All ad-hoc panels migrated to shadcn Card + CardHeader + CardTitle + CardContent.
  - Empty states use border-dashed bg-muted/40 Card.
  - Inline error cards use border-destructive/40 bg-destructive/5 instead of raw red classes.
  - Page titles use text-2xl font-semibold.
  - Outer page containers use space-y-6 p-4 md:p-6.
requirements-completed: [UI-01]
duration: ~1 session
completed: 2026-05-15
---

# Phase 06 Plan 03: Shared Layout + UI Consistency Pass Summary

## Accomplishments

### Part A — Shared dashboard layout
- Created `src/app/dashboard/layout.tsx` wrapping children in `<AppLayout>` once.
- Removed `<AppLayout>` from DashboardError, ServiceDisabledState, both allocation step components, and all 15 page.tsx files.
- Loading skeletons now automatically render inside sidebar chrome via the shared layout.

### Part B — Per-page consistency (15 pages)
- Headings normalized to `text-2xl font-semibold`.
- Outer containers standardized to `space-y-6 p-4 md:p-6`.
- Ad-hoc bordered panels replaced with shadcn Card.
- `<Link><Button>...</Button></Link>` → `<Button asChild><Link>...</Link></Button>`.
- Raw `text-gray-*` / `bg-gray-*` / `bg-white` / `border-gray-*` / zinc / slate replaced with semantic tokens.
- Custom green/blue oversized button styles dropped; default Button variant + sensible size.
- `<AppLoading />` inside pages swapped for bare `<LoadingSpinner>` (avoids double SidebarProvider).
- Custom red Alert classes dropped; default `variant="destructive"` styling kept.

## Verification
- `npx tsc --noEmit`: zero new errors
- `npx eslint`: clean on all touched files
- `grep "AppLayout" src/app/dashboard` → only `src/app/dashboard/layout.tsx` matches
- `grep` for `text-gray-*` / `bg-gray-*` / `*-zinc-*` / `*-slate-*` under `src/app/dashboard` → zero matches

## Deviations
- **`breadcrumbOverride` removed** from `holidaySubsidy/approvals/weekly/[ccaName]/page.tsx`. With AppLayout no longer invoked per-page, there is no per-page override hook. Auto-generated breadcrumbs from the path produce a sensible trail. Future enhancement could thread breadcrumb context through React context if explicit overrides are needed again.
