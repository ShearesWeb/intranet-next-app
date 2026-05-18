# 02 — CCA Model & Membership Management — Schema Refactor Plan

## 1. Goal & scope

Bring the CCA model and membership-management API surface (`/api/cca/[ccaId]/{members,addMember,removeMember,updateMember,searchUsers}`, `/api/cca/managedPositions`) and their shared helpers (`managed-cca-data.ts`, `cca-management-access.ts`, `cca-chair-access.ts`, `CCAPosition.ts`) into alignment with the post-refactor Supabase schema (`ccas`, `cca_positions`, `cca_appointments`, `cca_appointment_evaluations`, view `managed_cca_positions`, view `public_user_info`, view `authenticated_user_directory`, function `internal.can_manage_cca_appointments`).

In scope:
- Removal of references to dropped tables (`cca_member_rankings`, `cca_allocation_events`).
- Removal of dropped columns (`cca_positions.tier_type`, `cca_appointments.comments`).
- Fixing `public_user_info` joins that select columns the view no longer exposes (`email`, `room`).
- Trusting RLS / `internal.can_manage_cca_appointments` and the constraint trigger `internal.validate_cca_appointment` to gate writes; pruning duplicated capacity / duplicate-row checks where the DB now enforces them.
- Adjusting the `cca-management-access`/`cca-chair-access` helpers if their direct DB calls drift from the new view shape.

Out of scope (flagged in §7):
- Ranking POST/GET endpoints under `/api/cca/[ccaId]/rankings` and `/api/cca/rankings/all` — owned by 03-PLAN-member-ranking.
- Chair allocation routes (`/api/chair/positions/*`) — owned by 04-PLAN-cca-allocation.
- `fetchUserInfo`, `authenticated_user_info` consumption — owned by 01-PLAN-auth-and-user.
- Any UI/page changes — out of scope for the API refactor.
- Holiday subsidy / sportsCulture routes — owned by 04/05 plans.

## 2. Files in scope

API routes:
- `/Users/bytedance/intranet-next-app/src/app/api/cca/[ccaId]/members/route.ts`
- `/Users/bytedance/intranet-next-app/src/app/api/cca/[ccaId]/addMember/route.ts`
- `/Users/bytedance/intranet-next-app/src/app/api/cca/[ccaId]/removeMember/route.ts`
- `/Users/bytedance/intranet-next-app/src/app/api/cca/[ccaId]/updateMember/route.ts`
- `/Users/bytedance/intranet-next-app/src/app/api/cca/[ccaId]/searchUsers/route.ts`
- `/Users/bytedance/intranet-next-app/src/app/api/cca/managedPositions/route.ts`

Lib / helper files:
- `/Users/bytedance/intranet-next-app/src/lib/managed-cca-data.ts`
- `/Users/bytedance/intranet-next-app/src/lib/__tests__/managed-cca-data.test.ts`
- `/Users/bytedance/intranet-next-app/src/features/cca/utils/cca-management-access.ts`
- `/Users/bytedance/intranet-next-app/src/features/cca/utils/cca-management-access.test.ts`
- `/Users/bytedance/intranet-next-app/src/features/cca/utils/cca-chair-access.ts`
- `/Users/bytedance/intranet-next-app/src/features/cca/types/members.ts`
- `/Users/bytedance/intranet-next-app/src/types/CCAPosition.ts`

Touched but not modified (consumer-side updates left to other plans, flagged for cross-domain handoff):
- `src/features/cca/utils/cca-cut-status.ts` (consumed; behaviour unchanged)
- `src/features/cca/utils/cca-member-management.ts` (consumed; behaviour unchanged)
- `src/features/ranking/utils/cca-ranking-comments.ts` (referenced from `updateMember`; ranking write path moves to 03-PLAN)

## 3. Schema mapping

### 3.1 `ccas` (table)

Wiki: [`wiki/entity/table/public.ccas.md`](../../../intranet-wiki/wiki/entity/table/public.ccas.md) (seed) → SQL source [`db/changelogs/table/core/03.cca.sql`](../../../intranet/db/changelogs/table/core/03.cca.sql).

Columns: `id, created_at, updated_at, name (unique), cca_type, tier_type DEFAULT 'none', description, image_url`.

RLS: public SELECT (`db/changelogs/security/core/03.cca.sql`); writes are service-role only.

Current code references (`members`, `addMember`, `removeMember`, `updateMember`, `searchUsers`):
- `.from("ccas").select("id, name, cca_type").eq("id", ccaId).single()` — **unchanged**, matches new schema.

### 3.2 `cca_positions` (table)

