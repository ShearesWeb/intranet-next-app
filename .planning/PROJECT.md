# Sheares Intranet (intranet-next-app)

## What This Is

A Next.js 15 intranet for Sheares Hall residents to manage CCAs, CCA allocation, points, and facility bookings. Backed by Supabase (Postgres + RLS, schema owned by the private `vendor/intranet` submodule), deployed to Cloudflare Workers via OpenNext.

## Core Value

Residents and CCA chairs can do hall admin in one place without any user's data leaking into another session.

## Requirements

### Validated

- Facilities booking (Sheares venues, REBOKS courts, NUS and external venues) with JCRC approval — shipped.

### Active

- [ ] REBOK-01 through REBOK-05 — decouple REBOKS booking from the intranet (see REQUIREMENTS.md).

### Out of Scope

- Where REBOKS booking moves to — deferred to a later meeting (SHW-22: "TBC"). This milestone removes it from the intranet only.
- Schema changes in `vendor/intranet` — the `facility_type` enum and `facility_single_schedules` table are owned by the schema repo and the REBOKS bot; the app must decouple without requiring a DB migration.
- Booking priority system (SHW-24) — separate issue.

## Context

- Linear: SHW-22 (assigned to Kaleb) and SHW-25 (unassigned, due 2026-09-17) both describe this work. SHW-25 wording: "only things that can be booked on intranet is sheares facilities like comm hall etc".
- `FacilityType` is `"sheares" | "reboks" | "nus" | "external"`. REBOKS venues are bot-owned (read-only single-date schedules written by the REBOKS booking bot), gated by a month-at-a-time booking horizon, and already hidden from the JCRC admin/schedule editor.
- Codebase maps live in `.planning/codebase/`.

## Constraints

- **Tech stack**: Next.js 15 App Router, Supabase via `@supabase/ssr`, Vitest, Bun — no new frameworks.
- **Schema**: `vendor/intranet` submodule is not checked out locally; integration tests need `make db-up` and Docker. Do not assume enum values can be dropped.
- **Deploy**: CI only. Feature flags are compile-time constants in `src/lib/feature-flags.ts`.
- **Session isolation**: no user data may leak between sessions.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Decouple REBOKS app-side, leave DB enum/table in place | Schema and bot are owned elsewhere; a DB drop is a one-way door that a "TBC" destination cannot justify yet | — Pending |
| Keep `nus` and `external` venue types bookable | Type docs say those are "the hall's own to publish"; only `reboks` is NUS-secured. Flag for confirmation if the planner finds otherwise | — Pending |
| Cut REBOKS at the server-side data boundary (`getSlots`, `listFacilities`, `getClaimsForCca`), not in the UI | The DB keeps returning REBOKS rows via `facility_slots()` and the catalog; excluding them once in `src/lib/` means every page and component inherits the cut. Net code shrinks | ✓ Locked 2026-09-04, see `phases/01-…/01-CONTEXT.md` |
| No feature flag; delete horizon logic, notice, and copy outright | A toggle keeps dead code alive for a speculative return; the surviving exclusion (a few query clauses plus one predicate) is a data filter, not a switch | ✓ Locked 2026-09-04 |
| Keep `"reboks"` in the TS `FacilityType` union | The Postgres enum still has it and rows carrying it still arrive; narrowing the type would lie to the compiler | ✓ Locked 2026-09-04 |
| Hide existing REBOKS rows in `facility_claims` from chairs and JCRC views | A booking a chair can no longer manage is more confusing shown than hidden; withdraw-by-id stays RLS-guarded | ✓ Locked 2026-09-04, cheap to reverse |

---
*Last updated: 2026-09-04 after locking the data-boundary approach for Phase 1*
