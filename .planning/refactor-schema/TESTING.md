# Schema Refactor — Testing & Validation Plan

End-to-end test plan covering everything the 2026-05-18 schema refactor changed. Designed to be driven by Puppeteer (or any browser automation), but readable by hand. Each test case lists URL, prerequisites, action steps, expected outcomes, and the specific failure modes the refactor introduced.

## How to use this document

- Each test case has an **ID** (e.g. `T-AUTH-01`) for cross-referencing in commit messages and bug reports.
- **URL** is relative to the app root (production: `https://intranet.shweb.org`; preprod: `https://intranet-beta.shweb.org`; local dev: `http://localhost:3000`).
- **Network** assertions name the request/response Puppeteer should intercept (`page.on('response', ...)`).
- **DOM** assertions describe what should be visible; selectors are provided where stable, otherwise described semantically (the codebase uses `data-testid` sparingly — most selectors will be `getByText` / `getByRole`).
- **Fail modes** call out the specific symptom of a refactor regression (e.g. "if you see `relation cca_member_rankings does not exist`, plan 02 Task 5 reverted").

## Prerequisites

### DB state
- All migrations from `MIGRATIONS.md` must be deployed to the target environment. Verify in psql before running any tests:
  ```sql
  -- §2 wrappers
  SELECT proname FROM pg_proc WHERE proname IN
      ('can_manage_cca_appointments', 'can_manage_any_position_in_cca')
      AND pronamespace = 'public'::regnamespace;
  -- expect 2 rows

  -- §3, §4 columns on cca_user_subsidies
  SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'cca_user_subsidies'
        AND column_name IN ('hours', 'comments');
  -- expect 2 rows

  -- §5 column on cca_subsidies + RPC signature
  SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'cca_subsidies'
        AND column_name = 'justification';
  -- expect 1 row
  SELECT pg_get_function_arguments(oid) FROM pg_proc
      WHERE proname = 'upsert_subsidy' AND pronamespace = 'public'::regnamespace;
  -- expect: p_position_id integer, p_day date, p_hours numeric, p_justification text DEFAULT NULL::text
  ```
- The deleted legacy tables must NOT exist:
  ```sql
  SELECT relname FROM pg_class WHERE relname IN
      ('cca_member_rankings', 'cca_allocation_events', 'cca_capacity_info', 'cca_user_ranking', 'user_cca_applications');
  -- expect 0 rows
  ```

- **GRANTs to the `authenticated` role.** The schema-refactor migrations create the tables/views/RPCs but several environments have shipped without the matching grants. Verify before running any tests:
  ```sql
  -- Schema USAGE
  SELECT n.nspname, has_schema_privilege('authenticated', n.oid, 'USAGE') AS usage_granted
  FROM pg_namespace n
  WHERE n.nspname IN ('public', 'internal', 'enum');
  -- expect 3 rows, all usage_granted = true

  -- Table/view SELECT (sample — extend as needed)
  SELECT c.relname,
         has_table_privilege('authenticated', c.oid, 'SELECT') AS select_granted,
         has_table_privilege('authenticated', c.oid, 'UPDATE') AS update_granted
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname IN (
      'authenticated_user_info', 'authenticated_user_roles', 'authenticated_user_directory',
      'cca_appointments', 'cca_appointment_evaluations', 'cca_positions',
      'cca_position_preferences', 'cca_user_preferences',
      'cca_subsidies', 'cca_user_subsidies'
    );
  -- expect SELECT=true on all rows; UPDATE=true on cca_positions, cca_appointments, the two preference tables, and the two subsidy tables
  ```
  If any of these are missing, sign-in or chair/JCRC actions will fail with `42501 permission denied for table/schema X`. Two routes (`forChair`, `getRankablePositions`) historically swallowed these errors and returned `{positions:[]}` with 200 — making the grant gap invisible. Both were fixed to surface 500s in this codebase but other routes may still mask similar issues.

