# 03 — Member Ranking Refactor Plan

## 1. Goal & scope

This plan migrates the **member-ranking** API surface from the legacy `cca_member_rankings` table to the new `cca_appointment_evaluations` table (which stores a single `scores` JSONB rubric per appointment) so chair/manager-facing ranking flows continue working under the overhauled schema. In scope: the `cca/[ccaId]/rankings` GET + POST route, the cross-CCA listing route, the feature-local helper `ranking-route.ts`, the ranking API types, the rankings-route vitest, and the (now-obsolete) atomic-save RPC from Phase 04-05. Out of scope: CCA membership CRUD (`updateMember`, `addMember`, `removeMember`, `members`), CCA allocation / position-preference flows (`/api/user/saveRankings`, `/api/user/getRankablePositions/...`), and auth/user routes — those are handled by sibling plans 02 and 04. Note that `/api/user/saveRankings` and `/api/user/getRankablePositions/[email]/route.ts` were originally listed in this domain's scope, but they target `user_cca_applications` (allocation preferences), not `cca_member_rankings`; this plan covers only the rename of the existing `replace_user_cca_rankings` RPC artifact and flags the rest as a cross-domain dependency on plan 04.

## 2. Files in scope

API routes (read + write):
- `/Users/bytedance/intranet-next-app/src/app/api/cca/[ccaId]/rankings/route.ts` — GET (load members + rankings), POST (upsert rankings).
- `/Users/bytedance/intranet-next-app/src/app/api/cca/rankings/all/route.ts` — cross-CCA listing for ranking dashboard (no direct legacy table reference today, but verified for compatibility).

Feature helpers and types:
- `/Users/bytedance/intranet-next-app/src/features/ranking/utils/ranking-route.ts` — `loadCcaContext`, `loadManagedRankingAccess`, `mapRankingResponseMembers`, `buildRankingsUpsertPayloads`.
- `/Users/bytedance/intranet-next-app/src/features/ranking/utils/ranking-route.test.ts` — vitest fixtures for the helpers.
- `/Users/bytedance/intranet-next-app/src/features/ranking/utils/cca-ranking-comments.ts` — `buildRankingComments` / `extractRankingCommentFields` (rubric serializer; the legacy "comments" JSONB IS the new `scores` JSONB — see §3).
- `/Users/bytedance/intranet-next-app/src/features/ranking/types/ranking-api.ts` — `RankingRow`, `AppointmentRow`, `RankingPayload`, `RankingResponseMember`.
- `/Users/bytedance/intranet-next-app/src/features/ranking/types/ranking.ts` — `CCAMember`, `RankingSavePayload` (UI-facing; expected to remain mostly stable).

Atomic-save artifact carried from Phase 04-05 (legacy; not member-ranking but listed in domain scope):
- `/Users/bytedance/intranet-next-app/db/changelog/04-member-ranking-replace-user-cca-rankings.sql` — targets `user_cca_applications`, a table that no longer exists. Tracked here for deletion / hand-off to plan 04 only.

Out-of-scope but coupled (flagged for sibling plans):
- `/Users/bytedance/intranet-next-app/src/app/api/cca/[ccaId]/updateMember/route.ts` — owned by plan 02 (CCA management); contains a parallel `.upsert(..., { onConflict: "user_id, position_id" }).from("cca_member_rankings")` call that must be rewritten in lock-step.
- `/Users/bytedance/intranet-next-app/src/app/api/user/saveRankings/route.ts` and `/Users/bytedance/intranet-next-app/src/app/api/user/getRankablePositions/[email]/route.ts` — owned by plan 04 (allocation / preferences). Both reference `user_cca_applications` / `cca_capacity_info`, neither of which has been renamed to anything in the evaluations table.

## 3. Schema mapping

**Source of truth:** `/Users/bytedance/intranet/db/changelogs/table/evaluations/01.cca-appointment-evaluations.sql` (wiki page `wiki/entity/table/public.cca_appointment_evaluations.md` is `seed` and references this SQL). The wiki domain page `wiki/domain/member-ranking.md` still names the legacy table (`cca_member_rankings`); treat the SQL as authoritative.

Legacy table (current code) → new table:

