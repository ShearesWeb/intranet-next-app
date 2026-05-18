# DB Migrations Required for API Refactor

> **Status update 2026-05-18:** the DB team responded in `../intranet/docs/handoff/2026-05-18-next-app-migrations-response.md`. Summary:
>
> | # | Status | Notes |
> |---|---|---|
> | 1 sportsCulture RPCs | **REJECTED** | DB team says self-apply is not a supported semantic; route must be removed or repurposed. See §1 below. |
> | 2 public wrappers | Shipping as specified | `public.can_manage_cca_appointments(p_position_id)` + `public.can_manage_any_position_in_cca(p_cca_id)` |
> | 3 hours column | Shipping | `cca_user_subsidies.hours` NUMERIC(5,2); frozen post-approval |
> | 4 comments column | Shipping | `cca_user_subsidies.comments` TEXT; frozen post-approval |
> | 5 justification + RPC | Shipping | `cca_subsidies.justification` TEXT; `upsert_subsidy(p_position_id, p_day, p_hours, p_justification)` |
>
> One **additional** signature change shipped that we didn't request: `upsert_user_subsidy` now takes `(p_subsidy_id, p_user_id, p_hours, p_comments)` — the per-user `hours`/`comments` are written through the RPC, not direct UPDATE. Plan 05 tasks must use this RPC for chair-side per-user writes.
>
> Read `../intranet/docs/handoff/2026-05-18-next-app-migrations-response.md` for the full response. Plans below are amended in-line where the shipped signature differs from the request.

This document lists the database changes the `intranet-next-app` schema-refactor depends on. The intranet/DB team owns the actual SQL — these are **requirements**, not drafts. Each requirement names the API plan that consumes it so the schema landing order can be coordinated.

The wiki convention for changelog placement is documented at `wiki/convention/liquibase.md`. Suggested paths are illustrative; the DB team may choose differently.

---

## 1. SECURITY DEFINER RPC for sportsCulture self-apply — REJECTED BY DB TEAM

> **DB team response (2026-05-18):** Not shipping. The schema does not support member self-apply by design; sports/culture chairs and vices manage member appointments via the existing RLS path (`internal.can_manage_cca_appointments` walks the reporting chain). The `/api/sportsCulture/apply` route should be **removed or repurposed to a chair-facing endpoint**, not preserved as self-apply. Full rationale in `../intranet/docs/handoff/2026-05-18-next-app-migrations-response.md` §1.
>
> **Implication for the app:** product's "preserve instant-appointment behavior" decision (2026-05-18, plan 04 task F) is unworkable as-stated. Three viable paths, listed for product:
> 1. **Remove the route.** Members no longer have a self-service "apply" UX for sports/culture; chairs add them via the existing membership-management flow.
> 2. **Pivot to preferences.** Original plan 04 design — `/api/sportsCulture/apply` writes `cca_user_preferences` via `upsert_cca_user_preference`. UX changes: apply = expressed interest, not joined.
> 3. **Re-open with DB team.** If there is a strong product case for self-apply (e.g. tier-1 walk-on CCAs with no waiting list), surface concrete scenarios and request a scoped RPC with explicit eligibility rules.
>
> The original request below is retained for historical context; do not implement.

**Consumer:** [04-PLAN-cca-allocation.md](04-PLAN-cca-allocation.md) — `src/app/api/sportsCulture/apply/route.ts`

**Why:** Product chose to preserve the current behavior (a sports/culture application IS an instant CCA appointment), but the new RLS on `cca_appointments` denies self-insert. The route needs a DB-side bypass that performs the same eligibility checks as `internal.validate_cca_appointment` (one non-resident appointment per CCA per commitment period, capacity not exceeded) and then writes the appointment as `service_role`.

**Required surface** (suggested signature; DB team picks final name):

