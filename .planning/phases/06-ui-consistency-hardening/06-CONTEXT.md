# Phase 06: UI Consistency & Hardening

## Goal

All dashboard pages share consistent visual patterns (cards, buttons, spacing, semantic colors) and gracefully handle errors and loading states. No more blank screens, no more inconsistent ad-hoc panels, no more raw gray utility classes.

## Depends On

Phase 05 (all dashboard pages decomposed into thin shells backed by feature-local hooks/components).

## Requirements

- **UI-01** — Consistent spacing, colors, and component usage across all `/dashboard` pages.
- **UI-02** — Every `/dashboard` route segment has an `error.tsx` boundary.
- **UI-03** — Every page that fetches data shows a skeleton or loading indicator during fetch.

## Success Criteria

1. Spacing, colors, and component usage patterns are consistent across all pages — no page uses a visually different card, button, or layout style.
2. Every route segment under `/dashboard` has an `error.tsx` boundary so a broken component shows a recovery UI instead of crashing the page.
3. Every page that fetches data shows a skeleton or loading indicator during fetch — no blank screens while data loads.

## Plans

- **06-01** — Error boundaries: shared `DashboardError` component + `error.tsx` at every `/dashboard` segment.
- **06-02** — Loading skeletons: shared `dashboard-skeletons.tsx` (Page/Cards/Table/Form variants) + `loading.tsx` at every segment.
- **06-03** — Shared dashboard layout + UI consistency pass (cards, buttons, spacing, semantic colors).

## Key Decisions

- **Shared `src/app/dashboard/layout.tsx` introduced.** Previously each page wrapped itself in `<AppLayout>` individually. The new layout wraps once at the segment root so loading.tsx and error.tsx automatically render inside sidebar chrome.
- **`<AppLayout>` import is now restricted to `dashboard/layout.tsx`.** All 15 dashboard pages removed their own wrappers. `DashboardError`, `ServiceDisabledState`, and the two allocation step components also dropped their `<AppLayout>` wrappers — they render bare card content since the parent layout supplies chrome.
- **Semantic Tailwind tokens only.** All `text-gray-*` / `bg-gray-*` / `bg-white` / `border-gray-*` swapped for `text-foreground` / `text-muted-foreground` / `bg-card` / `border-border` and shadcn `bg-muted/40` empty-state pattern.
- **`<Button asChild>` pattern.** All `<Link><Button>...</Button></Link>` nesting replaced with `<Button asChild><Link>...</Link></Button>`.
- **`breadcrumbOverride` prop on AppLayout removed from one consumer.** `holidaySubsidy/approvals/weekly/[ccaName]/page.tsx` previously passed a custom breadcrumb override into its own `<AppLayout>`. With the shared layout there is no per-page override hook; the auto-generated path-based breadcrumbs are now the canonical source. Acceptable for parity since the auto-built trail is sensible.

## Affected Surfaces

- All `/dashboard` pages (15 page.tsx files)
- New: `src/app/dashboard/layout.tsx`, `src/components/layout/dashboard-error.tsx`, `src/components/layout/dashboard-skeletons.tsx`
- New: 18 `error.tsx` files, 15 `loading.tsx` files (one per route segment)
- Modified: `dashboard-error.tsx`, `service-disabled-state.tsx`, `rank-selection-step.tsx`, `rank-ordering-step.tsx` (dropped self-wrapping `<AppLayout>`)
