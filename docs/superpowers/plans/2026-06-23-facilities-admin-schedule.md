# Facilities Admin + Weekly Schedule Editor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Consolidate facilities to 2 pages (Bookings + JCRC Admin) and add in-app facility creation + a day-specific, wave-coloured weekly schedule editor.

**Architecture:** Thin API routes → `src/lib/facilities/*` domain libs → Supabase (RLS-gated). REBOKS `booking_schedules` drive the external Go bot; non-REBOKS bookings are materialised JCRC-side from schedules. UI is client components fetching `/api/facilities/*`.

**Tech Stack:** Next.js 15 App Router, TypeScript, Supabase (`@supabase/ssr`), Tailwind v4, shadcn/ui, Vitest + Testing Library.

## Global Constraints

- Response envelope `{ data, error }` via `apiOk`/`apiError`/`handleApiError`.
- Auth guards: `requireAuth()`, `requireJcrcAccess()` from `@/lib/api/auth`.
- Feature flag gate: every facilities route calls `getCoreServiceDisabledApiResponse("facilities")` first.
- Filenames `kebab-case`; components `PascalCase`; types `PascalCase`; `@/*` → `./src/*`.
- REBOKS facilities are NOT app-creatable (fixed identity) — enforced app-layer.
- Day-specific schedules: write real `day_of_week`, never an all-7 fan-out.
- Tests colocate (`src/**/*.test.ts(x)`); integration in `tests/integration/routes/`.

---

### Task 1: Schedule type + catalog write lib

**Files:**
- Modify: `src/types/facilities.ts` (BookingSchedule gains `priority`, `reboks_activity`)
- Modify: `src/lib/facilities/facility-catalog.ts` (add `createFacility`, `updateFacility`)
- Test: `src/lib/facilities/facility-catalog.test.ts`

**Interfaces produced:**
- `createFacility(input: { type: FacilityType; venue: string; sub_venue: string }): Promise<Facility>` — throws `ApiError(400)` if `type === "reboks"`, `ApiError(409)` on unique `(venue, sub_venue)` clash.
- `updateFacility(id: number, patch: { active?: boolean; venue?: string; sub_venue?: string }): Promise<Facility>`
- `BookingSchedule` now `{ …, priority: number, reboks_activity: string | null }`

- [ ] Step 1: Add `priority`/`reboks_activity` to `BookingSchedule`.
- [ ] Step 2: Write failing test `createFacility rejects reboks` (expects throw before any DB call).
- [ ] Step 3: Implement `createFacility` (guard reboks → ApiError(400); insert; map 23505 → 409) + `updateFacility`.
- [ ] Step 4: Run `npx vitest run src/lib/facilities/facility-catalog.test.ts` → PASS.
- [ ] Step 5: Commit.

### Task 2: Catalog route POST/PATCH

**Files:**
- Modify: `src/app/api/facilities/catalog/route.ts`
- Test: `src/app/api/facilities/catalog/route.test.ts`

**Interfaces:** consumes Task 1 libs. `POST {type,venue,sub_venue}` (jcrc) → 201; `PATCH {id,…}` (jcrc) → 200. Both flag-gated + `requireJcrcAccess()`.

- [ ] Step 1: Failing test: POST as non-jcrc → 403; POST reboks → 400; POST valid → 201 (mock libs).
- [ ] Step 2: Implement POST + PATCH delegating to Task 1 libs, `handleApiError` in catch.
- [ ] Step 3: Run route test → PASS.
- [ ] Step 4: Commit.

### Task 3: Schedules lib + route — priority/activity/day-specific

**Files:**
- Modify: `src/lib/facilities/booking-schedules.ts` (createSchedule gains priority+activity; add `updateSchedule`)
- Modify: `src/app/api/facilities/schedules/route.ts` (POST accepts priority+activity; add PATCH)
- Test: `src/lib/facilities/booking-schedules.test.ts`, `src/app/api/facilities/schedules/route.test.ts`

**Interfaces produced:**
- `createSchedule(input: { facilityId; dayOfWeek; hour; priority?; reboksActivity?: string|null }): Promise<BookingSchedule>` (priority default 100)
- `updateSchedule(id: number, patch: { priority?; reboks_activity?: string|null }): Promise<BookingSchedule>`

- [ ] Step 1: Failing test: createSchedule passes priority+reboks_activity through; defaults priority 100.
- [ ] Step 2: Implement lib changes.
- [ ] Step 3: Failing route test: POST validates priority≥0; PATCH by id; non-jcrc 403.
- [ ] Step 4: Implement route POST extension + PATCH.
- [ ] Step 5: Run both tests → PASS. Commit.

### Task 4: Schedule editor pure helpers

**Files:**
- Create: `src/lib/facilities/schedule-grid.ts` (no React)
- Test: `src/lib/facilities/schedule-grid.test.ts`