```sql
CREATE OR REPLACE FUNCTION public.apply_sports_culture_position(
  p_position_id INT
) RETURNS cca_appointments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id INT := internal.auth_user_id();
  v_position cca_positions%ROWTYPE;
  v_cca ccas%ROWTYPE;
  v_appt cca_appointments;
BEGIN
  -- 1. Resolve & gate: position must be sports/culture, member or team manager
  SELECT * INTO v_position FROM cca_positions WHERE id = p_position_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'position % not found', p_position_id; END IF;

  SELECT * INTO v_cca FROM ccas WHERE id = v_position.cca_id;
  IF v_cca.cca_type NOT IN ('sports', 'culture') THEN
    RAISE EXCEPTION 'apply_sports_culture_position only allowed for sports/culture CCAs (got %)', v_cca.cca_type;
  END IF;
  IF v_position.position_type NOT IN ('member', 'team manager') THEN
    RAISE EXCEPTION 'apply_sports_culture_position only allowed for member/team-manager roles (got %)', v_position.position_type;
  END IF;

  -- 2. Insert; existing validate_cca_appointment trigger enforces capacity & uniqueness.
  INSERT INTO cca_appointments (user_id, position_id, points, commitment_period)
  VALUES (v_user_id, p_position_id, 0, 'full-year')
  RETURNING * INTO v_appt;

  RETURN v_appt;
END;
$$;

GRANT EXECUTE ON FUNCTION public.apply_sports_culture_position(INT) TO authenticated;
```

**Companion DELETE** — the route's DELETE handler (withdraw) also needs a bypass since `cca_appointments` DELETE is gated by `internal.can_manage_cca_appointments`:

```sql
CREATE OR REPLACE FUNCTION public.withdraw_sports_culture_position(
  p_position_id INT
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id INT := internal.auth_user_id();
  v_position cca_positions%ROWTYPE;
  v_cca ccas%ROWTYPE;
BEGIN
  SELECT * INTO v_position FROM cca_positions WHERE id = p_position_id;
  IF NOT FOUND THEN RETURN; END IF;
  SELECT * INTO v_cca FROM ccas WHERE id = v_position.cca_id;
  IF v_cca.cca_type NOT IN ('sports', 'culture') THEN
    RAISE EXCEPTION 'withdraw_sports_culture_position only allowed for sports/culture CCAs';
  END IF;
  IF v_position.position_type NOT IN ('member', 'team manager') THEN
    RAISE EXCEPTION 'withdraw_sports_culture_position only allowed for member/team-manager roles';
  END IF;

  DELETE FROM cca_appointments
  WHERE user_id = v_user_id AND position_id = p_position_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.withdraw_sports_culture_position(INT) TO authenticated;
```

**Suggested changelog path:** `db/changelogs/function/cca-allocation/03.apply-sports-culture-position.sql`

**Blocking:** Plan 04 tasks F (POST handler) and G (DELETE handler) cannot land cleanly until these RPCs exist.

---

## 2. Public RPC wrapper for `internal.can_manage_cca_appointments` — SHIPPED

> **DB team shipped** (2026-05-18, in `function/core/05.can-manage-cca-appointments.sql`). Both wrappers landed exactly as specified — `public.can_manage_cca_appointments(p_position_id INT)` and `public.can_manage_any_position_in_cca(p_cca_id INT)`, both `SECURITY INVOKER STABLE`, both granted to `authenticated`. The position-wrapper omits `p_user_id` (self-derives from `internal.auth_user_id()`) per the original spec. Returns `false` for unauthenticated callers.

**Consumer:** [02-PLAN-cca-model-and-management.md](02-PLAN-cca-model-and-management.md) — `src/features/cca/utils/cca-chair-access.ts` (and consumers across plans 03, 04, 05)

**Why:** Product chose to widen the app-side chair-access check to match the DB's reporting-chain semantics. The function `internal.can_manage_cca_appointments(p_position_id INT, p_user_id INT) RETURNS BOOLEAN` is in the `internal` schema, which Supabase PostgREST cannot call. A thin `public.*` SECURITY INVOKER wrapper is needed so the API can call it via `supabase.rpc()`.

**Required surface:**

