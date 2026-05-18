# 01 — Plan: Auth & User domain schema alignment

## 1. Goal & scope

Bring the Auth & User slice of the Next.js API into alignment with the overhauled DB schema documented in `intranet-wiki`. This plan covers the `/api/user/*` route family, `fetch-user-info`, `AuthenticatedUser` typing, the Supabase client/middleware factories, and the auth callback — only insofar as they read identity/role/appointment data or shape the cross-repo contract. It does NOT cover CCA member CRUD, position rankings, chair-applicant flows, holiday subsidy, or sports/culture management; those belong to plans 02–05. It assumes the `public.authenticated_user_info` contract (changelog `03.authenticated-user-info.sql`) is stable and the `internal.auth_user_id()` SECURITY DEFINER function is deployed and `EXECUTE`-granted to `authenticated`.

## 2. Files in scope

API routes
- `src/app/api/user/route.ts` — GET (profile), DELETE (legacy cookie cleanup)
- `src/app/api/user/checkRole/route.ts` — chair/admin role probe
- `src/app/api/user/search/route.ts` — chair user search via `public_user_info`
- `src/app/api/user/getCCAs/route.ts` — user's appointed CCAs + rankable flag
- `src/app/api/user/getManagedCCAs/route.ts` — managed CCAs via `managed_cca_positions`

Lib / types / client
- `src/lib/fetch-user-info.ts` — primary consumer of `authenticated_user_info`
- `src/types/User.ts` — `AuthenticatedUser`, `UserAppointment`, `CcaType`, `PositionType`
- `src/types/CCAPosition.ts` — `CCAPosition` interface (deprecated field `is_admin` lives here)
- `src/lib/managed-cca-data.ts` — reads `managed_cca_positions` + `ccas`
- `src/context/AuthContext.tsx` — only the client transport; no direct DB queries
- `src/middleware.ts` — only the matcher / redirect surface (no schema reads)
- `src/utils/supabase/server.ts`, `src/utils/supabase/client.ts`, `src/utils/supabase/middleware.ts` — schema-agnostic; reviewed for auth-only edits
- `src/app/auth/callback/route.ts` — calls `fetchUserInfo()` on first sign-in

Out of scope (delegated; flagged in section 7 if touched indirectly)
- `src/features/cca/utils/cca-chair-access.ts`
- `src/lib/feature-flags.ts`
- `src/types/dashboard.ts` (already emptied)

## 3. Schema mapping

Citations refer to wiki pages at `/Users/bytedance/intranet-wiki/wiki/` and, where the wiki page is `status: seed`, to the upstream SQL changelog at `/Users/bytedance/intranet/db/changelogs/`.

### `src/lib/fetch-user-info.ts`

| Current reference | New reference | Notes |
|---|---|---|
| `from("authenticated_user_info")` select `id, email, name, room, points, profile_photo_path, appointments, is_admin, is_jcrc, is_culture_sports_admin` | Same view; columns match `view/core/03.authenticated-user-info.sql` daniel:3 | Contract — no rename. See `wiki/entity/view/public.authenticated_user_info.md` columns table. |
| `.eq("email", userEmail)` filter | RLS in the view already restricts to caller (`WHERE u.id = internal.auth_user_id()`) | The `.eq("email", …)` clause is now defensive at best and silently no-op at worst — keep but understand it does not gate the row. See gotcha #3 in the contract page. |
| JWT claim parsing for `app_user_id`/`intranet_user_id`/`internal_user_id` | No equivalent claim is emitted by the new DB; `internal.auth_user_id()` derives `users.id` from `auth.email()` server-side | `fetchUserId()` fast-path on custom claims should be retired or marked dead-code. See `wiki/entity/function/internal.auth_user_id.md`. |
| `storage.from("user-profile-pictures").getPublicUrl(profile_photo_path)` | Unchanged | Storage bucket is out-of-scope of this schema refactor. |

### `src/app/api/user/route.ts`

| Current reference | New reference | Notes |
|---|---|---|
| `fetchUserInfo()` round-trip | Same | GET handler is schema-clean. |
| `AUTH_USER_CACHE_KEY`, `AUTH_USER_ID_CACHE_KEY` cookie cleanup | Same | Legacy cleanup is unrelated to schema; keep for migration tail. |

