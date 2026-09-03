---
gsd_state_version: 1.0
current_phase: 1
current_phase_name: Decouple REBOKS booking from intranet
status: planning
stopped_at: Phase 1 CONTEXT.md written; discuss-phase is done, next step is `/gsd-plan-phase 1` (research + plan)
last_updated: "2026-09-03T18:56:08.416Z"
last_activity: 2026-09-04
last_activity_desc: Locked the data-boundary approach; wrote `phases/01-decouple-reboks-booking-from-intranet/01-CONTEXT.md`
state_head: 689785f49935fe9800a87a24e1afd2ea443e3a44
progress:
  total_phases: 1
  completed_phases: 0
  total_plans: 4
  completed_plans: 0
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-09-04)

**Core value:** Residents and CCA chairs can do hall admin in one place without any user's data leaking into another session.
**Current focus:** Phase 1 — Decouple REBOKS booking from intranet

## Current Position

Phase: 1 (Decouple REBOKS booking from intranet) — READY TO EXECUTE
Plan: 0 of 0 in current phase
Status: Context gathered — ready for research and planning (`/gsd-plan-phase 1`)
Last activity: 2026-09-04 — Locked the data-boundary approach; wrote `phases/01-decouple-reboks-booking-from-intranet/01-CONTEXT.md`

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

**Velocity:**

- Total plans completed: 0
- Average duration: -
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

**Recent Trend:**

- Last 5 plans: -
- Trend: -

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Phase 1: app-side decoupling only; DB enum and REBOKS tables stay.
- Phase 1: `nus` and `external` venue types stay bookable unless research contradicts.
- Phase 1: cut REBOKS at the server-side data boundary (three reads in `src/lib/facilities/`), no feature flag, delete horizon logic outright, keep `"reboks"` in the TS union, hide existing REBOKS claims. Full decision list D-01..D-14 in `01-CONTEXT.md`.
- Research question for the planner: does `supabase.rpc("facility_slots", …).neq("type", "reboks")` work against the local PostgREST sidecar? If not, filter in JS inside `getSlots`.

### Pending Todos

None yet.

### Blockers/Concerns

- `vendor/intranet` submodule is not initialized locally; integration tests need `git submodule update --init --recursive` + Docker.
- REBOKS destination undecided (SHW-22 "TBC") — do not build a replacement.

## Deferred Items

| Category | Item | Status | Deferred At | Milestone |
|----------|------|--------|-------------|-----------|
| *(none)* | | | | |

## Session Continuity

Last session: 2026-09-04
Stopped at: Phase 1 CONTEXT.md written; discuss-phase is done, next step is `/gsd-plan-phase 1` (research + plan)
Resume file: None