### Test users

Provision 5 test accounts in the target Supabase project. Each must have a corresponding row in `public.users` and (where applicable) appointments seeded.

| ID | Role | Required appointments |
|----|------|------------------------|
| `U-MEMBER` | regular member | One `member` appointment in any sports/culture CCA |
| `U-CHAIR-SPORTS` | sports chair | One `lead` appointment in a sports CCA (e.g. Badminton M) |
| `U-CHAIR-COMMITTEE` | committee chair | One `lead` appointment in a committee CCA |
| `U-MAINCOMM-HEAD` | maincomm head over a subcomm | One `maincomm` appointment whose position has a `subcomm` member reporting to it (validates plan 02 widening) |
| `U-JCRC` | JCRC member | One appointment in any CCA with `cca_type = 'jcrc'` |

Record each user's `users.id`, their primary `cca_appointments.position_id`, and the relevant `ccas.id` / `ccas.name`. Tests refer to them as `{U-CHAIR-SPORTS.cca_id}`, etc.

### Environment

- Node `package.json` lockfile installed; `npm run build` is green.
- Dev server: `npm run dev` (defaults to port 3000). For Puppeteer, set `BASE_URL=http://localhost:3000`.
- Cookies preserved across the test run for each user session (use Puppeteer `browserContext` per role).

### Reset between runs

Tests mutate `cca_appointment_evaluations`, `cca_subsidies`, `cca_user_subsidies`, `cca_position_preferences`, `cca_user_preferences`, `cca_appointments`. Either:
- Run against a disposable QA DB and reset between full runs, OR
- Add a teardown step per test that reverses what it created (each case below has a `Cleanup` block).

---

## Section A — Auth & user (Plan 01)

### T-AUTH-01 — Login + profile load

**URL:** `/dashboard`
**As:** `U-MEMBER`
**Preconditions:** Logged out.
**Steps:**
1. Navigate to `/dashboard`. Should redirect to `/auth/login`.
2. Click "Sign in with Google" (or use Supabase test auth).
3. Complete OAuth flow.
4. Land on `/dashboard`.
**Expected:**
- Network: `GET /api/user` returns 200 with `{ id, email, name, room, points, profile_photo_url, appointments, is_admin, is_jcrc, is_culture_sports_admin }` — every key present (no `undefined`).
- DOM: user's display name visible in top-right sidebar or welcome card.
**Fail modes:**
- If `appointments` is empty `[]` for a known-appointed user → `authenticated_user_info` view broken or `internal.auth_user_id()` returning NULL (check `auth.email()` propagation).
- If `is_jcrc` is `undefined` (vs `false`) → plan 01 Task 4 typing regression.

### T-AUTH-02 — User search returns email + room

**URL:** `/api/cca/<ccaId>/searchUsers?query=<partial-name>`
**As:** `U-CHAIR-SPORTS` (chair access required by route)
**Preconditions:** At least one user in the DB whose name matches the partial.
**Steps:**
1. Make an authenticated GET request to `/api/cca/<ccaId>/searchUsers?query=test` (note: the param is `query`, not `q`, and minimum length is 2 chars).
**Expected:**
- Network: 200 with `{ success: true, data: [{ id, name, email, room }, ...] }`.
- Each row has `email` and `room` populated (NOT NULL).
**Fail modes:**
- If `email` is missing from rows → route still queries `public_user_info` instead of `authenticated_user_directory`.
- 403 → chair authorization check broken.

### T-AUTH-03 — Role flags derived correctly

**URL:** `/api/user`
**As:** `U-MAINCOMM-HEAD` and `U-JCRC` separately
**Steps:**
1. As `U-MAINCOMM-HEAD`, fetch `/api/user`. Verify `is_admin = true` (they have subordinate positions in the reporting chain).
2. As `U-JCRC`, fetch `/api/user`. Verify `is_jcrc = true`.
3. As `U-MEMBER`, fetch `/api/user`. Verify all three flags are `false`.
**Fail modes:**
- `is_admin` always `false` for a maincomm head → `authenticated_user_roles` view's reporting-chain detection broken.
- Trying to "flip" a flag by UPDATE on `users` → no longer possible (flags are derived). Admin tooling that does this is silently broken and must be migrated to position assignment.