```sql
CREATE OR REPLACE FUNCTION public.can_manage_cca_appointments(
  p_position_id INT
) RETURNS BOOLEAN
LANGUAGE sql
SECURITY INVOKER
STABLE
SET search_path = public
AS $$
  SELECT internal.can_manage_cca_appointments(p_position_id, internal.auth_user_id());
$$;

GRANT EXECUTE ON FUNCTION public.can_manage_cca_appointments(INT) TO authenticated;
```

Note the wrapper takes only `position_id` and derives the user from `internal.auth_user_id()` — there is no use case in the app for asking "can user X manage position Y" other than "can the caller manage position Y", and forcing self-derivation prevents privilege escalation.

A `can_manage_any_position_in_cca(p_cca_id INT)` variant may also be useful, returning TRUE if the caller can manage any position in the given CCA. Plans 02/03 use this to answer "is this user a chair of CCA X" without enumerating positions:

```sql
CREATE OR REPLACE FUNCTION public.can_manage_any_position_in_cca(
  p_cca_id INT
) RETURNS BOOLEAN
LANGUAGE sql
SECURITY INVOKER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM cca_positions p
    WHERE p.cca_id = p_cca_id
      AND internal.can_manage_cca_appointments(p.id, internal.auth_user_id())
  );
$$;

GRANT EXECUTE ON FUNCTION public.can_manage_any_position_in_cca(INT) TO authenticated;
```

**Suggested changelog path:** `db/changelogs/function/core/07.can-manage-cca-appointments-public.sql`

**Blocking:** Plan 02 task 7 (widen `cca-chair-access.ts`) — without these wrappers, the app cannot widen the check.

**Not blocking, but coordinated:** Plans 03, 04 currently consume `checkCcaAuthorization` (the narrow app helper). Once the wrappers exist and plan 02 swaps the helper, those callers benefit transparently.

---

## 3. Add `hours` column to `cca_user_subsidies` (per-user override) — SHIPPED

> **DB team shipped** (2026-05-18, in `table/subsidy/02.cca-user-subsidies.sql`). Column is `NUMERIC(5,2)` with CHECK `hours IS NULL OR hours >= 0`. **Frozen post-approval** — the state-machine trigger raises `Cannot modify hours after approval (id %)` if you try to UPDATE on an approved row, including direct PostgREST writes.
>
> **Write surface:** must go through `upsert_user_subsidy(p_subsidy_id, p_user_id, p_hours, p_comments)` (DB team added the parameters; see §3.5 below). Plan 05 chair-side per-user write tasks should call the RPC, not `.update({ hours })` directly.

**Consumer:** [05-PLAN-holiday-subsidy.md](05-PLAN-holiday-subsidy.md) — `src/app/api/holidaySubsidy/declarations/[ccaId]/route.ts`, `weekly/[ccaId]/[weekId]/route.ts`

