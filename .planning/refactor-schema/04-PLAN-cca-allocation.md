# 04 — Plan: CCA Allocation domain schema alignment

> **Plan amendments (2026-05-18, post DB migration response)** — read these before executing tasks below.
>
> **sportsCulture removal supersedes Tasks E, F, I and the §3 sportsCulture mappings.** The DB team rejected migration #1 (see `MIGRATIONS.md` §1 and `../intranet/docs/handoff/2026-05-18-next-app-migrations-response.md`). Product chose to **remove the route entirely** rather than pivot to preferences.
>
> Concretely:
> - Delete `src/app/api/sportsCulture/apply/route.ts` (POST + DELETE handlers).
> - Delete `src/app/api/sportsCulture/available/route.ts` (its only consumer was the apply UX, which is going away).
> - Delete `src/types/sports-culture.ts` if no remaining consumers exist (verify via grep before deletion).
> - Remove the `<Link href="/dashboard/sportsCulture">` block from `src/app/dashboard/page.tsx` (the target page directory does not exist — it was a dead link).
> - Remove the `ccaApplications` feature-flag wiring from `src/lib/feature-flags.ts` **only if** no other code path consumes it (grep first — chair allocation routes also gate on `ccaApplications`).
>
> Tasks A–D (chair-side allocation routes), G (`forChair` row types), H (hook tests), J (audit log cleanup) remain as written. The "non-sportsCulture half of plan 04" is what proceeds; sportsCulture-related Tasks E and F are superseded by the removal task below.
>
> **New Task K — Delete sportsCulture routes and types** (replaces E + F):
> - [x] `rm src/app/api/sportsCulture/apply/route.ts`
> - [x] `rm src/app/api/sportsCulture/available/route.ts`
> - [x] `grep -rn "sportsCulture\|sports-culture\|SportsCulture" src/` — confirm only `src/types/sports-culture.ts` and `src/app/dashboard/page.tsx` Link remain.
> - [x] `rm src/types/sports-culture.ts`.
> - [x] Remove the `<Link href="/dashboard/sportsCulture">` card from `src/app/dashboard/page.tsx`.
> - [x] Check `src/lib/feature-flags.ts` for `ccaApplications` usage — chair routes (Tasks A–D), `/api/user/{checkRole, saveRankings, search, getRankablePositions}`, dashboard, sidebar, ccaAllocation layout all consume the flag. Kept.
> - [x] `npm run build` — zero TS errors (full Next.js build green).
> - [~] `grep -rn "sportsCulture\|sports-culture\|SportsCulture" src/` — zero hits expected. **Residual matches** are 14 hits of the `isSportsCulture` boolean variable (a CCA-type check) in `src/app/dashboard/mycca/admin/manageMembers/[ccaName]/page.tsx` and `src/features/cca/components/{add-member-modal,member-group-table}.tsx`. These belong to plan 02 (membership flow) and are unrelated to the self-apply feature; left untouched per scope rules.

## 1. Goal & scope

Realign the CCA Allocation slice of the Next.js API with the overhauled DB schema: replace reads from the deleted `cca_capacity_info` view with the new `cca_position_availability` view, replace reads/writes of the deleted `cca_user_ranking` table with the new two-sided preference market (`cca_position_preferences` written via the `upsert_cca_position_preference` RPC, and `cca_user_preferences` written via `upsert_cca_user_preference`), and stop writing directly to `cca_appointments` from the sportsCulture `apply` flow (the new RLS on `cca_appointments` forbids self-insert; applications now express user-side preferences instead). This plan covers the four routes under `src/app/api/chair/positions/`, both routes under `src/app/api/sportsCulture/`, the eight files under `src/features/allocation/`, and the `src/types/sports-culture.ts` shim. It does NOT cover the `cca/[ccaId]/*` membership routes (plan 02), the member-evaluation ranking flow (`cca/[ccaId]/rankings`, `cca/rankings/all`, `user/saveRankings` — plan 03), `user/getRankablePositions/[email]` (auth/user — plan 01, but the contract change to its response is surfaced here in section 7 as the consumer-side blocker for `useRankablePositions`), or holiday subsidy (plan 05). It assumes `internal.auth_user_id()` (`function/core/06.auth-user-id.sql`) and `internal.can_manage_cca_appointments` (`function/core/05.can-manage-cca-appointments.sql`) are deployed with EXECUTE granted to `authenticated`, and that `authenticated_user_info` continues to feed `requestingUser.appointments[].position_type/cca_id` to `checkCcaAuthorization`.

## 2. Files in scope

API routes
- `src/app/api/chair/positions/forChair/route.ts` — list rankable positions + their applicant ranks for the requesting chair
- `src/app/api/chair/positions/[position_id]/rank/route.ts` — bulk save chair ranks for one position
- `src/app/api/chair/positions/[position_id]/addApplicant/route.ts` — append one applicant to chair's rank list
- `src/app/api/chair/positions/[position_id]/removeApplicant/route.ts` — drop one applicant from chair's rank list
- `src/app/api/sportsCulture/available/route.ts` — list sports/culture member/team-manager positions a resident can apply to, with conflict reasons
- `src/app/api/sportsCulture/apply/route.ts` — POST apply / DELETE withdraw for a sports/culture position

Feature modules (`src/features/allocation/`)
- `types/applicants.ts` — `Applicant`, `Position` (chair-side view model; `ranking` field maps to `cca_position_preferences.rank`)
- `types/preferences.ts` — `RankablePosition`, `SportsCulturePosition`, `GroupedPositions` (user-side view models)
- `utils/applicant-diff.ts` + `applicant-diff.test.ts` — diff helper used by `use-applicant-rankings`
- `utils/ranking-changes.ts` + `ranking-changes.test.ts` — diff helper used by `use-rankable-positions`
- `utils/ranking-columns.tsx` — table column defs (presentational; safe pass-through)
- `utils/allocation-guide-content.ts` — static FAQ copy (no schema deps; touch only if domain language drifts)
- `components/position-card.tsx`, `components/position-search-box.tsx`, `components/rank-ordering-step.tsx`, `components/rank-selection-step.tsx`, `components/allocation-algorithm-steps.tsx`, `components/allocation-faq.tsx`, `components/allocation-guide-hero.tsx` — UI; touched only if a field name flows through props
- `hooks/use-applicant-rankings.ts` — chair-side hook (calls `/api/chair/positions/forChair` and the three position-id routes)
- `hooks/use-rankable-positions.ts` — user-side hook (calls `/api/user/getRankablePositions/[email]` and `/api/user/saveRankings`)