---

## Section B — CCA membership management (Plan 02)

### T-CCA-01 — Chair lists members with email/room

**URL:** `/dashboard/mycca/admin/manageMembers/<cca-slug>?ccaId=<id>`
**As:** `U-CHAIR-SPORTS`
**Steps:**
1. Navigate to the manage-members page for your CCA.
**Expected:**
- Network: `GET /api/cca/<ccaId>/members` returns 200 with each member's `email` and `room` populated.
- DOM: member rows show the email column and the room column.
**Fail modes:**
- Members shown but email/room blank → embed still uses `public_user_info` (which no longer exposes those columns).
- "Could not find a relationship" error in response → `authenticated_user_directory!inner` embed fails; consider rewriting as two queries with `.in('id', userIds)`.

### T-CCA-02 — Widened chair check: maincomm head manages subcomm member

**URL:** `/dashboard/mycca/admin/manageMembers/<subcomm-cca-slug>?ccaId=<subcomm-id>`
**As:** `U-MAINCOMM-HEAD`
**Preconditions:** The maincomm head's position has a subcomm position reporting to it (verify via `internal.can_manage_cca_appointments(<subcomm-position-id>, <maincomm-head-user-id>)` → `true`).
**Steps:**
1. Navigate to manage-members for the subcomm CCA.
**Expected:**
- Network: `GET /api/cca/<ccaId>/members` returns 200 (was 403 pre-refactor).
- DOM: member roster of the subcomm visible; chair UI controls (add/remove) enabled.
**Fail modes:**
- 403 → plan 02 Task 7 didn't deploy the widened check, or the new RPC `public.can_manage_any_position_in_cca` isn't granted to `authenticated`.

### T-CCA-03 — Add member (chain-of-managers RLS path)

**URL:** `/dashboard/mycca/admin/manageMembers/<cca-slug>?ccaId=<id>`
**As:** `U-CHAIR-SPORTS`
**Steps:**
1. Open the "Add Member" dialog.
2. Search for a user (typing in the search box hits `/api/cca/<ccaId>/searchUsers`).
3. Select a user, choose a position, submit.
**Expected:**
- Network: `POST /api/cca/<ccaId>/addMember` returns 200.
- DB: a new row in `cca_appointments` with `(user_id, position_id, commitment_period='full-year', points=0)`.
- DOM: the new member appears in the list after refetch.
**Fail modes:**
- 23505 PK violation → trying to add an existing `(user_id, position_id)`; UX should pre-check this.
- 23P01 with "Position capacity (N) for Semester X would be exceeded" → `validate_cca_appointment_after_write` trigger fired; surface message to user.
- "column tier_type does not exist" → plan 02 Task 3 didn't remove the legacy field.

### T-CCA-04 — Remove member (no audit-log write)

**URL:** `/dashboard/mycca/admin/manageMembers/<cca-slug>?ccaId=<id>`
**As:** `U-CHAIR-SPORTS`
**Steps:**
1. Click the remove button on a member row.
2. Confirm.
**Expected:**
- Network: `POST /api/cca/<ccaId>/removeMember` returns 200.
- DB: row gone from `cca_appointments`.
**Fail modes:**
- `relation cca_allocation_events does not exist` in the response → plan 02 Task 4 reverted.

### T-CCA-05 — Update member (only cut_status + commitment_period accepted)