Wiki: [`wiki/entity/table/public.cca_positions.md`](../../../intranet-wiki/wiki/entity/table/public.cca_positions.md) (seed) → SQL source [`db/changelogs/table/core/04.cca-position.sql`](../../../intranet/db/changelogs/table/core/04.cca-position.sql).

Columns: `id, created_at, updated_at, cca_id, reporting_position, position_type, name, description, capacity` (UNIQUE `(name, cca_id)`; CHECK `capacity >= 0` from `security/core/04`).

**No `tier_type` column.** Position-level tiering does not exist on this table — `tier_type` lives only on `ccas`.

Trigger: `internal.validate_cca_position_reporting` rejects self-reporting / cycles / depth > 10.

| Current code | New schema | Notes |
| --- | --- | --- |
| `addMember`: `INSERT INTO cca_positions (cca_id, position_type, tier_type, name)` | `INSERT INTO cca_positions (cca_id, position_type, name)` | `tier_type` column removed — write would fail. |
| `members`: `select("id, name, position_type").eq("cca_id", X)` | unchanged | OK |
| `addMember/removeMember`: `select("id").eq("cca_id", X).eq("position_type", "member").single()` | unchanged | OK; `single()` is still safe (no unique constraint on `position_type` but only one "member" row exists per CCA by convention). |
| `addMember`: `select("id, cca_id, capacity").eq("id", X).single()` | unchanged | OK |

### 3.3 `cca_appointments` (table)

Wiki: [`wiki/entity/table/public.cca_appointments.md`](../../../intranet-wiki/wiki/entity/table/public.cca_appointments.md) (seed) → SQL source [`db/changelogs/table/core/05.cca-appointment.sql`](../../../intranet/db/changelogs/table/core/05.cca-appointment.sql).

Columns: `user_id, position_id, created_at, updated_at, points DEFAULT 0, commitment_period DEFAULT 'full-year', cut_status`. Composite PK `(user_id, position_id)`. **No `id` column. No `comments` column.** `points` is `NOT NULL` with CHECK `points >= 0`.

RLS (`db/changelogs/security/core/05.cca-appointment.sql`):
- `select_all` — public SELECT (anyone authenticated or anon can read appointments).
- `insert_authenticated`, `update_authenticated`, `delete_authenticated` — TO `authenticated`, gated by `internal.can_manage_cca_appointments(position_id, internal.auth_user_id())`.

Constraint trigger: `internal.validate_cca_appointment` (`AFTER INSERT OR UPDATE DEFERRABLE INITIALLY DEFERRED`) enforces:
- One non-resident appointment per CCA per commitment period (semester-1, semester-2, or full-year), and
- Position `capacity` per semester.

| Current code | New schema | Notes |
| --- | --- | --- |
| `addMember`: `.select("id").eq("user_id").eq("position_id").single()` to check existing appointment | `.select("user_id, position_id")` (no `id` column) | `id` doesn't exist; the duplicate check still works on the composite key. |
| `addMember`: insert `{ user_id, position_id, points: 0, commitment_period }` | unchanged | `points: 0` matches default but is redundant; `commitment_period` may be `undefined` from clients — must default to `'full-year'` if missing or omit the field to let the column default fire. |
| `addMember`: pre-insert capacity check (`select count(*) where position_id = X`) | redundant with trigger | Trigger raises if capacity exceeded; keep app-side check only for friendly UX, but rely on DB for correctness. |
| `removeMember`: `.delete().eq("user_id").eq("position_id")` | unchanged | OK; RLS will reject if caller is not in chain-of-managers. |
| `updateMember`: `.update({cut_status, commitment_period, comments}).select("user_id, position_id").eq(...)` | drop `comments`; rest unchanged | **`comments` is not a column on `cca_appointments` in the new schema.** Write fails today / will fail with refactored schema. Comments now live in `cca_appointment_evaluations.scores` (JSONB) — see 03-PLAN-member-ranking. |
| `members`: `select("user_id, points, created_at, cut_status, commitment_period, public_user_info!inner(...), cca_positions!inner(...)").eq("cca_positions.cca_id", X)` | unchanged on `cca_appointments` side; `public_user_info` join must drop `email, room` — see §3.5 | OK on appointment columns; user join broken. |

### 3.4 `cca_appointment_evaluations` (table — NEW)

Wiki: [`wiki/entity/table/public.cca_appointment_evaluations.md`](../../../intranet-wiki/wiki/entity/table/public.cca_appointment_evaluations.md) (seed) → SQL source [`db/changelogs/table/evaluations/01.cca-appointment-evaluations.sql`](../../../intranet/db/changelogs/table/evaluations/01.cca-appointment-evaluations.sql).