### `src/app/api/user/checkRole/route.ts`

| Current reference | New reference | Notes |
|---|---|---|
| `userInfo.appointments[].position_type, position_name, cca_name` | Same — these are the keys emitted by `authenticated_user_appointments` JSON aggregate | `view/core/03.authenticated-user-info.sql` daniel:1 emits `cca_id, cca_name, position_id, position_type, position_name, points, commitment_period, cut_status`. Add `commitment_period`/`cut_status` to type if any caller needs them. |
| `userInfo.is_admin` | Same — derived from `authenticated_user_roles.is_admin` | Note: under the new schema `is_admin` is now derived from "user holds a position that has subordinate positions in the reporting chain" (`view/core/03.authenticated-user-info.sql` daniel:2), not from a stored flag. See `wiki/entity/view/public.authenticated_user_info.md`. The route's behavior is unchanged but its semantics have shifted; document this. |
| `checkCcaAuthorization({ requestingUser })` | Same — out of scope, delegated to plan 02 | Just verify it still consumes `appointments[].position_type`. |

### `src/app/api/user/search/route.ts`

| Current reference | New reference | Notes |
|---|---|---|
| `from("public_user_info").select("id, name, email, room")` | `public_user_info` now exposes only `id, name, profile_photo_path` (`view/core/01.public-user-info.sql` daniel:1) | **MISMATCH** — `email` and `room` are no longer in `public_user_info`. Authenticated chairs need a different source. Use `authenticated_user_directory` which exposes `id, email, name, room, telegram_handle, profile_photo_path` (`view/core/05.authenticated-user-directory.sql` daniel:1) and is granted to `authenticated`. |
| `.or("name.ilike.%q%,email.ilike.%q%,room.ilike.%q%")` | Run against `authenticated_user_directory` | Three filterable columns survive (`name`, `email`, `room`); `telegram_handle` is optional surface area. |
| `.order("name").limit(10)` | Same | No change. |

### `src/app/api/user/getCCAs/route.ts`

| Current reference | New reference | Notes |
|---|---|---|
| `user.appointments[].cca_id, cca_name, position_id, position_name, position_type, points` | Same shape | Emitted by `authenticated_user_appointments` JSON aggregate. |
| `from("ccas").select("id, name, cca_type, description, image_url")` | `ccas` table columns match (`table/core/03.cca.sql`): `id, name, cca_type, tier_type, description, image_url` | `tier_type enum.cca_tier_type` is NEW — pull it through to drive UI badges if needed (out of scope here; flag for plan 02). |
| `from("cca_appointments").select("position_id, cut_status").eq("user_id", …).in("position_id", …)` | Same table, same columns (`table/core/05.cca-appointment.sql`); `cut_status` is enum-typed now | RLS on `cca_appointments` allows public SELECT (`security/core/05.cca-appointment.sql` daniel:2), so this query still resolves under `authenticated`. Note `cut_status` is already in the `appointments` JSON; the secondary fetch is redundant. |
| `getManagedCcaData(supabase, user)` → reads `managed_cca_positions` and `ccas` | Same view, same columns | See `view/core/04.managed-cca-positions.sql` daniel:1 → exposes `cca_id, cca_name, positions[]` with `position_id, position_name, position_type, description, access_depth`. Wiki: `wiki/entity/view/public.managed_cca_positions.md`. |

### `src/app/api/user/getManagedCCAs/route.ts`

| Current reference | New reference | Notes |
|---|---|---|
| `getManagedCcaData()` | Same | Schema-clean. |

### `src/lib/managed-cca-data.ts`

| Current reference | New reference | Notes |
|---|---|---|
| `from("managed_cca_positions").select("*")` | Same view, columns `cca_id, cca_name, positions` per `view/core/04.managed-cca-positions.sql` | `positions` is a JSON array with `position_id, position_name, position_type, description, access_depth`. The TS type `ManagedCcaPosition` matches. |
| `from("ccas").select("id, name, cca_type, description")` | Same — also has `tier_type, image_url` if needed | No rename; safe. |
| `appointment.position_type` lowercase chair check (`lead`/`vice`) | Same enum values (`enum/03.position-type.sql`) | `position_type` enum is `enum.position_type`. Values are not in the wiki snapshot — verify against `enum/03.position-type.sql` directly; flagged in section 7. |