| Legacy `cca_member_rankings` column | New location | Notes |
|---|---|---|
| `user_id` INT (composite key) | `cca_appointment_evaluations.user_id` INT | FK now points at `cca_appointments(user_id, position_id)` composite (with `ON UPDATE CASCADE ON DELETE CASCADE`). |
| `position_id` INT (composite key) | `cca_appointment_evaluations.position_id` INT | Same; composite UNIQUE `(user_id, position_id)`. |
| `ranking` INT | `cca_appointment_evaluations.scores->>'ranking'` (numeric inside `scores` JSONB) | **No dedicated column.** The new `scores` JSONB MUST contain the integer rank — put it under the same `ranking` key the helpers currently emit. CHECK constraint requires `jsonb_typeof(scores)='object'` AND `scores <> '{}'`. |
| `comments` JSONB (held rubric metrics: `attendance`, `performance`, `helpfulness`, `initiative`, `attitude`, `remarks`) | Merged into `cca_appointment_evaluations.scores` JSONB | The same JSON object now holds both `ranking` and the rubric metric keys. `buildRankingComments(...)` already returns the rubric subset — the migration is to merge `{ ranking }` into that object before upserting. |
| `cut_status` (only referenced via the joined `cca_appointments.cut_status`) | `cca_appointments.cut_status` enum.cut_status (unchanged) | The `cut_status` column has NOT moved; it lives on the appointment row, not on the evaluation row. Reading uses the `cca_appointments` row from the existing GET join. |
| `updated_at` | `cca_appointment_evaluations.updated_at` (BEFORE UPDATE trigger `set_cca_appointment_evaluations_updated_at` calls `internal.set_updated_at()`) | Application code should NOT set this manually — see `updateMember/route.ts` for an existing manual `updated_at` that should be dropped. |

Confirmed enum values (cite `wiki/entity/enum/enum.cut_status.md`): `ivp-ihg-team`, `ihg-team`, `final-cut`, `first-cut`. The current normalizer `normalizeCutStatusForCca` in `/Users/bytedance/intranet-next-app/src/features/cca/utils/cca-cut-status.ts` and the editor's `formatCutStatus` in `ranking-editor.ts` are aligned with these values; no enum drift.

Confirmed `cca_appointments` columns (cite SQL `db/changelogs/table/core/05.cca-appointment.sql`, line 5–19): `user_id`, `position_id`, `created_at`, `updated_at`, `points`, `commitment_period`, `cut_status`. **There is NO `comments` column on `cca_appointments`** (the wiki page `wiki/entity/table/public.cca_appointments.md` lists one but the changelog SQL does not). Any code that writes `comments` directly to `cca_appointments` (e.g. `updateMember/route.ts` line 111) will fail; see §8 open question.

Confirmed selectable join target for member display: `public_user_info(id, name, profile_photo_path)` from `wiki/entity/view/public.public_user_info.md` (security_invoker view; GRANT SELECT TO anon, authenticated). Currently selected as `public_user_info!inner(name)` — still valid.

## 4. Authorization / RLS impact

The legacy domain page (`wiki/domain/member-ranking.md`) cites `internal.can_view_cca_member_rankings`; **that function does not exist in the new schema** (verified by `grep -rn can_view_cca_member_rankings /Users/bytedance/intranet/db/` — zero hits). RLS on `cca_appointment_evaluations` is enforced by `internal.can_manage_cca_appointments(position_id, internal.auth_user_id())` for every operation (cite `db/changelogs/security/evaluations/01.cca-appointment-evaluations.sql`):

- SELECT: `USING (internal.can_manage_cca_appointments(position_id, internal.auth_user_id()))`
- INSERT: `WITH CHECK (...same...)`
- UPDATE: `USING (...) WITH CHECK (...)`
- DELETE: `USING (...)`

`internal.can_manage_cca_appointments` (cite `db/changelogs/function/core/05.can-manage-cca-appointments.sql`) returns TRUE only when the caller holds an appointment that sits upstream in the `cca_positions.reporting_position` chain (depth ≤ 10) of the target `position_id`. **Members can no longer SELECT their own evaluations via the table directly** — under the new RLS, only chain-of-managers can read. The current application-layer view-only path goes through the `appointments` JSON in `authenticated_user_info` (which exposes `points`, `commitment_period`, `cut_status` but NOT rubric scores). This is a behaviour change but is invisible to the API routes in this plan, which already restrict access via `getManagedCcaAccess(..., accessLevel: "rank_members")`.

