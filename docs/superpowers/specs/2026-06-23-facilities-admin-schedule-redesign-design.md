# Facilities — Admin + Bookings redesign & weekly schedule editor

**Date:** 2026-06-23
**Status:** Approved design — ready for implementation plan
**Repos touched:** `intranet-next-app` (this spec) + a required companion change in `reboks-booking` (Go, flagged in §10)

## 1. Problem & goal

The facilities module sprawls across four pages (`/`, `/my-bookings`, `/manage`, `/venues`) and the JCRC tooling doesn't match how Sheares Hall sports actually run REBOKS booking. JCRC think in **waves** (priority groups that fire together against the external REBOKS system); there's no UI to define that recipe, and no way to add facilities in-app.

Collapse the module to **two pages** matching the JCRC mental model:

- **Bookings** (all residents / CCA chairs): see available slots, claim them, see own upcoming bookings + conflicts.
- **Admin** (JCRC only): view + add facilities, define booking schedules (the weekly wave recipe), resolve conflicts.

The centrepiece is a **weekly schedule editor** that visualises the whole week, colour-coded by wave, and stays readable when many slots fire at once.

## 2. Domain model (existing — for reference)

From `../intranet` (Liquibase) and `src/types/facilities.ts`:

- **`facilities`** — catalog: `(id, venue, sub_venue, type, active)`. `type ∈ {sheares, reboks, nus, external}`. RLS: SELECT for all authenticated; **no write policy today**.
- **`booking_schedules`** — recurring recipe the REBOKS bot reads: `(id, facility_id, day_of_week 0–6, hour 0–23, priority, reboks_activity)`. Unique `(facility_id, day_of_week, hour)`. RLS: SELECT all; JCRC write. `priority` = wave (lower fires first); `reboks_activity` = activity name for REBOKS ID resolution.
- **`facility_bookings`** — one secured hour: `(facility_id, booked_date, hour, status)`. `status` is **trigger-derived** from claims (`available → pending → conflicted → confirmed`; `confirmed` is terminal/sticky). RLS: SELECT all; JCRC write.
- **`facility_claims`** — a CCA's bid on a booking: `(booking_id, cca_id, status, claimed_by, resolved_*)`. Status rollup trigger recomputes the parent booking's status.

**Wave concept** (`reboks-booking/config/bookings.yaml`): config is `waves: [{name, bookings:[{activity, venue, sub_venue, hours[], remark}]}]`. Wave index → `priority`. The bot reads schedules priority-ascending, groups by `(facility, activity)`, and books each wave's slots concurrently, waves in sequence. Today the bot is **day-agnostic** — `seed` expands every booking across all 7 days and `groupSchedules` ignores `day_of_week`.

## 3. Key decisions (from brainstorming)

| # | Decision |
|---|---|
| D1 | Consolidate 4 pages → **2** (Bookings + Admin). |
| D2 | The bot materialises REBOKS `facility_bookings`; the app only CRUDs the **recipe** (`booking_schedules`). |
| D3 | Schedule editor = **weekly view**, day-specific, colour = wave, merged adjacent hours, collapsed dead time, wave-grouped cells for density, drill-down panel to edit/add. Wave labels are plain numbers. |
| D4 | **Day-specific** schedules (not all-7). Requires the companion bot change in §10. |
| D5 | In-app **add facilities** for all types **except REBOKS** (fixed identity). Needs a new write migration. |
| D6 | One unified schedule editor with **facility-type badges** at the top. REBOKS shows waves (priority + activity); other types are open/closed only. |
| D7 | Non-REBOKS bookable slots are **lazily materialised** from their schedules when the Bookings page queries a date window (no cron). |

## 4. Pages & navigation

```
src/app/dashboard/facilities/
  page.tsx            → Bookings (residents / chairs)
  admin/page.tsx      → Admin (JCRC): Facilities · Schedules · Conflicts
```

Remove: `manage/`, `venues/`, `my-bookings/` pages (content folded in). Keep `guide/`, `error.tsx`, `loading.tsx`. Update sidebar nav + breadcrumbs (`AppLayout`). Admin link is gated on `user.is_jcrc`; the admin page also guards server-side via `requireJcrcAccess()` on its routes.

### 4.1 Bookings page (`/dashboard/facilities`)