Shared types
- `src/types/sports-culture.ts` — `SportsCultureCca`, `SportsCulturePositionJoin`, `SportsCultureAppointment`

Out of scope (delegated; flagged in section 7 if a contract shift bleeds in)
- `src/app/api/user/getRankablePositions/[email]/route.ts` — owned by plan 01 (auth/user) but feeds `useRankablePositions`; **its switch to `cca_position_availability` + `cca_user_preferences` is a prerequisite for this plan's hook task to land cleanly**
- `src/app/api/user/saveRankings/route.ts` — owned by plan 03 (member-ranking subagent — **NB: this route name is ambiguous; if it serves the user-side preference market it actually belongs here, confirm in section 7**)
- `src/app/api/user/search/route.ts` — owned by plan 01
- `src/features/cca/utils/cca-chair-access.ts` — owned by plan 02; this plan keeps consuming `checkCcaAuthorization({ requestingUser, cca, require: "chair" })` unchanged

## 3. Schema mapping

Citations refer to wiki pages at `/Users/bytedance/intranet-wiki/wiki/` and, where the wiki page is `status: seed`, to the upstream SQL changelog at `/Users/bytedance/intranet/db/changelogs/`. Position-type lower-case checks (`lead`/`vice`/`resident`/`member`/`team manager`) map to `enum.position_type` values (`enum/03.position-type.sql` per `wiki/entity/enum/enum.position_type.md`).

### `src/app/api/chair/positions/forChair/route.ts`

| Current reference | New reference | Notes |
|---|---|---|
| `from("cca_capacity_info").select("id, name, capacity, available_capacity, applied_count, position_type, cca_id, cca_name")` | `from("cca_position_availability").select("position_id, cca_id, position_name, position_type, capacity, available_capacity, cca_name, cca_type, tier_type")` (`view/cca-allocation/01.cca-position-availability.sql`) | **Column rename:** `id` → `position_id`, `name` → `position_name`. **Dropped column:** `applied_count` no longer exists on the availability view — derive it client-side from the count of `cca_preference_pairs` rows for the position, or remove `applied_count` from the API contract. See `wiki/entity/view/public.cca_position_availability.md`. |
| `.in("cca_id", ccaIds)` filter where `ccaIds = accessResult.data.authorizedCcaIds` | Same filter against `cca_position_availability.cca_id` | The chair-access check (`checkCcaAuthorization`) is unchanged and still derives `authorizedCcaIds` from `requestingUser.appointments[].position_type IN ('lead','vice')`. RLS-wise, `cca_position_availability` is `security_invoker = on` with `SELECT` granted to `authenticated` (changeset daniel:2 of the same file) so any caller can read; auth gating is enforced in app code. |
| `.gt("available_capacity", 0)` | Same | `cca_position_availability.available_capacity` is computed as `GREATEST(0, capacity − GREATEST(sem1-taken, sem2-taken))`. Behaviorally equivalent. |
| `.not("position_type", "in", "(lead,vice,resident)")` | Same enum filter | `enum.position_type` includes `lead, vice, blockcomm, maincomm, subcomm, team manager, member, resident` per `wiki/entity/enum/enum.position_type.md`. |
| `from("cca_user_ranking").select("position_id, user_id, ranking, public_user_info!inner(id, name, email, room)").in("position_id", positionIds).order("ranking", { ascending: true })` | `from("cca_position_preferences").select("position_id, user_id, rank").in("position_id", positionIds).order("rank", { ascending: true })` + a second query against `authenticated_user_directory` keyed on `user_id` | **Two-sided change:** (1) The table is gone. New source is `cca_position_preferences` (`table/cca-allocation/02.cca-position-preferences.sql`), `rank` column (was `ranking`), keyed on `(position_id, user_id)`. (2) The implicit FK-join to `public_user_info` no longer carries `email`/`room` — `public_user_info` is now `(id, name, profile_photo_path)` only (`view/core/01.public-user-info.sql`). Use `authenticated_user_directory(id, email, name, room, telegram_handle, profile_photo_path)` (`view/core/05.authenticated-user-directory.sql`) which is granted to `authenticated`. **RLS:** `cca_position_preferences` SELECT is restricted to `internal.can_manage_cca_appointments(position_id, internal.auth_user_id())` (`security/cca-allocation/02.cca-position-preferences.sql` daniel:2) — the route's `authorizedCcaIds` filter happens to mirror this, but RLS will silently drop any row that slips through. |
| Output field `total_capacity = position.capacity` and `applied_count = position.applied_count` | `total_capacity = position.capacity`, `applied_count = pairs.length` (computed) | Keep the API response shape; rebuild `applied_count` from a count(*) over `cca_position_preferences` or `cca_user_preferences` per position. Decision: count `cca_position_preferences` rows since that is the chair-visible market; document the semantic shift in the route's header comment. |

### `src/app/api/chair/positions/[position_id]/rank/route.ts`

| Current reference | New reference | Notes |
|---|---|---|
| `from("cca_user_ranking").delete().eq("position_id", positionId)` then `from("cca_user_ranking").insert(rankingRecords)` | Loop over rankings and call `supabase.rpc("upsert_cca_position_preference", { p_position_id, p_user_id, p_rank })` for each | The RPC `public.upsert_cca_position_preference(p_position_id INT, p_user_id INT, p_rank INT)` (`function/cca-allocation/02.upsert-cca-position-preference.sql`) does the `ON CONFLICT (position_id, user_id) DO UPDATE` atomically, so a global delete-then-insert is no longer necessary. **Important constraint:** `cca_position_preferences` has `UNIQUE (position_id, rank) DEFERRABLE INITIALLY DEFERRED` (`table/cca-allocation/02.cca-position-preferences.sql` daniel:2). A batch reorder where two rows transiently share a rank is fine **only inside a single transaction**. Supabase JS calls each RPC in a separate transaction by default — see "Tasks" section 5 for the explicit handling. |
| `from("cca_positions").select("id, position_type, ccas!inner(id, name, cca_type)")` and `NON_APPLICANT_POSITION_TYPES.has(position_type)` guard | Same | `cca_positions` schema unchanged (`table/core/04.cca-position.sql`). Keep the type guard. |
| `checkCcaAuthorization({ requestingUser, cca, require: "chair" })` | Same | App-layer check is preserved as a fast-fail; DB-layer RLS on `cca_position_preferences` enforces the same rule via `internal.can_manage_cca_appointments`. |
| Removed applicants (those in the old set but not the new) | **Behavior gap:** the current route does a `DELETE WHERE position_id = …` to clear-and-replace; the new flow only upserts. | Add an explicit `from("cca_position_preferences").delete().eq("position_id", positionId).not("user_id", "in", `(${currentUserIds.join(",")})`)` call before the upsert loop. RLS on the table allows DELETE via `delete_managed` (daniel:5 of the security file). |

