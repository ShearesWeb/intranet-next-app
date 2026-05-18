# 05 — Holiday Subsidy — Schema Refactor Plan

> **Plan amendments (2026-05-18, product decisions)** — read this before applying any task below. The body of the plan was drafted assuming `hours` / `comments` / `justification` were permanently dropped; product chose to restore all three via DB migrations. These overrides apply across §1, §3, §5, §7.
>
> 1. **Per-user `hours` column** will be added back to `cca_user_subsidies` (see `MIGRATIONS.md` §3). Tasks 5.1, 5.6, 5.7, 5.8 must **preserve** the `hours` field on `UserSubsidyRecord`, `MemberWithDeclaration`, `WeeklyApprovalRow`, `WeeklyRow`, and on the weekly-commitment POST body. The semantics: `cca_user_subsidies.hours` is a per-user override; `NULL` means use the envelope's `cca_subsidies.hours`. The UI should display the override when present and the envelope rate otherwise.
> 2. **Per-user `comments` column** will be added back to `cca_user_subsidies` (see `MIGRATIONS.md` §4). Tasks 5.1, 5.6, 5.7, 5.8 must **preserve** the `comments` field on `UserSubsidyRecord`, `MemberWithDeclaration`, `WeeklyApprovalRow`, `WeeklyRow`, and on the weekly-commitment POST/PATCH bodies. Chair writes; JCRC and the member both read.
> 3. **Per-envelope `justification` column** will be added back to `cca_subsidies` (see `MIGRATIONS.md` §5). Tasks 5.1, 5.3, 5.4, 5.5, 5.9, 5.10 must **preserve** the `justification` field on `SubsidyRow`, `SubsidyDeclaration`, `PositionSubsidyRecord`, `MemberWithDeclaration` (envelope-level), `WeeklyApprovalRow` (envelope-level), `WeeklyRow` (envelope-level). The form dialog keeps its `<Textarea>` block. `upsert_subsidy` gains a `p_justification TEXT` parameter (see `MIGRATIONS.md` §5).
> 4. **Sequencing:** the three DB migrations (`MIGRATIONS.md` §3, §4, §5) must land **before** the in-scope plan tasks ship, otherwise the API contract claims fields the DB does not store. Wherever a task below says "drop justification / comments / hours", interpret it as "keep, and verify column exists in `qa` first".

## 1. Goal & scope

Migrate the Holiday Subsidy API surface (`/api/holidaySubsidy/declarations/[ccaId]`, `/api/holidaySubsidy/approvals`, `/api/holidaySubsidy/approvals/[ccaId]`, `/api/holidaySubsidy/weekly/[ccaId]/[weekId]`, `/api/holidaySubsidy/approvals/weekly/[ccaId]/[weekId]`) and its `src/features/holiday-subsidy/` types/helpers off the legacy `subsidies` / `user_subsidies` tables and onto the new `cca_subsidies` (envelope) / `cca_user_subsidies` (per-user claim) model. The migration replaces direct status writes with the `public.approve_subsidy` / `public.approve_user_subsidy` RPCs and chair declarations with `public.upsert_subsidy` / `public.upsert_user_subsidy`; it also reconciles the column rename (`subsidy_status` → `status`), the removal of `week_id` (now `day DATE`), and the fact that `public_user_info` no longer exposes `email`. **`hours` / `comments` / `justification` are preserved across the schema swap** via the DB-team migrations in `MIGRATIONS.md` §3–§5 (added 2026-05-18 after product decision). State-machine validation, JCRC-vs-chair gating, and envelope→child cascade-rejection are all enforced by DB triggers on `cca_subsidies` / `cca_user_subsidies`, so routes must trust those errors instead of duplicating the rules in TypeScript.

In scope: all five subsidy API routes, the in-feature types under `src/features/holiday-subsidy/types/`, and `chair-cca-table` / `approval-cca-table` / `subsidy-declaration-form-dialog` only insofar as their props' field names change. Out of scope: feature-flag plumbing, `holiday-weeks.json` schema (the date→week mapping lives in app config and is now load-bearing for translating `weekId` ↔ `day`), the `cca-chair-access` / `cca-management-access` helpers (owned by 02-PLAN), the `useChairSubsidyCcas` hook (it reads only from `AuthenticatedUser.appointments`, owned by 01-PLAN).

## 2. Files in scope

API routes:
- `/Users/bytedance/intranet-next-app/src/app/api/holidaySubsidy/declarations/[ccaId]/route.ts`
- `/Users/bytedance/intranet-next-app/src/app/api/holidaySubsidy/approvals/route.ts`
- `/Users/bytedance/intranet-next-app/src/app/api/holidaySubsidy/approvals/[ccaId]/route.ts`
- `/Users/bytedance/intranet-next-app/src/app/api/holidaySubsidy/weekly/[ccaId]/[weekId]/route.ts`
- `/Users/bytedance/intranet-next-app/src/app/api/holidaySubsidy/approvals/weekly/[ccaId]/[weekId]/route.ts`

Feature-internal types and utilities:
- `/Users/bytedance/intranet-next-app/src/features/holiday-subsidy/types/declarations.ts`
- `/Users/bytedance/intranet-next-app/src/features/holiday-subsidy/types/api.ts`
- `/Users/bytedance/intranet-next-app/src/features/holiday-subsidy/types/weekly.ts`
- `/Users/bytedance/intranet-next-app/src/features/holiday-subsidy/utils/holiday-weeks.ts` (used; gains a `getWeekDay(weekId)` helper)
- `/Users/bytedance/intranet-next-app/src/features/holiday-subsidy/utils/declaration-mappers.ts`
- `/Users/bytedance/intranet-next-app/src/features/holiday-subsidy/utils/weekly-change-set.ts`

Hooks that consume the changed payload shapes (response-mapper-only edits, no behavior change):
- `/Users/bytedance/intranet-next-app/src/features/holiday-subsidy/hooks/use-subsidy-declarations.ts`
- `/Users/bytedance/intranet-next-app/src/features/holiday-subsidy/hooks/use-subsidy-approval-details.ts`
- `/Users/bytedance/intranet-next-app/src/features/holiday-subsidy/hooks/use-subsidy-approvals-index.ts`
- `/Users/bytedance/intranet-next-app/src/features/holiday-subsidy/hooks/use-weekly-commitment.ts`
- `/Users/bytedance/intranet-next-app/src/features/holiday-subsidy/hooks/use-weekly-approvals.ts`

