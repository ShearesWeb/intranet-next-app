# Schema Refactor — Plans Index

Five domain plans, each owning a slice of the API. Walk the plan files for full task lists; this index only records cross-domain decisions and the suggested execution order.

**Testing artifact:** [TESTING.md](TESTING.md) — end-to-end test plan covering every behavioral change, formatted for Puppeteer automation. Has DB pre-flight, test-user fixtures, per-plan test cases with URLs / network / DOM / failure modes, and a coverage matrix tying each test back to a plan task.

## Plans

| # | Plan | Tasks | Owns |
|---|------|------:|------|
| 01 | [Auth & User](01-PLAN-auth-and-user.md) | 7 | `api/user/{route,checkRole,search,getCCAs,getManagedCCAs}`, `fetch-user-info.ts`, `types/User.ts`, auth callback |
| 02 | [CCA Model & Membership](02-PLAN-cca-model-and-management.md) | 11 | `api/cca/[ccaId]/{members,addMember,removeMember,updateMember,searchUsers}`, `managedPositions`, `managed-cca-data.ts`, chair/management access helpers |
| 03 | [Member Ranking](03-PLAN-member-ranking.md) | 8 | `api/cca/[ccaId]/rankings`, `cca/rankings/all`, `features/ranking/*`. Migrates `cca_member_rankings` → `cca_appointment_evaluations.scores` (JSONB) |
| 04 | [CCA Allocation](04-PLAN-cca-allocation.md) | 10 | `api/chair/positions/*`, `api/sportsCulture/*`, `features/allocation/*`. Migrates to `cca_position_availability` + `cca_{user,position}_preferences` |
| 05 | [Holiday Subsidy](05-PLAN-holiday-subsidy.md) | 10 | `api/holidaySubsidy/*`, `features/holiday-subsidy/*`. Migrates to `cca_subsidies`/`cca_user_subsidies` + `approve_*`/`upsert_*` RPCs |

## Route-ownership reassignments (resolved by subagent consensus)

My initial dispatch guessed wrong on two routes; both subagents 03 and 04 agreed where they belong:

| Route | Original assignment | Final owner | Why |
|-------|---------------------|-------------|-----|
| `api/user/saveRankings` | 03 | **04** | Writes user-side allocation preferences (legacy `user_cca_applications`), not member evaluations |
| `api/user/getRankablePositions/[email]` | 01 | **04** | Reads `cca_capacity_info`/`user_cca_applications` for allocation; feeds `useRankablePositions` |

Plan files reflect this. The route names are historically misleading — "rankings" in this app means *two different things* depending on the URL prefix.

## Cross-domain handoffs (must land together)

1. **`cca_member_rankings` removal vs add** — Plan 02 deletes the legacy ranking upsert from `updateMember/route.ts`; plan 03 introduces the new `cca_appointment_evaluations.scores` upsert. If plan 02 ships first, member evaluations cannot be saved through any route. **Order: 03 before 02**, or land both in the same PR. (Both plans flag this.)

2. **`public_user_info` → `authenticated_user_directory`** — same swap is required by plan 01 (`api/user/search`), plan 04 (`api/chair/positions/forChair`), and plan 05 (`api/holidaySubsidy/approvals/[ccaId]`). Either extract a shared helper in plan 01 or coordinate timing.

3. **`cca_appointments` no longer has `cca_id`** — plan 05 flagged; plan 02 owns the canonical join shape (`cca_appointments → cca_positions.cca_id`). Plan 02 should publish the join pattern early.

4. **`replace_user_cca_rankings` RPC (from Phase 04-05)** is orphaned by the schema change. Plan 03 flags it for deletion; plan 04 must replace the call site with the new `upsert_cca_user_preference` RPC.

## Product decisions (resolved 2026-05-18)

