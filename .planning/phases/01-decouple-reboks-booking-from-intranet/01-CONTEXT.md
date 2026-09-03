# Phase 1: Decouple REBOKS booking from intranet - Context

**Gathered:** 2026-09-04
**Status:** Ready for planning

<domain>
## Phase Boundary

The intranet facilities feature books only Sheares-managed venues (`sheares`, `nus`, `external`). REBOKS courts are neither visible nor claimable by chairs, JCRC views carry no REBOKS claims, and the REBOKS-only booking-horizon logic and copy are deleted. No change to the `vendor/intranet` schema, the `facility_type` enum, the `facility_single_schedules` table, or the REBOKS bot. Where REBOKS booking lives next is a separate milestone.

</domain>

<decisions>
## Implementation Decisions

### Where the cut happens
- **D-01:** Cut at the server-side data boundary, not in the UI. The DB will keep returning REBOKS rows (the `facility_slots()` RPC unions the bot's `facility_single_schedules`, and the `facilities` catalog still holds REBOKS venues), so the app excludes them at the point of read. Three reads can surface REBOKS data and all three exclude it: `getSlots` in `src/lib/facilities/facility-slots.ts`, `listFacilities` in `src/lib/facilities/facility-catalog.ts`, and `getClaimsForCca` in `src/lib/facilities/facility-claims.ts`. Every consumer above the lib layer (calendar, day panel, picker, approvals, confirmed bookings, admin page, schedule editor) inherits the exclusion. — **Reversibility:** reversible — three query clauses, nothing structural.
- **D-02:** Prefer pushing the exclusion into the query itself (`.neq("type", "reboks")` on the catalog query, and on the RPC call if PostgREST accepts filters on this set-returning function) over filtering in JavaScript. Researcher to confirm whether `supabase.rpc("facility_slots", …).neq("type", "reboks")` works against the local PostgREST sidecar; if not, filter the returned array in `getSlots`.
- **D-03:** One shared predicate, not scattered literals. A `BOOKABLE_FACILITY_TYPES` constant (`sheares`, `nus`, `external`) plus an `isBookableFacilityType()` guard in `src/types/facilities.ts`. This is an exclusion list, not a feature toggle: the excluded code path is deleted, not gated.

### What survives
- **D-04:** `"reboks"` stays in the `FacilityType` union. The Postgres enum still contains it and rows carrying it still arrive from the DB, so narrowing the TS type would misrepresent the data. Its entry in `FACILITY_TYPE_CONFIG` may be removed if nothing renders it after the cut; planner's call.
- **D-05:** The `FacilitySingleSchedule` interface may be deleted if no code references it after the cut. It documents a table the app never queries directly.

### What is deleted outright
- **D-06:** All four horizon helpers in `src/types/facilities.ts` (`bookingHorizonEnd`, `isBeyondBookingHorizon`, `isHorizonRestricted`, `horizonOpensOn`) and their unit tests. `MAX_SLOT_WINDOW_DAYS` and `daysUntilBooking` stay: they cap the RPC window and the booking lock, which are not REBOKS-specific. Only REBOKS was windowed, so no other venue loses behaviour.
- **D-07:** The horizon notice: `showHorizonNotice` prop chain from `src/app/dashboard/facilities/page.tsx` into `src/components/facilities/day-detail-panel.tsx`, and the JSX block that renders "REBOKS courts are secured a month at a time".
- **D-08:** The JCRC-only branch in `src/app/api/facilities/slots/route.ts` (`user.is_jcrc ? slots : slots.filter(...)`). After the cut every role receives the same slot set.
- **D-09:** No feature flag. `src/lib/feature-flags.ts` is per-service and the REBOKS destination is TBC; a toggle would keep dead code alive for a speculative return. Reinstating REBOKS later is a list entry plus whatever rule its new home needs, not a flag flip.

### API contract
- **D-10:** `POST /api/facilities/claims` replaces the horizon check with a bookable-type check. Keep the existing `getFacilityType(facility_id)` lookup so the type comes from the DB, not the request body. Return 4xx (400 or 403, planner's call) with an error that names the venue as not bookable on the intranet. This closes the hand-rolled-payload hole even though the UI can no longer offer REBOKS slots.
- **D-11:** `GET /api/facilities/catalog` and `GET /api/facilities/slots` drop `"reboks"` from their `VALID_TYPES` arrays. A `?type=reboks` request is treated as an unknown type (same as today's behaviour for any unrecognised value), not a special error.

### Existing REBOKS rows in `facility_claims`
- **D-12:** Hide them. `getClaimsForCca` excludes REBOKS claims, so "My CCA bookings" no longer lists them, and approvals derive from `getSlots` so they vanish there too. `DELETE /api/facilities/claims/[id]` is left untouched: it is guarded by RLS, so a chair who withdraws a historical REBOKS claim by id still can. Rationale: a chair seeing a booking they can no longer manage is more confusing than not seeing it. — **Reversibility:** reversible — remove one clause from `getClaimsForCca` if product wants them visible until the move-out date.

### UI cleanup (becomes dead after D-01)
- **D-13:** Remove the now-redundant `f.type !== "reboks"` filters in `src/app/dashboard/facilities/admin/page.tsx` and `src/components/facilities/schedule-slot-dialog.tsx`. Remove `"reboks"` from the badge list in `src/components/facilities/facility-type-badges.tsx` and the sort order in `src/lib/facilities/facility-picker.ts`. Rewrite the sentence in `src/app/dashboard/facilities/guide/page.tsx` that says Reboks slots come from the Reboks bot.
- **D-14:** Comments that mention the dropped `reboks_activity` column in `src/lib/facilities/facility-schedules.ts` and `src/app/api/facilities/schedules/route.ts` are historical notes about the schema rebuild, not REBOKS feature code. Leave or trim at the planner's discretion.

### Claude's Discretion
- Exact 4xx status and error wording for D-10.
- Whether D-04's config entry and D-05's interface are deleted or kept.
- Order of tasks and how many plans the phase splits into.
- Test restructuring, as long as REBOK-04's `make check` criterion holds.

</decisions>

<specifics>
## Specific Ideas

- "Cut it at the data boundary" — the user's framing. The test of a correct cut: after it, no file under `src/components` or `src/app/dashboard` needs to know REBOKS exists.
- Net code should shrink. The only surviving REBOKS-aware code is the exclusion itself, roughly five lines plus the shared predicate. If the diff adds more than it removes, the cut is in the wrong place.
- Not a feature flag. Both the user and the analysis rejected a toggle explicitly.

</specifics>

<canonical_refs>
## Canonical References

### Planning
- `.planning/PROJECT.md` — Milestone scope, key decisions, constraints (no schema changes, no deploy from workstation).
- `.planning/REQUIREMENTS.md` — REBOK-01 through REBOK-06, the acceptance bar for this phase.
- `.planning/ROADMAP.md` §Phase 1 — Success criteria.

### Codebase maps
- `.planning/codebase/ARCHITECTURE.md` — Layer map; routes delegate to `src/lib/`, which is where D-01 lands.
- `.planning/codebase/TESTING.md` — Three test layers; integration suite needs `make db-up` and the private submodule.
- `.planning/codebase/CONCERNS.md` — Known risks to avoid re-introducing.

### Feature docs in-repo
- `src/types/facilities.ts` — Doc comments on `FacilityType`, `FacilitySingleSchedule`, and the horizon helpers explain the current REBOKS contract (bot-owned, month-at-a-time horizon, only `reboks` is windowed).
- `src/lib/facilities/facility-slots.ts` — Doc comment on `getSlots` explains that `facility_slots()` replaced a materialised bookings table and why nothing stores a slot.
- `src/lib/facilities/facility-claims.ts` — Doc comment on `createClaim` lists the DB-side constraints (`uq_facility_claims_live`, `validate_facility_claim` trigger).
- `CLAUDE.md` — Repo conventions, test placement rule, Linear issue linking (`SHW-22`, `SHW-25`).

### Tracker
- Linear `SHW-22` (assigned to Kaleb) and `SHW-25` (unassigned, due 2026-09-17). SHW-25 wording: "only things that can be booked on intranet is sheares facilities like comm hall etc".

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `getFacilityType(facilityId)` in `src/lib/facilities/facility-catalog.ts`: already used by the claims POST route to read the venue type from the DB. D-10 reuses it unchanged.
- `apiError()` / `ApiError` from `@/lib/api/response` and `@/lib/api/errors`: the standard way to return the 4xx in D-10.
- `listPendingApprovals` and the confirmed-bookings view in `src/lib/facilities/facility-approvals.ts` both call `getSlots`, so they need no edits once D-01 lands.

### Established Patterns
- Routes are thin and delegate to `src/lib/`; policy lives in lib, not in route handlers or components. D-01 follows this.
- Type-scoped rules read the type from the DB rather than trusting the request (comment on `getFacilityType`). D-10 preserves this.
- Integration tests run real route handlers against Postgres plus PostgREST with the DB reseeded per test. The seed still contains REBOKS rows, which is exactly the condition REBOK-05 wants tested.

### Integration Points
- `src/lib/facilities/facility-slots.ts` → `getSlots`: the calendar, approvals, and confirmed-bookings all flow through here.
- `src/lib/facilities/facility-catalog.ts` → `listFacilities`: the picker, badges, admin list, and schedule editor all flow through here.
- `src/lib/facilities/facility-claims.ts` → `getClaimsForCca`: "My CCA bookings" component.
- `src/app/api/facilities/claims/route.ts` → POST: the only write path that can target a REBOKS venue.

### Production files touched (13, no tests)
Definitions: `src/types/facilities.ts`.
Routes: `src/app/api/facilities/slots/route.ts`, `src/app/api/facilities/claims/route.ts`, `src/app/api/facilities/catalog/route.ts`, `src/app/api/facilities/schedules/route.ts` (comment only).
Pages: `src/app/dashboard/facilities/page.tsx`, `src/app/dashboard/facilities/admin/page.tsx`, `src/app/dashboard/facilities/guide/page.tsx`.
Components: `src/components/facilities/day-detail-panel.tsx`, `src/components/facilities/schedule-slot-dialog.tsx`, `src/components/facilities/facility-type-badges.tsx`.
Lib: `src/lib/facilities/facility-picker.ts`, `src/lib/facilities/facility-schedules.ts` (comment only), plus the three lib files named in D-01.

</code_context>

<deferred>
## Deferred Ideas

- REBOKS destination (bot-only, separate app, or re-enable): REBOK-10, pending the SHW-22 meeting.
- Dropping `reboks` from the DB enum, deleting REBOKS `facilities` rows, or making `facility_slots()` exclude them: the only way to reach zero REBOKS-aware app code, but it lives in `vendor/intranet` and is a one-way door the TBC destination cannot justify yet.
- Booking priority system: SHW-24.

</deferred>

---

*Phase: 01-decouple-reboks-booking-from-intranet*
*Context gathered: 2026-09-04*