**Interfaces produced:**
- `waveColor(priority: number): string` — palette ramp (W1 #ef4444 … W4 #22c55e, then deterministic by index).
- `buildWeek(schedules: ScheduleSlot[]): DayColumn[]` where a `ScheduleSlot = { facility_id, venue, sub_venue, type, day_of_week, hour, priority, reboks_activity }`, grouping into time-clusters with merged adjacent hours and per-wave counts.
- `DayColumn = { day: number; clusters: Cluster[] }`; `Cluster = { startHour; endHour; waves: { priority; count; slots: ScheduleSlot[] }[] }`.

- [ ] Step 1: Failing tests: merges hours 19,20 of same slot into one 19–21 cluster; groups 8 concurrent into ≤4 wave buckets with counts; waveColor maps 1→#ef4444.
- [ ] Step 2: Implement helpers.
- [ ] Step 3: Run `npx vitest run src/lib/facilities/schedule-grid.test.ts` → PASS. Commit.

### Task 5: Schedule editor components

**Files:**
- Create: `src/components/facilities/facility-type-badges.tsx`
- Create: `src/components/facilities/schedule-week.tsx`
- Create: `src/components/facilities/schedule-cluster-panel.tsx`
- Create: `src/components/facilities/schedule-slot-dialog.tsx`
- Test: `src/components/facilities/schedule-week.test.tsx`

**Interfaces:** consume Task 4 helpers + `/api/facilities/schedules` + `/api/facilities/catalog`. `<ScheduleWeek type facilities schedules onChange />` renders the agenda week; clicking a cluster opens `<ScheduleClusterPanel>`; add/edit via `<ScheduleSlotDialog>` (REBOKS shows priority+activity fields, others hidden).

- [ ] Step 1: Failing component test: renders 7 day columns; a dense cluster shows wave chips with counts; collapses empty bands.
- [ ] Step 2: Implement `facility-type-badges`, `schedule-week`, `schedule-cluster-panel`, `schedule-slot-dialog`.
- [ ] Step 3: Run component test → PASS. Commit.

### Task 6: Facility add dialog + Admin page (3 tabs)

**Files:**
- Create: `src/components/facilities/facility-add-dialog.tsx`
- Create: `src/app/dashboard/facilities/admin/page.tsx`
- Reuse: `ManageConflicts`, `ConflictCard`, venues-grouped view (lift from old `venues/page.tsx`).

- [ ] Step 1: Build admin page: `requireJcrc` client guard (mirror old `manage/page.tsx`), `Tabs` = Facilities | Schedules | Conflicts; type badges in Facilities + Schedules.
- [ ] Step 2: Facilities tab = grouped list + Add dialog (reboks disabled in select). Schedules tab = `<ScheduleWeek>`. Conflicts tab = `<ManageConflicts>`.
- [ ] Step 3: Manual smoke via persona `sage` (JCRC). Commit.

### Task 7: Non-REBOKS materialisation (JCRC-side)

**Files:**
- Modify: `src/lib/facilities/facility-bookings.ts` (add `ensureBookingsForWindow`)
- Modify: `src/app/api/facilities/schedules/route.ts` (call after non-reboks create) + admin Schedules tab load
- Test: `src/lib/facilities/facility-bookings.test.ts`

**Interfaces produced:**
- `ensureBookingsForWindow(start: string, end: string): Promise<{ created: number }>` — for non-REBOKS schedules only, upsert `facility_bookings` for matching weekdays in window (reuse `expandWeekly`), idempotent. REBOKS skipped.

- [ ] Step 1: Failing test: only non-reboks schedules materialise; idempotent on re-run; window-bounded.
- [ ] Step 2: Implement using `expandWeekly`, join facilities to filter type≠reboks.
- [ ] Step 3: Wire JCRC triggers. Run test → PASS. Commit.

### Task 8: Bookings page consolidation

**Files:**
- Modify: `src/app/dashboard/facilities/page.tsx` (add "My upcoming + conflicts" section, fold `/my-bookings`)
- Remove: `src/app/dashboard/facilities/my-bookings/`, `manage/`, `venues/` (after confirming no imports)
- Modify: sidebar nav + any links to removed routes.

- [ ] Step 1: Add upcoming/conflicts section (lift `/my-bookings` logic) into bookings page.
- [ ] Step 2: Grep for links to removed routes; update to `/dashboard/facilities` + `/dashboard/facilities/admin`.
- [ ] Step 3: Delete old pages + now-unused components (`manage-bookings`, `booking-form-dialog`, `recurrence-dialog`) after grep confirms no consumers.
- [ ] Step 4: `make typecheck` clean. Commit.

### Task 9: Migration (../intranet) — facilities write policy

**Files:**
- Create: `../intranet/db/changelogs/table/facilities/06.facilities-jcrc-write.sql`

- [ ] Step 1: Add changeset: `jcrc_write` policy `FOR ALL TO authenticated USING/ WITH CHECK internal.is_jcrc(internal.auth_user_id())` + `GRANT INSERT,UPDATE,DELETE ON facilities TO authenticated` + sequence grant, mirroring `02.booking-schedules.sql` changesets 6–7. Include `--rollback`.
- [ ] Step 2: Commit in that repo (separate; note in PR).

### Task 10 (cross-repo, separate plan): `reboks-booking` day_of_week

Tracked in `reboks-booking` repo: `seed.expand()` stop all-7 fan-out (config gains `days`); `groupSchedules` key on `day_of_week`. NOT implemented here.

## Self-Review notes

- Spec §6/§7/§5/§4 ↦ Tasks 1–2 / 3+7 / 4+5 / 6+8. §10 ↦ Task 10 (out). Migration §6.1 ↦ Task 9.
- Materialisation RLS constraint honoured: Task 7 triggers are JCRC-only.
- Type names consistent: `createFacility`, `updateFacility`, `createSchedule`, `updateSchedule`, `ensureBookingsForWindow`, `buildWeek`, `waveColor`.