### `src/types/User.ts`

| Current type member | New schema column | Notes |
|---|---|---|
| `AuthenticatedUser.id: number` | `users.id SERIAL` (`table/core/02.user.sql`) | OK |
| `AuthenticatedUser.email/name/room` | `users.email TEXT NOT NULL`, `users.name TEXT NOT NULL`, `users.room VARCHAR NOT NULL` | OK; `room` is constrained by regex `^SH/[A-E]/[1-8]/...$` |
| `AuthenticatedUser.points: number` | `authenticated_user_appointments.points NUMERIC` (`COALESCE(SUM(a.points), 0)`) | Underlying `cca_appointments.points` is `INTEGER`; the aggregate is numeric. TS `number` is fine. |
| `AuthenticatedUser.profile_photo_url` | Derived from `users.profile_photo_path` via storage public URL | OK |
| `AuthenticatedUser.is_admin/is_jcrc/is_culture_sports_admin` | `authenticated_user_roles.*` (`view/core/03.authenticated-user-info.sql` daniel:2) | **SEMANTIC CHANGE** — these are no longer stored flags on `users`; they are derived per query from the reporting chain + `cca_type`. Keep TS type as `boolean` but add a JSDoc note. |
| `UserAppointment.position_type/position_name/points` | Emitted by view JSON aggregate | OK |
| `UserAppointment` extends `CCAPosition` which carries `is_admin: boolean` | The JSON aggregate does NOT include `is_admin` per appointment | **STALE FIELD** — `CCAPosition.is_admin` is dead; remove or repoint. |
| missing: `commitment_period`, `cut_status` on `UserAppointment` | Both are emitted by the view JSON aggregate now | Additive — add to the TS type. |
| missing: `display_name`, `telegram_handle`, `stay_period`, `matric` | All present on `authenticated_user_info` per contract page columns table | Additive — surface if any caller needs them; otherwise leave the TS type tight. |
| `AuthenticatedUser.display_name?: string` already present | View column is `text` (nullable) | TS should be `string | null` to match nullability. |

### `src/middleware.ts`, `src/utils/supabase/{server,client,middleware}.ts`, `src/context/AuthContext.tsx`, `src/app/auth/callback/route.ts`

No direct DB schema references. Auth path runs through `supabase.auth.getClaims()` / `getSession()` / `exchangeCodeForSession()` and `fetchUserInfo()`. No edits required for schema alignment. Listed for completeness; verified by grepping for `.from(`, `.rpc(`, and `supabase.from`.

## 4. Authorization / RLS impact

- The `users` table now has split SELECT grants by role (`security/core/02.user.sql` daniel:7, daniel:8):
  - `anon` can SELECT only `id, name, profile_photo_path`.
  - `authenticated` can SELECT directory columns: `id, created_at, updated_at, email, name, room, display_name, profile_photo_path, telegram_handle, stay_period, matric` — `expo_push_token` is excluded.
  - Any code that selects `expo_push_token` from `users` under `authenticated` will fail with permission error. None of the in-scope routes do this today; flag in section 7 if discovered downstream.