### `src/app/api/chair/positions/[position_id]/addApplicant/route.ts`

| Current reference | New reference | Notes |
|---|---|---|
| `from("cca_user_ranking").select("id").eq("user_id", user_id).eq("position_id", positionId).single()` existence probe | `from("cca_position_preferences").select("rank").eq("position_id", positionId).eq("user_id", user_id).maybeSingle()` | Column rename + use `maybeSingle()` so "not found" is not an error. |
| `from("cca_user_ranking").select("ranking").eq("position_id", positionId).order("ranking", desc).limit(1)` for next-rank derivation | `from("cca_position_preferences").select("rank").eq("position_id", positionId).order("rank", { ascending: false }).limit(1)` | Same logic, renamed column. |
| `from("cca_user_ranking").insert({ user_id, position_id, ranking: nextRanking })` | `supabase.rpc("upsert_cca_position_preference", { p_position_id, p_user_id: user_id, p_rank: nextRanking })` | RPC handles `ON CONFLICT` cleanly; first call still effectively inserts. |
| Implicit `cca_user_ranking.id` PK | None — `cca_position_preferences` PK is `(position_id, user_id)` (`table/cca-allocation/02.cca-position-preferences.sql` daniel:1). | Existence check must use `(position_id, user_id)` predicate, not a synthetic id. |

### `src/app/api/chair/positions/[position_id]/removeApplicant/route.ts`

| Current reference | New reference | Notes |
|---|---|---|
| `from("cca_user_ranking").delete().eq("user_id", user_id).eq("position_id", positionId)` | `from("cca_position_preferences").delete().eq("position_id", positionId).eq("user_id", user_id)` | Direct table delete is fine; RLS `delete_managed` policy authorizes via `internal.can_manage_cca_appointments`. |
| Position lookup + chair guard | Same | No change. |
| Position type guard `NON_APPLICANT_POSITION_TYPES` | Same | No change. |

### `src/app/api/sportsCulture/available/route.ts`

| Current reference | New reference | Notes |
|---|---|---|
| `from("cca_appointments").select("position_id, cca_positions!inner(name, position_type, cca_id, ccas!inner(id, name, cca_type))").eq("user_id", requestingUserId)` for existing-roles map | Same query against `cca_appointments` (`table/core/05.cca-appointment.sql`) — table is unchanged | `cca_appointments` SELECT is publicly readable (`security/core/05.cca-appointment.sql` daniel:2: `CREATE POLICY select_all FOR SELECT USING (true)`). Behavior preserved. |
| `from("cca_positions").select("id, name, description, capacity, ccas!inner(id, name, cca_type)").in("ccas.cca_type", ["sports","culture"]).in("position_type", ["member","team manager"])` | Same — could be rewritten to use `cca_position_availability` to also surface `available_capacity` | Optional improvement: switching to `cca_position_availability` lets the UI grey out at-capacity positions without a second query. Keep current `cca_positions` query for now; surface as a follow-up. |
| `from("cca_appointments").select("position_id").eq("user_id", requestingUserId)` for `appliedPositionIds` | Same query, unchanged | **Product decision (2026-05-18):** "applied" remains "has an appointment row" since apply still produces an appointment via the `apply_sports_culture_position` RPC. No swap to `cca_user_preferences`. |
| `userApplicationsByCCA` map keyed on `cca_id` (built from the existing-roles loop) | Same — keep building from `cca_appointments` | No semantic split. "You already applied as X" still means "you already have an appointment for that role"; capacity / per-CCA validation is enforced by `internal.validate_cca_appointment` at apply time. |
| `userCCAMap.get(ccaId)` returning `"member"`/`"lead"`/`"vice"`/`"team manager"` for conflict messages | Same — keep | The conflict-reason strings (lines 152–165 of the current file) reference `position_type` from existing appointments. Preserve verbatim wording so the UI does not need a re-test. |
| Output `groupedPositions = { sports: [...], culture: [...] }` | Same | API consumer is downstream; do not change the response envelope. |

### `src/app/api/sportsCulture/apply/route.ts` (POST)

**Product decision (2026-05-18):** preserve the current "apply = instant appointment" semantics. Direct `cca_appointments.insert` is blocked by RLS, so the route calls a new SECURITY DEFINER RPC `public.apply_sports_culture_position` (defined in `MIGRATIONS.md` §1) that performs the eligibility checks inside the function and then writes the appointment. **The pre-refactor user-visible behaviour is unchanged.**

| Current reference | New reference | Notes |
|---|---|---|
| `from("cca_appointments").insert({ user_id, position_id, points: 0 })` | `supabase.rpc("apply_sports_culture_position", { p_position_id: position_id })` | The RPC validates `cca_type IN ('sports','culture')` and `position_type IN ('member','team manager')` inside `SECURITY DEFINER` context, then performs the appointment insert. `internal.auth_user_id()` resolves the caller; no `user_id` is passed in. The existing `internal.validate_cca_appointment` trigger continues to enforce per-CCA-per-period uniqueness and capacity. |
| `from("cca_appointments").select(...).eq("user_id", …).eq("cca_positions.cca_id", positionData.cca_id).in("cca_positions.position_type", ["member","team manager"])` for conflicting-application probe | Same query against `cca_appointments` — unchanged | The pre-check stays as a UX shortcut. The RPC's trigger would otherwise raise a less-friendly Postgres error. |
| `from("cca_appointments").select("id").eq("user_id", …).eq("position_id", position_id).single()` exact-match probe | Same query, but use `.select("user_id, position_id")` since `cca_appointments` has no `id` column (it has a composite PK) | Keep the pre-check for the friendly "already applied" 400; without it the RPC raises a duplicate-key error. |
| `from("cca_allocation_events").insert({ user_id, position_id, reason, event_type: "applied" })` | **Delete entirely.** | `cca_allocation_events` no longer exists. Product confirmed no replacement audit trail is required. |

