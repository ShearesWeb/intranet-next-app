# Handover — Unfinished Business

_Generated 2026-05-30 for an upcoming cleanup/ultracode session. Audited via parallel exploration of tests, deployment/infra, features, and code/git hygiene. Facts marked ✅ were verified by running the command; items marked ⚠️ need confirmation during the session._

---

## TL;DR — the honest reality

The repo **looks** scarier than it is. The actual state:

- ✅ **`npm test` passes: 139 unit/component tests green (~2.7s).** Integration smoke tests (16) pass against a local Supabase.
- ✅ **`npm run typecheck` passes clean (exit 0).** No type errors.
- The "tests are everywhere" feeling is real but it's an **organization** problem, not a broken-tests problem — see [§1](#1-tests-the-main-complaint).
- The **biggest genuine risk** is deployment: the Cloudflare migration is wired and build-verified but **never deployed**, and the **release CI/CD workflows were deleted and not replaced** — the deploy pipeline is currently broken. See [§2](#2-deployment--infra-biggest-risk).
- The auth "session-bleed" bug (the whole reason this refactor exists) **looks fixed in code** but has **not been verified on the new Cloudflare runtime**. See [§3](#3-auth-session-bleed-verify-dont-assume).

### What's actually FINE — don't waste the session re-doing these
- Auth/session code: middleware cookie eviction + overflow self-healing + signout hardening are implemented with unit + e2e coverage.
- Facilities feature: complete, flag-enabled, wired into nav; prototype files already removed.
- Feature flags: all four domains on, no half-gated features.
- Toast libraries: already consolidated on `sonner` (CLAUDE.md's "react-hot-toast vs sonner" note is **stale** — `react-hot-toast` is not even in `package.json`).
- Repo bloat: **none.** The 177MB Terraform provider binary in `infra/.terraform/` is correctly gitignored; `.git` is ~25MB. No build artifacts tracked.

---

## Priority order for the session

1. **Fix the broken deploy pipeline** (release workflows + secrets) — [§2](#2-deployment--infra-biggest-risk)
2. **Deploy to preprod & verify auth/session isolation on Cloudflare** — [§2](#2-deployment--infra-biggest-risk), [§3](#3-auth-session-bleed-verify-dont-assume)
3. **Consolidate tests + get integration/e2e into CI** — [§1](#1-tests-the-main-complaint)
4. **Git hygiene** (junk commits, stale branches, `log/` gitignore) — [§4](#4-git-hygiene)
5. **Code health** (oversized services, prettier, eslint version, stale CLAUDE.md) — [§5](#5-code-health--docs)

---

## 1. Tests (the main complaint)

The harness is more mature than CLAUDE.md admits (which still says "No test framework configured" — **stale**). The problem is that tests live in **four+ different shapes/locations** and two of the four layers never run in CI.

### Reality map

| Layer | Location | Runner | Status | In CI? |
|---|---|---|---|---|
| Unit (node) | `src/**/*.test.ts` colocated | `npm test` (vitest) | ✅ pass | ✅ yes |
| Component (happy-dom) | `src/**/*.test.tsx` colocated + some `__tests__/` | `npm test` (vitest) | ✅ pass (minor `act()` warnings) | ✅ yes |
| API-route unit | `src/app/**/*.test.ts` colocated | `npm test` (vitest) | ✅ pass | ✅ yes |
| Integration (live DB) | `tests/integration/**` | `npm run test:integration` | ✅ pass locally (needs local Supabase via `npm run db:test:setup`) | ❌ no |
| E2E (Playwright + personas) | `e2e/specs/**` | `npm run e2e` | ⚠️ runnable locally, needs live Supabase + dev server | ❌ no |

Placement is inconsistent: colocated `*.test.*` in some places, `__tests__/` dirs in others (`src/lib/__tests__`, `src/lib/auth/__tests__`, `src/lib/supabase/__tests__`, `src/app/auth/__tests__`). Both are valid; pick one and document it.

Supporting infra that exists: `e2e/cli.ts` (persona test/login/list runner), `e2e/auth-harness.ts`, `e2e/fixtures.ts`, `scripts/setup-test-db.sh`, `tests/fixtures/` (9 personas + seed.sql + `generate.ts`), `src/test-utils/`.

### TODO
- [ ] **Decide & document ONE test-placement convention** (recommend: colocate unit/component; reserve `__tests__/` only where a dir has many tests). Apply consistently across `src/`.
- [ ] **Get integration + e2e into CI.** They're orphaned today — they can rot silently. Add a workflow that boots Supabase (CLI/container) + runs `npm run test:integration`; gate e2e behind a manual/nightly job if full Supabase-in-CI is too heavy. ⚠️ Confirm whether CI can provision Supabase.
- [ ] **Update CLAUDE.md testing section** — it claims no test framework; document the 4 layers + how to run each + the persona system. Consider a `TESTING.md`.
- [ ] **Resolve `feat/testing-harness` branch.** It's diverged from main (large delta). Determine if anything in it is unmerged-and-wanted, otherwise delete it. ⚠️ Verify before deleting.
- [ ] **Kill deprecation/warning noise:** remove `vite-tsconfig-paths` plugin (Vite resolves paths natively now) from `vitest.config.mts`; migrate `poolOptions` → top-level `pool` in `vitest.integration.config.mts` (Vitest 4); fix `act()` warnings in `src/hooks/use-ranking-editor.test.tsx` and `src/lib/auth/__tests__/auth-context.test.tsx`.
- [ ] **Move vitest globals out of prod typescope:** `src/vitest.d.ts` leaks test globals into the main tsconfig. Split into a `tsconfig.test.json` (there's already a TODO comment in the file).
- [ ] **Populate `src/test-utils/factories.ts`** (currently an empty placeholder) and add API-route integration tests — only 1 integration test file exists (`derived-flags.test.ts`).

---

## 2. Deployment & Infra (biggest risk)

Migration SST/AWS → Cloudflare Workers (OpenNext) is **code-complete and build-verified but NOT deployed.** Production still runs on the old AWS/SST stack.

What's done: `wrangler.jsonc` (prod + preprod, R2 bindings, `global_fetch_strictly_public` flag present — needed for Supabase SSR), `open-next.config.ts` (R2 incremental cache), full Terraform stack in `infra/` (R2 cache bucket + worker custom-domain, remote state in R2, parameterized prd/preprod), deploy scripts (`deploy`, `deploy:preprod`, `preview`, `cf-typegen`), `docs/cloudflare-migration.md` (thorough runbook).

### ⚠️ Blocking problems
- [ ] **Release workflows were DELETED, not replaced.** The old tag-based promotion flow (`v1.2.3-rc` → preprod → auto-promote → prod) is gone. There are **no Cloudflare deploy workflows**. The pipeline is broken — any release tag does nothing. Recreate `.github/workflows/3-preprod-release.yml` + `4-prd-release.yml` using `npm run deploy:preprod` / `npm run deploy` instead of SST. (CLAUDE.md constraint: "deployment pipeline must remain functional" — currently violated.)
- [ ] **GitHub Actions secrets not set:** need `CLOUDFLARE_API_TOKEN` (Workers Scripts:Edit, R2:Edit, Zone:Read, DNS:Edit) + `CLOUDFLARE_ACCOUNT_ID`. Remove old `AWS_*` secrets.
- [ ] **Terraform never applied** (no state yet). Run `terraform init`/`apply` for preprod then prod (env vars in `infra/README.md`). Custom domains intentionally start `enable_custom_domains = false` — flip to `true` only after workers deploy.
- [ ] **Workers never deployed & DNS not cut over.** `intranet.shweb.org` / `intranet-beta.shweb.org` still point at AWS.

### Deploy sequence (from `docs/cloudflare-migration.md`)
- [ ] `npm run preview` (local OpenNext/wrangler smoke) → `npm run cf-typegen`
- [ ] `terraform apply` preprod (R2 bucket) → `npm run deploy:preprod` → verify on `*.workers.dev`
- [ ] Verify checklist on preprod: OAuth round-trip, session persistence, **no session bleed across accounts**, API→Supabase, `next/image`, the kebab-case redirects, `wrangler tail` for errors
- [ ] Repeat for prod → flip `enable_custom_domains = true` → re-apply Terraform to attach domains → DNS cutover
- [ ] **Only after** ~1 week stable: decommission AWS (`sst remove`), remove AWS secrets. Note `sst.config.ts` is already gone from HEAD.

### Smaller infra cleanups
- [ ] `next.config.mjs` still whitelists the old AWS image host `deifkwefumgah.cloudfront.net`. Confirm images still served from there or migrate to R2/CF Images, then update `remotePatterns`.
- [ ] `eslint.ignoreDuringBuilds` was removed from `next.config.mjs`, so **ESLint now blocks `next build`** — make sure lint is clean before the first CF deploy (see [§5](#5-code-health--docs)).

---

## 3. Auth session-bleed (verify, don't assume)

This is the core value of the whole project ("no user data leaks between sessions"). The code **looks fixed**:
- `src/lib/supabase/middleware.ts` evicts foreign-projref cookies every request, refreshes current-projref cookies with proper Set-Cookie writeback, and self-heals cookie overflow (>12KB → clear + redirect to login with `reason=cookie_overflow`).
- `src/app/api/auth/signout/route.ts` revokes the refresh token server-side and expires httpOnly cookies (browser SDK can't).
- `src/lib/auth/auth-context.tsx` validates session email == fetched user email; `/api/user` is `cache: "no-store"`.
- Coverage: `src/lib/supabase/cookie-eviction.test.ts`, `e2e/specs/auth.spec.ts`.

### TODO
- [ ] **Verify session isolation on the actual Cloudflare Worker runtime**, not just locally — this is the one place the old bug lived and the runtime is changing. Two accounts, back-to-back, confirm no bleed. Do this on preprod before cutover.
- [ ] Reconcile/delete the `cookie-overflow-fix` and `cookie-rebase` branches — the fix appears already merged to main; confirm and prune. ⚠️ Verify merged before deleting.

---

## 4. Git hygiene

- [ ] **Junk commits on `main`:** `7da73ed` ("sex") and `003b783` ("Sex with gab", 76 files / 8.5k insertions of real work behind a garbage message). ⚠️ **Both are already on `origin/main`** (only `f70c3e8` is unpushed), so removing them means **rewriting shared history + force-push** on a multi-contributor repo (ShearesWeb org). Judgment call: either (a) leave them as historical and move on, or (b) coordinate a history rewrite with the team. Don't force-push shared main unilaterally.
- [ ] **`log/` is untracked and NOT gitignored** (`log/app.log`, empty). Add `log/` and `*.log` to `.gitignore`, or delete the dir. (`.terraform/`, `.open-next`, `.wrangler/` are already ignored ✅.)
- [ ] **Prune merged/stale branches.** `feat/cloudflare-infra` is ✅ merged into main → delete. Stale remote branches (5–11 months old) safe to delete after handoff: `origin/feat/peien-jcrc-viewCCARanking-page`, `origin/feat/juntong-jcrcAdminViewCCA`, `origin/feat/juntong-manageMembersTailwind`, `origin/feat/keeret-homepageupdate`, `origin/feature/feature-flag-phases`, `origin/feature/cca-ranking`, `origin/cleanup/remove-node-modules-and-restructure`. Verify the rest (`feat/cca-admin-page`, `feat/remove-add-member`, `feat/cca-ranking`, cookie-*) are merged before pruning.
- [ ] **No pre-commit enforcement.** Add husky + lint-staged (prettier + eslint on staged files) so style/lint drift can't land again.

---

## 5. Code health & docs

- [ ] **Formatting drift:** ~41 files use space indentation despite `.prettierrc` `useTabs: true`. Run `npx prettier --write "src/**/*.{ts,tsx}"` once, commit, then rely on the pre-commit hook above.
- [ ] **ESLint version mismatch:** `eslint-config-next@14.2.13` while Next is `^15`. Bump to `^15.x` and re-verify build (since lint now gates builds).
- [ ] **Oversized files to decompose** (business logic first; visual/diagram components are legitimately large and lower priority):
  - `src/lib/holiday-subsidy/weekly-service.ts` (504), `src/lib/holiday-subsidy/approval-service.ts` (482)
  - `src/lib/cca/member-service.ts` (420), `src/lib/cca/position-service.ts` (383)
  - `src/hooks/use-cca-members.ts` (434)
  - Lower priority (visual): `*-flow-visual.tsx` / `gale-shapley-visual.tsx` (580–667), `src/components/ui/sidebar.tsx` (694, vendored-ish)
- [ ] **CLAUDE.md is stale in several places** — fix while here: "No test framework configured" (false), `eslint.ignoreDuringBuilds: true` (removed), "SST/OpenNext on AWS" deployment (now Cloudflare), "react-hot-toast" (gone). The `.planning/` dir it references was intentionally deleted in `7da73ed` (recoverable from git history if an audit trail is needed).
- [ ] **Verify facilities admin override is fully wired** — `src/app/dashboard/facilities/admin/page.tsx:59` has an unused-param suppression that may indicate a stubbed override endpoint. Confirm `POST /api/facilities/admin/override` works end-to-end. The remaining `eslint-disable`s (Supabase `any` row types, vitest `no-var`) are justified.

---

## Suggested ultracode batching (parallelizable)

These groups are mostly independent and can run as parallel agents:

- **Batch A — Deploy pipeline:** recreate CF release workflows, wire secrets, document deploy. (Then human runs the actual deploy + DNS cutover; agents can't hold Cloudflare creds.)
- **Batch B — Test consolidation:** normalize placement, fix deprecations/`act()` warnings, split test tsconfig, add integration tests + CI job.
- **Batch C — Repo hygiene:** `log/` gitignore, prettier --write, husky/lint-staged, eslint bump, branch-prune script.
- **Batch D — Docs:** rewrite stale CLAUDE.md sections, add TESTING.md.
- **Batch E — Refactor (slower, do last):** decompose the 4 oversized service/hook files with tests as the safety net.

Leave for a human (not an agent): the shared-history force-push decision (§4), the actual Cloudflare deploy + DNS cutover (§2), and the cross-account session-bleed verification on preprod (§3).
