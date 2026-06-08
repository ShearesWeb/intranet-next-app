# Chair Preferences — Master-Detail Redesign

**Date:** 2026-06-07
**Status:** Approved (design)
**Area:** CCA allocation → chair preferences (chairs ranking applicants for allocation)

## Problem

The chair-preferences page (`/dashboard/cca-allocation/rank-applicants`) renders **every** CCA, **every** position, and **every** applicant on one page as nested collapsibles, all expanded on load. This breaks down on two axes:

1. **Many CCAs / positions** — a long scroll through a nested-collapsible maze with no way to focus on one CCA. Upper-JCRC chairs can see many CCAs at once.
2. **Many applicants in one position** — drag-reordering across 20+ rows is slow and error-prone, and there is no search to locate a person.

A single global "Save all" spans everything, so the dirty state and save scope are unclear.

## Goals

- Give chairs an overview that scales: see all their CCAs at a glance, drill into one at a time.
- Make ranking a long applicant list manageable (search + non-drag reorder controls).
- Reuse existing table / drill-in conventions already used by holiday-subsidy and my-cca admin.
- No backend/API changes.

## Non-goals

- Changing the ranking algorithm, the save endpoints, or the data model.
- Reworking `AddApplicantDialog` behaviour.
- Mobile-specific redesign beyond what the shared `DataTable` already provides.

## Approach: master-detail across two routes

Mirror the established pattern (`my-cca/admin` → `manage-members/[ccaName]?ccaId=`, holiday-subsidy `weekly/[ccaName]?ccaId=`).

### Routes

| Route | Purpose |
|---|---|
| `/dashboard/cca-allocation/rank-applicants` | **Overview** — `DataTable` of the chair's CCAs |
| `/dashboard/cca-allocation/rank-applicants/[ccaName]?ccaId=N` | **Detail** — ranking workspace for one CCA |

Param convention: route segment `[ccaName]` carries `encodeURIComponent(cca_name)` for a readable URL; the `?ccaId=N` query param is the reliable key used for data lookup. Detail page decodes `params.ccaName` for display and reads `searchParams.get("ccaId")` for filtering.

### Overview page

Replaces the current nested-collapsible body with a single `DataTable<CcaRow>` (searchable by CCA name, `pageSize` ~10).

Columns:

| Column | Source | Render |
|---|---|---|
| CCA | `cca_name`, plus CCA type | name + `CcaTypeBadge` |
| Positions | `group.positions.length` | count |
| To rank | sum of `applicants.length` across positions | count |
| Status | derived (see below) | status pill |
| (action) | — | `<Button asChild><Link href={`…/[ccaName]?ccaId=${cca_id}`}>Rank ›</Link></Button>` |

Status derivation per CCA:
- **No applicants** — every rankable position has `applicants.length === 0`.
- **Needs ranking** — at least one applicant exists whose `ranking` is `null` (not yet saved).
- **Ranked** — applicants exist and all have a non-null `ranking`.

`PageHeader` keeps the "Chair preferences" title and the existing summary line (`N CCAs · N positions · N applicants`). The global "Save all" button is removed from the overview — saving now happens on the detail page.

Data: reuse `GET /api/chair/positions/for-chair`, which already returns `{ positions, ccas }` grouped by CCA. The overview only reads counts + `ranking` presence; no new endpoint.

`EmptyState` ("No CCA positions to manage") is preserved for chairs with no positions.

### Detail page (`[ccaName]/page.tsx`)

- `PageHeader` with `title={ccaName}`, `backHref="/dashboard/cca-allocation/rank-applicants"`, `backLabel="Back to chair preferences"`, and the per-CCA **Save** button in `actions`.
- Loads the chair's data and filters `ccaGroups` to the one matching `ccaId`. If no match (bad/stale URL), show `ErrorCard` / `EmptyState` with a link back.
- Renders that CCA's rankable positions as `PositionCard` in **full mode** (the existing non-compact layout: position header, capacity, `AddApplicantDialog`, `OrderingTable`). No nested collapsibles — positions stack directly since there are only a few per CCA.
- **Save scope is naturally isolated:** the page only mounts this CCA's positions, so only they can become dirty. `handleSaveAll` already saves only dirty positions, so it saves exactly this CCA. Keep the existing unsaved-changes amber banner.
- **Unsaved-leave guard:** warn before navigating away (back link / route change / `beforeunload`) when `hasAnyChanges` is true.