### `src/app/api/sportsCulture/apply/route.ts` (DELETE)

| Current reference | New reference | Notes |
|---|---|---|
| `from("cca_appointments").delete().eq("user_id", …).eq("position_id", position_id)` | `supabase.rpc("withdraw_sports_culture_position", { p_position_id: position_id })` | DELETE on `cca_appointments` is gated by `internal.can_manage_cca_appointments` (chain-of-managers only). The SECURITY DEFINER RPC `public.withdraw_sports_culture_position` (`MIGRATIONS.md` §1) re-validates the position type/CCA type and deletes the appointment for the caller (`internal.auth_user_id()`). |
| `from("cca_allocation_events").delete()...` | **Delete entirely.** | Table is gone. |

### `src/features/allocation/types/applicants.ts`

| Current type member | New schema column | Notes |
|---|---|---|
| `Applicant.ranking: number \| null` | `cca_position_preferences.rank` | The DB column is `rank`. Rename `Applicant.ranking` to `Applicant.rank` for cohesion **only if the entire chain (`forChair` route output → hook → component → save payload) renames in lockstep.** Otherwise keep `ranking` as the wire name and translate at the route boundary. Decision: keep `ranking` to minimize blast radius; document the alias in the type's JSDoc. |
| `Position.applied_count: number` | Derived (count of `cca_position_preferences` rows for `position_id`) | See `forChair` row above. Keep the field; route now computes it. |
| `Position.available_capacity` / `Position.capacity` | `cca_position_availability.available_capacity` / `.capacity` | Unchanged. |

### `src/features/allocation/types/preferences.ts`

| Current type member | New schema column | Notes |
|---|---|---|
| `RankablePosition.user_ranking: number \| null` | `cca_user_preferences.rank` | Same alias decision as above — keep `user_ranking` for now. The user-side `saveRankings` payload (`{ position_id, ranking }`) is consumed by a route owned by plan 03 (auth/user); flag the rename downstream if it lands there. |
| `SportsCulturePosition.is_applied: boolean` | True iff a `cca_user_preferences` row exists for `(caller, position_id)` | Semantic shift; type does not change. |
| `SportsCulturePosition.conflict_reason` | Composed in `sportsCulture/available` from `cca_appointments` + `cca_user_preferences` | Field is purely advisory; no DB column. |

### `src/features/allocation/utils/applicant-diff.ts`

| Current symbol | New schema role | Notes |
|---|---|---|
| `diffApplicantsForSave(position, originalOrders)` returns `{ toAdd, toRemove, rankings: { user_id, ranking }[] }` | Same return shape; consumer wraps `rankings` into `upsert_cca_position_preference` calls and uses `toRemove` for batch `DELETE` | Pure logic; no schema dependency. Tests in `applicant-diff.test.ts` keep passing. |

### `src/features/allocation/utils/ranking-changes.ts`

| Current symbol | New schema role | Notes |
|---|---|---|
| `buildRankingsPayload(positions)` returns `{ position_id, ranking }[]` | Consumed by user-side `saveRankings` (owned by plan 03 — see section 7); will eventually map to `upsert_cca_user_preference(p_position_id, p_rank)` calls | Keep this helper as-is; the payload field name `ranking` flows out of this domain. |

### `src/features/allocation/hooks/use-applicant-rankings.ts`

| Current behavior | New behavior | Notes |
|---|---|---|
| Sequential `POST /api/chair/positions/{id}/addApplicant`, `POST /…/removeApplicant`, then `POST /…/rank` per save | Same per-position orchestration | The routes' internals change; the hook's contract is preserved. No code change in this file. |

### `src/features/allocation/hooks/use-rankable-positions.ts`

| Current behavior | New behavior | Notes |
|---|---|---|
| `GET /api/user/getRankablePositions/${userEmail}` returns `positions[] { id, name, cca_name, position_type, capacity, available_capacity, applied_count, description, user_ranking, is_selected }` | Same response shape after plan 01 swaps the upstream source from `cca_capacity_info` + `user_cca_applications` to `cca_position_availability` + `cca_user_preferences` | **Cross-domain dependency:** owned by plan 01. This plan's hook does not need edits **iff** the response contract is preserved. Flag in section 7. |
| `POST /api/user/saveRankings` body `{ email, rankings: { position_id, ranking }[] }` | Same — but the route's internals must switch from `user_cca_applications` writes to `upsert_cca_user_preference` calls | **Cross-domain dependency:** route ownership is ambiguous (filename pattern places it under plan 03 but the data flow puts it under this plan). Resolve in section 7; for now keep the hook unchanged. |

### `src/types/sports-culture.ts`

| Current type member | New schema column | Notes |
|---|---|---|
| `SportsCultureCca { id, name, cca_type: "sports" \| "culture" }` | `ccas.id, ccas.name, ccas.cca_type` (`table/core/03.cca.sql`; enum `enum.cca_type`) | OK. |
| `SportsCulturePositionJoin { name, position_type, cca_id, ccas }` | Maps a `cca_positions` row with embedded `ccas`; `position_type` is `enum.position_type` | OK. |
| `SportsCultureAppointment { position_id, cca_positions }` | Maps a `cca_appointments` row with embedded `cca_positions` | OK; consumed only by `sportsCulture/available` after the read-side swap. |

## 4. Authorization / RLS impact