**URL:** `/dashboard/mycca/admin/manageMembers/<cca-slug>?ccaId=<id>`
**As:** `U-CHAIR-SPORTS`
**Steps:**
1. Edit a member's cut status to `ihg-team` (sports CCA).
2. Save.
**Expected:**
- Network: `POST /api/cca/<ccaId>/updateMember` body has only `{ user_id, position_id, cut_status, commitment_period? }`. No `ranking`, `attendance_rating`, `performance_rating`, `comments`.
- Response: 200.
- DB: `cca_appointments.cut_status` updated; no rows touched in `cca_appointment_evaluations`.
**Fail modes:**
- Any write to `cca_member_rankings` in the network panel → plan 02 Task 5 reverted.
- 400 "Cut status is not allowed" when sending a valid status → cut-status normalization regressed.

---

## Section C — Member ranking (Plan 03)

### T-RANK-01 — Chair loads rankings (cca_appointment_evaluations read)

**URL:** `/dashboard/mycca/admin/rankMembers/<cca-slug>?ccaId=<id>`
**As:** `U-CHAIR-SPORTS`
**Preconditions:** At least one `member` appointment exists in this CCA.
**Steps:**
1. Navigate to the rank-members page.
**Expected:**
- Network: `GET /api/cca/<ccaId>/rankings` returns 200 with `{ members: [...], cca_type, cca_name }`.
- Each member row has rubric fields populated (e.g. `ranking`, `attendance`, `performance` for sports; `ranking`, `helpfulness`, `initiative`, `attitude` for resident). Missing rubric → zeros.
**Fail modes:**
- `relation cca_member_rankings does not exist` → plan 03 Task 1 reverted.
- Empty `members` for a CCA with appointments → `cca_appointments` join to position broken (check `cca_positions.cca_id` filter).
- 403 → `cca_appointment_evaluations.select_managed` RLS failing; verify the chair's appointment exists.

### T-RANK-02 — Chair saves rankings (scores JSONB CHECK)

**URL:** `/dashboard/mycca/admin/rankMembers/<cca-slug>?ccaId=<id>`
**As:** `U-CHAIR-SPORTS`
**Steps:**
1. Edit a member's rubric (set ranking + at least one rubric metric > 0).
2. Click Save.
**Expected:**
- Network: `POST /api/cca/<ccaId>/rankings` body is `[{ user_id, position_id, ranking, attendance?, performance?, helpfulness?, initiative?, attitude?, remarks? }, ...]`.
- Response: 200 with `{ success: true }`.
- DB: row in `cca_appointment_evaluations` with `scores` JSONB containing the merged `{ ranking, attendance, performance, ... }`.
**Fail modes:**
- 23514 "check constraint cca_appointment_evaluations_scores_object" → an empty `scores` `{}` was written. `buildRankingsUpsertPayloads` should filter zero-rubric rows pre-flight.
- 403 → chair's `internal.can_manage_cca_appointments(position_id, user_id)` returning false; verify reporting chain.
- "column comments does not exist" → legacy split-column code not fully removed; both ranking + rubric must merge into `scores`.

### T-RANK-03 — Member cannot read own rubric (RLS expected behavior)

**URL:** `/api/cca/<their-cca-id>/rankings`
**As:** `U-MEMBER`
**Steps:**
1. Direct fetch (not via UI — no UI surfaces this to members today).
**Expected:**
- Either 403, or 200 with empty `members` array (RLS filters rows away). Both are acceptable per the product call ("Acceptable — keep as is").
**Fail modes:**
- If the member sees their own ranking → SELECT RLS on `cca_appointment_evaluations` is broader than `internal.can_manage_cca_appointments`. The DB policy should be re-checked.

---

## Section D — CCA allocation (Plan 04)

### T-ALLOC-01 — Chair lists applicants for a position