Components whose form/table field bindings change with the type renames:
- `/Users/bytedance/intranet-next-app/src/features/holiday-subsidy/components/subsidy-declaration-form-dialog.tsx`
- `/Users/bytedance/intranet-next-app/src/features/holiday-subsidy/components/declaration-section-card.tsx`
- `/Users/bytedance/intranet-next-app/src/features/holiday-subsidy/components/weekly-commitment-table.tsx`
- `/Users/bytedance/intranet-next-app/src/features/holiday-subsidy/components/weekly-approvals-table.tsx`
- `/Users/bytedance/intranet-next-app/src/features/holiday-subsidy/components/chair-cca-table.tsx`
- `/Users/bytedance/intranet-next-app/src/features/holiday-subsidy/components/approval-cca-table.tsx`

Out-of-scope but referenced (do **not** edit here):
- `/Users/bytedance/intranet-next-app/src/features/holiday-subsidy/hooks/use-chair-subsidy-ccas.ts` — pure consumer of `AuthenticatedUser.appointments`; owned by 01-PLAN.
- `/Users/bytedance/intranet-next-app/src/features/cca/utils/cca-chair-access.ts` — owned by 02-PLAN.
- `/Users/bytedance/intranet-next-app/src/lib/fetch-user-info.ts` — owned by 01-PLAN.

## 3. Schema mapping

### 3.1 `cca_subsidies` (table — replaces legacy `subsidies`)

Wiki: [`wiki/entity/table/public.cca_subsidies.md`](../../../intranet-wiki/wiki/entity/table/public.cca_subsidies.md) (seed) → SQL source [`db/changelogs/table/subsidy/01.cca-subsidies.sql`](../../../intranet/db/changelogs/table/subsidy/01.cca-subsidies.sql).

Columns:

| Column | Type | Notes |
| --- | --- | --- |
| `id` | SERIAL PK | |
| `position_id` | INT NOT NULL | FK `cca_positions(id)` ON UPDATE CASCADE ON DELETE CASCADE |
| `day` | DATE NOT NULL | **replaces `week_id`** — must be the SG-local week-start date |
| `hours` | NUMERIC NOT NULL | CHECK `hours > 0` |
| `status` | `enum.subsidy_status` NOT NULL DEFAULT `'pending'` | **renamed from `subsidy_status`** |
| `created_by` | INT (FK `users.id` ON DELETE SET NULL) | set automatically by `upsert_subsidy` to `internal.auth_user_id()` |
| `decided_by` | INT (FK `users.id` ON DELETE SET NULL) | set by `validate_cca_subsidy_transition` trigger |
| `decided_at` | TIMESTAMPTZ | set by trigger |
| `rejection_reason` | TEXT | CHECK `rejection_reason IS NULL OR status = 'rejected'`; cleared by trigger on non-rejected transitions |
| `created_at` / `updated_at` | TIMESTAMPTZ | `updated_at` auto-maintained by `set_cca_subsidies_updated_at` (`internal.set_updated_at`) |

Unique: `(position_id, day)`. **No `comments` column.** **No `week_id` column.** **`justification` will be added by `MIGRATIONS.md` §5** — treat it as a `TEXT` nullable column going forward; the row schema in §3.1 below assumes it is present.

RLS (SQL `db/changelogs/security/subsidy/01.cca-subsidies.sql`):
- `select_managed_or_jcrc`: chain-of-managers (`internal.can_manage_cca_appointments(position_id, internal.auth_user_id())`) OR `internal.is_jcrc(internal.auth_user_id())`.
- `insert_managed`: chain-of-managers only.
- `update_managed_or_jcrc`: chain-of-managers OR JCRC (trigger then narrows by transition).
- `delete_managed`: chain-of-managers only.

### 3.2 `cca_user_subsidies` (table — replaces legacy `user_subsidies`)

Wiki: [`wiki/entity/table/public.cca_user_subsidies.md`](../../../intranet-wiki/wiki/entity/table/public.cca_user_subsidies.md) (seed) → SQL source [`db/changelogs/table/subsidy/02.cca-user-subsidies.sql`](../../../intranet/db/changelogs/table/subsidy/02.cca-user-subsidies.sql).

Columns:

| Column | Type | Notes |
| --- | --- | --- |
| `id` | SERIAL PK | **new** — current API addresses rows by `(user_id, position_id, week_id)`; refactor must address by `id` (or by `(subsidy_id, user_id)` composite) |
| `subsidy_id` | INT NOT NULL | FK `cca_subsidies(id)` — **replaces standalone `(position_id, week_id)` linkage** |
| `user_id` | INT NOT NULL | FK `users(id)` |
| `status` | `enum.subsidy_status` NOT NULL DEFAULT `'pending'` | renamed from `subsidy_status` |
| `created_by` / `decided_by` / `decided_at` / `rejection_reason` | same shape as parent envelope | trigger-maintained |

Unique: `(subsidy_id, user_id)`. **`hours` (NUMERIC(5,2), nullable, CHECK `hours >= 0`) and `comments` (TEXT, nullable) will be added by `MIGRATIONS.md` §3 and §4.** `hours` acts as a per-user override of the envelope's `cca_subsidies.hours` (NULL → use envelope rate). `comments` is the chair's per-member note, visible to chair, JCRC, and the member.

RLS: own row OR chain-of-managers OR JCRC for SELECT; chain-of-managers only for INSERT/DELETE; chain-of-managers OR JCRC for UPDATE.

### 3.3 `enum.subsidy_status`

Wiki: [`wiki/entity/enum/enum.subsidy_status.md`](../../../intranet-wiki/wiki/entity/enum/enum.subsidy_status.md) (seed). Values: `pending`, `approved`, `rejected`. Matches `src/features/holiday-subsidy/types/declarations.ts::SubsidyStatus`; no value rename required.

### 3.4 RPCs