The wiki domain page (`wiki/domain/cca-allocation.md`) names `internal.can_manage_applications` as the authorization gate, but the SQL truth in `function/core/05.can-manage-cca-appointments.sql` and the policies in `security/cca-allocation/02.cca-position-preferences.sql` confirm the **actual** gate is `internal.can_manage_cca_appointments(p_position_id, p_actor_user_id)` — a recursive walk up `cca_positions.reporting_position` looking for a `cca_appointments` row owned by the actor (depth ≤ 10, with cycle detection that raises if a cycle is hit at exactly depth 10). The `managed_cca_positions` view (`view/core/04.managed-cca-positions.sql`, contract per `wiki/convention/view-as-contract.md`) emits the union of positions a user can manage; CCA-Allocation routes do not need to read this view directly — the app-layer `checkCcaAuthorization({ requestingUser, cca, require: "chair" })` is a fast app-side mirror keyed on `appointments[].position_type IN ('lead','vice')`, and the DB will enforce the same predicate via RLS regardless.

Read/write matrix for the two preference tables:

| Table | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| `cca_user_preferences` (`security/cca-allocation/01.cca-user-preferences.sql`) | own (`user_id = internal.auth_user_id()`) | own | own | own |
| `cca_position_preferences` (`security/cca-allocation/02.cca-position-preferences.sql`) | `internal.can_manage_cca_appointments(position_id, internal.auth_user_id())` | same | same | same |
| `cca_appointments` (`security/core/05.cca-appointment.sql`) | public (`USING (true)`) | `can_manage_cca_appointments` | `can_manage_cca_appointments` | `can_manage_cca_appointments` |

**Double-blind market:** `cca_user_preferences.select_own` makes the user-side preferences invisible to chairs at the DB level. A chair querying `cca_position_preferences` for a position only sees ranks the chair (or upstream manager) explicitly wrote — not the user's reciprocal rank. The composite `cca_preference_pairs` view (`view/cca-allocation/02.cca-preference-pairs.sql`) is `security_invoker = on`, so it also returns only the rows the caller's RLS authorizes on each side — i.e., chairs see only `position_rank`, users see only `user_rank`. **Do not** use `cca_preference_pairs` in chair-side routes expecting to read both sides; it will look hollow.

**Self-application blocked at DB:** `cca_appointments.insert_authenticated` denies a user inserting their own appointment unless they manage the position. This is the schema-level reason the sportsCulture `apply` route must stop writing to `cca_appointments` and switch to the user-preference RPC. If the new behavior diverges from product intent (the wiki domain page is still ambiguous about whether sports/culture has a separate "auto-accept" path), surface this in section 7 rather than working around RLS in app code.

**`can_manage_cca_appointments` cycle exception:** if the reporting chain is exactly 10 deep without cycle markers, the function `RAISE EXCEPTION 'Reporting chain at position % exceeds maximum depth of 10'`. App-layer code must treat a Postgres error from any preferences write as a 500 with the raw message included (current `console.error(...) + 500 generic` pattern is acceptable but loses the diagnostic — consider passing the PG error code through in the response envelope for the chair routes specifically).

## 5. Tasks

Each task is bite-sized and independently mergeable; tests where present are vitest. The order respects dependencies inside this domain; cross-domain prerequisites are listed in section 7.

### Task A — Swap `forChair` reads to the new views and surface `cca_name`, `position_name`

File: `src/app/api/chair/positions/forChair/route.ts`

- [x] Replace the `cca_capacity_info` query with `cca_position_availability`. Adjust the select list to `position_id, cca_id, position_name, position_type, capacity, available_capacity, cca_name, cca_type, tier_type` and drop `id`/`name`/`applied_count`.
- [x] Update the local `CapacityInfoRow` type (rename to `PositionAvailabilityRow`) and the `getPositionsForPhase` return type to mirror the column names; drop `applied_count` from the row type.
- [x] Replace the `cca_user_ranking` + nested `public_user_info` query with two queries:
  1. `from("cca_position_preferences").select("position_id, user_id, rank").in("position_id", positionIds).order("rank", { ascending: true })`
  2. `from("authenticated_user_directory").select("id, name, email, room").in("id", uniqueApplicantUserIds)`
  Stitch the two together in JS to rebuild the per-position applicant array.
- [x] Compute `applied_count = applicantsByPosition.get(position.position_id)?.length ?? 0` so the response envelope is preserved.
- [x] In the response mapping, rename `position.id` → `position.position_id` and `position.name` → `position.position_name` everywhere, but **keep the API output keys as `id` and `name`** (`result = allPositions.map(p => ({ id: p.position_id, name: p.position_name, … }))`) — front-end `Position` type uses `id`/`name`.

Before sketch (current, lines 41–56):
```ts
const { data: allPositions } = await supabase
  .from("cca_capacity_info")
  .select("id, name, capacity, available_capacity, applied_count, position_type, cca_id, cca_name")
  .in("cca_id", ccaIds)
  .gt("available_capacity", 0)
  .not("position_type", "in", NON_APPLICANT_POSITION_TYPES);
```

After sketch:
```ts
const { data: allPositions } = await supabase
  .from("cca_position_availability")
  .select("position_id, cca_id, position_name, position_type, capacity, available_capacity, cca_name")
  .in("cca_id", ccaIds)
  .gt("available_capacity", 0)
  .not("position_type", "in", NON_APPLICANT_POSITION_TYPES);
```

Before sketch (current, lines 87–96):
```ts
const { data: applicationsWithUsers } = await supabase
  .from("cca_user_ranking")
  .select(`position_id, user_id, ranking, public_user_info!inner(id, name, email, room)`)
  .in("position_id", positionIds)
  .order("ranking", { ascending: true });
```

After sketch:
```ts
const { data: prefRows } = await supabase
  .from("cca_position_preferences")
  .select("position_id, user_id, rank")
  .in("position_id", positionIds)
  .order("rank", { ascending: true });

const userIds = Array.from(new Set((prefRows ?? []).map((r) => r.user_id)));
const { data: dirRows } = await supabase
  .from("authenticated_user_directory")
  .select("id, name, email, room")
  .in("id", userIds);

const userById = new Map((dirRows ?? []).map((u) => [u.id, u]));
const applicantsByPosition = new Map<number, Applicant[]>();
for (const r of prefRows ?? []) {
  const u = userById.get(r.user_id);
  if (!u) continue;
  const arr = applicantsByPosition.get(r.position_id) ?? [];
  arr.push({ id: u.id, name: u.name, email: u.email, room: u.room, ranking: r.rank });
  applicantsByPosition.set(r.position_id, arr);
}
```