### Applicant-level improvements (axis 2)

Applied inside the per-position ranking UI so they benefit both the detail page and any reuse:

1. **Search / filter** — a text input above the `OrderingTable` that filters displayed applicants by name/email/room. Filtering is view-only; it must not reorder or drop applicants from the underlying list, and reorder controls operate on the true list. Simplest correct behaviour: when a filter is active, show matching rows read-only (drag disabled) so a filtered drag can't corrupt order; clearing the filter restores full drag/reorder.
2. **Move-to-top / move-to-bottom** — per-row buttons for fast reordering over long lists without dragging. Keep drag-and-drop as-is. These call the same `onReorder` path as drag.

Decision: keep search and move-buttons as **opt-in props** on `OrderingTable` (e.g. `searchable`, `showMoveControls`) so existing call sites (member-evaluation ranking, etc.) are unaffected.

## Components & refactor

Reuse: `DataTable`, `CcaTypeBadge`, `PageHeader`, `EmptyState`, `ErrorCard`, `PositionCard` (full mode), `OrderingTable`, `AddApplicantDialog`, `useApplicantRankings`.

Changes:

- `useApplicantRankings(userEmail, opts?: { ccaId?: number })` — optional filter. When `ccaId` is set, `ccaGroups`/`positions` are scoped to that CCA (filter after fetch; the endpoint returns everything). Without it, behaviour is unchanged so the overview (or any other caller) still works. All save/dirty handlers operate on the scoped set.
- Overview `page.tsx` — rewrite body from nested collapsibles to `DataTable`. Build `CcaRow[]` (cca_id, cca_name, cca_type, positionCount, applicantCount, status) from `ccaGroups`.
- New `[ccaName]/page.tsx` — detail workspace described above.
- `OrderingTable` — add optional `searchable` + `showMoveControls`; implement filter + move-top/bottom.
- Remove the now-unused `CcaSection` / `CollapsiblePosition` helpers from the old overview file.

New files: `src/app/dashboard/cca-allocation/rank-applicants/[ccaName]/page.tsx`.
Rewritten: `src/app/dashboard/cca-allocation/rank-applicants/page.tsx`.
Modified: `src/hooks/use-applicant-rankings.ts`, `src/components/table/ordering-table.tsx` (and `PositionCard` if it needs to forward the new `OrderingTable` props).

## Data shapes (unchanged)

From `@/types/applicants`: `Position`, `Applicant` (`ranking: number | null`), `CcaPositionGroup { cca_id, cca_name, positions[] }`. CCA type for the badge comes from the position/group payload (verify the field name during implementation; fall back to omitting the badge if not present rather than fetching extra data).

## Error handling

- Detail page with unknown `ccaId` → `EmptyState`/`ErrorCard` + back link, no crash.
- Save failures → existing `toast.error` per-position flow in `useApplicantRankings` is kept.
- Loading → existing `LoadingSpinner`.

## Testing

- Unit: status-derivation helper (`No applicants` / `Needs ranking` / `Ranked`) for representative groups.
- Unit: `useApplicantRankings` `ccaId` filter scopes positions/ccaGroups and dirty/save to one CCA.
- Component: `OrderingTable` search filters rows; move-to-top/bottom reorders and fires `onReorder`; filtered state disables drag.
- Component: overview renders a row per CCA with correct counts/status and a working `Rank` link `href`.
- Manual (persona login, `declan` = sports chair / `sage` = all flags): overview lists CCAs, click drills in, rank + save scoped to that CCA, back nav warns on unsaved.

## Open questions

- Exact field carrying CCA type in the `for-chair` payload — confirm during implementation; omit the badge gracefully if absent.