**Why:** Product confirmed that per-member hour overrides are required (some members work different hours from the chair's declared envelope rate).

**Required change:**

```sql
ALTER TABLE cca_user_subsidies
  ADD COLUMN hours NUMERIC(5,2) CHECK (hours IS NULL OR hours >= 0);

COMMENT ON COLUMN cca_user_subsidies.hours IS
  'Per-user override of the parent cca_subsidies.hours rate. NULL means use the envelope default.';
```

**Validation:** The `validate_cca_user_subsidy_transition_before_update` trigger should be reviewed to ensure `hours` mutations are allowed in the relevant status states (likely only `pending` / `declared`, not `approved`).

**Suggested changelog path:** `db/changelogs/table/holiday-subsidy/03.cca-user-subsidies-add-hours.sql`

**Blocking:** Plan 05 tasks on `declarations` and `weekly` route field handling.

---

## 4. Add `comments` column to `cca_user_subsidies` (chair note per member) — SHIPPED

> **DB team shipped** (2026-05-18, in `table/subsidy/02.cca-user-subsidies.sql`). Free-text TEXT column. Empty strings normalized to NULL when written through `upsert_user_subsidy` (via `NULLIF(p_comments, '')`); direct PostgREST writes keep `''` as-is. **Frozen post-approval.**
>
> **Write surface:** same RPC as §3 — `upsert_user_subsidy`.

**Consumer:** [05-PLAN-holiday-subsidy.md](05-PLAN-holiday-subsidy.md) — same routes as above plus `approvals/weekly/[ccaId]/[weekId]/route.ts`

**Why:** Product confirmed that the chair's per-member note is required (JCRC reviewers expect per-member context).

**Required change:**

```sql
ALTER TABLE cca_user_subsidies
  ADD COLUMN comments TEXT;

COMMENT ON COLUMN cca_user_subsidies.comments IS
  'Chair''s free-text note for this member''s row. Visible to the chair, JCRC reviewers, and the member.';
```

**Suggested changelog path:** `db/changelogs/table/holiday-subsidy/04.cca-user-subsidies-add-comments.sql`

**Blocking:** Plan 05 declaration and approval-detail tasks.

---

## 5. Add `justification` column to `cca_subsidies` (chair note per envelope) — SHIPPED

> **DB team shipped** (2026-05-18, `table/subsidy/01.cca-subsidies.sql` + `function/subsidy/01.upsert-subsidy.sql`). TEXT column, nullable. `upsert_subsidy` now takes `(p_position_id, p_day, p_hours, p_justification)` — `approve_subsidy` is unchanged (chair-only write). Mutability matches existing `hours` on `cca_subsidies`: writable while `pending` / `rejected→pending`, raises `Subsidy already approved (id %); cannot upsert` once `approved`. No separate trigger-level freeze.

**Consumer:** [05-PLAN-holiday-subsidy.md](05-PLAN-holiday-subsidy.md) — `declarations/[ccaId]/route.ts`, `approvals/[ccaId]/route.ts`

**Why:** Product confirmed that the chair's per-envelope justification text is required (JCRC needs it to decide approval).

**Required change:**

```sql
ALTER TABLE cca_subsidies
  ADD COLUMN justification TEXT;

COMMENT ON COLUMN cca_subsidies.justification IS
  'Chair''s free-text explanation submitted with the envelope. Required by JCRC for approval decisions.';
```

**Wire into RPCs:** `public.upsert_subsidy` and `public.approve_subsidy` should accept and persist `justification`. Suggested signature update:

```sql
-- existing: public.upsert_subsidy(p_cca_id INT, p_day DATE, p_hours NUMERIC, ...)
-- add: p_justification TEXT DEFAULT NULL
```

**Suggested changelog path:** `db/changelogs/table/holiday-subsidy/05.cca-subsidies-add-justification.sql` plus a `function/holiday-subsidy/upsert-subsidy.sql` revision.

**Blocking:** Plan 05 declaration and approval flows.

---

## Sequencing recommendation

The DB team can land migrations in any order; the API plans coordinate around availability. A reasonable sequence:

1. **#2 (public RPC wrappers)** — unblocks plan 02, no breakage risk.
2. **#3, #4, #5 (subsidy columns)** — independent ALTERs, no breakage risk.
3. **#1 (sportsCulture RPCs)** — last, since plan 04 has the most interlocking changes.

Each migration should be deployed to `qa` first, smoke-tested against a preprod build of `intranet-next-app` with the relevant plan's branch checked out, then promoted.

## Verification (after deploy)

For each migration, the DB team should be able to verify with a smoke test:

| Migration | Smoke test |
|---|---|
| #1 sportsCulture RPCs | `SELECT public.apply_sports_culture_position(<sports_member_position_id>);` as an authenticated test user → row appears in `cca_appointments`. Repeat for `withdraw_*`. |
| #2 can_manage wrappers | `SELECT public.can_manage_cca_appointments(<position_id>);` as a known chair → TRUE; as a random user → FALSE. |
| #3 hours column | `INSERT INTO cca_user_subsidies (..., hours) VALUES (..., 4.5);` succeeds; `hours = -1` fails. |
| #4 comments column | `UPDATE cca_user_subsidies SET comments = 'note' WHERE ...;` succeeds; column appears in `SELECT *`. |
| #5 justification + RPC | `SELECT public.upsert_subsidy(..., p_justification := 'reason');` persists; `SELECT justification FROM cca_subsidies WHERE ...;` returns the text. |