- `authenticated_user_info` is `security_invoker = on` and runs the caller's RLS. The `select_own_user` policy (`security/core/02.user.sql` daniel:2) restricts the underlying join to `internal.auth_user_id() = id`, which guarantees single-row isolation regardless of any `.eq("email", …)` filter the app adds. SSR session bleed risk is mitigated at the DB layer, but the SSR client must still pass the caller's cookies — see `src/utils/supabase/server.ts`.
- `public_user_info` is `security_invoker = on` and granted to both `anon` and `authenticated` (`view/core/01.public-user-info.sql` daniel:2). Because it now exposes only `id, name, profile_photo_path`, the search route must move to `authenticated_user_directory` for `email`/`room` columns (see section 3).
- `authenticated_user_directory` is granted to `authenticated` only (`view/core/05.authenticated-user-directory.sql` daniel:2). RLS on `users` allows authenticated SELECT (`security/core/02.user.sql` daniel:6 with `USING (true)`), so the directory view returns the full user roster to any authenticated caller — application-layer chair/admin gating in the search route remains necessary.
- `managed_cca_positions` is `security_invoker = on`, joins on `internal.auth_user_id()` internally, and is granted to `authenticated` (`view/core/04.managed-cca-positions.sql` daniel:2). The `getManagedCcaData` helper does not need an explicit user filter.
- `is_admin` flag semantics have shifted: it is now derived from "user holds a position that has subordinate positions in the reporting chain" (`view/core/03.authenticated-user-info.sql` daniel:2). The `checkRole` route still uses `userInfo.is_admin` correctly, but operators should be aware the flag is no longer settable independently of the appointment graph.
- No `service_role` bypass is required for any in-scope route; all reads work under `authenticated`.

## 5. Tasks

### Task 1 — Switch user search to `authenticated_user_directory`

**Files:** `src/app/api/user/search/route.ts`

Steps:
- [x] Replace the table reference on line 56 from `public_user_info` to `authenticated_user_directory`.
- [x] Confirm the `.select("id, name, email, room")` projection still resolves under the directory view (it does — see `view/core/05.authenticated-user-directory.sql`).
- [x] Keep the chair-only gate via `checkCcaAuthorization`; do not relax it just because the directory view is authenticated-wide.

Before/after:

```ts
// before
const { data, error } = await supabase
  .from("public_user_info")
  .select("id, name, email, room")
  .or(`name.ilike.%${query}%,email.ilike.%${query}%,room.ilike.%${query}%`)
  .order("name")
  .limit(10);

// after
const { data, error } = await supabase
  .from("authenticated_user_directory")
  .select("id, name, email, room")
  .or(`name.ilike.%${query}%,email.ilike.%${query}%,room.ilike.%${query}%`)
  .order("name")
  .limit(10);
```

Verification:
- [ ] Sign in as a `lead`/`vice` chair, hit `GET /api/user/search?query=an`, confirm 200 with matching residents.
- [ ] Sign in as a non-chair, confirm 403.
- [ ] Sign in as anon (no session), confirm 401.

Test coverage gap:
- [ ] No test file exists under `src/app/api/user/__tests__/` for the search route — add a fixture-driven test that mocks the Supabase client and asserts the table name used is `authenticated_user_directory`.

### Task 2 — Remove dead `internal_user_id` JWT-claim fast path in `fetchUserId`

**Files:** `src/lib/fetch-user-info.ts`

Steps:
- [x] Delete `INTERNAL_USER_ID_CLAIM_KEYS`, `parseNumberClaim`, and `resolveInternalUserIdFromClaims` — the new auth path does not emit `app_user_id`/`intranet_user_id`/`internal_user_id` claims (Supabase JWT only carries `sub`, `email`, etc.; see `wiki/entity/function/internal.auth_user_id.md` for the DB-side resolver).
- [x] In `fetchUserId()`, drop the claims pre-check and go straight to the `authenticated_user_info` lookup, which itself is gated by `internal.auth_user_id()`.

Before/after:

```ts
// before
export async function fetchUserId(): Promise<number | null> {
  noStore();
  const supabase = await createClient();
  const claims = await getVerifiedClaims(supabase);
  const internalUserIdFromClaims = resolveInternalUserIdFromClaims(claims);
  if (internalUserIdFromClaims !== null) return internalUserIdFromClaims;
  const userEmail = await resolveAuthenticatedEmail(supabase, claims);
  // … db lookup …
}

// after
export async function fetchUserId(): Promise<number | null> {
  noStore();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("authenticated_user_info")
    .select("id")
    .single();
  if (error) {
    console.error("Error retrieving user ID from database:", error);
    return null;
  }
  return data?.id ?? null;
}
```

Verification:
- [x] `npm run lint` clean.
- [ ] Manually call `fetchUserId()` from a server component in dev; confirm a logged-in user returns their `users.id`, anon returns `null`.