- [ ] Verification: `npm run lint` plus `curl -s http://localhost:3000/api/chair/positions/forChair -H "cookie: …"` and confirm a stub `positions: [{ id, name, cca_name, total_capacity, available_capacity, applied_count, filled_positions, position_type, applicants: [{ id, name, email, room, ranking }] }]` round-trips. Run the chair-side `RankApplicants` page and visually confirm rows render.

### Task B — Rewrite `addApplicant` to use the preference RPC

File: `src/app/api/chair/positions/[position_id]/addApplicant/route.ts`

- [x] Replace the `cca_user_ranking` existence probe with `from("cca_position_preferences").select("rank").eq("position_id", positionId).eq("user_id", user_id).maybeSingle()`. Return 400 "Applicant already exists for this position" only when `data` is non-null.
- [x] Replace the next-rank lookup with `from("cca_position_preferences").select("rank").eq("position_id", positionId).order("rank", { ascending: false }).limit(1)`.
- [x] Replace the final insert with `supabase.rpc("upsert_cca_position_preference", { p_position_id: positionId, p_user_id: user_id, p_rank: nextRanking })`.
- [x] Keep the existing `cca_positions` lookup + chair guard intact.

After sketch (replacing lines 58–94):
```ts
const { data: existing } = await supabase
  .from("cca_position_preferences")
  .select("rank")
  .eq("position_id", positionId)
  .eq("user_id", user_id)
  .maybeSingle();
if (existing) {
  return NextResponse.json({ error: "Applicant already exists for this position" }, { status: 400 });
}

const { data: currentApplicants, error: countError } = await supabase
  .from("cca_position_preferences")
  .select("rank")
  .eq("position_id", positionId)
  .order("rank", { ascending: false })
  .limit(1);
if (countError) {
  return NextResponse.json({ error: "Failed to determine ranking" }, { status: 500 });
}
const nextRanking = currentApplicants.length > 0 ? (currentApplicants[0].rank || 0) + 1 : 1;

const { error: rpcError } = await supabase.rpc("upsert_cca_position_preference", {
  p_position_id: positionId,
  p_user_id: user_id,
  p_rank: nextRanking,
});
if (rpcError) {
  return NextResponse.json({ error: rpcError.message }, { status: 500 });
}
```

- [ ] Verification: from the `RankApplicants` UI, add an applicant via the search box and confirm a new `cca_position_preferences` row appears (`select * from cca_position_preferences where position_id = … and user_id = …`).

### Task C — Rewrite `removeApplicant` to delete from `cca_position_preferences`

File: `src/app/api/chair/positions/[position_id]/removeApplicant/route.ts`

- [x] Single-line change: `from("cca_user_ranking")` → `from("cca_position_preferences")`. Filter columns are unchanged (`position_id`, `user_id`).
- [x] Keep the existing position lookup, type guard, and chair guard.
- [ ] Verification: remove an applicant from the UI; confirm DB row count drops by 1. **Skipped: needs running server / DB.**

### Task D — Rewrite bulk `rank` save to use the RPC plus a targeted DELETE

File: `src/app/api/chair/positions/[position_id]/rank/route.ts`

- [x] Replace the unconditional `DELETE WHERE position_id` with `DELETE WHERE position_id AND user_id NOT IN (currentUserIds)`. Use `from("cca_position_preferences").delete().eq("position_id", positionId).not("user_id", "in", `(${rankingUserIds.join(",")})`)`.
- [x] Replace the bulk `INSERT` with sequential calls to `supabase.rpc("upsert_cca_position_preference", { p_position_id: positionId, p_user_id: r.user_id, p_rank: r.ranking })`. Reject overall on any error.
- [x] Note the `UNIQUE (position_id, rank) DEFERRABLE INITIALLY DEFERRED` constraint: per-row RPCs run in their own transactions, so naive `rank` reassignment can collide if two existing rows swap ranks mid-batch. Mitigation: stage every row to a temporary high rank (e.g. `+1000`) first, then apply the real ranks. Pseudocode:
  ```ts
  for (const r of rankings) {
    await supabase.rpc("upsert_cca_position_preference", { p_position_id: positionId, p_user_id: r.user_id, p_rank: r.ranking + 1000 });
  }
  for (const r of rankings) {
    await supabase.rpc("upsert_cca_position_preference", { p_position_id: positionId, p_user_id: r.user_id, p_rank: r.ranking });
  }
  ```
  Document this trade-off in the route's header comment. Better: introduce a `public.replace_cca_position_preferences(p_position_id INT, p_rows JSONB)` SECURITY INVOKER RPC that does the swap inside one transaction with `SET CONSTRAINTS ALL DEFERRED`. **Flag in section 7 as a follow-up if the staged-rank workaround tests dirty.**
- [ ] Verification: rearrange 3+ applicants in the UI, save, confirm `select position_id, user_id, rank from cca_position_preferences where position_id = … order by rank` reflects the new order with no gaps or duplicates. **Skipped: needs running server / DB.** Unit test asserts the staged + final pass RPC sequence.

### Task E — Keep `sportsCulture/available` reading `cca_appointments` for `is_applied`

File: `src/app/api/sportsCulture/available/route.ts`

**Product decision (2026-05-18):** preserve the current "apply = instant appointment" semantics. `is_applied` continues to mean "the user has a row in `cca_appointments` for this position", not "the user has expressed a preference". The first `cca_appointments` query that powers `userCCAMap` and the second one that powers `appliedPositionIds` both remain — neither swaps to `cca_user_preferences`.

- [ ] **No DB-source changes** to either query. `cca_appointments` is still publicly readable (`security/core/05.cca-appointment.sql` daniel:2: `select_all`) so both queries continue to resolve under `authenticated`.
- [ ] Verify the joined `cca_positions!inner(cca_id, ...)` shape still resolves with the new schema (it does — `cca_positions` is unchanged in this respect; see plan 05 §7 Q6 for the "appointments by CCA" join pattern caveat).
- [ ] Add a code comment explaining why this route still reads `cca_appointments` (despite preferences existing in the new model) — the sportsCulture flow chooses instant-appointment semantics via the SECURITY DEFINER RPC defined in `MIGRATIONS.md` §1; preferences are reserved for the chair-managed market.
- [ ] Verification: as a user with one existing sports `member` appointment, hit `/api/sportsCulture/available` and confirm the conflict messages match the pre-refactor behaviour exactly. No regressions in `userApplicationsByCCA` shape.

