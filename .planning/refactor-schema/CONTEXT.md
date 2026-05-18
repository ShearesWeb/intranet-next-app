# Schema Refactor — Shared Context

The intranet DB schema has been overhauled. Every API route in `src/app/api/` must be reviewed against the new schema documented in `intranet-wiki` (at `/Users/bytedance/intranet-wiki`).

## Sources of truth

- **Wiki root:** `/Users/bytedance/intranet-wiki/wiki/`
- **Wiki index:** `wiki/index.md`
- **Domain pages:** `wiki/domain/{auth-and-roles,cca-allocation,cca-model,holiday-subsidy,member-ranking,points-system}.md`
- **Entity pages:** `wiki/entity/{enum,table,view,materialized_view,function,trigger}/*.md`
- **Conventions:** `wiki/convention/{naming,rbac,rls,view-as-contract}.md`
- **Cross-repo contract:** `wiki/entity/view/public.authenticated_user_info.md` — already mapped to `src/lib/fetch-user-info.ts` and `src/types/User.ts`. Treat this view as load-bearing.

Most non-contract pages are at `status: seed`. The source of authority is the SQL changelogs they point to under `../intranet/db/changelogs/` (paths in the page frontmatter — also at `/Users/bytedance/intranet-next-app/../intranet/`).

## New schema landscape

**Tables** (`wiki/entity/table/`):
- `users`, `ccas`, `feature_flags`
- `cca_positions`, `cca_appointments`, `cca_appointment_evaluations` (NEW — likely replaces legacy `cca_member_rankings`)
- `cca_user_preferences`, `cca_position_preferences` (allocation inputs)
- `cca_subsidies`, `cca_user_subsidies` (subsidy lifecycle)

**Views** (`wiki/entity/view/`):
- `authenticated_user_info` (contract, developing), `authenticated_user_appointments`, `authenticated_user_roles`, `authenticated_user_directory`, `public_user_info`
- `cca_position_availability` (NEW — likely replaces `cca_capacity_info`)
- `cca_preference_pairs`, `managed_cca_positions`

**Functions** (`wiki/entity/function/`):
- `public.upsert_*` family — `upsert_cca_position_preference`, `upsert_cca_user_preference`, `upsert_subsidy`, `upsert_user_subsidy`
- `public.approve_subsidy`, `public.approve_user_subsidy`
- `internal.can_manage_cca_appointments`, `internal.is_jcrc`, `internal.auth_user_id`
- `internal.upsert_*`, `internal.validate_*`, `internal.cascade_cca_subsidy_rejection`

**Enums**: `cca_type`, `cca_tier_type`, `position_type`, `commitment_period`, `stay_period`, `cut_status`, `subsidy_status`

## Known mismatches (high-level scan)

Current code references that look stale against the new schema:
- `cca_capacity_info` (chair/forChair) — likely `cca_position_availability` now
- `cca_user_ranking` (chair/forChair) — likely `cca_position_preferences` or `cca_preference_pairs` now
- `cca_member_rankings` (cca/[ccaId]/rankings) — likely `cca_appointment_evaluations` now
- `public_user_info` lookups — view exists but is `seed` in wiki; verify shape

## Plans index

Each domain is owned by one plan in this directory. Subagents write to these paths:

- `01-PLAN-auth-and-user.md` — Auth & user routes
- `02-PLAN-cca-model-and-management.md` — CCA/membership routes
- `03-PLAN-member-ranking.md` — Ranking routes + `cca_appointment_evaluations` migration
- `04-PLAN-cca-allocation.md` — Chair applicant routes + sportsCulture routes + preferences
- `05-PLAN-holiday-subsidy.md` — Holiday subsidy routes + new subsidy model