`validate_cca_appointment_after_write` (cite `db/changelogs/security/core/05.cca-appointment.sql` lines 132–137) is a DEFERRED constraint trigger on `cca_appointments` (NOT on the evaluations table). It enforces (a) one non-resident position per CCA period per user, and (b) `cap city` headcount limits. **This trigger is unrelated to evaluations** but matters when `updateMember/route.ts` (out-of-scope, plan 02) mutates appointment rows. No impact on the rankings GET/POST routes which do not insert appointments.

Chair access via `managed_cca_positions` view (cite `db/changelogs/view/core/04.managed-cca-positions.sql`) — `security_invoker = on`, returns `cca_id`, `cca_name`, and a `positions` JSON aggregate of `{position_id, position_name, position_type, description, access_depth}`. The existing helper `getManagedCcaAccess` in `src/features/cca/utils/cca-management-access.ts` reads this view and filters to `managedPositionIds`. **No code change needed for managed-CCA access.**

Application-layer access (cite `wiki/convention/rbac.md` capability matrix): "Submit ranking for own CCA" requires Chair (lead/vice) **or** `is_culture_sports_admin` **or** `is_admin`. The current `feature-flags` gate (`getCoreServiceDisabledApiResponse("memberRanking", { isJcrc })`) is orthogonal and stays.

## 5. Atomic save concern

Phase 04-05 introduced `db/changelog/04-member-ranking-replace-user-cca-rankings.sql` and a `supabase.rpc("replace_user_cca_rankings", ...)` call **for the allocation preference save flow** (`/api/user/saveRankings/route.ts`) — it operates on `user_cca_applications`, NOT on `cca_member_rankings`/`cca_appointment_evaluations`. The chair-side ranking save in `/api/cca/[ccaId]/rankings/route.ts` (POST) has always been a non-RPC `.upsert(..., { onConflict: "user_id, position_id" })` and was never wrapped by 04-05.

Implications for this plan:

- The 04-05 RPC (`public.replace_user_cca_rankings`) targets a table (`user_cca_applications`) that does not appear in the new schema. The artifact must either be deleted or rewritten by plan 04 (allocation). This plan only flags it.
- For chair-side ranking persistence, the new `cca_appointment_evaluations` table supports the same `onConflict: "user_id, position_id"` upsert semantics (the table has the matching UNIQUE constraint `cca_appointment_evaluations_appointment_unique`). A direct `.upsert(...)` call is still safe.
- The single-statement upsert is itself atomic at the row level. If, in the future, multi-row writes need true transactional batching, a new `public.upsert_cca_appointment_evaluations(p_user_id, p_position_id, p_scores)` RPC could be added — but no such RPC is defined in the changelog today, and this plan does NOT introduce one. The existing `.upsert(rows, { onConflict: ... })` call from supabase-js is the path forward.

## 6. Tasks

Each task targets a single file/concern. Apply in listed order; verification commands sit in §7.

### Task 1 — Rewrite the rankings POST upsert site to `cca_appointment_evaluations`

- [ ] Edit `/Users/bytedance/intranet-next-app/src/app/api/cca/[ccaId]/rankings/route.ts`:
  - [ ] Replace `supabase.from("cca_member_rankings").upsert(rankingsToUpsert, { onConflict: "user_id, position_id" })` (lines 171–173) with `supabase.from("cca_appointment_evaluations").upsert(rankingsToUpsert, { onConflict: "user_id, position_id" })`.
  - [ ] No change to `rankingsToUpsert` shape at this layer — the per-row payload reshape happens in Task 2.

Before:

```ts
const { error } = await supabase
    .from("cca_member_rankings")
    .upsert(rankingsToUpsert, { onConflict: "user_id, position_id" });
```

After:

```ts
const { error } = await supabase
    .from("cca_appointment_evaluations")
    .upsert(rankingsToUpsert, { onConflict: "user_id, position_id" });
```

- [ ] Verify with `npm run build` (TypeScript should not block; supabase-js is untyped at the table level).
- [ ] Manual smoke: chair saves rankings on `/dashboard/mycca/admin/rankMembers/[ccaName]` and the call returns `200 { success: true }`.

### Task 2 — Reshape upsert payload: write `{user_id, position_id, scores}` instead of `{user_id, position_id, ranking, comments}`