**URL:** `/dashboard/ccaAllocation/rankApplicants?ccaId=<id>`
**As:** `U-CHAIR-COMMITTEE`
**Preconditions:** Chair manages a CCA with at least one position that has `cca_position_preferences` rows seeded.
**Steps:**
1. Navigate to rank-applicants page.
**Expected:**
- Network: `GET /api/chair/positions/forChair` returns 200 with `{ positions: [{ id, name, cca_name, total_capacity, available_capacity, applied_count, position_type, applicants: [{ id, name, email, room, ranking }] }] }`.
- Each applicant has email + room populated (via `authenticated_user_directory`).
- `applied_count` equals the number of applicant rows.
**Fail modes:**
- `relation cca_capacity_info does not exist` → plan 04 Task A reverted.
- Empty applicants list despite known seed rows → `cca_position_preferences.select_managed` RLS failing or the `(position_id)` filter wrong.
- "Could not find a relationship" → the directory embed approach failed; fallback to two queries.

### T-ALLOC-02 — Chair reorders applicants (staged-rank workaround)

**URL:** same as T-ALLOC-01
**As:** `U-CHAIR-COMMITTEE`
**Preconditions:** At least 3 applicants for the position.
**Steps:**
1. Drag (or click controls) to swap the top two applicants' order.
2. Click Save.
**Expected:**
- Network: `POST /api/chair/positions/<position_id>/rank` body is `[{ user_id, ranking }, ...]` for the full set.
- Response: 200.
- DB: `SELECT user_id, rank FROM cca_position_preferences WHERE position_id = <id> ORDER BY rank` — values are contiguous (`1, 2, 3, ...`) with no `1001+` residuals from the staging step.
**Fail modes:**
- Any rank value `>= 1001` after save → staging loop didn't complete its second pass.
- 23505 unique violation on `(position_id, rank)` → DEFERRABLE constraint not deferred (check that the table definition still has `DEFERRABLE INITIALLY DEFERRED`).
- Applicants removed from the list still appear in `cca_position_preferences` → prune step (`DELETE NOT IN`) didn't fire.

### T-ALLOC-03 — User views and saves their preferences

**URL:** `/dashboard/ccaAllocation/rank`
**As:** `U-MEMBER`
**Preconditions:** Feature flag `ccaApplications` is enabled.
**Steps:**
1. Navigate to the rank page.
2. Select at least 2 positions.
3. Set ranks (1, 2).
4. Click Save.
**Expected:**
- Network: `GET /api/user/getRankablePositions/<email>` returns 200 with `positions: [...]`; the user's existing rows show as `user_ranking: <number>, is_selected: true`.
- Network: `POST /api/user/saveRankings` body `[{ position_id, ranking }, ...]` → 200.
- DB: rows in `cca_user_preferences` for the caller's `user_id` with contiguous ranks.
**Fail modes:**
- 401 → `fetchUserId()` returning null; check JWT claim resolution.
- `applied_count > 0` exposed on the response — should always be `0` (RLS hides preference counts from regular users).
- After save, `cca_user_preferences.rank` still at `1001+` → staging didn't complete.
- 503 (feature-flag disabled) → expected if `ccaApplications: false` in `src/lib/feature-flags.ts`; verify flag state matches the test environment.

### T-ALLOC-04 — sportsCulture routes return 404

**URL:** `/api/sportsCulture/available` and `/api/sportsCulture/apply`
**As:** Any logged-in user.
**Steps:**
1. GET `/api/sportsCulture/available`.
2. POST `/api/sportsCulture/apply` with any body.
3. DELETE `/api/sportsCulture/apply` with any body.
**Expected:**
- All three return 404 (route handler does not exist).
**Fail modes:**
- Any non-404 → route still exists, plan 04 Task K reverted.

### T-ALLOC-05 — Dashboard has no sportsCulture link

**URL:** `/dashboard`
**As:** `U-MEMBER`
**Steps:**
1. Navigate to `/dashboard`.
**Expected:**
- DOM: no card/link containing the text "Sports & Culture" or `href="/dashboard/sportsCulture"`. Other allocation cards (CCA Allocation main) remain.
**Fail modes:**
- Dead link still present → plan 04 Task K didn't edit `src/app/dashboard/page.tsx`.