### Task F — Rewrite `sportsCulture/apply` POST/DELETE against the new SECURITY DEFINER RPCs

File: `src/app/api/sportsCulture/apply/route.ts`

**Prerequisite:** `MIGRATIONS.md` §1 must be deployed (`public.apply_sports_culture_position(p_position_id INT)` and `public.withdraw_sports_culture_position(p_position_id INT)`).

**Product decision (2026-05-18):** preserve the instant-appointment behavior. The RPCs from `MIGRATIONS.md` §1 perform the eligibility checks (CCA type, position type) inside SECURITY DEFINER context so the resulting `INSERT INTO cca_appointments` bypasses RLS. The validate-cca-appointment trigger still fires.

- [ ] **POST handler:**
  - [ ] Keep the `cca_positions`/`ccas` lookup and the `cca_type`+`position_type` validation block (lines 28–58) — defence in depth; the RPC also validates but returning a friendly 400 from the API is better UX than letting the RPC raise.
  - [ ] Keep the existing-CCA-applications probe (lines 60–75) reading `cca_appointments` — semantics unchanged from current code.
  - [ ] Keep the exact-match probe (lines 100–115) for the "you already applied to this exact position" 400 — the RPC's underlying trigger would otherwise raise a less-friendly `23P01` (validate_cca_appointment) error.
  - [ ] Replace the direct `cca_appointments.insert` (lines 117–122) with `supabase.rpc("apply_sports_culture_position", { p_position_id: position_id })`. Inspect the returned row for the inserted appointment.
  - [ ] **Delete** the `cca_allocation_events.insert` try/catch (lines 129–139) — table is gone and product confirmed the audit trail is not being replaced.
- [ ] **DELETE handler:**
  - [ ] Replace `from("cca_appointments").delete()…` with `supabase.rpc("withdraw_sports_culture_position", { p_position_id: position_id })`. The RPC handles the eligibility check and scopes the delete to the caller.
  - [ ] **Delete** the `cca_allocation_events` cleanup (lines 179–189).

After sketch (POST, replacing only the insert and audit-log calls — pre-checks above remain):
```ts
const { data: appointment, error: rpcError } = await supabase.rpc(
  "apply_sports_culture_position",
  { p_position_id: position_id },
);

if (rpcError) {
  // Trigger-raised errors (capacity, duplicate, validation) surface here.
  // Map common Postgres codes to friendly 400 vs 500.
  const isCheckViolation = rpcError.code === "23P01" || rpcError.code === "23514";
  return NextResponse.json(
    { error: isCheckViolation ? rpcError.message : "Failed to apply" },
    { status: isCheckViolation ? 400 : 500 },
  );
}

return NextResponse.json({ success: true, appointment });
```

After sketch (DELETE):
```ts
const { error: rpcError } = await supabase.rpc(
  "withdraw_sports_culture_position",
  { p_position_id: position_id },
);

if (rpcError) {
  return NextResponse.json({ error: "Failed to withdraw" }, { status: 500 });
}
return NextResponse.json({ success: true });
```

- [ ] Verification:
  1. As a fresh user, POST `/api/sportsCulture/apply` with a valid sports `member` position; assert a row appears in **`cca_appointments`** (not `cca_user_preferences`).
  2. Attempt POST as a user who is already `lead` of the same CCA — expect the route's pre-check to return 400 before the RPC fires.
  3. Attempt POST against a `committee`-type CCA — expect the RPC to raise (`apply_sports_culture_position only allowed for sports/culture CCAs`).
  4. DELETE the application — assert the appointment row is gone.

### Task G — Update `forChair` row types and ranking-columns typing

File: `src/features/allocation/types/applicants.ts`

- [x] Add a JSDoc note above `Applicant.ranking` clarifying the field is the wire-name alias for `cca_position_preferences.rank`.
- [x] No structural change required — the route boundary keeps the legacy field name.

File: `src/features/allocation/types/preferences.ts`

- [x] Add JSDoc note above `RankablePosition.user_ranking` aliasing `cca_user_preferences.rank`.
- [~] `SportsCulturePosition` and `GroupedPositions` types removed entirely (Task K removed the consuming routes).
- [x] Verification: `npm run build` passes; no TS errors in plan 04 scope.

### Task H — Keep hooks untouched but pin the test expectations

Files: `src/features/allocation/hooks/use-applicant-rankings.ts`, `src/features/allocation/utils/applicant-diff.test.ts`, `src/features/allocation/utils/ranking-changes.test.ts`

- [x] No code change. `npx vitest run src/features/allocation` passes (5 tests for `applicant-diff` + `ranking-changes`).
- [x] No further test updates needed (alias preserved).
- [x] Added new vitest specs that assert chair-side RPC payload shape (`{ p_position_id, p_user_id, p_rank }`) and user-side RPC payload shape (`{ p_position_id, p_rank }`): `src/app/api/chair/positions/[position_id]/rank/route.test.ts`, `src/app/api/chair/positions/[position_id]/addApplicant/route.test.ts`, plus the rewritten `src/app/api/user/saveRankings/route.test.ts`.

### Task I — Optional: switch `sportsCulture/available` to `cca_position_availability`

File: `src/app/api/sportsCulture/available/route.ts`

- [ ] **Optional, gated:** if the front-end wants to display capacity remaining, replace the `cca_positions` query (lines 104–116) with `from("cca_position_availability").select("position_id, position_name, description, capacity, available_capacity, cca_id, cca_name, cca_type").in("cca_type", ["sports","culture"]).in("position_type", ["member","team manager"])`.
- [ ] Output mapping: replace `position.id` with `position.position_id` and `position.name` with `position.position_name`, but emit `id`/`name` in the response envelope.
- [ ] Verification: API consumers still receive the same field names; new `available_capacity` is purely additive.

### Task J — Remove dead `cca_allocation_events` references and update header comments

Files: `src/app/api/sportsCulture/apply/route.ts`