| RPC | Signature | Wiki | SQL |
| --- | --- | --- | --- |
| `public.upsert_subsidy(p_position_id INT, p_day DATE, p_hours NUMERIC, p_justification TEXT DEFAULT NULL) RETURNS cca_subsidies` | chair creates / re-submits envelope; INSERT if absent, UPDATE hours+justification if `pending`, reset to `pending` if `rejected`, RAISE if `approved`. The `p_justification` parameter is added by `MIGRATIONS.md` §5. | [`public.upsert_subsidy.md`](../../../intranet-wiki/wiki/entity/function/public.upsert_subsidy.md) | [`function/subsidy/01.upsert-subsidy.sql`](../../../intranet/db/changelogs/function/subsidy/01.upsert-subsidy.sql) |
| `public.approve_subsidy(p_subsidy_id INT, p_decision enum.subsidy_status, p_reason TEXT DEFAULT NULL) RETURNS cca_subsidies` | JCRC approves/rejects envelope; clears `rejection_reason` on approve; sets `rejection_reason = NULLIF(p_reason,'')` on reject; trigger writes `decided_by`/`decided_at` | [`public.approve_subsidy.md`](../../../intranet-wiki/wiki/entity/function/public.approve_subsidy.md) | [`function/subsidy/02.approve-subsidy.sql`](../../../intranet/db/changelogs/function/subsidy/02.approve-subsidy.sql) |
| `public.upsert_user_subsidy(p_subsidy_id INT, p_user_id INT) RETURNS cca_user_subsidies` | chair declares user under envelope; INSERT if absent, no-op if `pending`, reset to `pending` if `rejected`, RAISE if `approved` | [`public.upsert_user_subsidy.md`](../../../intranet-wiki/wiki/entity/function/public.upsert_user_subsidy.md) | [`function/subsidy/03.upsert-user-subsidy.sql`](../../../intranet/db/changelogs/function/subsidy/03.upsert-user-subsidy.sql) |
| `public.approve_user_subsidy(p_user_subsidy_id INT, p_decision enum.subsidy_status, p_reason TEXT DEFAULT NULL) RETURNS cca_user_subsidies` | JCRC approves/rejects per-user claim | [`public.approve_user_subsidy.md`](../../../intranet-wiki/wiki/entity/function/public.approve_user_subsidy.md) | [`function/subsidy/04.approve-user-subsidy.sql`](../../../intranet/db/changelogs/function/subsidy/04.approve-user-subsidy.sql) |

All four are `SECURITY INVOKER`, `EXECUTE` granted to `authenticated`; no service-role bypass.

### 3.5 Joined views the routes read alongside subsidies

| Current code reference | New schema | Notes |
| --- | --- | --- |
| `.from("public_user_info").select("id, name, email")` | `public.public_user_info` only exposes `id, name, profile_photo_path` (SQL [`view/core/01.public-user-info.sql`](../../../intranet/db/changelogs/view/core/01.public-user-info.sql)) | **`email` is gone** — switch to `authenticated_user_directory` (SQL [`view/core/05.authenticated-user-directory.sql`](../../../intranet/db/changelogs/view/core/05.authenticated-user-directory.sql); columns `id, email, name, room, telegram_handle, profile_photo_path`; SELECT to `authenticated`). |
| `.from("cca_appointments").eq("cca_id", ccaId)` | `cca_appointments` has no `cca_id` column ([SQL `table/core/05.cca-appointment.sql`](../../../intranet/db/changelogs/table/core/05.cca-appointment.sql)) | Must filter via the joined `cca_positions.cca_id` — owned by 02-PLAN; flagged in §7. |
| `.from("ccas").select("name").eq("id", ccaId)` | unchanged | OK. |
| `.from("authenticated_user_info").select("is_jcrc, is_admin").eq("id", user.id)` (deprecated path in `approvals/weekly/[ccaId]/[weekId]`) | use `fetchUserInfo()` (`src/lib/fetch-user-info.ts`) | The inline `authorizeJCRC` helper is currently dead-coded (`void authorizeJCRC`). Delete it and call `fetchUserInfo()` instead — see Task 5.1. |

## 4. Authorization / RLS impact

### 4.1 Capability matrix (subsidy domain)

| Operation | Required actor | Enforced by |
| --- | --- | --- |
| Insert `cca_subsidies` envelope (chair declaration) | chain-of-managers for the target `position_id` | RLS `insert_managed`; `upsert_subsidy` is `SECURITY INVOKER` so the calling JWT is what matters |
| Update `cca_subsidies.hours` while `pending` | chain-of-managers (no status change) | RLS `update_managed_or_jcrc`; trigger is a no-op when `OLD.status = NEW.status` |
| Transition `cca_subsidies.status pending → approved` | JCRC | `internal.validate_cca_subsidy_transition` trigger (`internal.is_jcrc(actor)`) |
| Transition `cca_subsidies.status pending → rejected` | JCRC | trigger |
| Transition `cca_subsidies.status approved → rejected` (retract) | JCRC | trigger |
| Transition `cca_subsidies.status rejected → pending` (resubmit) | chair (chain-of-managers) | trigger (`internal.can_manage_cca_appointments`) |
| Cascade reject children when envelope `approved → rejected` | DB | trigger `cascade_cca_subsidy_rejection_after_update` writes `cca_user_subsidies.rejection_reason = 'envelope rejected[: <reason>]'` for non-rejected children |
| Insert / change `cca_user_subsidies` into `pending`/`approved` when parent not `approved` | DB rejects | trigger `enforce_parent_approved_before_iud` raises `Parent subsidy must be approved (current status: …)` |
| Approve / reject `cca_user_subsidies` | JCRC | `internal.validate_cca_user_subsidy_transition` — chair only for `rejected → pending` |
| Read `cca_subsidies` | chair OR JCRC | RLS `select_managed_or_jcrc` |
| Read `cca_user_subsidies` | own row OR chair OR JCRC | RLS `select_own_or_managed_or_jcrc` |

### 4.2 Legal `cca_subsidies.status` transitions

```
pending ─JCRC──> approved
pending ─JCRC──> rejected
approved ─JCRC──> rejected   (also cascades to child user-subsidies)
rejected ─chair──> pending   (resubmit)
```

Anything else raises `Invalid transition % -> %`. `OLD.status = NEW.status` is a no-op (allows non-status updates such as `hours` while pending).

### 4.3 Legal `cca_user_subsidies.status` transitions

Same set as the envelope. Authorization actor is derived from the parent envelope's `position_id` via `SELECT position_id FROM cca_subsidies WHERE id = NEW.subsidy_id` inside the trigger, so chairs of the parent CCA can resubmit rejected child claims without the API needing to compute that join.

### 4.4 Implications for routes