- **Browse + claim** — keep the existing month-grid + `DayDetailPanel` + `ClaimDialog` + venue/type filters. Chairs (lead/vice appointments) can claim a slot for their CCA; withdraw their own claim.
- **My upcoming + conflicts** — fold in `/my-bookings`: the user's CCA claims with booking date/time/status, grouped/sorted by date. Conflicted slots are surfaced **read-only** (resolution is JCRC-only). A claim on a `conflicted` booking shows a "being resolved by JCRC" affordance.
- Residents only **read** `facility_bookings` and **claim** existing rows; they never create booking rows (see §7.3 for why materialisation is JCRC-side).

### 4.2 Admin page (`/dashboard/facilities/admin`) — JCRC only

Three tabs (`Tabs` primitive). Type badges (Sheares / REBOKS / NUS / External) are the context switcher inside Facilities and Schedules.

**Tab 1 — Facilities**
- View all facilities grouped by type (current `venues` page UI).
- **Add facility** dialog: `type` (select; REBOKS disabled), `venue`, `sub_venue`. Active toggle on existing rows. Server rejects `type=reboks` on create.

**Tab 2 — Schedules** (the weekly editor, §5)

**Tab 3 — Conflicts**
- Existing `ManageConflicts` + `ConflictCard` flow, unchanged.

## 5. Weekly schedule editor (centrepiece)

**Layout** — agenda-per-day week (7 day columns). Each column lists its **time-clusters** in time order. A cluster = the set of schedule slots sharing one (day, time-span).

- **Colour = wave**, label = wave number (1 hottest/first → N). Fixed palette: W1 `#ef4444`, W2 `#f97316`, W3 `#eab308`, W4 `#22c55e`; waves beyond 4 extend the ramp deterministically by index.
- **Merged hours** — consecutive hours of the same slot render as one block; cluster header shows the range (e.g. "7–9pm").
- **Collapsed gaps** — only time-bands with slots render; large empty spans collapse to a thin divider.
- **Density / 8+ simultaneous** — a cluster groups its slots **by wave** into ≤N coloured chips, each showing a **count** (e.g. `W3 · 17`), plus a total. Nothing squishes regardless of concurrency.
- **Drill-down** — clicking a cluster opens a panel listing every slot in it, grouped by wave: venue/sub_venue + activity, with edit and "+ add slot at this time". This is where REBOKS priority/activity are edited.

**Type badges** switch the editor's facility-type context:
- **REBOKS** — full model: each slot has `priority` (wave) + `reboks_activity`. Adding/editing a slot sets day, hour(s), facility, priority, activity.
- **Sheares / NUS / External** — open/closed only: a slot is `(facility, day, hour)`; `priority` defaults `100`, `reboks_activity` null.

**Editing model** — per-cell mutations map to `booking_schedules` rows. Each (facility, day, hour) is one row. Multi-hour edits and multi-court activities fan out to multiple rows in one request. Saves are immediate (optimistic UI; matches the per-row POST/DELETE/PATCH API). Day-specific: writes use the real `day_of_week`, never an all-7 expansion.

## 6. Facilities add — schema + API

### 6.1 Migration (`../intranet`)

New Liquibase changeset on `facilities`:
- `jcrc_write` policy `FOR ALL TO authenticated USING (internal.is_jcrc(internal.auth_user_id())) WITH CHECK (...)`, mirroring `booking_schedules`.
- `GRANT INSERT, UPDATE, DELETE ON facilities TO authenticated` + sequence usage (RLS still gates).
- REBOKS exclusion is enforced at the **app layer** (create rejects `type=reboks`), not the DB, so the bot's own REBOKS seeding still works.

### 6.2 Lib + routes (`intranet-next-app`)

- `src/lib/facilities/facility-catalog.ts`: add `createFacility({type, venue, sub_venue})` (throws on `reboks`), `updateFacility(id, {active?, venue?, sub_venue?})`.
- `src/app/api/facilities/catalog/route.ts`: add `POST` (create) + `PATCH` (update), both `requireJcrcAccess()`. Validate type, reject `reboks` on create, map unique-violation `(venue, sub_venue)` → 409.

## 7. Data / API changes (`intranet-next-app`)

### 7.1 Types (`src/types/facilities.ts`)

- `BookingSchedule`: add `priority: number` and `reboks_activity: string | null`.

### 7.2 Schedules route (`/api/facilities/schedules`)