- [~] Superseded by Task K — the apply route is deleted, so the header-comment fix is moot.
- [x] Grep within `src/features/allocation/` returns zero matches for `cca_allocation_events`. One residual match exists in `src/app/api/cca/[ccaId]/removeMember/route.ts` (plan 02 scope) — flagged for that plan to clean up.
- [~] `grep cca_allocation_events src/` returns 1 match (in plan 02's `removeMember` route) — not in scope for plan 04.

## 6. Verification

Local smoke tests after all tasks:

1. **Static checks:**
   ```
   npm run lint
   npm run build
   npx vitest run src/features/allocation
   ```

2. **Chair flow — `RankApplicants` page (`/dashboard/ccaAllocation/rankApplicants`):**
   - Sign in as a user with a `lead` or `vice` appointment.
   - Confirm `GET /api/chair/positions/forChair` returns the position list with applicants from `cca_position_preferences` joined to `authenticated_user_directory`.
   - Add an applicant via the search box; confirm `POST /api/chair/positions/{id}/addApplicant` succeeds and a new row appears in `cca_position_preferences`.
   - Reorder 3+ applicants and save; confirm `POST /api/chair/positions/{id}/rank` writes per-row upserts and the staged-rank workaround does not leave `+1000` rows behind.
   - Remove an applicant; confirm `POST /api/chair/positions/{id}/removeApplicant` deletes the row.

3. **User flow — `apply` / `withdraw`:**
   - Sign in as a resident with no CCA appointments.
   - `curl -sX POST -H "cookie: …" -H "content-type: application/json" -d '{"position_id": <a sports member position id>}' http://localhost:3000/api/sportsCulture/apply` → expect `{ success: true }`; assert `cca_user_preferences` row exists with `rank = 1`.
   - Apply a second time to a different sports CCA member position → expect `success`; new row with `rank = 2`.
   - Apply to a SECOND position **inside the same CCA** as the first → expect `400` with "You have already applied as …".
   - `GET /api/sportsCulture/available` → expect the applied positions to carry `is_applied: true`; sibling positions in the same CCA carry the conflict reason.
   - DELETE `/api/sportsCulture/apply` for the second position → expect `success`; row gone.

4. **Authorization checks:**
   - As a non-chair user, `POST /api/chair/positions/{id}/addApplicant` returns 403 with `"You are not authorized to manage this CCA"`.
   - As a service account, `select count(*) from cca_position_preferences where position_id = <p>` matches the number of rows the chair sees in the UI.
   - As a regular user, `select count(*) from cca_position_preferences where user_id = me` returns 0 (RLS hides chair-side ranks). Same query against `cca_user_preferences` returns own rows.

5. **DB-level sanity queries** (run with `psql` or Supabase SQL editor as service role to bypass RLS):
   ```
   -- Confirm no orphaned appointment writes from the legacy apply path
   SELECT user_id, position_id, created_at
   FROM cca_appointments
   WHERE created_at > now() - interval '1 day'
     AND position_id IN (SELECT id FROM cca_positions WHERE position_type IN ('member','team manager'));
   -- expect 0 from sportsCulture/apply (chair routes are the only writers post-refactor)

   -- Confirm preference rows have contiguous ranks per user
   SELECT user_id, COUNT(*), MIN(rank), MAX(rank)
   FROM cca_user_preferences
   GROUP BY user_id
   HAVING MAX(rank) > COUNT(*);
   -- expect 0 rows (gaps indicate a save bug)
   ```

## 7. Open questions

1. ~~**`user/getRankablePositions/[email]` and `user/saveRankings` ownership.**~~ **Resolved 2026-05-18:** both routes belong to this plan (allocation). Plans 03 and 01 hand them off; `INDEX.md` records the consensus.

2. **`replace_cca_position_preferences` RPC for atomic chair-side reorders.** The staged-rank workaround in task D (write `+1000`, then write real rank) is correct but doubles RPC traffic. A single SECURITY INVOKER function `public.replace_cca_position_preferences(p_position_id INT, p_rows JSONB)` that deletes the old set and inserts the new set under `SET CONSTRAINTS ALL DEFERRED` would be one round-trip and inherently atomic. The wiki has no such function; **action:** open an issue in `/Users/bytedance/intranet` to add it under `db/changelogs/function/cca-allocation/03.replace-cca-position-preferences.sql` so a future task can swap to it.

3. ~~**`cca_user_preferences.rank` semantics for sports/culture applications.**~~ **Moot 2026-05-18:** sportsCulture applications no longer write to `cca_user_preferences` at all — they write `cca_appointments` via the SECURITY DEFINER RPC. No rank-namespace overlap with the chair-managed market.

4. **`applied_count` semantics.** The legacy `cca_capacity_info.applied_count` measured rows in `cca_user_ranking` (chair-managed). After this refactor, `applied_count` is the count of `cca_position_preferences` rows for the position. The user-side count (rows in `cca_user_preferences`) is invisible to chairs (RLS); a chair sees only their own ranked list. UX assumption check needed: does the UI expect `applied_count` to mean "how many residents expressed interest" or "how many I have ranked"? Current behavior is the latter. **Flag for product confirmation.**

5. **`internal.can_manage_applications` vs `internal.can_manage_cca_appointments`.** The wiki `wiki/domain/cca-allocation.md` references `internal.can_manage_applications` but no such function is shipped (`function/core/` only has `can_manage_cca_appointments`). Treat the wiki page as stale and document the actual gate in section 4. **Action:** request `/wiki-deepen` on `wiki/domain/cca-allocation.md` to fix the function name.

6. ~~**Removed `cca_allocation_events` audit trail.**~~ **Resolved 2026-05-18:** product confirmed no replacement audit table is needed. Tasks F and J drop the writes.

7. **`cca_preference_pairs` for analytics.** Useful for a future "view the full market" admin page but `security_invoker = on` means a chair sees only their `position_rank` side and a user sees only their `user_rank` side. A `service_role` analytics consumer (Go pipeline) can read both; flag for plan 03 or a future analytics plan.

8. **`enum.position_type` `"team manager"` literal.** The enum value has a space (`'team manager'`). The current code mixes lowercased literals (`["member","team manager"]`) with Set membership checks. Confirm that Supabase JS `.in()` with a quoted space round-trips correctly to Postgres — it does, but lint configurations sometimes strip whitespace. Flag for verification during task F local smoke.