---

## Section E — Holiday subsidy (Plan 05)

### T-SUB-01 — Chair declares subsidy envelope

**URL:** `/dashboard/holidaySubsidy/declaration/<cca-slug>?ccaId=<id>`
**As:** `U-CHAIR-SPORTS`
**Steps:**
1. Click "Declare" on a position + week.
2. Enter `hours = 4`, `justification = "End-of-semester training"`.
3. Submit.
**Expected:**
- Network: `POST /api/holidaySubsidy/declarations/<ccaId>` body `{ positionId, weekId, hours: 4, justification: "End-of-semester training" }` → 200 with envelope row.
- DB: row in `cca_subsidies` with `position_id, day=<derived from weekId>, hours=4, justification="End-of-semester training", status='pending'`.
- DOM: declaration appears in the list with status badge "Pending".
**Fail modes:**
- 400 "hours must be positive" → CHECK `hours > 0` on envelope. Test with non-zero values.
- "column justification does not exist" → migration §5 not deployed.
- "function upsert_subsidy(...) does not exist" → signature mismatch (probably missing the `p_justification TEXT` overload).

### T-SUB-02 — Chair edits a pending envelope (hours + justification mutable)

**As:** `U-CHAIR-SPORTS`
**Preconditions:** T-SUB-01 created a pending envelope.
**Steps:**
1. Edit the envelope's hours to 5 and justification to "Updated reason".
2. Save.
**Expected:**
- Network: `POST /api/holidaySubsidy/declarations/<ccaId>` (idempotent upsert) → 200.
- DB: same row's `hours=5, justification='Updated reason'`, `status` still `pending`, `updated_at` advanced.
**Fail modes:**
- "Subsidy already approved" error on a pending row → status filter inverted somewhere.

### T-SUB-03 — JCRC approves envelope

**URL:** `/dashboard/holidaySubsidy/approvals/<cca-slug>?ccaId=<id>`
**As:** `U-JCRC`
**Preconditions:** Pending envelope from T-SUB-01.
**Steps:**
1. Open the approval page; the envelope appears.
2. Click "Approve".
**Expected:**
- Network: `PATCH /api/holidaySubsidy/approvals/<ccaId>` body `{ updates: [{ subsidyId, status: "approved" }] }` → 200. (The route reads `body.updates`, NOT a bare array.)
- DB: envelope `status='approved'`, `decided_by=<jcrc user_id>`, `decided_at IS NOT NULL`.
- DOM: row badge changes to "Approved".
**Fail modes:**
- 403 "Only JCRC may approve a subsidy" when acting as JCRC → `internal.is_jcrc(<user_id>)` returning false; verify the JCRC user has an appointment under a CCA with `cca_type='jcrc'`.
- Generic 500 → trigger error not mapped; check `approvals/[ccaId]/route.ts` error-mapping table.

### T-SUB-04 — Chair declares per-user under approved envelope

**URL:** `/dashboard/holidaySubsidy/weekly/<cca-slug>?ccaId=<id>&week=<weekId>`
**As:** `U-CHAIR-SPORTS`
**Preconditions:** T-SUB-03 approved an envelope for this position+week.
**Steps:**
1. Open the weekly commitment page.
2. Toggle a member into the commitment list; set per-user `hours = 3.5` (override) and `comments = "Half-day"`.
3. Save.
**Expected:**
- Network: `POST /api/holidaySubsidy/weekly/<ccaId>/<weekId>` body includes `declarations: [{ user_id, position_id, hours: 3.5, comments: "Half-day" }, ...]` → 200.
- DB: row in `cca_user_subsidies` with `hours=3.5, comments='Half-day', status='pending', subsidy_id=<envelope-id>`.
- DOM: member row in the table with the override and comment visible.
**Fail modes:**
- 400 "Parent subsidy must be approved" → trigger fired because the envelope was NOT approved. Re-check T-SUB-03 succeeded.
- "function upsert_user_subsidy(...) does not exist" → signature changed; verify migration §3/§4 deployed.
- Per-user `hours` writes blocked → either the column missing (migration §3) or the route is using direct `.update()` instead of the RPC.