Test coverage gap:
- [ ] Add a unit test that asserts `fetchUserId()` returns `null` when no session exists and the user's id when authenticated. Currently no tests exist for this module.

### Task 3 — Drop the redundant `.eq("email", userEmail)` filter from `fetchUserInfo`

**Files:** `src/lib/fetch-user-info.ts`

Rationale: the view is `security_invoker = on` with RLS `internal.auth_user_id() = id`, which already returns at most one row per caller. The email filter is unnecessary and masks the contract — keep `.single()`.

Steps:
- [x] Remove the email resolution chain inside `fetchUserInfo()` (lines 80–86 in current file) and the `.eq("email", userEmail)` clause.
- [x] Keep `noStore()` and the null check after `.single()`.

Before/after:

```ts
// before
const userEmail = await resolveAuthenticatedEmail(supabase, claims);
if (!userEmail) { /* return null */ }
const { data, error } = await supabase
  .from("authenticated_user_info")
  .select("…")
  .eq("email", userEmail)
  .single();

// after
const { data, error } = await supabase
  .from("authenticated_user_info")
  .select("id, email, name, room, points, profile_photo_path, appointments, is_admin, is_jcrc, is_culture_sports_admin")
  .maybeSingle();
if (error) throw error;
if (!data) return null;
```

Notes:
- [x] Switch from `.single()` to `.maybeSingle()` so unauthenticated callers get `null` instead of a thrown error when the view is empty.
- [x] Keep `resolveAuthenticatedEmail` only if some path outside this function uses it. Grep `src/` for `resolveAuthenticatedEmail` — if no external use, delete it.

Verification:
- [ ] `curl -X GET /api/user` with no session → 404, no DB exception in logs.
- [ ] `curl -X GET /api/user` with valid cookies → 200 with own profile.
- [ ] In `psql` as `authenticated` role: `SET request.jwt.claims TO '{"email":"foo@example.com"}'; SELECT count(*) FROM authenticated_user_info;` → returns 1.

Test coverage gap:
- [ ] No tests today for `fetch-user-info.ts`. Add a stub-based test verifying `maybeSingle` is used and that the row count is not over-filtered.

### Task 4 — Clean up `UserAppointment` shape

**Files:** `src/types/User.ts`, `src/types/CCAPosition.ts`

Steps:
- [x] Remove `is_admin: boolean` from `CCAPosition` — the `authenticated_user_appointments` JSON aggregate does not emit a per-appointment admin flag (`view/core/03.authenticated-user-info.sql` daniel:1).
- [x] Add `commitment_period: enum.commitment_period` and `cut_status: enum.cut_status | null` to `UserAppointment` to mirror the JSON keys.
- [x] Tighten `AuthenticatedUser.display_name` to `string | null` to match `users.display_name TEXT` (nullable).
- [x] Leave `PositionType` and `CcaType` as string unions for now — see Open Questions for the enum-source gap.

Before/after:

```ts
// src/types/CCAPosition.ts — before
export interface CCAPosition {
  cca_id: number;
  cca_name: string;
  position_id: number;
  position_name: string;
  is_admin: boolean;
}

// src/types/CCAPosition.ts — after
export interface CCAPosition {
  cca_id: number;
  cca_name: string;
  position_id: number;
  position_name: string;
}
```

```ts
// src/types/User.ts — additions
export interface UserAppointment extends CCAPosition {
  position_type: PositionType;
  position_name: string;
  points: number;
  commitment_period: "full-year" | "semester-1" | "semester-2";
  cut_status: "cut" | "active" | null; // refine from enum/05.cut-status.sql
}
```

Verification:
- [x] `npm run build` passes with no `tsc` errors referencing `is_admin` on appointments. (Verified via `npx tsc --noEmit`; in-scope files have no errors and no `is_admin` references on appointments remain.)
- [x] Grep for `appointment.is_admin` and `appointments[].is_admin` — must return zero hits across `src/`. (Verified — no matches.)

Test coverage gap:
- [ ] If any test fixture builds a `UserAppointment` literal, ensure it adds the new fields. Currently the test corpus is minimal; no immediate gap to fill beyond compile-time checks.