- [ ] Edit `/Users/bytedance/intranet-next-app/src/features/ranking/utils/ranking-route.ts`, function `buildRankingsUpsertPayloads` (lines 187–251):
  - [ ] Replace the return-object construction (lines 244–250) so the payload writes a single `scores` object containing the ranking + rubric metrics + remarks.
  - [ ] The `comments` (rubric) builder must be merged with `{ ranking }` into one JSONB.
  - [ ] Drop the top-level `ranking` and `comments` keys.

Before (lines 217–250):

```ts
.map((ranking) => {
    const positionType = positionTypeById.get(ranking.position_id);
    const rankingMetricKeys = getRankingMetricKeys({ ccaType, positionType });
    const normalizedPerformance =
        ccaType !== "sports"
            ? ranking.performance
            : ranking.performance > 0 ? ranking.performance : ranking.attendance;
    const comments = isResidentPositionType(positionType)
        ? buildRankingComments({
                helpfulness: ranking.helpfulness,
                initiative: ranking.initiative,
                attitude: ranking.attitude,
                remarks: ranking.remarks,
            })
        : buildRankingComments({
                attendance: ranking.attendance,
                performance: rankingMetricKeys.includes("performance")
                    ? ranking.performance
                    : normalizedPerformance,
                remarks: ranking.remarks,
            });

    return {
        user_id: ranking.user_id,
        position_id: ranking.position_id,
        ranking: ranking.ranking,
        comments,
    };
});
```

After:

```ts
.map((ranking) => {
    const positionType = positionTypeById.get(ranking.position_id);
    const rankingMetricKeys = getRankingMetricKeys({ ccaType, positionType });
    const normalizedPerformance =
        ccaType !== "sports"
            ? ranking.performance
            : ranking.performance > 0 ? ranking.performance : ranking.attendance;
    const rubric = isResidentPositionType(positionType)
        ? buildRankingComments({
                helpfulness: ranking.helpfulness,
                initiative: ranking.initiative,
                attitude: ranking.attitude,
                remarks: ranking.remarks,
            })
        : buildRankingComments({
                attendance: ranking.attendance,
                performance: rankingMetricKeys.includes("performance")
                    ? ranking.performance
                    : normalizedPerformance,
                remarks: ranking.remarks,
            });

    return {
        user_id: ranking.user_id,
        position_id: ranking.position_id,
        scores: { ranking: ranking.ranking, ...rubric },
    };
});
```

- [ ] Update the existing vitest at `/Users/bytedance/intranet-next-app/src/features/ranking/utils/ranking-route.test.ts` lines 84–141 ("filters out disallowed positions...") to assert the new payload shape (`scores: { ranking: 1, attendance: 8, performance: 7, remarks: "ready" }` instead of `ranking: 1, comments: { ... }`).
- [ ] Confirm `scores` is never `{}` — the test must include an assertion that resident positions always emit at least one rubric key (CHECK constraint: `jsonb_typeof(scores)='object' AND scores <> '{}'`).

### Task 3 — Rewrite the rankings GET select to read from `cca_appointment_evaluations.scores`

- [ ] Edit `/Users/bytedance/intranet-next-app/src/app/api/cca/[ccaId]/rankings/route.ts` lines 92–96:
  - [ ] Replace the `cca_member_rankings` table name with `cca_appointment_evaluations`.
  - [ ] Replace the column projection `"user_id, position_id, ranking, comments"` with `"user_id, position_id, scores"`.

Before:

```ts
const { data: rankings, error: rankingsError } = await supabase
    .from("cca_member_rankings")
    .select("user_id, position_id, ranking, comments")
    .in("position_id", positionIds)
    .in("user_id", userIds);
```

After:

```ts
const { data: rankings, error: rankingsError } = await supabase
    .from("cca_appointment_evaluations")
    .select("user_id, position_id, scores")
    .in("position_id", positionIds)
    .in("user_id", userIds);
```

- [ ] Verify with the helper test once Task 4 lands.

### Task 4 — Adjust `mapRankingResponseMembers` to parse `scores` JSONB

- [ ] Edit `/Users/bytedance/intranet-next-app/src/features/ranking/utils/ranking-route.ts`, function `mapRankingResponseMembers` (lines 84–185):
  - [ ] Source the per-row `ranking` value from `scores.ranking` (numeric) instead of the legacy top-level `ranking` column.
  - [ ] Continue passing the same JSONB into `extractRankingCommentFields(...)` — it already handles `attendance / performance / helpfulness / initiative / attitude / remarks` keys, all of which live inside `scores`. The same call works because the rubric keys are at the top level of `scores` (alongside `ranking`).