Columns: `id SERIAL, user_id, position_id, scores JSONB (CHECK object + non-empty), created_at, updated_at`. UNIQUE `(user_id, position_id)`. FK `(user_id, position_id) → cca_appointments(user_id, position_id) ON DELETE CASCADE`.

RLS (`db/changelogs/security/evaluations/01.cca-appointment-evaluations.sql`): all four operations gated by `internal.can_manage_cca_appointments(position_id, internal.auth_user_id())` — **including SELECT** (no public read).

**Replaces** the legacy `cca_member_rankings` table referenced by:
- `updateMember/route.ts` (lines 144–172): upsert into `cca_member_rankings` with `{ user_id, position_id, ranking, comments, updated_at }`.

In this plan we **stop writing rankings from `updateMember`** and document the cross-domain handoff: clients that want to update evaluations alongside member status should call the ranking endpoints in 03-PLAN. Reasoning: `cca_appointment_evaluations.scores` is JSONB (no `ranking`/`comments` columns), and the metric/comment encoding now lives in `src/features/ranking/utils/cca-ranking-comments.ts`. Keeping the dual write here would re-introduce stale schema knowledge inside a route that no longer owns evaluations.

### 3.5 `public_user_info` (view) and `authenticated_user_directory` (view)

Wiki: [`wiki/entity/view/public.public_user_info.md`](../../../intranet-wiki/wiki/entity/view/public.public_user_info.md) (seed) → SQL [`db/changelogs/view/core/01.public-user-info.sql`](../../../intranet/db/changelogs/view/core/01.public-user-info.sql).

`public_user_info` exposes only `(id, name, profile_photo_path)` — granted to `anon, authenticated`, `security_invoker = on`.

Wiki: [`wiki/entity/view/public.authenticated_user_directory.md`](../../../intranet-wiki/wiki/entity/view/public.authenticated_user_directory.md) (seed) → SQL [`db/changelogs/view/core/05.authenticated-user-directory.sql`](../../../intranet/db/changelogs/view/core/05.authenticated-user-directory.sql).

`authenticated_user_directory` exposes `(id, email, name, room, telegram_handle, profile_photo_path)` — granted to `authenticated` only, `security_invoker = on`. Note the wiki page lists `display_name` and `stay_period` but the SQL does not include them; trust the SQL.

| Current code | New schema | Notes |
| --- | --- | --- |
| `members`: nested select `public_user_info!inner(id, name, email, room)` | join must use `authenticated_user_directory!inner(id, name, email, room)` | `email, room` no longer on `public_user_info`. |
| `searchUsers`: `from("public_user_info").select("id, name, email, room").or("name.ilike.%,email.ilike.%,room.ilike.%")` | `from("authenticated_user_directory")` with the same columns/filter | Same fix. |

PostgREST embed targets the view name as a relationship — the embed `public_user_info!inner(...)` resolves through the FK on `cca_appointments.user_id`. The `authenticated_user_directory` view also has an `id` aligned to `users.id`, so the embed should resolve symmetrically; **verify** at runtime (see §6, step 4).

### 3.6 `managed_cca_positions` (view)

Wiki: [`wiki/entity/view/public.managed_cca_positions.md`](../../../intranet-wiki/wiki/entity/view/public.managed_cca_positions.md) (seed) → SQL [`db/changelogs/view/core/04.managed-cca-positions.sql`](../../../intranet/db/changelogs/view/core/04.managed-cca-positions.sql).

Columns: `cca_id, cca_name, positions` (JSON aggregate). Each `positions[]` element is:
```
{
  position_id INT,
  position_name TEXT,
  position_type enum.position_type,
  description TEXT,
  access_depth INT
}
```

Properties: `security_invoker = on`, granted to `authenticated`. Internally uses `internal.auth_user_id()` so every caller sees only their own row(s). The view emits one row per `(cca where the caller is a member OR has reporting access)` and aggregates all positions the caller can manage in that CCA (depth ≤ 10, cycles filtered).

Current code references:
- `cca-management-access.ts`: `.from("managed_cca_positions").select("cca_id, cca_name, positions").eq("cca_id", X).maybeSingle()` — **unchanged**, matches new view.
- `managed-cca-data.ts`: `.from("managed_cca_positions").select("*")` then re-joins to `ccas` by id — **unchanged**, but consider that `cca_name` is now always populated from the view (so we no longer need the chair-appointment fallback for the display name except for chair-only CCAs not surfaced by `position_access` recursion).

No column mismatches; the shape matches the existing `ManagedCcaViewRow` / `ManagedCcaAccessRow` types.

### 3.7 `internal.can_manage_cca_appointments` (function)