### Task 5 — Drop the redundant `cca_appointments` cut-status fetch in `getCCAs`

**Files:** `src/app/api/user/getCCAs/route.ts`

Rationale: `cut_status` is already included in `user.appointments[].cut_status` per the new view; the secondary `cca_appointments` query is duplicate work. This is a side-effect of Task 4 making `cut_status` visible on the typed appointment.

Steps:
- [x] Remove the block from line 80 (`appointmentPositionIds = …`) through line 101 (`set(row.position_id, row.cut_status ?? null)`).
- [x] Replace the `cut_status` lookup at line 114 with `appointment.cut_status ?? null`.

Before/after:

```ts
// before
cut_status: appointmentStatusByPositionId.get(appointment.position_id) ?? null,

// after
cut_status: appointment.cut_status ?? null,
```

Verification:
- [ ] `GET /api/user/getCCAs` with a user who has a `cut_status='cut'` appointment returns `cut_status: "cut"` for that row.
- [ ] Network tab shows one fewer Supabase query per dashboard load.

Test coverage gap:
- [ ] No existing test for this route. Add a test that mocks `fetchUserInfo()` to return an appointment with a populated `cut_status` and verifies the response surfaces it without a second DB call.

### Task 6 — Document the `is_admin` semantic shift

**Files:** `src/app/api/user/checkRole/route.ts`, `src/types/User.ts`

Steps:
- [x] Add a JSDoc note above `UserRoleFlags` in `src/types/User.ts` stating `is_admin/is_jcrc/is_culture_sports_admin` are derived per-query from appointments + reporting chain (`view/core/03.authenticated-user-info.sql` daniel:2) and not stored on `users`.
- [x] Add a brief comment in `checkRole/route.ts` near the `userInfo.is_admin` branch explaining that admin status now requires the user to hold a position with subordinates in the reporting chain — useful when debugging "I gave them admin but they can't see X."

Before/after:

```ts
// src/types/User.ts — after
/**
 * Role flags surfaced from `authenticated_user_roles`. These are *derived*
 * per query from the user's appointments and the reporting chain of their
 * position(s) — they are not stored as columns on `public.users`.
 * See: intranet-wiki/wiki/entity/view/public.authenticated_user_info.md
 */
export interface UserRoleFlags {
  is_admin: boolean;
  is_jcrc: boolean;
  is_culture_sports_admin: boolean;
}
```

Verification:
- [x] Grep for `is_admin` across `src/` — confirm each consumer is comment-friendly with the derived semantics. (Comments added in `src/types/User.ts` and `src/app/api/user/checkRole/route.ts`; remaining consumers are sidebar gating which now correctly relies on the derived flag.)

Test coverage gap: none — comments only.

### Task 7 — Confirm no auth-only edits needed to Supabase client factories

**Files:** `src/utils/supabase/server.ts`, `src/utils/supabase/client.ts`, `src/utils/supabase/middleware.ts`, `src/middleware.ts`

Steps:
- [x] Read each file end-to-end; confirm no `.from(`, `.rpc(`, or schema-coupled call exists.
- [x] Verify `createClient({ allowCookieWrite: true })` is invoked from `src/app/auth/callback/route.ts` (only writeable path).
- [x] Verify the matcher in `src/middleware.ts` covers `/dashboard/:path*` and `/auth/:path*` — no expansion is needed for the schema refactor.

Verification:
- [x] `grep -rn "supabase.from\|supabase.rpc" src/utils src/middleware.ts` returns zero matches. (Verified — no schema-coupled calls in the client factories or middleware.)

Test coverage gap: out of scope; the SSR session-bleed concern is its own workstream (see project CLAUDE.md).

## 6. Verification

Once Tasks 1–6 ship, run these end-to-end checks. They assume the DB has been migrated to the new schema and that the changelog files referenced above have been applied.