Before (line 123–134):

```ts
rankings?.forEach((ranking) => {
    const parsedComments = extractRankingCommentFields(ranking.comments);
    rankingsMap.set(`${ranking.user_id}:${ranking.position_id}`, {
        ranking: ranking.ranking,
        attendance: parsedComments.attendance,
        ...
    });
});
```

After:

```ts
rankings?.forEach((row) => {
    const parsedScores = extractRankingCommentFields(row.scores);
    const rankingValue =
        row.scores && typeof row.scores === "object" && !Array.isArray(row.scores)
            ? (() => {
                  const v = (row.scores as Record<string, unknown>).ranking;
                  return typeof v === "number" && Number.isFinite(v) ? v : null;
              })()
            : null;
    rankingsMap.set(`${row.user_id}:${row.position_id}`, {
        ranking: rankingValue,
        attendance: parsedScores.attendance,
        performance: parsedScores.performance,
        helpfulness: parsedScores.helpfulness,
        initiative: parsedScores.initiative,
        attitude: parsedScores.attitude,
        remarks: parsedScores.remarks,
    });
});
```

- [ ] No change to the downstream `scopedMembers` map / sort / filter logic (lines 136–183).
- [ ] Update vitest at lines 13–82 ("normalizes joined rows..."): the `rankings: RankingRow[]` fixture should use `scores: { ranking: 1, attendance: 8, performance: 7, remarks: "steady" }` instead of `ranking: 1, comments: { ... }`.

### Task 5 — Update `RankingRow` type to reflect the new column

- [ ] Edit `/Users/bytedance/intranet-next-app/src/features/ranking/types/ranking-api.ts` lines 24–29:
  - [ ] Replace the legacy `RankingRow` with the new shape.

Before:

```ts
export type RankingRow = {
    user_id: number;
    position_id: number;
    ranking: number | null;
    comments: unknown | null;
};
```

After:

```ts
export type RankingRow = {
    user_id: number;
    position_id: number;
    scores: unknown | null;
};
```

- [ ] Grep for other consumers: `grep -rn "RankingRow" src/` — confirmed only `ranking-route.ts` and `rankings/route.ts` import this type.
- [ ] Verify with `npm run build` — TS errors will pinpoint any stragglers.

### Task 6 — Confirm the `cca/rankings/all` listing route requires no schema change

- [ ] Read `/Users/bytedance/intranet-next-app/src/app/api/cca/rankings/all/route.ts` (already inspected; 35 lines).
- [ ] Confirm it only reads `managed_cca_positions` via `getManagedCcaData(...)` and the `ccas` table — both unchanged in the new schema (cite `wiki/entity/view/public.managed_cca_positions.md` and `wiki/entity/table/public.ccas.md`).
- [ ] No code change required; document as "verified, no change" in the verification log.

### Task 7 — Decommission / hand off the Phase 04-05 atomic-save artifact

- [ ] The file `/Users/bytedance/intranet-next-app/db/changelog/04-member-ranking-replace-user-cca-rankings.sql` defines `public.replace_user_cca_rankings` against `public.user_cca_applications`. That table is gone from the new schema.
- [ ] Hand off to plan 04 (CCA allocation): the allocation domain owns `user_cca_applications` → presumably `cca_user_preferences` or `cca_position_preferences` (per `CONTEXT.md` §"New schema landscape"). Plan 04 must decide whether to delete the file outright or rewrite it as `replace_user_cca_position_preferences` against the new table.
- [ ] Do not delete or modify the file in this plan. Note the hand-off in the cross-domain section of plan 04.

### Task 8 — Flag the parallel `updateMember` upsert for plan 02

- [ ] `/Users/bytedance/intranet-next-app/src/app/api/cca/[ccaId]/updateMember/route.ts` lines 162–164 contain an identical `supabase.from("cca_member_rankings").upsert(...)` call. **Do not edit** — owned by plan 02 (CCA management).
- [ ] Provide the exact replacement snippet to plan 02 for inclusion. The migration is the same as Task 1 + Task 2 above: change the table to `cca_appointment_evaluations`; merge `{ ranking, ...rubric }` into `scores`; drop the manual `updated_at: new Date().toISOString()` field (the BEFORE UPDATE trigger `set_cca_appointment_evaluations_updated_at` already handles it).
- [ ] Additionally flag for plan 02: the `comments` field passed to `.from("cca_appointments").update({ comments })` at line 111 references a column that does NOT exist on the new `cca_appointments` table (changelog confirms only `user_id, position_id, created_at, updated_at, points, commitment_period, cut_status`). Plan 02 must either drop the comments update or migrate that field into `scores.remarks`.