Wiki: [`wiki/entity/function/internal.can_manage_cca_appointments.md`](../../../intranet-wiki/wiki/entity/function/internal.can_manage_cca_appointments.md) (seed) → SQL [`db/changelogs/function/core/05.can-manage-cca-appointments.sql`](../../../intranet/db/changelogs/function/core/05.can-manage-cca-appointments.sql).

Signature: `(p_position_id INT, p_actor_user_id INT) RETURNS BOOLEAN`, `SECURITY DEFINER`. Granted EXECUTE to `authenticated`.

Semantics: walks the recursive `reporting_position` chain *upward* from `p_position_id` and returns TRUE iff the actor holds any appointment on a position in that chain (depth ≤ 10). RAISES if the chain hits depth 10 without termination.

Not directly called from API code (used only inside RLS policies and the `managed_cca_positions` view). Our app-side helper `checkCcaAuthorization` approximates this from `requestingUser.appointments`, treating `lead`/`vice` appointments on the *same* CCA as the only chair signal. That is **narrower than the DB definition** (which would also count subcomm/maincomm holders reporting up from a child position). See §4 for the implication.

### 3.8 Enum values

- `enum.cca_type` ([`enum/01.cca-type.sql`](../../../intranet/db/changelogs/enum/01.cca-type.sql)): `sports, committee, culture, jcrc, adhoc, supplementary`. App `types/User.ts` currently models `CcaType = "sports" | "culture" | "committee" | string` — does not name `jcrc | adhoc | supplementary` but the trailing `string` keeps it from breaking. Recommended (low priority) to broaden in types.
- `enum.position_type` ([`enum/03.position-type.sql`](../../../intranet/db/changelogs/enum/03.position-type.sql)): `lead, vice, blockcomm, maincomm, subcomm, team manager, member, resident`. App types already list these correctly.
- `enum.commitment_period` ([`enum/04.commitment-period.sql`](../../../intranet/db/changelogs/enum/04.commitment-period.sql)): `semester-1, semester-2, full-year`. Matches app `CommitmentPeriod`.
- `enum.cut_status` ([`enum/05.cut-status.sql`](../../../intranet/db/changelogs/enum/05.cut-status.sql)): `ivp-ihg-team, ihg-team, final-cut, first-cut`. Matches app `CutStatus`.

### 3.9 Dropped tables referenced by current code

- **`cca_member_rankings`** — gone. Used in `updateMember/route.ts` (write only). Replacement is `cca_appointment_evaluations` (JSONB scores) but this domain stops writing it (see §3.4).
- **`cca_allocation_events`** — gone. Used in `removeMember/route.ts` (log on cut). No replacement in the new schema; the audit-log concept is not surfaced by the wiki. Drop the write; if a replacement is later required, raise it as an open question.

## 4. Authorization / RLS impact

### 4.1 Trust model shift

The new schema enforces chair-style authorization in the database via `internal.can_manage_cca_appointments` (RLS on `cca_appointments` writes and `cca_appointment_evaluations` all operations). That function uses the **reporting chain** rather than a simple "is this user lead/vice of this CCA?" check.

- DB definition: actor must hold an appointment on `p_position_id` or any ancestor up to depth 10.
- App helper `checkCcaAuthorization` (`cca-chair-access.ts`): actor must have a `lead`/`vice` appointment on the same `cca_id`.

**Implication.** A user who is e.g. a `maincomm` member whose position reports up to a sub-CCA position they manage would be allowed by the DB but rejected by the app helper. Conversely, a `lead` of CCA A who has no DB reporting link to a position in CCA B would be rejected by the DB but allowed if app code uses only `checkCcaAuthorization`.

**Product decision (2026-05-18):** widen the app-side check to match the DB. The DB function is authoritative; the app's narrow `lead`/`vice` predicate under-grants permissions and causes UX regressions for reporting-chain managers (e.g. a `maincomm` head should be able to manage a `subcomm` member's record).

The widening lives in plan task 7 and depends on the public RPC wrappers documented in `MIGRATIONS.md` §2 (`public.can_manage_cca_appointments(p_position_id INT)` and `public.can_manage_any_position_in_cca(p_cca_id INT)`). Until those land, plan 02 keeps the narrow check as a temporary shim — task 7 is feature-flagged on RPC availability.

We continue to rely on RLS as the authoritative enforcement layer; the widened app helper exists only to short-circuit with a friendly 403 instead of letting a Supabase RLS denial surface as an opaque error.

### 4.2 `managed_cca_positions` view semantics

`security_invoker = on` means the view runs with the caller's grants and RLS — but it explicitly filters on `internal.auth_user_id()` internally, so the caller never sees rows for other users. Our `.eq("cca_id", X)` filter combined with this gives one row when the caller has any access to CCA X, otherwise no row.

