---
phase: "01"
slug: "decouple-reboks-booking-from-intranet"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-09-04"
---

# Phase 01 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.x (unit + component via `vitest.config.mts`; integration via `vitest.integration.config.mts`) |
| **Config file** | `vitest.config.mts`, `vitest.integration.config.mts` |
| **Quick run command** | `npx vitest run <changed test file>` |
| **Full suite command** | `make check` (format-check + typecheck + unit + component); integration: `make db-up && make test-integration && make db-down` |
| **Estimated runtime** | ~30 seconds for `make test`; ~90 seconds for `make check`; integration several minutes and needs Docker + `vendor/intranet` submodule (absent locally as of 2026-09-04, so integration runs in CI on the PR) |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run <the test file the task touched>`
- **After every plan wave:** Run `make check`
- **Before `/gsd-verify-work`:** `make check` green locally, and `make test-integration` green (locally if Docker + submodule are available, otherwise via `2-merge-request-ci.yml` on the PR)
- **Max feedback latency:** 90 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 01-XX-XX | — | — | REBOK-01 | — | N/A | component | `npx vitest run src/components/facilities/day-detail-panel.test.tsx src/components/facilities/facility-select.test.tsx src/lib/facilities/facility-picker.test.ts` | ✅ | ⬜ pending |
| 01-XX-XX | — | — | REBOK-02 | T-01-01 (hand-rolled REBOKS claim payload) | Claims POST reads facility type from DB via `getFacilityType` and returns 4xx for `reboks` | unit (route) + integration | `npx vitest run src/app/api/facilities/slots/route.test.ts src/app/api/facilities/claims/route.test.ts` then `make test-integration` | ✅ unit / ❌ W0 integration case | ⬜ pending |
| 01-XX-XX | — | — | REBOK-03 | — | N/A | lib + integration | `npx vitest run src/lib/facilities` and the new REBOKS integration case | ✅ / ❌ W0 | ⬜ pending |
| 01-XX-XX | — | — | REBOK-04 | — | N/A | unit + full | `npx vitest run src/types/facilities.test.ts` then `make check` | ✅ | ⬜ pending |
| 01-XX-XX | — | — | REBOK-05 | — | N/A | integration | `make test-integration` including the new REBOKS-row case | ❌ W0 | ⬜ pending |
| 01-XX-XX | — | — | REBOK-06 | — | N/A | static audit | `grep -rn -i "reboks\|bookingHorizonEnd\|isBeyondBookingHorizon\|isHorizonRestricted\|horizonOpensOn\|showHorizonNotice" src/components src/app/dashboard` exits 1; `git diff --shortstat main` shows deletions > insertions | N/A | ⬜ pending |

*Task IDs are filled in by the planner; the rows above are the requirement-to-command seed from RESEARCH.md §Validation Architecture.*

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/integration/routes/facilities.test.ts` — parameterize the `createFacility()` helper with a `type` argument (currently hardcoded to `'nus'`)
- [ ] `tests/integration/routes/facilities.test.ts` — new REBOKS-row case: create a `type='reboks'` facility, publish a schedule, assert it is absent from `GET /api/facilities/catalog` and `GET /api/facilities/slots`, and that `POST /api/facilities/claims` on it returns 4xx (covers REBOK-02, REBOK-05)

No framework install is needed; Vitest and both configs exist.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| The "REBOKS courts are secured a month at a time" notice never renders on `/dashboard/facilities` | REBOK-01, REBOK-04 | The JSX block and its `showHorizonNotice` prop are deleted, so there is no component test to write; a grep audit proves absence | `make e2e-login PERSONA=declan`, open `/dashboard/facilities`, pick any day, confirm no REBOKS venue and no horizon notice |
| Guide page no longer says Reboks slots come from the Reboks bot | REBOK-04 | Copy change with no test | Open `/dashboard/facilities/guide` and read the schedule-sources sentence |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 90s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