| Decision | Outcome | Plan impact |
|---|---|---|
| sportsCulture apply behavior | **Preserve instant-appointment**. Calls a new `SECURITY DEFINER` RPC instead of pivoting to preferences. | Plan 04 §3 + Task F rewritten; `MIGRATIONS.md` §1 lists the RPC requirements. |
| Holiday subsidy dropped fields | **Restore all three**: per-user `hours` override, per-user `comments`, per-envelope `justification`. | Plan 05 amendments at the top; tasks 5.1/5.3/5.6/5.7/5.8/5.10 keep the fields. `MIGRATIONS.md` §3, §4, §5 list the column adds. |
| Chair authorization scope | **Widen to match DB.** App helper calls a public RPC wrapper instead of relying on `lead`/`vice` predicate. | Plan 02 §4.1 + Task 7 rewritten; `MIGRATIONS.md` §2 lists the wrappers. |
| Member rubric self-read | **No change.** Members continue to see only `points` + `cut_status`; rubric remains chair-only. | No plan changes. Plan 03 §8 Q3 still applies if appetite shifts later. |

## Still pending (informational)

These remain true regardless of the decisions above; surface them when the relevant work lands:

- **Role flags are derived, not stored** (plan 01 §3 note): `is_admin`, `is_jcrc`, `is_culture_sports_admin` are computed in `authenticated_user_roles`. Any admin tooling that expects to "flip a flag" on `users` will silently break.
- **`cca_allocation_events` audit trail is gone** with no replacement; product confirmed no successor is required (plan 04 §7 Q6, plan 02 §7).

## DB migrations — final status (2026-05-18)

DB team response is at `../intranet/docs/handoff/2026-05-18-next-app-migrations-response.md`. Summary:

| # | Request | Outcome |
|---|---|---|
| 1 | sportsCulture self-apply RPCs | **REJECTED** — DB team says self-apply is not a supported semantic. Route must be removed or repurposed. **Open product question — see below.** |
| 2 | Public `can_manage_cca_appointments` wrappers | **Shipped as specified.** Plan 02 task 7 unblocked. |
| 3 | `cca_user_subsidies.hours` | **Shipped.** Frozen post-approval (trigger raises). |
| 4 | `cca_user_subsidies.comments` | **Shipped.** Frozen post-approval. |
| 5 | `cca_subsidies.justification` + `upsert_subsidy` signature | **Shipped.** New signature: `upsert_subsidy(p_position_id, p_day, p_hours, p_justification)`. |

**Additional shipped change we didn't request:** `upsert_user_subsidy` now takes `(p_subsidy_id, p_user_id, p_hours, p_comments)`. Per-user `hours`/`comments` writes go through this RPC; direct `.update({ hours })` will not work (the trigger blocks post-approval, and the RPC normalizes empty-string comments to NULL). Plan 05 chair-side per-user write tasks must call the RPC.

## sportsCulture route decision (resolved 2026-05-18)

DB team rejected migration #1. Product chose to **remove the route entirely** rather than pivot to preferences.

- `src/app/api/sportsCulture/apply/route.ts` — deleted
- `src/app/api/sportsCulture/available/route.ts` — deleted (its only consumer was the apply UI)
- `src/types/sports-culture.ts` — deleted if no other consumers
- `<Link href="/dashboard/sportsCulture">` in dashboard — deleted (dead link; target page never existed)

Plan 04 has a new **Task K** at the top that supersedes Tasks E + F. The chair-side allocation half of plan 04 (Tasks A–D, G, H, J) proceeds unchanged.

Sports/culture member appointments are now managed exclusively by chairs/vices via the existing membership flow (plan 02 `addMember`/`updateMember`/`removeMember`).

## Suggested execution order

```
Plan 01 (auth/user)           ─── lands first (establishes contracts)
        │
        ├── Plan 02 + Plan 03 ─── land together (cca_member_rankings handoff)
        │       │
        │       └── Plan 04 ─── after 02 (depends on chair-access helpers staying consistent)
        │
        └── Plan 05 (subsidy) ─── parallel with 02–04 (no shared writes)
```

## Open product questions (across plans)

- Should `hours`/`justification`/`comments` be re-added to `cca_user_subsidies` via migration? (Plan 05 §7)
- Is the user-visible shift from "apply → joined" to "apply → preference → allocated" intentional? (Plan 04 §7)
- Should `position_type` and `cca_type` TypeScript unions be tightened against the deployed enum values? Wiki enum pages are still `seed`. (Plans 01 §7, 02 §7)