### T-SUB-05 — JCRC approves per-user claim

**URL:** `/dashboard/holidaySubsidy/approvals/weekly/<cca-slug>?ccaId=<id>&week=<weekId>`
**As:** `U-JCRC`
**Preconditions:** T-SUB-04 created a pending user subsidy.
**Steps:**
1. Open JCRC weekly approval page.
2. Approve the per-user row.
**Expected:**
- Network: `PATCH /api/holidaySubsidy/approvals/weekly/<ccaId>/<weekId>` body `{ updates: [{ userSubsidyId: <serial-id>, status: "approved" }] }` → 200. (Route reads `body.updates`, NOT a bare array.) Note: ID is now numeric `cca_user_subsidies.id`, NOT a composite key.
- DB: `cca_user_subsidies` row `status='approved', decided_by, decided_at` populated.
**Fail modes:**
- 400 "Invalid transition" → trying an illegal state transition (e.g. directly `approved → pending`).
- `userSubsidyId` is a string composite (e.g. `"3-12-2026-12-22"`) → request body shape wasn't migrated; the PATCH input changed in plan 05.

### T-SUB-06 — Hours frozen post-approval

**As:** `U-CHAIR-SPORTS`
**Preconditions:** T-SUB-05 approved a per-user row.
**Steps:**
1. Try to edit the per-user row's hours from 3.5 to 4 via the weekly commitment page.
2. Save.
**Expected:**
- Network: `POST /api/holidaySubsidy/weekly/...` → 409 (or 400, depending on route mapping) with error message containing "Cannot modify hours after approval".
- DB: row unchanged.
**Fail modes:**
- 200 with hours actually changing → trigger guard missing (verify migration §3).
- 500 → error message not pattern-matched; route's error handler needs the regex.

### T-SUB-07 — Cascade rejection (envelope → children)

**As:** `U-JCRC`
**Preconditions:** Envelope approved (T-SUB-03), per-user rows in pending state (multiple, before T-SUB-05).
**Steps:**
1. Open JCRC envelope approval; click "Reject" on the approved envelope.
**Expected:**
- Network: `PATCH /api/holidaySubsidy/approvals/<ccaId>` body `{ updates: [{ subsidyId, status: "rejected", rejectionReason: "<reason>" }] }` → 200.
- DB:
  - Envelope: `status='rejected', rejection_reason=<reason>`.
  - All children that were `approved` are now `rejected` with `rejection_reason='envelope rejected: <reason>'`.
**Fail modes:**
- Children's status unchanged → `cascade_cca_subsidy_rejection_after_update` trigger not firing. Verify trigger deployed.

---

## Section F — Cross-cutting integration

### T-INT-01 — Production build green

**Steps:**
1. `cd /Users/bytedance/intranet-next-app && npm run build`
**Expected:** Exit 0; no TypeScript errors; all routes built.

### T-INT-02 — Vitest suites pass (subset)

**Steps:**
1. `npx vitest run --environment=node src/features/cca/utils/cca-chair-access.test.ts`
2. `npx vitest run --environment=node src/features/ranking/utils/ranking-route.test.ts`
3. `npx vitest run --environment=node src/features/holiday-subsidy/`
**Expected:** All tests pass.
**Known issue:** `--environment=node` is required because the repo's `vitest.config.mts` points to `jsdom` which isn't installed. The DOM-using `src/features/ranking/hooks/use-recap-navigation.test.tsx` will still fail until `jsdom` is added — unrelated to this refactor.

### T-INT-03 — No stale schema references in shipped code