- The chair-only "delete pending declaration" branch in `declarations/[ccaId]` `DELETE` is fine — RLS `delete_managed` enforces it and the `status` CHECK plus the lifecycle (`approved` envelopes cannot be deleted via the API except through `ON DELETE CASCADE` when a position disappears) is preserved.
- The route-level "is `subsidy_status` PENDING before deletion?" check is now redundant — RLS allows chairs to delete any envelope they manage, including approved ones (state isn't a delete gate at the DB layer). The product rule "only pending declarations can be deleted" is **policy, not schema**, so keep the explicit `status === 'pending'` 400 in the route or move it into a future trigger/policy (flagged §7).
- All current direct `.update({ subsidy_status: ... })` calls must be replaced with RPC calls so that the trigger's actor derivation (`internal.auth_user_id()`) and rejection-reason capture work correctly. Direct UPDATE will still go through the trigger and succeed *if* the actor has the right role, but `rejection_reason` would not be set (no `p_reason` plumbing) and bulk reason capture would require a per-row UPDATE anyway.

## 5. Tasks

### Task 5.1 — Normalize types (status column rename, drop `week_id`/`justification`/`comments`)

Files:
- `src/features/holiday-subsidy/types/declarations.ts`
- `src/features/holiday-subsidy/types/api.ts`
- `src/features/holiday-subsidy/types/weekly.ts`

Before / after sketch:

```ts
// declarations.ts  BEFORE
export interface SubsidyRow {
    id: number;
    position_id: number;
    week_id: number;
    hours: number;
    justification: string | null;
    subsidy_status: SubsidyStatus;
}

// declarations.ts  AFTER
export interface SubsidyRow {
    id: number;
    position_id: number;
    day: string; // ISO date "YYYY-MM-DD" (SG-local week start)
    week_id: number; // derived client-side via getWeekIdForDay(day)
    hours: number;
    status: SubsidyStatus;
}

// SubsidyDeclaration view model
//   - drop `justification`
//   - rename `weekId` stays (client identifier); add `day: string`
```

```ts
// api.ts  AFTER (excerpt)
export interface UserSubsidyRecord {
    id: number;
    subsidy_id: number;
    user_id: number;
    status: SubsidyStatus;
    rejection_reason: string | null;
}

export interface PositionSubsidyRecord {
    id: number;
    position_id: number;
    day: string;
    hours: number;
    status: SubsidyStatus;
    rejection_reason: string | null;
}
```

Steps:
- [ ] Rename every `subsidy_status` field/key to `status` across `declarations.ts`, `api.ts`, `weekly.ts`.
- [ ] Drop `justification` from `SubsidyRow`, `SubsidyDeclaration`, `PositionSubsidyRecord`, `WeeklyApprovalSubmission`, `MemberWithDeclaration`, `WeeklyApprovalRow`, `WeeklyRow`.
- [ ] Drop `comments` from `UserSubsidyRecord`, `WeeklyApprovalSubmission`, `MemberWithDeclaration`, `WeeklyApprovalRow`, `WeeklyRow`.
- [ ] Add `day: string` to `SubsidyRow` / `PositionSubsidyRecord`; keep `weekId: number` on view-model types (client-only identifier).
- [ ] Add `subsidy_id: number` to `UserSubsidyRecord`.
- [ ] Update `coerceSubsidyStatus` / `formatSubsidyStatus` in `declaration-mappers.ts` to read `subsidy.status` instead of `subsidy.subsidy_status`.

Verification:
- [ ] `npx tsc --noEmit` — must surface every remaining `subsidy_status` / `justification` / `comments` reference as a compile error; address each in the route tasks below.

### Task 5.2 — Add `getWeekDay(weekId)` / `getWeekIdForDay(day)` helpers

File: `src/features/holiday-subsidy/utils/holiday-weeks.ts`

Before / after sketch:

```ts
// AFTER (appended)
export function getWeekDay(weekId: number): string | null {
    const week = HOLIDAY_WEEKS.find((w) => w.id === weekId);
    if (!week) return null;
    return week.start.toISOString().slice(0, 10); // "YYYY-MM-DD"
}

export function getWeekIdForDay(day: string): number | null {
    return HOLIDAY_WEEKS.find((w) => w.start.toISOString().slice(0, 10) === day)?.id ?? null;
}
```

Steps:
- [ ] Add the two pure functions; they bridge the API's new `day` column with the existing `weekId` UI/URL parameter.
- [ ] Extend `src/features/holiday-subsidy/utils/holiday-weeks.test.ts` with cases for every week in `holiday-weeks.json` plus an unknown id / non-matching day returning `null`.

Verification:
- [ ] `npx jest src/features/holiday-subsidy/utils/holiday-weeks.test.ts` (if test runner exists — note Stack file states "No test framework configured"; if absent, smoke-test via `node --import tsx -e 'import("./holiday-weeks").then(m => console.log(m.getWeekDay(1)))'`).

### Task 5.3 — Rewrite `declarations/[ccaId]/route.ts` against `cca_subsidies` + `upsert_subsidy`

File: `src/app/api/holidaySubsidy/declarations/[ccaId]/route.ts`

Before / after sketch (`GET`):

```ts
// BEFORE
const { data, error } = await supabase
    .from("cca_positions")
    .select(`id, name, position_type, cca_id, subsidies (id, position_id, week_id, hours, justification, subsidy_status)`)
    .eq("cca_id", ccaId);

// AFTER
const { data, error } = await supabase
    .from("cca_positions")
    .select(`id, name, position_type, cca_id, cca_subsidies (id, position_id, day, hours, status, rejection_reason)`)
    .eq("cca_id", ccaId);
// then map each subsidy → { ..., weekId: getWeekIdForDay(s.day) } and DROP rows where weekId === null.
```

Before / after sketch (`POST`):

```ts
// BEFORE: app validates position, INSERT into subsidies with week_id + justification
// AFTER:  validate position, derive day from weekId, call RPC
const day = getWeekDay(weekId);
if (!day) return NextResponse.json({ error: "Unknown week" }, { status: 400 });

const { data, error } = await supabase
    .rpc("upsert_subsidy", { p_position_id: positionId, p_day: day, p_hours: hours })
    .single();
```

`PATCH` (chair re-submits hours or resubmits a rejected envelope): same RPC — `upsert_subsidy` handles both `pending` (hours-only) and `rejected → pending` branches. Keep the 23505 unique-violation path only as a safety net (RPC raises with a different message but `errno` may still surface).

`DELETE` (chair retracts a `pending` declaration): RLS allows; keep app-side gate `status === 'pending'` before deleting; otherwise `.from("cca_subsidies").delete().eq("id", subsidyId)`.

Steps:
- [ ] Remove the `validatePosition` helper — `upsert_subsidy` is `SECURITY INVOKER`; RLS `insert_managed` on `cca_subsidies` enforces chain-of-managers, and the FK on `position_id` enforces existence. Keep the `authorizeChair` helper (server-side fast-fail) because it pre-empts a useless DB round-trip.
- [ ] `POST` / `PATCH` collapse into a single `upsert_subsidy` call; drop the `justification` field from the request body schema; document the breaking change for the form in Task 5.10.
- [ ] `GET`: rename table to `cca_subsidies`, rename `subsidy_status` to `status`, drop `justification`, add `day`; map each row to `{ id, position_id, weekId: getWeekIdForDay(s.day), hours, status }` and filter out rows whose `day` doesn't map (e.g., legacy / out-of-config dates).
- [ ] `DELETE`: rename `from("subsidies")` to `from("cca_subsidies")`; keep `existing.status === 'pending'` gate. The `cca_positions!inner(cca_id)` join is still required because authorization is by `ccaId` from the URL, not by `position_id` on the row.
- [ ] Translate RPC errors: `upsert_subsidy` raises `Subsidy already approved (id %); cannot upsert` → map to HTTP 409; `No authenticated user` → 401. Pattern-match the `error.message`; do not swallow.

Verification:
- [ ] Manual `curl -X POST /api/holidaySubsidy/declarations/{ccaId}` with body `{ positionId, weekId: 6, hours: 4 }` (note no `justification`) returns the envelope row with `status: 'pending'`.
- [ ] Resubmit same payload returns the same row (PENDING branch in RPC).
- [ ] After a JCRC rejection, repeat the POST: response should now have `status: 'pending'` again (RPC's `rejected → pending` branch).
- [ ] DELETE with an `approved` envelope returns 400 ("Only pending declarations can be deleted").

### Task 5.4 — Rewrite `approvals/route.ts` (JCRC index of CCAs needing approval)

File: `src/app/api/holidaySubsidy/approvals/route.ts`

Before / after sketch:

```ts
// BEFORE: queries .from("subsidies").eq("subsidy_status", "pending")
// AFTER:
const { data, error } = await supabase
    .from("cca_subsidies")
    .select(`status, cca_positions!inner (cca_id, ccas!inner (id, name))`)
    .eq("status", "pending");
// fetchPendingWeeklyCommitments:
const { data, error } = await supabase
    .from("cca_user_subsidies")
    .select(`status, cca_subsidies!inner (cca_positions!inner (cca_id, ccas!inner (id, name)))`)
    .eq("status", "pending");
```

The "weekly" counter is now a count of `pending` per-user claims; the join hop is one deeper (`cca_user_subsidies → cca_subsidies → cca_positions → ccas`) because there is no direct `position_id` on `cca_user_subsidies`.

Steps:
- [ ] Replace `from("subsidies")` → `from("cca_subsidies")`, `subsidy_status` → `status` in `fetchSubsidies` and `fetchCcasWithAnySubsidy`.
- [ ] Replace `from("user_subsidies")` → `from("cca_user_subsidies")` and update its join to `cca_subsidies!inner(cca_positions!inner(cca_id, ccas!inner(id, name)))`.
- [ ] Update the `SubsidyWithCCA` / `UserSubsidyWithCCA` types to reflect the deeper join (extract a shared `CcaIdName` helper).
- [ ] Keep the JCRC gate (`if (!user || !user.is_jcrc) return 403`) — RLS would technically allow chairs to see their own envelopes too, but this endpoint is for the JCRC dashboard and the response shape would be misleading for a chair.

Verification:
- [ ] As JCRC: `GET /api/holidaySubsidy/approvals` returns `{ ccas: [{ id, name, pendingDeclarations, pendingWeekly }] }` with non-zero counters where the seed data has pending envelopes and pending user claims.
- [ ] As non-JCRC: returns 403.
- [ ] Postgres: `SELECT count(*) FROM cca_subsidies WHERE status = 'pending';` matches the sum of `pendingDeclarations` across the response.

### Task 5.5 — Rewrite `approvals/[ccaId]/route.ts` (envelope approve/reject)

File: `src/app/api/holidaySubsidy/approvals/[ccaId]/route.ts`

Before / after sketch (`GET`):

```ts
// BEFORE: from("subsidies").select("..., subsidy_status, cca_positions!inner(...)").eq("cca_positions.cca_id", ccaId)
// AFTER
const { data, error } = await supabase
    .from("cca_subsidies")
    .select(`id, position_id, day, hours, status, rejection_reason,
             cca_positions!inner(id, name, position_type, cca_id)`)
    .eq("cca_positions.cca_id", ccaId);
// map row → { ...row, weekId: getWeekIdForDay(row.day) }
```

Before / after sketch (`PATCH`):

```ts
// BEFORE: per-status group then bulk .update({ subsidy_status }).in("id", ids)
// AFTER: per-row RPC call, parallelized
const results = await Promise.allSettled(updates.map((u) =>
    supabase.rpc("approve_subsidy", {
        p_subsidy_id: u.subsidyId,
        p_decision: u.status,           // must be 'approved' | 'rejected'
        p_reason: u.rejectionReason ?? null,
    })));
// any rejected => collect the error.message and return 207-style failure detail
```

Steps:
- [ ] Rename table and column in `fetchCcaData` (cca_subsidies / status).
- [ ] Extend the API request body to accept an optional `rejectionReason: string | null` per update (chairs see the reason after rejection); update `validateUpdates` accordingly.
- [ ] Replace the bulk-update loop with `approve_subsidy` RPC calls. Reject the request if any `status` is `pending` (the RPC rejects with `approve_subsidy only accepts approved/rejected`; failing fast in the route gives a cleaner 400).
- [ ] Drop `ensureSubsidiesBelongToCca` — RLS will already prevent JCRC actors from acting on envelopes they cannot SELECT, but JCRC can see all envelopes by policy `select_managed_or_jcrc`. The wedge that needs the cca-membership check is the URL: this route's promise is "approvals for THIS cca", so keep a slim variant that confirms each `subsidyId.cca_positions.cca_id = ccaId` *before* dispatching the RPC. Easier: re-query `cca_subsidies` after the RPC calls to project the fresh state, filtering by `cca_positions.cca_id`.
- [ ] After all RPC promises settle, re-`SELECT` the affected envelopes (`.in("id", ids)`) for the response — `approve_subsidy` returns the row, so the simpler form is to harvest those returns directly.
- [ ] Map errors:
  - `Invalid transition % -> %` → 409 Conflict, `Cannot ${decision} a subsidy in state ${oldStatus}`.
  - `Only JCRC may ...` → 403 Forbidden.
  - `Subsidy % not found or not accessible` → 404.
  - Anything else → 500.

Verification:
- [ ] Postgres: snapshot `cca_subsidies` before/after; rows transitioning `pending → approved` have `decided_by = jcrc_user_id`, `decided_at IS NOT NULL`, `rejection_reason IS NULL`.
- [ ] Rejecting an `approved` envelope (`approved → rejected`): trigger `cascade_cca_subsidy_rejection_after_update` should leave its child `cca_user_subsidies` rows at `status = 'rejected'` with `rejection_reason LIKE 'envelope rejected%'`. Confirm with `SELECT id, status, rejection_reason FROM cca_user_subsidies WHERE subsidy_id = ...;`.
- [ ] As a chair (not JCRC): PATCH returns 403 because the trigger raises.

### Task 5.6 — Rewrite `weekly/[ccaId]/[weekId]/route.ts` (chair weekly commitment)

File: `src/app/api/holidaySubsidy/weekly/[ccaId]/[weekId]/route.ts`

Conceptual shift: the chair page used to write `(user_id, position_id, week_id, hours, justification, comments)` rows into `user_subsidies`. The new model says: hours live on the envelope (`cca_subsidies.hours`); per-user rows (`cca_user_subsidies`) are mere existence flags awaiting JCRC approval; **and** the parent envelope must already be `approved` before children may be inserted (trigger `enforce_parent_approved_before_iud`).

Before / after sketch (`GET`):

```ts
// AFTER: derive the day from weekId, find approved envelopes for the CCA's positions, list children
const day = getWeekDay(weekIdNum);
if (!day) return NextResponse.json({ error: "Unknown week" }, { status: 400 });

const { data: envelopes } = await supabase
    .from("cca_subsidies")
    .select(`id, position_id, hours, status,
             cca_positions!inner (id, name, position_type, cca_id)`)
    .eq("cca_positions.cca_id", ccaId)
    .eq("day", day)
    .eq("status", "approved");

const subsidyIds = envelopes?.map(e => e.id) ?? [];

const { data: appointments } = await supabase
    .from("cca_appointments")
    .select(`user_id, position_id, cca_positions!inner(cca_id, id, name, position_type)`)
    .eq("cca_positions.cca_id", ccaId);
// filter to position_ids that have an approved envelope

const { data: userSubs } = subsidyIds.length === 0 ? { data: [] } : await supabase
    .from("cca_user_subsidies")
    .select("id, subsidy_id, user_id, status")
    .in("subsidy_id", subsidyIds);

const { data: directory } = await supabase
    .from("authenticated_user_directory")
    .select("id, name, email")
    .in("id", appointments.map(a => a.user_id));
```

Output shape (per chair-page row):
```ts
{
    id: user_id,
    user_id, position_id,
    name, email,
    role: positionName,
    type: positionType,
    has_approved_subsidy: true,        // by construction (filtered)
    submitted: !!userSub,              // exists row?
    approved_hours: envelope.hours,    // template only
    status: userSub?.status ?? null,
    // hours / justification / remarks fields REMOVED from row schema
}
```

Before / after sketch (`POST` — chair selects which members get the subsidy):

```ts
// AFTER: declarations[] becomes user_ids to add; deletions[] stays user_ids to remove
for (const decl of declarations) {
    const envelope = envelopesByPosition.get(decl.position_id);
    if (!envelope) return 400; // no approved envelope for this position+day
    await supabase.rpc("upsert_user_subsidy", {
        p_subsidy_id: envelope.id,
        p_user_id: decl.user_id,
    });
}
for (const del of deletions) {
    const envelope = envelopesByPosition.get(del.position_id);
    if (!envelope) continue;
    await supabase.from("cca_user_subsidies")
        .delete()
        .eq("subsidy_id", envelope.id)
        .eq("user_id", del.user_id);
}
```

Steps:
- [ ] Replace `getWeekLabel` / `isWeekEditable` keeping; add `getWeekDay` derivation.
- [ ] Drop the `subsidies` and `user_subsidies` queries; replace with the three-query plan above (envelopes / appointments / user-subs / directory).
- [ ] Replace the `public_user_info` join with a direct `authenticated_user_directory.select("id, name, email").in("id", userIds)` and a client-side `Map<id, {name, email}>` lookup. `cca_appointments` no longer joins to `public_user_info` because (a) `email` isn't there and (b) `cca_appointments` does not have a `cca_id` column (this is enforced — see 02-PLAN §3.3). Use `cca_positions!inner(cca_id)` filtering instead.
- [ ] In `POST`: drop the `hours` / `justification` / `comments` / `subsidy_status` fields from upsert input; reshape `declarations[]` to `{ user_id, position_id }` only.
- [ ] Replace the `.upsert(upsertData, { onConflict: "user_id,position_id,week_id" })` call with a loop over `upsert_user_subsidy(subsidy_id, user_id)` (the RPC handles the no-op-on-pending and resubmit-on-rejected branches).
- [ ] On parent-not-approved error from trigger (`Parent subsidy must be approved (current status: %)`), translate to 409 ("Cannot add members until the envelope is approved").
- [ ] Drop the `validatePairs` cca-appointment membership check that materializes after the above queries — RLS `insert_managed` on `cca_user_subsidies` already enforces chair access, and `enforce_parent_approved_before_iud` already enforces envelope state. Keep a thin sanity check that `(user_id, position_id)` is in `cca_appointments` only for the friendlier 400 message.
- [ ] Re-enable the JCRC-only-toggle pattern: this endpoint is a CHAIR endpoint, not JCRC; **delete** the unused `void authorizeJCRC` lines and the dead helper. Authorization shifts to `authorizeChair(ccaId)` mirroring `declarations/[ccaId]/route.ts` (or relies entirely on RLS — the simpler refactor is to drop the helper and let RLS reject with the standard error). Recommended: keep `authorizeChair` for the fast-fail (cheap server-side `is_user_in_chain` check before the DB round-trip).

Verification:
- [ ] `GET /api/holidaySubsidy/weekly/{ccaId}/{weekId}` returns only members whose position has an `approved` envelope at the given `day`.
- [ ] `POST` with `declarations: [{ user_id, position_id }]` succeeds when the envelope is `approved`; returns 409 when it's `pending`/`rejected`.
- [ ] `POST` then `GET` shows the new rows as `submitted: true`, `status: 'pending'`.
- [ ] DB: `SELECT * FROM cca_user_subsidies WHERE subsidy_id = ? AND user_id = ?;` — verify the row exists and `status = 'pending'`.

### Task 5.7 — Rewrite `approvals/weekly/[ccaId]/[weekId]/route.ts` (JCRC per-user approve/reject)

File: `src/app/api/holidaySubsidy/approvals/weekly/[ccaId]/[weekId]/route.ts`

Before / after sketch (`GET`):

```ts
const day = getWeekDay(weekIdNum);
const { data: submissions } = await supabase
    .from("cca_user_subsidies")
    .select(`id, user_id, status, rejection_reason,
             cca_subsidies!inner (id, position_id, day, hours,
                cca_positions!inner (id, name, position_type, cca_id)),
             user:authenticated_user_directory!cca_user_subsidies_user_id_fkey (id, name, email)`)
    .eq("cca_subsidies.cca_positions.cca_id", ccaIdNum)
    .eq("cca_subsidies.day", day);
```

Before / after sketch (`PATCH`):

```ts
const results = await Promise.allSettled(updates.map(u =>
    supabase.rpc("approve_user_subsidy", {
        p_user_subsidy_id: u.userSubsidyId,
        p_decision: u.status,
        p_reason: u.rejectionReason ?? null,
    })));
```

Steps:
- [ ] Remove `void authorizeJCRC` dead code; reinstate proper auth by calling `fetchUserInfo()` and returning 403 if `!is_jcrc && !is_admin`.
- [ ] Replace the `user_subsidies` table with `cca_user_subsidies`; replace the `week_id` filter with a join through `cca_subsidies.day = getWeekDay(weekId)`.
- [ ] Replace `public_user_info(id, name, email)` with `authenticated_user_directory(id, name, email)`. (Supabase's relation embedding requires an FK; if `authenticated_user_directory` has no FK alias, fall back to a separate `.in("id", userIds)` lookup as in Task 5.6.)
- [ ] Reshape the response row: composite `id` becomes the SERIAL `cca_user_subsidies.id`; surface `subsidy_id` (so the UI can group by envelope) and `hours` from the parent envelope; drop the `justification` / `remarks` fields.
- [ ] Change the PATCH input contract: `updates: [{ userSubsidyId: number; status: 'approved'|'rejected'; rejectionReason?: string|null }]`. The old `{ user_id, position_id }` composite addressing is no longer needed.
- [ ] Loop `approve_user_subsidy` per row; aggregate failures with the same error-mapping table as Task 5.5.

Verification:
- [ ] DB: pick a `cca_user_subsidies.id` with `status = 'pending'`, PATCH `{ updates: [{ userSubsidyId: id, status: 'approved' }] }` as JCRC, then `SELECT decided_by, decided_at, status FROM cca_user_subsidies WHERE id = ?;` — confirm trigger filled both.
- [ ] PATCH `{ status: 'rejected', rejectionReason: 'Not enough evidence' }` — confirm `rejection_reason` is captured and `decided_by/decided_at` are set.
- [ ] PATCH on a parent-rejected envelope's child should already be `rejected` (cascade) — no-op transition (`OLD.status = NEW.status`) returns without trigger error; the RPC raises `UPDATE … RETURNING * INTO v_result` succeeds but the trigger short-circuits at the top guard — confirm no spurious error.

### Task 5.8 — Hook payload reconciliation

Files:
- `src/features/holiday-subsidy/hooks/use-subsidy-declarations.ts`
- `src/features/holiday-subsidy/hooks/use-subsidy-approval-details.ts`
- `src/features/holiday-subsidy/hooks/use-subsidy-approvals-index.ts`
- `src/features/holiday-subsidy/hooks/use-weekly-commitment.ts`
- `src/features/holiday-subsidy/hooks/use-weekly-approvals.ts`

Steps:
- [ ] Update every `.subsidy_status` access on response payloads to `.status`.
- [ ] Remove every reference to `justification` / `comments` / `remarks` from the read mappers; if the dialog still needs these, keep them as local form-state fields (the API drops them silently — flagged in §7 as a product question).
- [ ] In `use-weekly-commitment.ts::handleSave`, drop `hours` / `justification` / `remarks` from the `declarations` payload (now `{ user_id, position_id }` only).
- [ ] In `use-weekly-approvals.ts::runBatchUpdate`, change `updates` to `[{ userSubsidyId, status, rejectionReason }]`; remove `user_id` / `position_id` composite keying.
- [ ] In `use-subsidy-approval-details.ts::save`, change `updates` to `[{ subsidyId, status, rejectionReason }]`.

Verification:
- [ ] `npx tsc --noEmit` from the repo root passes.
- [ ] Smoke-run each page in dev:
  - [ ] `/dashboard/holidaySubsidy/declaration/{ccaName}` — list + create/edit/delete works.
  - [ ] `/dashboard/holidaySubsidy/approvals/{ccaName}` — JCRC sees envelopes, can approve/reject.
  - [ ] `/dashboard/holidaySubsidy/weekly/{ccaName}` — chair sees approved-envelope members; can add/remove.
  - [ ] `/dashboard/holidaySubsidy/approvals/weekly/{ccaName}` — JCRC sees per-user claims; can approve/reject.

### Task 5.9 — Component re-binding (status field name + drop dropped columns)

Files:
- `src/features/holiday-subsidy/components/declaration-section-card.tsx`
- `src/features/holiday-subsidy/components/weekly-commitment-table.tsx`
- `src/features/holiday-subsidy/components/weekly-approvals-table.tsx`
- `src/features/holiday-subsidy/components/approval-cca-table.tsx`
- `src/features/holiday-subsidy/components/chair-cca-table.tsx`

Steps:
- [ ] Rename `row.subsidy_status` → `row.status` in every column accessor.
- [ ] Remove "Justification" / "Remarks" columns from the weekly tables; reflect product confirmation from §7 before deleting (placeholder columns are acceptable if product chooses to reinstate the field in a future migration).
- [ ] `approval-cca-table.tsx` / `chair-cca-table.tsx` use `pendingDeclarations` / `pendingWeekly` counters — no schema impact, but verify the typing imports compile after Task 5.1.

Verification:
- [ ] Visual smoke test on each page; columns render with new field names and there are no `undefined` cells.

### Task 5.10 — Form dialog: drop `justification`, add `day` derivation

File: `src/features/holiday-subsidy/components/subsidy-declaration-form-dialog.tsx`

Steps:
- [ ] Remove the `justification` `<Textarea>` block and its form-state field.
- [ ] Keep the `weekId` `<select>`; on submit, the client may continue to send `weekId` (the API will translate via `getWeekDay`).
- [ ] Drop the `justification: formState.justification` body field from the POST/PATCH body.
- [ ] Update the dialog copy: title + description should clarify that "the envelope is per-position-per-day and JCRC reviews the hours request."

Verification:
- [ ] Submit a new declaration; row appears in declaration list with `status = 'pending'`, `hours` correct.
- [ ] Edit hours of a `pending` declaration; reload; new value persists.

## 6. Verification

Run after all tasks complete:

- [ ] **Static**: `cd /Users/bytedance/intranet-next-app && npx tsc --noEmit` returns 0.
- [ ] **Static**: `cd /Users/bytedance/intranet-next-app && npm run lint` returns 0 (note: lint is ignored during builds, but plan demands it pass here).
- [ ] **DB grep**: `grep -rn "from(\"subsidies\"" src/ ; grep -rn "from(\"user_subsidies\"" src/ ; grep -rn "subsidy_status" src/ ; grep -rn "week_id" src/app/api/holidaySubsidy` — all return zero hits.
- [ ] **DB grep**: `grep -rn "justification" src/features/holiday-subsidy src/app/api/holidaySubsidy ; grep -rn "remarks" src/features/holiday-subsidy ; grep -rn "comments" src/app/api/holidaySubsidy` — zero hits (or only in user-facing copy strings).
- [ ] **DB grep**: `grep -rn "public_user_info" src/app/api/holidaySubsidy` — zero hits (replaced by `authenticated_user_directory`).
- [ ] **DB grep**: `grep -rn "\\bsubsidies\\b" src/app/api/holidaySubsidy` — only matches `cca_subsidies` / `cca_user_subsidies`.
- [ ] **End-to-end (preprod)**: as a chair, declare an envelope; as JCRC, approve it; as chair again, add two users; as JCRC, approve one and reject the other with a reason; assert in DB that `cca_user_subsidies.rejection_reason` is set on the rejected row and `decided_by` matches the JCRC user.
- [ ] **End-to-end (preprod)**: as JCRC, retract an `approved` envelope; query `cca_user_subsidies WHERE subsidy_id = X` — every child should be `status = 'rejected'` and `rejection_reason LIKE 'envelope rejected%'` (cascade trigger).
- [ ] **End-to-end (preprod)**: as a non-JCRC, non-chair authenticated user, call each endpoint — expect 403/404 from RLS without sensitive data leakage.
- [ ] **Postgres**:
    ```sql
    -- legal transitions only
    SELECT id, status FROM cca_subsidies WHERE id IN (...);
    -- approver attribution
    SELECT id, decided_by, decided_at, rejection_reason FROM cca_subsidies WHERE id IN (...);
    -- cascade
    SELECT id, status, rejection_reason FROM cca_user_subsidies WHERE subsidy_id = ?;
    -- triggers fire (negative test): UPDATE cca_subsidies SET status='approved' WHERE status='rejected' as non-JCRC must RAISE.
    ```

## 7. Open questions

- ~~**Q1 (Product)**~~ **Resolved 2026-05-18:** per-user `hours` override IS needed. `MIGRATIONS.md` §3 adds the column; tasks 5.1, 5.6, 5.7, 5.8 keep the field on `UserSubsidyRecord` and the weekly POST body.
- ~~**Q2 (Product)**~~ **Resolved 2026-05-18:** both per-user `comments` and per-envelope `justification` ARE needed. `MIGRATIONS.md` §4 adds `cca_user_subsidies.comments`; `MIGRATIONS.md` §5 adds `cca_subsidies.justification` and threads it through `upsert_subsidy`. The form dialog keeps both fields.
- **Q3 (Wiki gap)**: `wiki/domain/holiday-subsidy.md` still references the legacy `subsidies` / `user_subsidies` / `subsidy_claims` tables and `internal.can_manage_subsidies`. None of those exist in the new schema — the actual model is `cca_subsidies` / `cca_user_subsidies` with chair access derived via `internal.can_manage_cca_appointments` (the same function used for membership management). File a `/wiki-deepen` request to rewrite the domain page; the page is `seed` and load-bearing for new contributors.
- **Q4 (Wiki gap)**: `wiki/convention/rbac.md` and `wiki/convention/rls.md` both link to `internal.can_manage_subsidies` and `public.subsidy_claims`. Those entity pages do not exist in `wiki/entity/function/` or `wiki/entity/table/`. Either the convention pages need updating or the function/table needs to be (re)created — clarify whether the canonical authorization helper for subsidies is `can_manage_cca_appointments` (current SQL says yes) or a future `can_manage_subsidies`.
- **Q5 (Cross-domain, 01-PLAN)**: `fetchUserInfo()` returns `is_jcrc` from `authenticated_user_info`; the `approvals/weekly` route previously read this from a direct Supabase query that no longer compiles (`authenticated_user_info` has no public `id` selector — RLS filters to self). Confirm with 01-PLAN that `fetchUserInfo()` is the only sanctioned read path for `is_jcrc` and remove inline queries.
- **Q6 (Cross-domain, 02-PLAN)**: `weekly/[ccaId]/[weekId]/route.ts` reads `cca_appointments.eq("cca_id", ccaId)` — this column was removed in the new schema. The plan above filters via `cca_positions!inner(cca_id)`, but the canonical replacement for "list appointments under CCA" is `managed_cca_positions` or an explicit join. Confirm the chosen join shape with 02-PLAN to avoid drift.
- **Q7 (Cross-domain, 04-PLAN)**: Sports/Culture allocation routes also reference `public_user_info(email)`. The fix here uses `authenticated_user_directory`. Sync with 04-PLAN so both domains converge on the same directory view rather than each rolling their own join.
- **Q8 (Date model)**: The new schema uses `day DATE` rather than `week_id`. The plan above derives `day` from `weekId` via `holiday-weeks.json`. This makes the JSON config load-bearing: a typo in `start` translates to a "no envelope for this week" silent failure. Add a build-time check or runtime assertion that every entry's `start` is parseable and unique, and surface explicit errors when `getWeekDay` returns `null`.
- **Q9 (Approval reason persistence)**: `approve_subsidy` only writes `rejection_reason` on `rejected`; transitioning `approved → rejected` (retraction) does the same. There is no audit trail for who *approved* (only `decided_by` / `decided_at` overwrite each time). If product needs an approval history, propose a `cca_subsidy_decisions` event log — out of scope for this plan.
- **Q10 (Test framework)**: The codebase has no test framework configured (per `CLAUDE.md`'s tech-stack survey). Tasks 5.1–5.10 specify `npx tsc --noEmit` and manual smoke tests for verification. If a Jest/Vitest harness lands during the refactor, retrofit `weekly-change-set.test.ts` and `holiday-weeks.test.ts` with cases for the new payload shapes.