- `POST`/`PATCH` accept `priority` + `reboks_activity`; validate `priority >= 0`, activity required when facility type is `reboks`.
- Add `PATCH` (move wave / edit activity) keyed by id. Keep day-specific `(facility_id, day_of_week, hour)`.
- `booking-schedules.ts`: extend `createSchedule`/add `updateSchedule` for the new columns.

### 7.3 Non-REBOKS materialisation (JCRC-side)

**Constraint:** `facility_bookings` is **INSERT-gated to JCRC** by RLS. So materialisation must run under a JCRC session — a resident's Bookings-page read cannot create rows. Residents only read bookings and claim existing rows (`facility_claims.insert_own` allows that).

- New lib helper `ensureBookingsForWindow(start, end)` (non-REBOKS only): for each non-REBOKS schedule, upsert `facility_bookings` rows for matching dates in `[start, end]`, idempotent on the unique `(facility_id, booked_date, hour)` key. REBOKS rows are never materialised this way (the bot owns them).
- **Triggered by JCRC actions**, never by resident reads:
  - on non-REBOKS schedule create/edit (materialise the forward booking window for that facility), and
  - on Admin → Schedules tab load (re-materialise the rolling forward window).
- Forward window = a fixed horizon constant (e.g. 8 weeks); bounded, never backfills unboundedly.
- **Trade-off:** the window only extends when a JCRC member is active. Acceptable for active management; a future Cloudflare cron (out of scope here) can keep it rolling without JCRC presence. If A1 (§12) resolves to "non-REBOKS are availability-display only / not claimable", this whole section is dropped.

## 8. Components (intranet-next-app)

New / changed under `src/components/facilities/`:
- `schedule-week.tsx` — the weekly editor grid (clusters, wave chips, collapsed gaps).
- `schedule-cluster-panel.tsx` — drill-down editor for a (day, time) cluster.
- `schedule-slot-dialog.tsx` — add/edit a slot (facility, day, hours, priority, activity).
- `facility-add-dialog.tsx` — add facility (type/venue/sub_venue; reboks disabled).
- `facility-type-badges.tsx` — the type switcher.
- Reuse: `ConflictCard`, `ManageConflicts`, `MonthGrid`, `DayDetailPanel`, `ClaimDialog`.
- Retire: `manage-bookings.tsx`, `booking-form-dialog.tsx`, `recurrence-dialog.tsx` (manual dated-booking add is dropped for REBOKS; non-reboks uses materialisation). Confirm no other consumers before deleting.

## 9. Testing

- **Unit** (`src/**/*.test.ts`): `createFacility` rejects `reboks`; schedule create/update validation (priority range, activity-required-for-reboks, day 0–6, hour 0–23); `ensureBookingsForWindow` idempotency + window bounds; wave→colour mapping; cluster grouping/merge-hours pure helpers.
- **Component** (`*.test.tsx`): `schedule-week` renders clusters, groups by wave with counts, collapses gaps; drill-down panel lists slots; type-badge switch toggles wave fields.
- **Integration** (`tests/integration/routes/`): catalog `POST/PATCH` and schedules `POST/PATCH/DELETE` against Postgres + PostgREST with persona JWTs — JCRC allowed, non-JCRC 403, RLS enforced. Use `asPersona("sage")` (JCRC) vs `asPersona("aria")`.

## 10. Cross-repo dependency ⚠️ (`reboks-booking`, Go)

Day-specific (D4) requires the bot to honour `day_of_week`, or it will over-book (it currently books all 7 days):
- `internal/seed/seed.go` `expand()`: stop the `for day := 0..6` fan-out; seed the real day(s) from config (config gains a `days` field per booking).
- `internal/booking/group.go` `groupSchedules`: key groups on `day_of_week` and only fire a slot for matching target dates in the window.

This is **out of scope for the intranet code** but a **required companion task** — the intranet writing day-specific REBOKS schedules is incorrect until the bot respects them. Tracked as a separate plan in the `reboks-booking` repo.

## 11. Out of scope

- The Go bot change itself (dependency, §10).
- Any new external (NUS/external) booking integrations — those facilities are intranet-managed slots only.
- Auth/login changes (handled separately).

## 12. Open assumptions to confirm during planning

- A1: Non-REBOKS facilities genuinely want claimable slots (vs. simple availability display). If not, §7.3 materialisation can be dropped and non-reboks become view-only.
- A2: Wave count is small (≤ ~6) in practice; palette ramp assumes this.