**Steps:**
1. `grep -rn "cca_member_rankings\|cca_allocation_events\|cca_capacity_info\|cca_user_ranking\|user_cca_applications" src/ --include="*.ts" --include="*.tsx" | grep -v "//" | grep -v "\* "`
**Expected:** Zero results (the only legitimate hits are inside `//` comments documenting the swap).

### T-INT-04 — Session isolation regression check

**As:** Open two browsers, sign in as `U-CHAIR-SPORTS` and `U-MEMBER` concurrently.
**Steps:**
1. In browser A, fetch `/api/user` as `U-CHAIR-SPORTS`.
2. In browser B, fetch `/api/user` as `U-MEMBER`.
**Expected:** Each response carries the correct user's data; no cross-bleed. This regression-tests the phase-1 SSR session-bleed fix on top of the refactor.
**Fail modes:** Any cross-user data → phase-1 cookie/SSR work broke.

---

## Section G — Smoke shorthand

A fast end-to-end smoke (≤ 5 minutes) hitting one assertion from each plan, suitable for post-deploy:

| Step | Action | Pass criterion |
|------|--------|----------------|
| 1 | `GET /api/user` as any user | 200 + populated `appointments` |
| 2 | `GET /api/cca/<id>/members` as chair | 200 + first row has `email` populated |
| 3 | `GET /api/cca/<id>/rankings` as chair | 200 + no `cca_member_rankings` error |
| 4 | `GET /api/chair/positions/forChair` as chair | 200 + no `cca_capacity_info` error |
| 5 | `POST /api/holidaySubsidy/declarations/<id>` with valid body | 200 + envelope row created with `justification` |
| 6 | `GET /api/sportsCulture/available` | 404 |

If any step fails, jump to the relevant section above for diagnostics.

---

## Puppeteer notes

- The codebase uses `data-testid` sparingly. Most selectors will need to be derived from button text, form labels, or `role` attributes. When writing Puppeteer scripts, prefer `page.getByRole("button", { name: "Save" })` (Playwright-style locators) over CSS selectors.
- Network interception: wrap each test's critical fetch in `page.waitForResponse(resp => resp.url().includes("/api/<route>") && resp.request().method() === "POST")`.
- For auth, the easiest path is to bypass OAuth by injecting a Supabase session cookie directly. Get a service-role-issued JWT for each test user once and reuse across runs.
- DB assertions: rather than re-implementing SQL checks in Puppeteer, dump expected state with a sidecar `psql -c "..."` call per test case. Keep DB and UI assertions in the same test file for traceability.
- Cleanup: between tests, either reset to a known seed (`pg_restore` from a fixture) or have each test undo its mutations via `psql`. Don't rely on UI deletion paths to clean up — they're part of what's being tested.

## Coverage matrix

| Plan | Tasks | Test cases covering them |
|------|-------|--------------------------|
| 01 (Auth & User) | 1, 2, 3, 4, 5, 6, 7 | T-AUTH-01, T-AUTH-02, T-AUTH-03 |
| 02 (CCA Model) | 1, 2, 3, 4, 5, 6, 7 (widening), 8, 9, 10, 11 | T-CCA-01, T-CCA-02 (Task 7 widening), T-CCA-03, T-CCA-04, T-CCA-05 |
| 03 (Member Ranking) | 1, 2, 3, 4, 5, 6, 7, 8 | T-RANK-01, T-RANK-02, T-RANK-03 |
| 04 (CCA Allocation) | A, B, C, D, G, H, J, K (sportsCulture removal) | T-ALLOC-01, T-ALLOC-02, T-ALLOC-03, T-ALLOC-04, T-ALLOC-05 |
| 05 (Holiday Subsidy) | 5.1–5.10 | T-SUB-01 through T-SUB-07 |
| Cross-cutting | build, lint, session | T-INT-01 through T-INT-04 |

Any test case marked here that fails in CI is a clear regression of the cited plan/task.
