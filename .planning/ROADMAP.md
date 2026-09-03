# Roadmap: Sheares Intranet — REBOKS decoupling

## Overview

One phase: take REBOKS (NUS court) booking out of the Sheares intranet so the facilities feature only books hall-owned venues. Where REBOKS booking lives next is a separate, undecided milestone.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

- [ ] **Phase 1: Decouple REBOKS booking from intranet** - Remove REBOKS venues, slots, claims, horizon logic and copy from the facilities feature, app-side only (SHW-22 / SHW-25)

## Phase Details

### Phase 1: Decouple REBOKS booking from intranet
**Goal**: The intranet facilities feature books only Sheares-managed venues. REBOKS courts are neither visible nor claimable by chairs, JCRC approval views carry no REBOKS claims, and the REBOKS-only horizon logic and copy are gone — without any change to the `vendor/intranet` schema.
**Depends on**: Nothing (first phase)
**Requirements**: REBOK-01, REBOK-02, REBOK-03, REBOK-04, REBOK-05, REBOK-06
**Approach** (locked, see `phases/01-decouple-reboks-booking-from-intranet/01-CONTEXT.md`): exclude REBOKS at the three server-side reads in `src/lib/facilities/` so every consumer inherits it; replace the claims horizon check with a bookable-type check; delete horizon helpers, notice, JCRC-only slots branch, and redundant UI filters. No feature flag.
**Canonical refs**: `phases/01-decouple-reboks-booking-from-intranet/01-CONTEXT.md`, `REQUIREMENTS.md`, `codebase/ARCHITECTURE.md`, `codebase/TESTING.md`
**Success Criteria** (what must be TRUE):
  1. A chair opening `/dashboard/facilities` sees no REBOKS venues, slots, filters, or badges, and the "courts secured a month at a time" notice never renders.
  2. `GET /api/facilities/catalog` and `GET /api/facilities/slots` never return a `reboks` facility, and `POST /api/facilities/claims` on a REBOKS facility returns a 4xx error.
  3. JCRC approval and confirmed-booking lists contain no REBOKS claims; the admin page and schedule editor still exclude REBOKS venues.
  4. `make check` (format, typecheck, unit + component tests) passes, and the facilities integration suite passes against a seeded DB that still contains REBOKS rows.
  5. No file under `vendor/intranet` or any migration is required for the above.
  6. After the change, no file under `src/components/` or `src/app/dashboard/` references `reboks` or any horizon helper; the only REBOKS-aware code is the exclusion in `src/lib/facilities/` and `src/types/facilities.ts`, and the diff removes more lines than it adds.
**Plans**: 4 plans

Plans:
- [ ] 01-01-PLAN.md — Tracer slice plus the data-boundary cut: shared bookable-type predicate, three excluding lib reads, claims-POST type gate, horizon concept deleted (wave 1)
- [ ] 01-02-PLAN.md — One venue-type array instead of four, redundant UI filters and guide copy removed, component and lib test fixtures cleared (wave 2)
- [ ] 01-03-PLAN.md — Integration coverage: parameterized facility factory plus an end-to-end case against real Postgres and PostgREST (wave 2)
- [ ] 01-04-PLAN.md — Audit against success criteria 4, 5 and 6: grep gates, diff line-count, `make check`, manual observations (wave 3)
