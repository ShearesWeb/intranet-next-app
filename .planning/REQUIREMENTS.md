# Requirements: Sheares Intranet — REBOKS decoupling

**Defined:** 2026-09-04
**Core Value:** Residents and CCA chairs can do hall admin in one place without any user's data leaking into another session.

## v1 Requirements

### REBOKS decoupling

- [ ] **REBOK-01**: Chairs cannot see or claim REBOKS slots anywhere in the facilities UI (calendar, day panel, facility picker, type filter, badges).
- [ ] **REBOK-02**: Facilities API routes reject or omit REBOKS: `catalog` and `slots` do not accept or return `type=reboks`; `claims` refuses a claim on a REBOKS facility with a clear error.
- [ ] **REBOK-03**: JCRC approvals and confirmed-bookings views show no REBOKS claims; the admin page and schedule editor keep excluding REBOKS venues.
- [ ] **REBOK-04**: REBOKS-specific copy and logic (booking horizon, "courts secured a month at a time" notices, guide text) are removed or no longer reachable, and unit/component/integration tests are updated so `make check` passes.
- [ ] **REBOK-05**: No schema migration is required; the app decouples purely in application code (types, lib, routes, components), and existing REBOKS rows in the DB do not break Sheares/NUS/external booking.
- [ ] **REBOK-06**: The exclusion lives at the server-side data boundary (`getSlots`, `listFacilities`, `getClaimsForCca` in `src/lib/facilities/`) plus one bookable-type check in the claims POST route. After the change no file under `src/components/` or `src/app/dashboard/` references REBOKS or a horizon helper, there is no feature flag, and the diff removes more lines than it adds.

## v2 Requirements

### REBOKS destination

- **REBOK-10**: Host REBOKS booking in a separate surface (bot-only, separate app, or re-enable in intranet) — pending a meeting decision (SHW-22 "TBC").

## Out of Scope

| Feature | Reason |
|---------|--------|
| Dropping `reboks` from the DB `facility_type` enum | Owned by `vendor/intranet` and the REBOKS bot; destination undecided |
| Booking priority system | Separate issue SHW-24 |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| REBOK-01 | Phase 1 | Pending |
| REBOK-02 | Phase 1 | Pending |
| REBOK-03 | Phase 1 | Pending |
| REBOK-04 | Phase 1 | Pending |
| REBOK-05 | Phase 1 | Pending |
| REBOK-06 | Phase 1 | Pending |

**Coverage:**
- v1 requirements: 6 total
- Mapped to phases: 6
- Unmapped: 0

---
*Requirements defined: 2026-09-04*
*Last updated: 2026-09-04 after locking the data-boundary approach (REBOK-06 added)*