DB-side preconditions:
- [ ] `SELECT has_function_privilege('authenticated', 'internal.auth_user_id()', 'EXECUTE');` returns `t`.
- [ ] `SELECT has_table_privilege('authenticated', 'public.authenticated_user_info', 'SELECT');` returns `t`.
- [ ] `SELECT has_table_privilege('authenticated', 'public.authenticated_user_directory', 'SELECT');` returns `t`.
- [ ] `SELECT has_table_privilege('anon', 'public.public_user_info', 'SELECT');` returns `t`.

App-side smoke (run against local dev or preprod):

```bash
# Authenticated GET /api/user — your own profile, 200
curl -i -b cookies.txt "$BASE/api/user"

# Authenticated GET /api/user/search?query=an as a non-chair — 403
curl -i -b cookies.txt "$BASE/api/user/search?query=an"

# Authenticated GET /api/user/search?query=an as a lead/vice — 200 with hits
curl -i -b chair-cookies.txt "$BASE/api/user/search?query=an"

# Authenticated GET /api/user/getCCAs — appointments + can_rank_members
curl -i -b cookies.txt "$BASE/api/user/getCCAs"

# Authenticated GET /api/user/getManagedCCAs — chair-managed CCAs only
curl -i -b chair-cookies.txt "$BASE/api/user/getManagedCCAs"

# Authenticated GET /api/user/checkRole — isAuthorized matches lead/vice/admin state
curl -i -b cookies.txt "$BASE/api/user/checkRole"
```

Session-isolation check (regression guard for the SSR-bleed bug noted in the project README):
- [ ] In two browser profiles, sign in as user A and user B simultaneously. Hit `/api/user` from each. Confirm each returns its own row only. Repeat after a server reload to ensure no module-level state leaks.

Static check:
- [ ] `npm run lint && npm run build` — no errors.

## 7. Open questions

- **Enum literal values for `position_type`, `cca_type`, `cut_status`, `commitment_period`, `cca_tier_type`.** The wiki pages under `wiki/entity/enum/` are not present in the listing I scanned; only the `enum/` SQL changelog directory is referenced. Need a wiki seed or upstream `enum/03.position-type.sql` read before tightening `PositionType` and `CcaType` from `string` unions to literal types in `src/types/User.ts`. Source: `/Users/bytedance/intranet/db/changelogs/enum/`.
- **`is_admin` semantic shift downstream.** The `checkRole` route still works because `userInfo.is_admin` is still a boolean, but business logic that assumes an admin flag is *settable* by an operator (e.g., admin tooling that flips a row in `users.is_admin`) will silently break. Flag for the CCA-management plan (02) and admin tooling owners. Wiki: `wiki/entity/view/public.authenticated_user_info.md` columns table notes the derivation.
- **`cca-chair-access.ts` consumers across other domains.** The chair check in `checkRole/route.ts` and `search/route.ts` calls `checkCcaAuthorization` from `src/features/cca/utils/cca-chair-access.ts`. The lib itself only looks at `appointment.position_type` and is schema-clean, but the *list of valid chair position types* should be reconciled against `enum.position_type` once that enum's wiki page exists. Cross-domain — flagged for plan 02.
- **`tier_type` on `ccas`.** New column from `table/core/03.cca.sql`. `getCCAs/route.ts` returns CCA metadata to the dashboard. The dashboard may want to badge tier-1 vs tier-2 CCAs. Out of scope here; flagged for plan 02 (CCA model & management).
- **`expo_push_token` exclusion under `authenticated`.** `security/core/02.user.sql` daniel:8 explicitly excludes `expo_push_token` from the `authenticated` column grant. The Next app does not currently read this column, but the mobile/notifications adjacent code might. Out of scope here; flagged for whoever owns push notifications.
- **`fetchUserId()` callers.** Need to grep for `fetchUserId` consumers before the cleanup in Task 2 to confirm none of them depend on the deleted claims fast-path's synchronous-after-cache behavior. Cross-cutting check — verify in implementation.
- **`AUTH_USER_CACHE_KEY` / `AUTH_USER_ID_CACHE_KEY` cookies.** `src/app/api/user/route.ts` DELETE handler still clears these. Confirm with operators whether any stale clients (older app versions, web previews) still set them; if not, the DELETE handler can be simplified or removed in a follow-up plan.
