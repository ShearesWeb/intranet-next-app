# Phase 1: Decouple REBOKS booking from intranet - Research

**Researched:** 2026-09-04
**Domain:** Application-layer feature removal / server-side data filtering (Next.js 15 + Supabase/PostgREST), no schema change
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Where the cut happens**
- **D-01:** Cut at the server-side data boundary, not in the UI. The DB will keep returning REBOKS rows (the `facility_slots()` RPC unions the bot's `facility_single_schedules`, and the `facilities` catalog still holds REBOKS venues), so the app excludes them at the point of read. Three reads can surface REBOKS data and all three exclude it: `getSlots` in `src/lib/facilities/facility-slots.ts`, `listFacilities` in `src/lib/facilities/facility-catalog.ts`, and `getClaimsForCca` in `src/lib/facilities/facility-claims.ts`. Every consumer above the lib layer (calendar, day panel, picker, approvals, confirmed bookings, admin page, schedule editor) inherits the exclusion. — **Reversibility:** reversible — three query clauses, nothing structural.
- **D-02:** Prefer pushing the exclusion into the query itself (`.neq("type", "reboks")` on the catalog query, and on the RPC call if PostgREST accepts filters on this set-returning function) over filtering in JavaScript. Researcher to confirm whether `supabase.rpc("facility_slots", …).neq("type", "reboks")` works against the local PostgREST sidecar; if not, filter the returned array in `getSlots`.
- **D-03:** One shared predicate, not scattered literals. A `BOOKABLE_FACILITY_TYPES` constant (`sheares`, `nus`, `external`) plus an `isBookableFacilityType()` guard in `src/types/facilities.ts`. This is an exclusion list, not a feature toggle: the excluded code path is deleted, not gated.

**What survives**
- **D-04:** `"reboks"` stays in the `FacilityType` union. The Postgres enum still contains it and rows carrying it still arrive from the DB, so narrowing the TS type would misrepresent the data. Its entry in `FACILITY_TYPE_CONFIG` may be removed if nothing renders it after the cut; planner's call.
- **D-05:** The `FacilitySingleSchedule` interface may be deleted if no code references it after the cut. It documents a table the app never queries directly.

**What is deleted outright**
- **D-06:** All four horizon helpers in `src/types/facilities.ts` (`bookingHorizonEnd`, `isBeyondBookingHorizon`, `isHorizonRestricted`, `horizonOpensOn`) and their unit tests. `MAX_SLOT_WINDOW_DAYS` and `daysUntilBooking` stay: they cap the RPC window and the booking lock, which are not REBOKS-specific. Only REBOKS was windowed, so no other venue loses behaviour.
- **D-07:** The horizon notice: `showHorizonNotice` prop chain from `src/app/dashboard/facilities/page.tsx` into `src/components/facilities/day-detail-panel.tsx`, and the JSX block that renders "REBOKS courts are secured a month at a time".
- **D-08:** The JCRC-only branch in `src/app/api/facilities/slots/route.ts` (`user.is_jcrc ? slots : slots.filter(...)`). After the cut every role receives the same slot set.
- **D-09:** No feature flag. `src/lib/feature-flags.ts` is per-service and the REBOKS destination is TBC; a toggle would keep dead code alive for a speculative return. Reinstating REBOKS later is a list entry plus whatever rule its new home needs, not a flag flip.

**API contract**
- **D-10:** `POST /api/facilities/claims` replaces the horizon check with a bookable-type check. Keep the existing `getFacilityType(facility_id)` lookup so the type comes from the DB, not the request body. Return 4xx (400 or 403, planner's call) with an error that names the venue as not bookable on the intranet. This closes the hand-rolled-payload hole even though the UI can no longer offer REBOKS slots.
- **D-11:** `GET /api/facilities/catalog` and `GET /api/facilities/slots` drop `"reboks"` from their `VALID_TYPES` arrays. A `?type=reboks` request is treated as an unknown type (same as today's behaviour for any unrecognised value), not a special error.

**Existing REBOKS rows in `facility_claims`**
- **D-12:** Hide them. `getClaimsForCca` excludes REBOKS claims, so "My CCA bookings" no longer lists them, and approvals derive from `getSlots` so they vanish there too. `DELETE /api/facilities/claims/[id]` is left untouched: it is guarded by RLS, so a chair who withdraws a historical REBOKS claim by id still can. Rationale: a chair seeing a booking they can no longer manage is more confusing than not seeing it. — **Reversibility:** reversible — remove one clause from `getClaimsForCca` if product wants them visible until the move-out date.

**UI cleanup (becomes dead after D-01)**
- **D-13:** Remove the now-redundant `f.type !== "reboks"` filters in `src/app/dashboard/facilities/admin/page.tsx` and `src/components/facilities/schedule-slot-dialog.tsx`. Remove `"reboks"` from the badge list in `src/components/facilities/facility-type-badges.tsx` and the sort order in `src/lib/facilities/facility-picker.ts`. Rewrite the sentence in `src/app/dashboard/facilities/guide/page.tsx` that says Reboks slots come from the Reboks bot.
- **D-14:** Comments that mention the dropped `reboks_activity` column in `src/lib/facilities/facility-schedules.ts` and `src/app/api/facilities/schedules/route.ts` are historical notes about the schema rebuild, not REBOKS feature code. Leave or trim at the planner's discretion.

### Claude's Discretion
- Exact 4xx status and error wording for D-10.
- Whether D-04's config entry and D-05's interface are deleted or kept.
- Order of tasks and how many plans the phase splits into.
- Test restructuring, as long as REBOK-04's `make check` criterion holds.

### Deferred Ideas (OUT OF SCOPE)
- REBOKS destination (bot-only, separate app, or re-enable): REBOK-10, pending the SHW-22 meeting.
- Dropping `reboks` from the DB enum, deleting REBOKS `facilities` rows, or making `facility_slots()` exclude them: the only way to reach zero REBOKS-aware app code, but it lives in `vendor/intranet` and is a one-way door the TBC destination cannot justify yet.
- Booking priority system: SHW-24.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| REBOK-01 | Chairs cannot see or claim REBOKS slots anywhere in the facilities UI (calendar, day panel, facility picker, type filter, badges). | D-01's three lib-layer exclusions (Pattern 1/2) mean every UI consumer inherits filtered data automatically; D-13's badge/sort-order cleanup removes the remaining `"reboks"` literals from `facility-type-badges.tsx`/`facility-picker.ts`. See Test File Inventory for the exact component test files to update. |
| REBOK-02 | Facilities API routes reject or omit REBOKS: `catalog` and `slots` do not accept or return `type=reboks`; `claims` refuses a claim on a REBOKS facility with a clear error. | D-11's `VALID_TYPES` literal removal (confirmed no-op beyond the literal, Pitfall 3); D-10's bookable-type check (Code Examples) replacing the horizon check, reusing `getFacilityType()` unchanged. |
| REBOK-03 | JCRC approvals and confirmed-bookings views show no REBOKS claims; the admin page and schedule editor keep excluding REBOKS venues. | `listPendingApprovals`/`listUpcomingConfirmed` in `facility-approvals.ts` both derive from `getSlots` (confirmed via direct read, no edits needed there — inherits D-01); D-13 removes the now-redundant manual filters in admin page and schedule-slot-dialog. |
| REBOK-04 | REBOKS-specific copy and logic (booking horizon, notices, guide text) are removed or no longer reachable, and unit/component/integration tests are updated so `make check` passes. | D-06/D-07 deletion targets identified exactly (4 helper functions + notice JSX); full Test File Inventory (9 files) enumerates every test edit required, closing the gap in CONTEXT.md's "13 files, no tests" count. |
| REBOK-05 | No schema migration is required; the app decouples purely in application code, and existing REBOKS rows in the DB do not break Sheares/NUS/external booking. | Confirmed via direct reads that no file outside `src/` needs touching (Runtime State Inventory); Pitfall 2 identifies that the integration suite currently has zero REBOKS coverage and specifies the exact new test needed to satisfy this requirement. |
| REBOK-06 | The exclusion lives at the server-side data boundary (`getSlots`, `listFacilities`, `getClaimsForCca`) plus one bookable-type check in the claims POST route; no feature flag; diff shrinks. | Patterns 1-3 give the exact code for all three lib functions plus D-10's route check; Pitfall 1 flags the grep-verification ambiguity around test-fixture data so the planner's verification step is unambiguous. |
</phase_requirements>

## Summary

This phase is a pure code-removal refactor inside a well-mapped codebase, not a new-technology build. All facts below come from reading the actual source files in this session (`src/types/facilities.ts`, the three `src/lib/facilities/*.ts` reads, all four `src/app/api/facilities/*/route.ts`, every production/test file the grep audit found), not from framework docs.

The three server-side reads named in D-01 (`getSlots`, `listFacilities`, `getClaimsForCca`) are thin, single-purpose functions with no branching logic beyond the query itself — each is a 5-15 line change. `getSlots` calls `supabase.rpc("facility_slots", { p_from, p_to })` with **no post-processing filter today**; PostgREST's own documentation confirms that table-returning RPC functions accept horizontal-filtering query params on **both GET and POST**, so `.neq("type", "reboks")` chained onto the existing `.rpc()` call is expected to work without switching to `{ get: true }`. This resolves CONTEXT.md's D-02 open question — filtering in the query is the right default; a JS-side fallback filter inside `getSlots` is documented below only as insurance.

The bigger finding from this session's audit: the phase's 13-file "no tests" list in CONTEXT.md undercounts by 9 test files that reference `reboks`, the horizon helpers, or a `reboks`-typed fixture. Those are enumerated exactly below, each with what the edit is (delete vs. rewrite vs. leave alone). A second finding: **the integration seed (`tests/fixtures/seed.sql`) contains zero facility rows of any type** — the integration suite creates facilities ad hoc per test via a raw `INSERT INTO facilities (type, venue, sub_venue) VALUES ('nus', ...)` helper (`createFacility()` in `tests/integration/routes/facilities.test.ts`). There is currently **no integration test that exercises a REBOKS row at all**. REBOK-05's "seeded DB that still contains REBOKS rows" criterion is satisfiable only by adding a new integration test that inserts a `type = 'reboks'` facility the same way `createFacility()` does — the phase must add this test, not just verify against an existing one.

A third finding: `vendor/intranet` is present as a git submodule reference but is **not checked out** in this workspace (empty directory, no `Makefile`), and Docker is installed but not running, and `liquibase` is not on `PATH`. `make db-up` / `make test-integration` cannot run in this environment as-is; this is a known, already-logged blocker (STATE.md), not new information, but it means the phase's plan must treat the integration suite as CI-verified rather than locally-verified unless the executor first runs `git submodule update --init --recursive` and starts Docker.

**Primary recommendation:** Implement D-01 through D-14 exactly as CONTEXT.md specifies — this research found nothing that contradicts the locked approach. Push the exclusion into the query for `listFacilities` (`.neq("type", "reboks")`, mirroring the existing `opts?.type` pattern) and `getSlots` (`.neq("type", "reboks")` chained onto the existing `.rpc()` call); for `getClaimsForCca`, the type is only reachable through the embedded `facilities(venue, sub_venue, type)` join already in `CLAIM_SELECT`, and PostgREST does not support filtering an embedded-resource's own column from the top-level query string in the same request — filter the returned array in JS after `toClaimWithFacility()` maps it (documented as the "embedded-join filter" pattern below, not a `getSlots`-style fallback).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| REBOKS row exclusion (calendar, catalog, claims-list) | API / Backend (`src/lib/facilities/`) | — | D-01: cut at the server-side data boundary so every UI consumer inherits it for free; this is the entire point of the locked approach |
| Bookable-type validation on claim creation | API / Backend (`src/app/api/facilities/claims/route.ts`) | Database (RLS/trigger, unchanged) | Type comes from a DB lookup (`getFacilityType`), not the request body — API route is the correct tier for a request-shape check even though the DB's own `validate_facility_claim` trigger is the final backstop |
| Horizon-notice / REBOKS copy removal | Browser / Client (React components + pages) | — | Purely presentational; no server-side equivalent exists after the cut because there is no horizon left to explain |
| `VALID_TYPES` request-param validation | API / Backend (`catalog/route.ts`, `slots/route.ts`) | — | Guards the `?type=` query param before it reaches the lib layer; removing the literal is a no-op change in behavior (see Pitfall 3) |
| Type union / shared predicate (`FacilityType`, `isBookableFacilityType`) | Types (`src/types/facilities.ts`) | — | Single source of truth consumed by both API and lib tiers; D-03's `BOOKABLE_FACILITY_TYPES` constant belongs here, not duplicated per-file |

## Package Legitimacy Audit

Not applicable — this phase installs no new npm packages. It only deletes code and edits existing files in `src/types/`, `src/lib/facilities/`, `src/app/api/facilities/`, `src/app/dashboard/facilities/`, and `src/components/facilities/`.

## Standard Stack

No new dependencies. Existing stack in play, all already installed and pinned:

| Library | Version (from `package.json`, read this session) | Role in this phase |
|---------|------|---------------------|
| `@supabase/supabase-js` (via `src/lib/supabase/server.ts`) | pinned in `package.json`, not re-verified this session (unchanged by this phase) | `.rpc()`, `.from().select()`, `.neq()` — the exclusion mechanism |
| Vitest 4.1.4 [CITED: `.planning/codebase/TESTING.md`, verified 2026-09-03] | 4.1.4 | Unit + component test edits (D-06's helper deletion, route test rewrites) |
| PostgREST — pulled as `postgrest/postgrest` (no version pin) in `Makefile:56-63` [VERIFIED: Makefile:56-63 — `docker run -d --name $(REST) ... postgrest/postgrest`] | `latest` at container-pull time | The sidecar the integration suite runs the RPC filter against |

## Architecture Patterns

### System Architecture Diagram

```
                     ┌─────────────────────────────┐
                     │   Chair / JCRC in browser    │
                     └───────────────┬───────────────┘
                                     │ fetch()
                                     ▼
        ┌───────────────────────────────────────────────────┐
        │  API routes (thin) — src/app/api/facilities/*      │
        │  catalog/route.ts   slots/route.ts   claims/route.ts│
        │  - VALID_TYPES no longer includes "reboks" (D-11)  │
        │  - claims POST: bookable-type check replaces the   │
        │    horizon check (D-10)                            │
        │  - slots GET: JCRC-only branch deleted (D-08)      │
        └───────────────────┬─────────────────────────────────┘
                             │ delegates to
                             ▼
        ┌───────────────────────────────────────────────────┐
        │  src/lib/facilities/  ← THE CUT LANDS HERE (D-01)  │
        │  getSlots()        .neq("type","reboks") on RPC    │
        │  listFacilities()  .neq("type","reboks") on query  │
        │  getClaimsForCca() JS-filter after embedded join    │
        │  getFacilityType() UNCHANGED — reused by D-10       │
        └───────────────────┬─────────────────────────────────┘
                             │ PostgREST (filters travel as
                             │ query-string params, GET or POST)
                             ▼
        ┌───────────────────────────────────────────────────┐
        │  Postgres: facilities, facility_claims,             │
        │  facility_schedules, facility_single_schedules      │
        │  (bot-owned, unchanged), facility_slots() RPC       │
        │  — still returns "reboks" rows; app filters them out│
        └───────────────────────────────────────────────────┘

  Every consumer above the lib layer (calendar page, day-detail
  panel, facility picker, approvals, confirmed-bookings, admin
  page, schedule editor, My CCA bookings) receives already-filtered
  data and needs no REBOKS-awareness of its own — that is the test
  of a correct cut (CONTEXT.md "Specific Ideas").
```

### Recommended Project Structure

No new files or directories. Every edit lands inside existing files:

```
src/types/facilities.ts                          # D-03 BOOKABLE_FACILITY_TYPES + isBookableFacilityType(); D-06 delete 4 horizon fns
src/lib/facilities/facility-slots.ts              # D-01/D-02 .neq() on the rpc() call
src/lib/facilities/facility-catalog.ts            # D-01 .neq() on listFacilities(); getFacilityType() untouched
src/lib/facilities/facility-claims.ts             # D-01/D-12 JS-filter getClaimsForCca() after the embedded join
src/app/api/facilities/claims/route.ts            # D-10 bookable-type check replaces horizon check
src/app/api/facilities/catalog/route.ts           # D-11 drop "reboks" from VALID_TYPES
src/app/api/facilities/slots/route.ts             # D-08/D-11 delete JCRC-only branch, drop "reboks" from VALID_TYPES
src/app/api/facilities/schedules/route.ts         # D-14 comment-only, discretionary
src/app/dashboard/facilities/page.tsx             # D-07 delete showHorizonNotice prop chain
src/app/dashboard/facilities/admin/page.tsx       # D-13 remove now-redundant f.type !== "reboks" filter
src/app/dashboard/facilities/guide/page.tsx       # D-13 rewrite the Reboks-bot sentence
src/components/facilities/day-detail-panel.tsx    # D-07 delete horizon notice JSX + imports
src/components/facilities/schedule-slot-dialog.tsx# D-13 remove now-redundant f.type !== "reboks" filter
src/components/facilities/facility-type-badges.tsx# D-13 remove "reboks" from TYPES badge list
src/lib/facilities/facility-picker.ts             # D-13 remove "reboks" from TYPE_ORDER
```

### Pattern 1: Query-level exclusion via `.neq()` on a direct table query

**What:** `listFacilities` already supports an optional `type` include-filter (`if (opts?.type) query = query.eq("type", opts.type)`). Add an unconditional exclude-filter alongside it.

**When to use:** Any read that queries the `facilities` table (or a table with a `type`/`facility_type` column) directly.

**Example:**
```typescript
// src/lib/facilities/facility-catalog.ts — verbatim current code, read this session
export async function listFacilities(opts?: { type?: FacilityType }): Promise<Facility[]> {
	const supabase = await createClient();

	let query = supabase.from("facilities").select(FACILITY_SELECT).order("venue").order("sub_venue");

	if (opts?.type) query = query.eq("type", opts.type);
	// D-01 addition, same shape as the line above:
	query = query.neq("type", "reboks");

	const { data, error } = await query;
	// ... unchanged
}
```
[VERIFIED: src/lib/facilities/facility-catalog.ts:7-22 — quoted above is the exact current body]

### Pattern 2: Query-level exclusion via `.neq()` chained on `.rpc()`

**What:** `getSlots` calls `supabase.rpc("facility_slots", { p_from: from, p_to: to })` and does no filtering today. PostgREST's official docs state table-valued functions "support read filters, resource embedding, and can be called using POST or GET methods" — filters ride the query string independently of the POST body that carries `p_from`/`p_to`, so chaining `.neq("type", "reboks")` works without adding `{ get: true }` to the `.rpc()` call.

**When to use:** Filtering the result set of a Postgres function exposed as an RPC endpoint that returns a table type (confirmed: `FacilitySlot[]` has a `type` column, so it is filterable).

**Example:**
```typescript
// src/lib/facilities/facility-slots.ts — current body, read this session; D-02 addition on the marked line
export async function getSlots(from: string, to: string): Promise<FacilitySlot[]> {
	// ... span validation unchanged
	const supabase = await createClient();

	const { data, error } = await supabase
		.rpc("facility_slots", { p_from: from, p_to: to })
		.neq("type", "reboks"); // D-01/D-02 addition

	if (error) {
		console.error("Error fetching facility slots:", error);
		throw new ApiError(500, "Failed to load the facilities calendar");
	}

	return ((data ?? []) as FacilitySlot[]).map((slot) => ({
		...slot,
		claims: slot.claims ?? [],
	}));
}
```
[CITED: https://docs.postgrest.org/en/v14/references/api/functions.html — "If functions return table types, they support read filters, resource embedding, and can be called using POST or GET methods."]
[VERIFIED: src/lib/facilities/facility-slots.ts:22-45 — quoted structure above matches the current body except for the added `.neq()` line]

**Fallback if the RPC filter does not behave as documented against the local PostgREST sidecar** (the executor should confirm once `make db-up` is runnable — see Environment Availability): filter the returned array inside `getSlots` instead:
```typescript
return ((data ?? []) as FacilitySlot[])
	.filter((slot) => slot.type !== "reboks")
	.map((slot) => ({ ...slot, claims: slot.claims ?? [] }));
```
Cost of the fallback: none functionally — `facility_slots()` already returns the full computed grid for the window (documented cost: "a full weekly grid over a year is ~88k rows" [VERIFIED: src/lib/facilities/facility-slots.ts:18-19 — "Cost is linear in slots returned — a full weekly grid over a year is ~88k rows and several hundred ms — so keep windows to a week or a month."]), so a JS `.filter()` over an already-fetched array adds no additional round trip; the only loss is that the DB-side filter would (when the function is inlinable) let Postgres avoid materializing REBOKS rows at all, which is a minor efficiency difference, not a correctness one.

### Pattern 3: Filtering on an embedded-join column (`getClaimsForCca`)

**What:** `facility_claims` has no `type` column of its own — the type is only reachable through the embedded `facilities(venue, sub_venue, type)` join already present in `CLAIM_SELECT`. PostgREST resource-embedding filters (`facilities.type=neq.reboks` as an embedded-filter query param) exist but change the embed to an inner-join-with-filter semantics that is easy to get subtly wrong (rows where the embed is filtered out return `facilities: null` rather than being excluded, unless `!inner` is used). Given the row count here is small (one CCA's own claims) and `toClaimWithFacility()` already unwraps the join in JS, filtering after the map is simpler and behaviorally unambiguous.

**Example:**
```typescript
// src/lib/facilities/facility-claims.ts — current getClaimsForCca body, read this session
export async function getClaimsForCca(ccaId: number): Promise<ClaimWithFacility[]> {
	const supabase = await createClient();

	const { data, error } = await supabase
		.from("facility_claims")
		.select(CLAIM_SELECT)
		.eq("cca_id", ccaId)
		.order("date", { ascending: true })
		.order("hour", { ascending: true });

	if (error) {
		console.error("Error fetching CCA claims:", error);
		throw new ApiError(500, "Failed to load your CCA's bookings");
	}

	return ((data ?? []) as unknown as ClaimRow[])
		.map(toClaimWithFacility)
		.filter((claim) => claim.facility_type !== "reboks"); // D-01/D-12 addition
}
```
[VERIFIED: src/lib/facilities/facility-claims.ts:50-66 — quoted body above matches current code except the added `.filter()` line]

Alternative considered and rejected: `.eq("facilities.type", "sheares")`-style embedded filter with `facilities!inner(...)` in `CLAIM_SELECT` pushes the filter into Postgres but changes `ClaimRow.facilities` from nullable-embed to inner-join semantics, which is a wider change to `CLAIM_SELECT` (shared by `createClaim`) for a table with a handful of rows per CCA — not worth the risk in a phase whose stated goal is to shrink the diff (CONTEXT.md "Net code should shrink").

### Anti-Patterns to Avoid

- **Filtering in the UI layer instead of the lib layer:** Every current `.filter((f) => f.type !== "reboks")` (admin page, schedule-slot-dialog) is *already* this anti-pattern in miniature and is exactly what D-13 removes once D-01 makes it redundant. Don't reintroduce a fourth one anywhere in `src/app/dashboard/` or `src/components/`.
- **Trusting `facility_id`'s type from the request body:** `getFacilityType(facility_id)` exists specifically because "the client must not be able to talk its way past a type-scoped rule by mislabelling the venue" [VERIFIED: src/lib/facilities/facility-catalog.ts:27-29 — doc comment on `getFacilityType`, quoted verbatim]. D-10 must call this function, not read a `type` field off the claim POST body (there isn't one today, and none should be added).
- **Leaving `FACILITY_TYPE_CONFIG["reboks"]` reachable through a `TYPES`/`MANAGED_TYPES`-style array that still includes `"reboks"`:** `facility-type-badges.tsx`'s `TYPES` const and `facility-picker.ts`'s `TYPE_ORDER` const both currently hardcode `["sheares", "reboks", "nus", "external"]` independently of `admin/page.tsx`'s separately-declared `MANAGED_TYPES = ["sheares", "nus", "external"]`. D-03's `BOOKABLE_FACILITY_TYPES` constant should replace all three so there is one array, not three that must be kept in sync by hand.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Bookable-type membership check | A fourth inline `type !== "reboks"` / `["sheares","nus","external"].includes(type)` literal | D-03's shared `isBookableFacilityType()` guard + `BOOKABLE_FACILITY_TYPES` constant in `src/types/facilities.ts` | CONTEXT.md is explicit: "One shared predicate, not scattered literals" — this phase is being graded partly on whether the diff *shrinks*, and three independently-hardcoded arrays (`TYPES`, `TYPE_ORDER`, `MANAGED_TYPES`) becoming three call-sites of one constant is the measurable version of that |
| Excluding an embedded-join column | A raw SQL view or a new RPC just to expose `facility_claims.facility_type` | JS `.filter()` after `toClaimWithFacility()` (Pattern 3 above) | The row count is small (per-CCA claims list), and `vendor/intranet` is explicitly out of scope (D-01, deferred list) — no new DB object may be introduced by this phase |

**Key insight:** Every "don't hand-roll" concern in this phase reduces to the same instruction as D-03: there is exactly one place each rule should live (`src/types/facilities.ts`), and the risk in this phase is re-deriving the same list of bookable types in a fourth location rather than reusing the shared constant.

## Runtime State Inventory

Not a rename/refactor/rebrand phase in the sense that trigger applies to (no string is being renamed across the codebase) — but it does remove app-code access to existing data, so the same "what still has state after the code changes" question applies to REBOKS-tagged rows already in the DB.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | Existing `facility_claims` rows with `facilities.type = 'reboks'` (via the join) remain in Postgres — D-12 hides them from `getClaimsForCca` and thus from "My CCA bookings" and JCRC approvals/confirmed-bookings (which derive from `getSlots`) | Code edit only (the two `.filter()`/`.neq()` additions above) — no data migration. `DELETE /api/facilities/claims/[id]` is explicitly left untouched per D-12, so a chair can still withdraw a REBOKS claim by its known id even though it no longer appears in any list |
| Live service config | REBOKS availability itself (`facility_single_schedules`) is written by the external REBOKS bot, not by this app — confirmed read-only: "the REBOKS booking bot is the only writer, and the app has no write grant" [VERIFIED: src/types/facilities.ts:64-66 — doc comment on `FacilitySingleSchedule`, quoted verbatim] | None — this phase does not touch the bot or its schedule rows |
| OS-registered state | None found — this is a pure web-app code change with no OS-level task scheduler, systemd unit, or process-manager registration involved | None — verified by reading the full file list touched; nothing outside `src/` is written |
| Secrets/env vars | None — no env var or secret name references "reboks" or "horizon" anywhere in the grepped source | None |
| Build artifacts | None — no installed package or generated artifact carries a REBOKS-specific name | None |

## Common Pitfalls

### Pitfall 1: Grep-based "no reboks references" verification catching test fixture data, not just production logic

**What goes wrong:** REBOK-06 / Success Criterion 6 says "no file under `src/components/` or `src/app/dashboard/` references `reboks` or any horizon helper." A literal `grep -ril reboks src/components src/app/dashboard` will also match test files that use `"reboks"` purely as an arbitrary placeholder `type` value in a fixture factory — e.g. `schedule-week.test.tsx:13` (`type: p.type ?? "reboks"`) and `facility-select.test.tsx:9,49` (a REBOKS-typed facility used to test that the picker groups by type at all).

**Why it happens:** `"reboks"` remains a valid literal of the `FacilityType` union (D-04 keeps it), so using it as arbitrary test data is not itself wrong — but it is textually indistinguishable from a real REBOKS-feature reference to a naive grep.

**How to avoid:** When the planner writes the verification step for Success Criterion 6, scope the grep to exclude `*.test.ts`/`*.test.tsx` (e.g. `grep -rl reboks src/components src/app/dashboard --include='*.tsx' --include='*.ts' | grep -v '\.test\.'`), OR treat this as an opportunity to also swap the arbitrary placeholder type in `schedule-week.test.tsx` and `facility-select.test.tsx` to `"sheares"`/`"nus"` for cleanliness (trivial, zero behavior change, since these tests only assert grouping/rendering mechanics, not REBOKS-specific behavior). Either resolution is acceptable; leaving the ambiguity undocumented is not — the plan's verification command must decide one way explicitly.

**Warning signs:** A verify step that reports failure listing only `*.test.tsx` files is a false positive under a literal reading; don't let that block completion, but don't silently ignore it either — confirm which of the two resolutions above was chosen.

### Pitfall 2: The integration suite has no REBOKS coverage today — REBOK-05 requires *adding* a test, not just re-running existing ones

**What goes wrong:** Assuming "the facilities integration suite passes against a seeded DB that still contains REBOKS rows" (Success Criterion 4) is satisfied by simply running `make test-integration` unchanged. It is not: `tests/fixtures/seed.sql` has zero facility rows [VERIFIED: tests/fixtures/seed.sql:1-107 — full file read this session, contains no `INSERT INTO facilities` or `facility_claims` statement], and every existing `facilities.test.ts` case creates its own facility ad hoc with `type = 'nus'` via `createFacility()` [VERIFIED: tests/integration/routes/facilities.test.ts:14-21 — `INSERT INTO facilities (type, venue, sub_venue) VALUES ('nus', 'UTown', $1) RETURNING id`]. No existing integration test ever creates or queries a `type = 'reboks'` row.

**Why it happens:** The horizon/REBOKS-exclusion logic today lives entirely in unit-mocked route tests (`slots/route.test.ts`, `claims/route.test.ts` — both mock `getSlots`/`getFacilityType` rather than hitting Postgres), so integration coverage of REBOKS was never needed before this phase, when REBOKS rows were simply allowed through unfiltered.

**How to avoid:** The plan must include a task to add a new integration test (in `tests/integration/routes/facilities.test.ts` or a new file) that: (1) inserts a `type = 'reboks'` facility the same way `createFacility()` does (a REBOKS variant, e.g. `createFacility('reboks')` — parameterize the existing helper's hardcoded `'nus'`), (2) publishes a schedule for it via the existing `publishSlot()` helper, (3) asserts it is absent from `GET /api/facilities/catalog` and `GET /api/facilities/slots` responses, and (4) asserts `POST /api/facilities/claims` against it returns the D-10 4xx.

**Warning signs:** A plan whose only integration-test task is "run `make test-integration` and confirm it still passes" without a corresponding new REBOKS-specific assertion has not actually verified REBOK-05.

### Pitfall 3: Assuming `?type=reboks` needs new error-handling after D-11

**What goes wrong:** Building special-case handling for a `?type=reboks` request after removing the literal from `VALID_TYPES`.

**Why it happens:** It's tempting to think "removing reboks from valid types" means the removed value needs an explicit rejection path.

**How to avoid:** Read the existing code: both routes already do `VALID_TYPES.includes(typeParam as FacilityType) ? typeParam : undefined` [VERIFIED: src/app/api/facilities/catalog/route.ts:18-21 and src/app/api/facilities/slots/route.ts:44-46 — identical ternary pattern in both files, quoted structurally above]. An unrecognized `typeParam` already silently resolves to `undefined` (no type filter applied — the catalog/slots endpoint just returns unfiltered-by-type results, which are now REBOKS-free anyway thanks to D-01). Removing `"reboks"` from the array is confirmed to be a no-op beyond deleting the literal, exactly as CONTEXT.md's D-11 states — no new branch needed.

**Warning signs:** A plan task titled something like "handle unknown type=reboks gracefully" indicates a misunderstanding; the existing ternary already handles every unrecognized value identically.

### Pitfall 4: `vendor/intranet` not checked out blocks *any* local integration-test run, not just REBOKS-specific ones

**What goes wrong:** A plan step that says "run `make test-integration` locally to verify" without first checking submodule/Docker state will fail for reasons unrelated to this phase's changes, producing a false "my change broke something" signal.

**Why it happens:** `vendor/intranet` is a git submodule reference pinned to a commit but the directory is empty in this workspace [VERIFIED: `git submodule status` output this session — `-d0e8ac2f25431abce2c74eca5fc71cbd3672fb9c vendor/intranet` (leading `-` means not initialized); `ls vendor/intranet` returns an empty directory]. `make db-up` explicitly checks for this and exits with a clear message ("schema repo not found... git submodule update --init") [VERIFIED: Makefile:50 — `@test -f "$(INTRANET)/Makefile" || { echo "schema repo not found at $(INTRANET) (git submodule update --init, or set INTRANET=)"; exit 1; }`], but a plan that doesn't call this out up front wastes a cycle rediscovering it.

**How to avoid:** State explicitly in the plan (or as a `checkpoint:human-verify`) that `git submodule update --init --recursive` plus a running Docker daemon are prerequisites for local integration verification, and that CI (`2-merge-request-ci.yml`) is the fallback verification path if those aren't available locally. See Environment Availability below.

## Code Examples

### D-03: Shared predicate in `src/types/facilities.ts`

```typescript
// Addition to src/types/facilities.ts, alongside the existing FacilityType export.
// The three current independent arrays this replaces:
//   facility-type-badges.tsx:  const TYPES: FacilityType[] = ["sheares", "reboks", "nus", "external"];
//   facility-picker.ts:        const TYPE_ORDER: FacilityType[] = ["sheares", "reboks", "nus", "external"];
//   admin/page.tsx:            const MANAGED_TYPES: FacilityType[] = ["sheares", "nus", "external"];
export const BOOKABLE_FACILITY_TYPES: FacilityType[] = ["sheares", "nus", "external"];

export function isBookableFacilityType(type: FacilityType): boolean {
	return BOOKABLE_FACILITY_TYPES.includes(type);
}
```
[VERIFIED: src/components/facilities/facility-type-badges.tsx:6, src/lib/facilities/facility-picker.ts:3, src/app/dashboard/facilities/admin/page.tsx:24 — the three array literals quoted above are the exact current lines being consolidated]

### D-10: Bookable-type check replacing the horizon check in the claims POST route

```typescript
// src/app/api/facilities/claims/route.ts — current horizon-check block (lines 65-75, read this session)
// being replaced:
//   if (!user.is_jcrc) {
//       const type = await getFacilityType(facility_id);
//       if (type && isHorizonRestricted(type, date)) {
//           return apiError(
//               `REBOKS bookings open one month at a time — ${bookingHorizonEnd()} is the last date currently open`,
//               403,
//           );
//       }
//   }
//
// D-10 replacement (getFacilityType + apiError reused unchanged; is_jcrc branch dropped
// since bookable-type is not a JCRC exemption — JCRC does not get to claim REBOKS slots either,
// D-10 note: "planner's call" on exact status/wording, this is one reasonable choice):
const type = await getFacilityType(facility_id);
if (type && !isBookableFacilityType(type)) {
	return apiError("This venue is not bookable on the intranet", 400);
}
```
[VERIFIED: src/app/api/facilities/claims/route.ts:65-75 — quoted block above is the exact current code being replaced]
[VERIFIED: src/lib/facilities/facility-catalog.ts:31-46 — `getFacilityType` signature/behavior reused unchanged, quoted in full in Pattern discussion above]

Note the discretion point CONTEXT.md leaves open (D-10: "Return 4xx (400 or 403, planner's call)"): 400 reads more accurately here since the request is malformed in intent (asking to book a venue type the intranet doesn't support) rather than a permissions failure; 403 was the prior status because the horizon check *was* about permission-in-time. This is a recommendation, not a verified requirement — flagged in the Assumptions Log.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| REBOKS-only booking horizon (`bookingHorizonEnd`/`isBeyondBookingHorizon`/`isHorizonRestricted`/`horizonOpensOn`) gating both the slots list and the claims POST | No horizon at all for any venue — hall venues were never windowed and REBOKS is no longer bookable through the intranet, so the concept has no remaining referent | This phase (D-06) | `MIN_BOOKING_LEAD_DAYS`/`isBookingLocked`/`daysUntilBooking` are unaffected and continue to gate all venues equally — this phase does not touch lead-time locking, only the REBOKS-specific horizon |
| JCRC-only full-horizon exemption in `GET /api/facilities/slots` (`user.is_jcrc ? slots : slots.filter(...)`) | Every role receives the identical slot set (D-08) — moot once REBOKS rows never reach any caller | This phase (D-08) | Simplifies the route to a straight `getSlots()` → optional type filter → response, removing one branch entirely |

**Deprecated/outdated:**
- `FacilitySingleSchedule` interface (`src/types/facilities.ts`): documents a bot-owned table the app has never queried directly (confirmed zero other consumers in this session's grep). Safe to delete per D-05's discretion; keeping it costs nothing but a stale doc comment if the planner prefers minimal diff churn.
- `FACILITY_TYPE_CONFIG["reboks"]` entry: becomes unreachable once no `FacilitySlot`/`Facility` row typed `"reboks"` can flow past the lib layer to any UI consumer (D-01 guarantees this). D-04 leaves deletion to the planner; either choice satisfies the requirements, but if kept, note it is genuinely dead code post-cut (not "may become dead" — will become dead).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Chaining `.neq("type", "reboks")` onto `supabase.rpc("facility_slots", {...})` (default POST method) works identically to the documented GET-filtering behavior against the specific unpinned `postgrest/postgrest:latest` image this repo's `make db-up` pulls | Pattern 2 / D-02 | Low-medium: PostgREST's own docs state this is method-independent for table-returning functions, and the image is unpinned/current, but this session could not run `make db-up` (Docker not running, submodule not checked out) to observe it directly against this repo's actual `facility_slots()` definition (which lives in the private `vendor/intranet` submodule and was not readable this session). If wrong, the JS-array-filter fallback in Pattern 2 is a drop-in replacement with no other consequence. |
| A2 | 400 (not 403) is the better status code for D-10's bookable-type rejection | Code Examples / D-10 | Low: CONTEXT.md explicitly defers this to the planner ("planner's call"); either status satisfies REBOK-02's "clear error" requirement. Wrong choice only affects HTTP-semantics purity, not functionality — no test currently asserts one status over the other for this new path since it doesn't exist yet. |
| A3 | Filtering `getClaimsForCca`'s result in JS after `toClaimWithFacility()` (rather than an embedded-filter query with `facilities!inner(...)`) is the right tradeoff for this table's expected row count | Pattern 3 | Low: no production row-count data was available this session (couldn't query the live/staging DB); the claim rests on "a CCA's own claims list is inherently small" from domain knowledge of the feature (one hall's worth of venue bookings per CCA), not a measured number. If a CCA somehow has thousands of historical claims, an embedded-filter query would be more efficient — but the correctness of either approach is unaffected. |

## Open Questions

None blocking. The single research question CONTEXT.md posed for this session (D-02: does the RPC accept `.neq()`) is answered with HIGH confidence from official PostgREST documentation (see Pattern 2), with a documented zero-cost fallback if the live behavior against this repo's actual `vendor/intranet` schema differs — this can be confirmed by the executor as the very first step of implementing `getSlots`, before writing the rest of the plan's tasks, since it is a two-line change to test.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Docker | `make db-up` (integration test DB + PostgREST sidecar) | ✓ installed, ✗ daemon not running | 29.4.0 | Start Docker Desktop before running `make db-up`; otherwise defer integration verification to CI |
| `vendor/intranet` submodule | Schema/Liquibase changelogs for `make db-up` | ✗ not checked out (empty dir, gitlink present) | — | `git submodule update --init --recursive` (requires SSH access to the private `ShearesWeb/intranet` repo) |
| Liquibase | Schema migration inside `make db-up` | ✗ not on PATH | — | CI installs a pinned tarball (4.31.1) automatically; locally, install per `docs/TESTING.md` one-time setup, or rely on CI |
| `psql` | Seed application, ad hoc test queries | ✓ | 17.10 (Homebrew) | — |
| Java (JDK) | Liquibase runtime | ✓ | 25.0.4.1 LTS | — |
| `postgrest/postgrest` Docker image | The RPC-filter behavior this phase's core design decision (D-02) depends on | Not pulled/tested this session (Docker daemon down) | `latest` at pull time — unpinned in `Makefile` | Once Docker is running and the submodule is checked out, `make db-up` pulls and starts it automatically |

**Missing dependencies with no fallback:**
- None — every gap above has either a documented fallback (CI) or a known unblock command.

**Missing dependencies with fallback:**
- Full local integration-test run (`make test-integration`) is blocked until Docker is started and the submodule is initialized; CI (`2-merge-request-ci.yml`, triggered on PR into `main`) runs the full stack including `next build` and integration tests and is the safety net if local verification isn't possible before opening the PR.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.4 [CITED: `.planning/codebase/TESTING.md`] |
| Config file | `vitest.config.mts` (unit + component), `vitest.integration.config.mts` (integration) [VERIFIED: file listing this session — both files present at repo root] |
| Quick run command | `npx vitest run <path>` (single file) or `make test` (all unit + component) |
| Full suite command | `make check` (format-check + typecheck + test) for unit/component; `make db-up && make test-integration && make db-down` for integration |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|---------------------|-------------|
| REBOK-01 | Chair sees no REBOKS slots/filters/badges in the facilities UI | component | `npx vitest run src/components/facilities/day-detail-panel.test.tsx src/components/facilities/facility-select.test.tsx src/lib/facilities/facility-picker.test.ts` | ✅ (existing files need edits — see Test File Inventory below) |
| REBOK-02 | `catalog`/`slots` never accept/return `type=reboks`; `claims` POST refuses a REBOKS facility with a clear error | unit (route) + integration | `npx vitest run src/app/api/facilities/slots/route.test.ts src/app/api/facilities/claims/route.test.ts src/app/api/facilities/catalog/route.ts` then `make test-integration` (new REBOKS case, Pitfall 2) | ✅ unit files exist and need rewriting; ❌ integration case needs adding — Wave 0 gap |
| REBOK-03 | JCRC approval/confirmed-booking lists show no REBOKS claims; admin page/schedule editor still exclude REBOKS venues | component + integration | `npx vitest run src/app/dashboard/facilities/admin/page.tsx` has no dedicated test file today — covered indirectly by `facility-picker.test.ts`/`facility-select.test.tsx` group-by-type assertions; integration coverage via the new REBOKS facility test | ❌ no direct admin-page component test exists; relies on lib-level tests + new integration case |
| REBOK-04 | Horizon copy/logic removed or unreachable; `make check` passes | unit + component | `npx vitest run src/types/facilities.test.ts` (after deleting the 4 horizon-fn describe blocks) then `make check` | ✅ file exists, needs the described-block deletions |
| REBOK-05 | No schema migration; existing REBOKS rows in DB don't break other bookings | integration | `make test-integration` including the new REBOKS-row test (Pitfall 2) | ❌ new test needed — Wave 0 gap |
| REBOK-06 | Exclusion lives at the 3 named lib functions + claims-route check; no `src/components`/`src/app/dashboard` file references reboks/horizon; diff shrinks | static/manual + `make check` | `grep` audit per Pitfall 1's scoped pattern, plus `git diff --stat` line-count comparison | N/A — verification step, not a test file |

### Sampling Rate

- **Per task commit:** `npx vitest run <changed test file>` for whichever file the task touched
- **Per wave merge:** `make check` (unit + component) — integration only if Docker/submodule are available locally, else defer to CI
- **Phase gate:** `make check` green locally + `make test-integration` green (locally if possible, CI otherwise) before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `tests/integration/routes/facilities.test.ts` — needs a new REBOKS-row test case (create a `type='reboks'` facility, publish a schedule, assert absence from catalog/slots and a 4xx from claims POST) — covers REBOK-02, REBOK-05
- [ ] `tests/integration/routes/facilities.test.ts`'s `createFacility()` helper needs a `type` parameter (currently hardcoded to `'nus'`) to support the above — small refactor, not a new file

### Test File Inventory (production files touched: 13 per CONTEXT.md D-14/13; test files touched: 9, found this session)

Every file below was located via `grep -rn -i "reboks\|bookingHorizonEnd\|isBeyondBookingHorizon\|isHorizonRestricted\|horizonOpensOn\|showHorizonNotice\|FacilitySingleSchedule" src/ tests/` in this session [VERIFIED: grep output this session, file list below matches it exactly].

| File | What references REBOKS/horizon | Required edit |
|------|-------------------------------|----------------|
| `src/types/facilities.test.ts` | `describe` blocks for all 4 horizon functions (`bookingHorizonEnd`, `isBeyondBookingHorizon`, `isHorizonRestricted`, `horizonOpensOn`) | Delete these 4 `describe` blocks entirely (D-06 — "and their unit tests") |
| `src/app/api/facilities/schedules/route.test.ts` | Comment + a `reboks_activity` field in a test payload (line 71), testing that it's accepted-and-ignored | Leave — this tests the *dropped-column* comment behavior (D-14), unrelated to the REBOKS venue-type cut; no change required |
| `src/app/api/facilities/slots/route.test.ts` | Entire `describe("GET /api/facilities/slots — REBOKS horizon", ...)` block (4 `it`s) testing the JCRC-exemption branch and horizon trimming | Delete the whole `describe` block (D-08 removes the code it tests); optionally add a new case asserting REBOKS-typed slots from `getSlots` mock never appear regardless of `is_jcrc`, to keep coverage of the `.neq()`/type-exclusion behavior at the lib boundary (that exclusion is better unit-tested in `facility-slots.test.ts`, which doesn't exist yet — see note below) |
| `src/app/api/facilities/claims/route.test.ts` | Entire `describe("POST /api/facilities/claims — REBOKS horizon gate", ...)` block (3 `it`s) plus one comment in the lead-time-gate block | Delete the horizon-gate `describe` block; replace with a new `describe("POST /api/facilities/claims — bookable-type gate", ...)` covering: reboks-typed facility → 4xx; sheares-typed → 201; (JCRC exemption removed per the D-10 code example above — confirm with planner whether JCRC should still be exempt, since CONTEXT.md doesn't explicitly re-decide this for the new check) |
| `src/components/facilities/day-detail-panel.test.tsx` | `"REBOKS"` used only as an arbitrary venue-name string in 2 test fixtures (line 78-79); no test exercises `showHorizonNotice` | No forced change — see Pitfall 1. Optional: rename to a neutral venue string for hygiene |
| `src/components/facilities/schedule-week.test.tsx` | `type: p.type ?? "reboks"` as the default in a `slot()` factory | Optional cleanup (not required for `FacilityType` union correctness since `"reboks"` stays valid) — recommend swapping default to `"sheares"` to fully clear the literal from a `src/components/` file per Pitfall 1 |
| `src/components/facilities/facility-select.test.tsx` | A `type: "reboks"` fixture facility + assertions that "Reboks" renders as a group label | This test exercises generic type-grouping behavior, not REBOKS-specific logic — swap the fixture's type to `"nus"` and the assertion string to `"NUS"` so the test keeps validating grouping without asserting on a value that no longer reaches this component in production |
| `src/lib/facilities/facility-picker.test.ts` | 2 `type: "reboks"` fixtures + assertions on grouping order | Same as above — this is `src/lib/`, not `src/components/`/`src/app/dashboard/`, so not required by REBOK-06's literal text, but recommend the same swap for consistency since `groupFacilitiesByType`'s `TYPE_ORDER` becomes `BOOKABLE_FACILITY_TYPES` (D-03) which no longer contains `"reboks"` — leaving a reboks-typed fixture here would still pass (the function has no knowledge of "bookable," it groups whatever it's given) but is a stale example |
| `src/lib/facilities/schedule-grid.test.ts` | `type: p.type ?? "reboks"` default in a `slot()` factory | Same as `schedule-week.test.tsx` — optional cleanup, not required |

**Net new test file:** none required by production-file structure — the REBOKS-specific `describe` blocks being deleted from `slots/route.test.ts` and `claims/route.test.ts` are large enough that the planner may choose to consolidate the *replacement* bookable-type-gate tests into those same files (recommended, keeps 1:1 file-to-route correspondence) rather than creating new test files.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | Unaffected by this phase — `requireAuth()` already gates every route touched, unchanged |
| V3 Session Management | No | Unaffected |
| V4 Access Control | Yes | D-10's bookable-type check is itself an access-control-adjacent input-validation control; must read the type from the DB via `getFacilityType()`, never trust a `type` field on the request body (none exists today — do not add one) |
| V5 Input Validation | Yes | `VALID_TYPES` array narrowing on `?type=` query params (unchanged pattern, D-11 just removes one literal); the D-10 check is the input-validation control for `facility_id` |
| V6 Cryptography | No | Not applicable |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Hand-rolled POST body claiming a venue is a different type than it actually is, to bypass a type-scoped rule | Tampering | `getFacilityType(facility_id)` reads the type from the DB by id, never from the request body — this pattern already exists in this codebase (the doc comment on `getFacilityType` names this exact threat) and D-10 must preserve it, not introduce a body-supplied `type` field |
| A chair claiming a REBOKS slot via a stale/cached UI that hasn't picked up the exclusion yet (client-side bypass) | Tampering / Elevation of Privilege | D-10's server-side 4xx is the actual enforcement boundary — the UI-layer removal (D-01/D-07/D-13) is a UX improvement, not the security control. This is exactly why D-10 exists as a defense-in-depth item even though "the UI can no longer offer REBOKS slots" (CONTEXT.md D-10) |

## Sources

### Primary (HIGH confidence)
- `/websites/postgrest_en_v14` (Context7) — "References > API > Functions" — confirms table-valued RPC functions support horizontal filtering via query-string params on both GET and POST
- Direct reads this session of: `src/types/facilities.ts`, `src/lib/facilities/facility-slots.ts`, `src/lib/facilities/facility-catalog.ts`, `src/lib/facilities/facility-claims.ts`, `src/lib/facilities/facility-approvals.ts`, `src/lib/facilities/facility-schedules.ts`, `src/lib/facilities/facility-access.ts`, `src/lib/facilities/facility-picker.ts`, `src/lib/api/response.ts`, `src/lib/api/errors.ts`, all four `src/app/api/facilities/*/route.ts`, `src/app/dashboard/facilities/{page,admin/page,guide/page}.tsx`, `src/components/facilities/{day-detail-panel,facility-type-badges,schedule-slot-dialog}.tsx`, `tests/fixtures/seed.sql`, `tests/fixtures/personas.ts`, `tests/integration/routes/facilities.test.ts`, `tests/integration/helpers.ts`, `tests/integration/harness.sql`, `Makefile`, `.github/actions/setup-test-stack/action.yml`, and every unit/component test file in the Test File Inventory table

### Secondary (MEDIUM confidence)
- `/supabase/postgrest-js` (Context7) — confirms `.rpc()` returns a `PostgrestFilterBuilder` on which general filters (`.eq`, `.neq`, etc.) are documented as chainable
- `/supabase/supabase-js` (Context7, source snippets) — confirms the default `.rpc()` HTTP method is POST unless `{ get: true }` is passed, and that query-string filters are appended to the URL independently of the POST body

### Tertiary (LOW confidence)
- None used for this research — the phase's scope (in-repo removal) meant almost everything was verifiable by direct source read rather than external search.

## Metadata

**Confidence breakdown:**
- Standard stack: N/A - no new dependencies; existing stack confirmed via direct file reads
- Architecture: HIGH - every claim about current code structure is a direct read from this session, not inference
- Pitfalls: HIGH - Pitfall 1 and 2 are both derived from direct reads of `seed.sql`/`facilities.test.ts`/test files, not speculation
- D-02 RPC-filter claim: HIGH via official PostgREST documentation, but not runtime-verified against this repo's actual `facility_slots()` definition (submodule unavailable this session) — hence logged as Assumption A1 with a zero-cost fallback

**Research date:** 2026-09-04
**Valid until:** No expiry driver identified — this is an in-repo code-removal phase with no external API/library version dependency that would go stale; safe to treat as valid until the phase is planned and executed (should be days, not the typical 30-day window)