`cca-management-access.ts` should treat:
- `managedCca === null` as "no access via reporting chain".
- `chairAccessResult.data.hasChairAccess` (from JWT/appointments) as the lead/vice signal.

These two signals are independent: a user can be `lead` of CCA A (chair access true, managed positions also populated by the view's `member_ccas` branch) or only an upstream chair without a direct appointment in A (only the view shows access). The current code already merges both correctly; no change required to the merge logic.

### 4.3 `cca_appointment_evaluations` RLS

All operations (including SELECT) are gated by `internal.can_manage_cca_appointments`. **Anonymous and same-CCA-member reads are not permitted.** The ranking domain (03-PLAN) must rely on this for SELECT/UPSERT; the `updateMember` route should stop touching it (consistent with §3.4).

### 4.4 `validate_cca_appointment` trigger (DEFERRED constraint)

Because the trigger is `DEFERRABLE INITIALLY DEFERRED`, batch operations that temporarily violate capacity inside a transaction will succeed if the net result is valid at commit. Supabase REST does not begin a transaction for us, so each insert/update is its own transaction — the trigger fires immediately. **App-side capacity pre-checks are redundant** in single-row inserts but harmless for friendly error messaging. Keep pre-checks only where they materially improve UX; otherwise let the trigger error bubble.

The "one non-resident appointment per CCA commitment period" rule is now enforced server-side. The `addMember` route's existing "User is already appointed to this position" check is finer-grained (PK conflict on `(user_id, position_id)`) and stays useful.

### 4.5 RLS impact on the result-type helpers

The current `getManagedCcaAccess` returns `{ ok: false, status: 401 }` for unauthenticated callers and `{ ok: false, status: 403, error: "You are not authorized..." }` for callers with no access in the view. The error wording should stay; only the field selections change.

`checkCcaAuthorization` reads exclusively from `requestingUser.appointments` (JWT-resolved cache), not the DB, so the schema change does not touch its implementation. The shape of `UserAppointment.position_type` must still match `enum.position_type` (it does — see §3.8).

## 5. Tasks

Each task is intentionally bite-sized. Apply in order; nothing earlier depends on anything later.

### Task 1 — Fix `public_user_info` joins in `members/route.ts`

File: `/Users/bytedance/intranet-next-app/src/app/api/cca/[ccaId]/members/route.ts`

- [ ] Change the embed in the `.from("cca_appointments").select(...)` call from `public_user_info!inner(id, name, email, room)` to `authenticated_user_directory!inner(id, name, email, room)` (line 92).
- [ ] Update `MemberWithJoins` in `src/features/cca/types/members.ts` to use `authenticated_user_directory: MemberJoinUser | MemberJoinUser[] | null` and rename the access in lines 113–114 of the route accordingly.
- [ ] Verification: `npm run build` succeeds; run the route locally with a member-managing user and confirm the response includes `email` and `room`.

Before / after sketch (just the embed):
```ts
// before
.select(`
    user_id, points, created_at, cut_status, commitment_period,
    public_user_info!inner(id, name, email, room),
    cca_positions!inner(id, name, position_type, cca_id)
`)
// after
.select(`
    user_id, points, created_at, cut_status, commitment_period,
    authenticated_user_directory!inner(id, name, email, room),
    cca_positions!inner(id, name, position_type, cca_id)
`)
```

### Task 2 — Fix `searchUsers/route.ts` directory view

File: `/Users/bytedance/intranet-next-app/src/app/api/cca/[ccaId]/searchUsers/route.ts`

- [ ] Replace `.from("public_user_info")` with `.from("authenticated_user_directory")` (line 57).
- [ ] Keep the same column selection `("id, name, email, room")` and `.or(...)` predicate.
- [ ] Verification: search by partial email/room as a chair returns matching residents.

### Task 3 — Remove dropped column writes in `addMember/route.ts`

File: `/Users/bytedance/intranet-next-app/src/app/api/cca/[ccaId]/addMember/route.ts`

- [ ] Remove `tier_type: "none"` from the `cca_positions` insert (lines 76–82). `cca_positions` has no `tier_type` column.
- [ ] Either default `commitment_period` to `'full-year'` when undefined, or omit the field on insert to let the DB default fire. Recommended: drop the field if undefined, so explicit caller values are honoured (line 147).
- [ ] Remove the manual capacity pre-check (lines 126–140) **or** keep it for UX only and add a comment that `internal.validate_cca_appointment` is the authoritative guard. Recommended: keep pre-check with a comment.
- [ ] Change the existing-appointment lookup (line 96–100) from `.select("id")` to `.select("user_id, position_id")` since `cca_appointments` has no `id` column.
- [ ] Verification: add a member to a CCA you chair; add the same user again (expect 400); attempt to add when capacity is full (expect 400 with capacity error from trigger).

Before / after sketch (member-position creation):
```ts
// before
.insert({ cca_id: ccaData.id, position_type: "member", tier_type: "none", name: "Member" })
// after
.insert({ cca_id: ccaData.id, position_type: "member", name: "Member" })
```

### Task 4 — Remove dropped table writes in `removeMember/route.ts`

File: `/Users/bytedance/intranet-next-app/src/app/api/cca/[ccaId]/removeMember/route.ts`

- [ ] Delete the `cca_allocation_events` insert block (lines 89–99). The table no longer exists in the new schema; the wiki does not list a replacement.
- [ ] Leave the `cca_appointments` delete unchanged.
- [ ] Verification: removing a member returns `{ success: true }`; no Postgres errors about missing relation `cca_allocation_events`.

### Task 5 — Strip `comments` write and `cca_member_rankings` upsert in `updateMember/route.ts`

File: `/Users/bytedance/intranet-next-app/src/app/api/cca/[ccaId]/updateMember/route.ts`

- [x] Remove `comments` from the `MemberUpdate` type in `src/features/cca/types/members.ts` (line 83) — `cca_appointments` has no `comments` column.
- [x] Remove the `if (comments !== undefined) updates.comments = comments;` line in the route (line 111).
- [x] Remove the entire `cca_member_rankings` upsert block (lines 144–172) and the `buildRankingComments` import. Add a code comment pointing clients to `/api/cca/[ccaId]/rankings` (the 03-PLAN endpoint) for evaluation writes.
- [x] Trim the request-body destructure to drop `comments, ranking, attendance_rating, performance_rating` (they are no longer used by this route).
- [x] Verification: `npx tsc --noEmit` clean for both files; ranking-fields call-graph dead from UI per plan 03 §summary.

Cross-domain note: `subsidy-declaration-form-dialog.tsx` and ranking pages currently call this route with ranking fields. Those callers move to the ranking endpoint owned by 03-PLAN. **Flag in §7**.

### Task 6 — Audit `cca-management-access.ts` against the new view shape

File: `/Users/bytedance/intranet-next-app/src/features/cca/utils/cca-management-access.ts`

- [ ] No column changes required (view shape matches). Verify by reading the SQL once more.
- [ ] Add a docstring comment on `getManagedCcaAccess` documenting that:
  - RLS / `internal.can_manage_cca_appointments` is the authoritative guard for writes.
  - This helper only short-circuits with a friendly 403; the DB still enforces.
- [ ] Update the test file `cca-management-access.test.ts` is already consistent (selects `cca_id, cca_name, positions`) — no change needed unless lint flags the comment changes.
- [ ] Verification: `npm test -- cca-management-access` (or repo-equivalent vitest run) passes.

### Task 7 — Widen `cca-chair-access.ts` to match DB authorization

File: `/Users/bytedance/intranet-next-app/src/features/cca/utils/cca-chair-access.ts`

**Prerequisite:** `MIGRATIONS.md` §2 must be deployed (the public wrappers `public.can_manage_cca_appointments(p_position_id INT)` and `public.can_manage_any_position_in_cca(p_cca_id INT)`).

**Goal:** replace the in-memory `lead`/`vice` check with a server-side call to the DB function, so the app honours the full reporting-chain semantics (e.g. a `maincomm` head can manage a `subcomm` member's record).

- [ ] Add a new async helper `canManageCcaServerSide(supabase, ccaId): Promise<boolean>` that calls `supabase.rpc("can_manage_any_position_in_cca", { p_cca_id: ccaId })` and returns the boolean. Treat `null`/error responses as `false`.
- [ ] Keep the existing synchronous `isChairPositionType` and `CHAIR_POSITION_TYPES` for client-side UI hints (e.g. menu visibility) — they are no longer authoritative but remain useful as fast-path predicates from JWT appointments.
- [ ] Refactor `checkCcaAuthorization` to take an optional `supabase` argument. When provided, it uses `canManageCcaServerSide` to extend the result; when omitted, it falls back to the JWT-only `lead`/`vice` check and marks the result as `degraded: true` so callers can decide whether to retry with a server check.
- [ ] Update `AccessResult<T>` to `AccessResult<T> & { degraded?: boolean }` so consumers can distinguish "definitely no access" from "JWT says no but DB might say yes".
- [ ] Sweep all consumers (`members/route.ts`, `addMember/route.ts`, `removeMember/route.ts`, `updateMember/route.ts`, `searchUsers/route.ts`, `managedPositions/route.ts`, plus `cca-management-access.ts`): pass the `supabase` client so they get the widened check.

Before / after sketch:
```ts
// before
export function checkCcaAuthorization({ requestingUser, cca }: Args): AccessResult<...> {
    const chairAppointment = requestingUser.appointments.find(
        a => a.cca_id === cca.id && CHAIR_POSITION_TYPES.has(a.position_type),
    );
    return chairAppointment
        ? { ok: true, data: { ... } }
        : { ok: false, status: 403, error: "..." };
}

// after
export async function checkCcaAuthorization({ requestingUser, cca, supabase }: Args)
: Promise<AccessResult<...>> {
    // 1. JWT fast path
    const chairAppointment = requestingUser.appointments.find(
        a => a.cca_id === cca.id && CHAIR_POSITION_TYPES.has(a.position_type),
    );
    if (chairAppointment) return { ok: true, data: { ... } };

    // 2. DB widened check (reporting-chain managers)
    if (supabase) {
        const { data: canManage } = await supabase.rpc(
            "can_manage_any_position_in_cca",
            { p_cca_id: cca.id },
        );
        if (canManage === true) return { ok: true, data: { viaReportingChain: true, ... } };
    }
    return { ok: false, status: 403, error: "You are not authorized..." };
}
```

- [ ] Add a JSDoc comment explaining that this function is now async because the DB check requires a round-trip; consumers in tight loops should call it once and reuse the result.
- [ ] Verification: with a test user appointed as a `maincomm` head whose chain reaches a `subcomm` member position, hit `GET /api/cca/[ccaId]/members` for the subcomm's CCA — must succeed (was 403 before).

### Task 8 — Audit `managed-cca-data.ts` against new view shape

File: `/Users/bytedance/intranet-next-app/src/lib/managed-cca-data.ts`

- [ ] Confirm the `ManagedCcaViewRow` shape (`{ cca_id, cca_name, positions }`) matches the new view (it does).
- [ ] No column changes. Optional cleanup: the `cca_type: CcaType | "committee"` default in `ManagedCcaPositionsRow` can stay; the new `enum.cca_type` includes `committee` so the fallback is still a valid enum value.
- [ ] Verification: `npm test -- managed-cca-data` (the existing test file) still passes.

### Task 9 — Tighten `CCAPosition.ts` against new schema

File: `/Users/bytedance/intranet-next-app/src/types/CCAPosition.ts`

- [ ] Current shape:
  ```ts
  export interface CCAPosition {
      cca_id: number;
      cca_name: string;
      position_id: number;
      position_name: string;
      is_admin: boolean;
  }
  ```
- [ ] The `is_admin` flag was a derived field surfaced by the *old* user-info view. The new `authenticated_user_appointments` view (consumed via `authenticated_user_info`) emits appointments without `is_admin` (it lives at the top-level on `authenticated_user_info` instead, projected by `authenticated_user_roles`).
- [ ] Cross-domain check: `fetchUserInfo` (01-PLAN) is the producer of `appointments[]`. If 01-PLAN drops `is_admin` from each appointment, drop it here too. Otherwise keep as-is.
- [ ] Action for this plan: **leave `is_admin` in place** but tag a TODO referencing 01-PLAN, and verify nothing in this domain reads `appointment.is_admin` (grep confirms it's not used by any file in §2).
- [ ] Verification: `grep -R "appointment.is_admin\|\.is_admin" src/features/cca src/lib/managed-cca-data.ts src/app/api/cca` returns no hits.

### Task 10 — Tidy `types/members.ts` after Task 1 & Task 5

File: `/Users/bytedance/intranet-next-app/src/features/cca/types/members.ts`

- [ ] Rename `MemberWithJoins.public_user_info` to `authenticated_user_directory` (matches the new embed name).
- [ ] Drop `comments` from `MemberUpdate`.
- [ ] Verification: `tsc --noEmit` clean across the `cca` feature.

### Task 11 — `managedPositions/route.ts` — no DB changes, only feature-flag review

File: `/Users/bytedance/intranet-next-app/src/app/api/cca/managedPositions/route.ts`

- [ ] No schema mismatch — the route reads via `getManagedCcaData(supabase, user)` which we audited in Task 8.
- [ ] Verify the feature-flag gating still makes sense: `isCoreServiceEnabled("memberRanking", ...)` is checked twice with different `isJcrc` inputs. This is unchanged by the schema refactor; no action.
- [ ] Verification: `curl /api/cca/managedPositions` (as a lead user) returns the merged chair + reporting-chain CCAs.

## 6. Verification

Run these after each major task and at the end of the plan.

1. Build & typecheck:
   ```sh
   cd /Users/bytedance/intranet-next-app && npm run build
   ```
2. Lint (informational — ESLint does not block builds per `next.config.mjs`):
   ```sh
   cd /Users/bytedance/intranet-next-app && npm run lint
   ```
3. Unit tests (vitest):
   ```sh
   cd /Users/bytedance/intranet-next-app && npx vitest run src/features/cca src/lib/__tests__/managed-cca-data.test.ts
   ```
4. End-to-end manual smoke as a chair user on a local Supabase pointed at the new schema:
   ```sh
   curl -s -b "$COOKIE_JAR" http://localhost:3000/api/cca/<ccaId>/members | jq '.groupedMembers, .total_members'
   curl -s -b "$COOKIE_JAR" "http://localhost:3000/api/cca/<ccaId>/searchUsers?query=ron" | jq '.data'
   curl -s -b "$COOKIE_JAR" -X POST http://localhost:3000/api/cca/<ccaId>/addMember \
     -H 'content-type: application/json' \
     -d '{"user_id": <uid>, "commitment_period": "full-year"}'
   curl -s -b "$COOKIE_JAR" -X POST http://localhost:3000/api/cca/<ccaId>/updateMember \
     -H 'content-type: application/json' \
     -d '{"user_id": <uid>, "position_id": <pid>, "cut_status": "first-cut"}'
   curl -s -b "$COOKIE_JAR" -X POST http://localhost:3000/api/cca/<ccaId>/removeMember \
     -H 'content-type: application/json' \
     -d '{"user_id": <uid>}'
   curl -s -b "$COOKIE_JAR" http://localhost:3000/api/cca/managedPositions | jq 'length'
   ```
5. Database-side verification (as `authenticated` role with a JWT for the chair user, via psql / Supabase studio SQL editor):
   ```sql
   -- Confirm RLS path
   SELECT internal.can_manage_cca_appointments(<position_id>, internal.auth_user_id());
   -- Confirm view returns expected shape
   SELECT cca_id, cca_name, jsonb_array_length(positions::jsonb) AS n FROM managed_cca_positions;
   -- Confirm join targets exist
   \d+ authenticated_user_directory
   \d+ public_user_info
   ```
6. Grep for residual stale references after the refactor:
   ```sh
   grep -RIn "cca_member_rankings\|cca_allocation_events\|public_user_info!inner(.*email\|tier_type" \
     /Users/bytedance/intranet-next-app/src/app/api/cca \
     /Users/bytedance/intranet-next-app/src/features/cca \
     /Users/bytedance/intranet-next-app/src/lib/managed-cca-data.ts
   ```
   Expected output: empty.

## 7. Open questions

- **Removed audit log.** `cca_allocation_events` is gone with no documented replacement. Confirm with the schema owner whether allocation cut/uncut events should be persisted at all, or whether the new `cut_status` enum on `cca_appointments` is the sole record. If a replacement table is planned, raise a separate ticket — Task 4 currently drops the write entirely.
- **Comments on appointments.** `cca_appointments.comments` was dropped. The wiki places member-level prose on `cca_appointment_evaluations.scores` (JSONB). Confirm with 03-PLAN-member-ranking that comments are still surfaced to the chair UI through the ranking endpoint; if not, the `Member.comments` UI field becomes orphaned.
- **Ranking write removal from `updateMember`.** Task 5 stops writing rankings here, but at least one consumer (the rank-members dialog) currently relies on this side-effect. Cross-domain handoff: 03-PLAN must ensure the rank-members dialog posts to `/api/cca/[ccaId]/rankings` directly, or the UI subagent must update the dialog. Flag in 03-PLAN's open questions too.
- **`is_admin` on `CCAPosition`.** The new `authenticated_user_info` view does not emit `is_admin` per appointment (it emits `is_admin` at the top level as a role flag). Decide with 01-PLAN-auth-and-user whether to drop the field from `CCAPosition`.
- ~~**Wider chair authorization.**~~ **Resolved 2026-05-18:** product chose to widen — see Task 7 and `MIGRATIONS.md` §2 for the required public RPC wrappers.
- **`public_user_info` join targets for embeds.** PostgREST resolves `authenticated_user_directory!inner(...)` only if the view exposes a referenced FK target. The wiki and SQL confirm the `id` column is the same `users.id` underlying the view, but the embed syntax depends on PostgREST's relationship inference. **Verify at runtime (§6 step 4).** If the embed does not resolve, fall back to two queries: fetch appointments, then `.in("id", userIds)` against `authenticated_user_directory`.
- **`cca_type` enum widening.** New enum includes `jcrc, adhoc, supplementary`. `src/types/User.ts` `CcaType` only narrows `sports | culture | committee`. Not breaking due to the trailing `string`, but a follow-up to broaden the union improves type safety. Out of scope here; flag for a future cleanup pass.
