---
phase: 04-member-ranking-module
plan: 05
subsystem: api
tags: [supabase, vitest, rpc, liquibase, ranking, api]
requires:
  - phase: 04-01
    provides: Ranking module foundation and feature-local types
provides:
  - Shared ranking route helpers extracted into src/features/ranking/utils/ranking-route.ts
  - RPC-backed atomic preference save replacing delete/insert sequence
  - Liquibase SQL changelog for public.replace_user_cca_rankings
affects: [rankings-api, save-rankings, atomic-save]
tech-stack:
  added: []
  patterns:
    - Feature-local route helper extraction pattern
    - Supabase RPC call replacing multi-step mutation sequence
key-files:
  created:
    - src/features/ranking/utils/ranking-route.ts
    - src/features/ranking/utils/ranking-route.test.ts
    - src/app/api/user/saveRankings/route.test.ts
    - db/changelog/04-member-ranking-replace-user-cca-rankings.sql
  modified:
    - src/app/api/cca/[ccaId]/rankings/route.ts
    - src/app/api/cca/[ccaId]/updateMember/route.ts
    - src/app/api/user/saveRankings/route.ts
key-decisions:
  - Use SECURITY INVOKER so any RLS/grants mismatch surfaces in the real-environment checkpoint rather than being silenced by DEFINER.
  - Deliver the SQL as a leaf Liquibase changelog only; the user's pipeline decides include order.
  - rankings/route.ts keeps its existing GET/POST response shapes and conflict key unchanged.
patterns-established:
  - "Route helper extraction pattern: loadCcaContext, loadManagedRankingAccess, mapRankingResponseMembers, buildRankingsUpsertPayloads in feature-local utils."
requirements-completed: [RANK-03]
duration: ~2 sessions
completed: 2026-04-29
---

# Phase 04 Plan 05: Ranking Route Cleanup and Atomic Save Summary

**Feature-local rankings route helpers and RPC-backed atomic preference save**

## Performance

- **Tasks:** 2 automated + 1 human checkpoint (pending)
- **Files modified:** 7 (4 created, 3 modified)

## Accomplishments
- Extracted `loadCcaContext`, `loadManagedRankingAccess`, `mapRankingResponseMembers`, and `buildRankingsUpsertPayloads` from the 417-line rankings route into `src/features/ranking/utils/ranking-route.ts` with 3 passing tests.
- Updated `src/app/api/cca/[ccaId]/updateMember/route.ts` to import `buildRankingComments` from the feature-local util.
- Replaced the delete/insert sequence in `saveRankings` with a single `supabase.rpc("replace_user_cca_rankings", ...)` call with 4 passing tests.
- Delivered `db/changelog/04-member-ranking-replace-user-cca-rankings.sql` using Liquibase formatted SQL with `security invoker`.

## Files Created/Modified
- `src/features/ranking/utils/ranking-route.ts` — loadCcaContext, loadManagedRankingAccess, mapRankingResponseMembers, buildRankingsUpsertPayloads.
- `src/features/ranking/utils/ranking-route.test.ts` — 3 tests for response normalization and POST payload filtering.
- `src/app/api/user/saveRankings/route.test.ts` — 4 tests for RPC name/params, 401 path, and no delete/insert.
- `db/changelog/04-member-ranking-replace-user-cca-rankings.sql` — Liquibase SQL for public.replace_user_cca_rankings with security invoker.
- `src/app/api/cca/[ccaId]/rankings/route.ts` — delegates helpers to feature-local utility.
- `src/app/api/cca/[ccaId]/updateMember/route.ts` — imports buildRankingComments from feature-local util.
- `src/app/api/user/saveRankings/route.ts` — RPC-backed save, no more delete/insert sequence.

## Decisions Made
- Used `security invoker` as specified; if the real environment surfaces RLS/grants errors, the exact error text must be captured at the checkpoint before switching approaches.
- Did not create a root Liquibase changelog; the user's pipeline integrates the leaf file.

## Deviations from Plan

None for Tasks 1 and 2. Task 3 is a blocking human checkpoint — the Liquibase migration must be applied and `/api/user/saveRankings` verified in the real Supabase environment.

## User Setup Required

**BLOCKING:** Apply `db/changelog/04-member-ranking-replace-user-cca-rankings.sql` via your existing Liquibase/Supabase pipeline, then verify `/dashboard/ccaAllocation/rank` save flow returns 200 and persists across refresh. Type `approved` to confirm, or paste the exact RPC/database error if it fails.

## Next Phase Readiness
- Phase 04 is complete after the human migration checkpoint passes.
- Phase 05 planning artifacts (05-00 through 05-09) are already written and ready to execute.

---
*Phase: 04-member-ranking-module*
*Completed (automated tasks): 2026-04-29*