## 7. Verification

Run after Tasks 1–6 are complete:

- [ ] `npx vitest run src/features/ranking/utils/ranking-route.test.ts` — passes with the new `scores` payload assertions.
- [ ] `npm run build` — TypeScript clean.
- [ ] `grep -rn "cca_member_rankings" /Users/bytedance/intranet-next-app/src` — should return zero hits inside the member-ranking scope (one hit may remain in `updateMember/route.ts` which is plan 02's responsibility).
- [ ] `grep -rn "from(\"cca_appointment_evaluations\")" /Users/bytedance/intranet-next-app/src/app/api/cca/[ccaId]/rankings` — both GET and POST call sites present.

Database / live verification (after the new schema is deployed):

- [ ] Connect to Supabase with a chair JWT and run `SELECT user_id, position_id, scores FROM cca_appointment_evaluations LIMIT 5;` — must succeed (RLS allows via `can_manage_cca_appointments`).
- [ ] Hit `GET /api/cca/{ccaId}/rankings` for a CCA the user chairs — response shape `{ members: [...], cca_type, cca_name }` unchanged; each member should have `ranking, attendance, performance, ...` populated (or `0` if no evaluation row exists).
- [ ] Hit `POST /api/cca/{ccaId}/rankings` with a valid payload — server returns `{ success: true }`; verify a row exists in `cca_appointment_evaluations` with the expected JSONB `scores`.
- [ ] Edge case: send a payload that would produce `scores = {}` (all rubric metrics zero) — confirm the `cca_appointment_evaluations_scores_object` CHECK constraint is triggered and the response is a 500 with a Postgres `check_violation` (`23514`) error (or update `buildRankingsUpsertPayloads` to skip the row pre-flight if §8 question 1 resolves toward "no empty rows").

## 8. Open questions

1. **Empty scores guard.** The CHECK constraint `jsonb_typeof(scores) = 'object' AND scores <> '{}'` will reject an upsert whose `scores` JSONB has no keys. `buildRankingsUpsertPayloads` currently calls `hasRequiredRankingInputs(...)` which forbids zero-valued required metrics for non-resident positions, so empty-rubric rows should never reach the upsert — but if the front-end ever passes `ranking: 0` with no rubric (e.g. resetting a row), the `scores` object collapses to `{ ranking: 0 }` (still non-empty, OK). Confirm with plan 02 that `updateMember` does NOT bypass this filter.
2. **`cca_appointments.comments` column.** Wiki page `wiki/entity/table/public.cca_appointments.md` lists a `comments TEXT` column but the changelog SQL does not create one. Either the wiki is stale or the column was added by a downstream changelog not yet read. Plan 02 (CCA management) needs to resolve before refactoring `updateMember/route.ts`. **Cross-domain.**
3. **Read access for non-managers.** The new RLS on `cca_appointment_evaluations` restricts SELECT to chain-of-managers only. There is currently no route in scope that lets a regular member read their own rubric — only the `authenticated_user_info.appointments` JSON, which carries `points` and `cut_status` but NOT the rubric. If a future UI page wants to show "your scores", a new view (`public.my_appointment_evaluations` or similar) or RLS policy will be needed. Out of scope for this plan; flagged for the domain owner.
4. **`replace_user_cca_rankings` RPC fate.** The Phase 04-05 SQL artifact at `/Users/bytedance/intranet-next-app/db/changelog/04-member-ranking-replace-user-cca-rankings.sql` references the legacy `user_cca_applications` table. Plan 04 (allocation) must decide whether to (a) delete the changelog file, (b) rewrite it against the new preferences table, or (c) replace the RPC call in `saveRankings/route.ts` with a direct upsert. **Cross-domain hand-off to plan 04.**
5. **Wiki domain page drift.** `wiki/domain/member-ranking.md` and `wiki/domain/points-system.md` both still cite `cca_member_rankings` and `internal.can_view_cca_member_rankings` — neither exists in the new SQL. These pages are `seed`-status; once this refactor lands, request a wiki update so future readers see `cca_appointment_evaluations` + `internal.can_manage_cca_appointments` as the canonical names.
