# Testing Harness — Design

**Status:** Draft for review
**Author:** brainstormed with Daniel, 2026-05-18
**Target repo:** `intranet-next-app`
**Sibling repo:** `intranet` (canonical DB schema + CSV pipeline)

---

## 1. Context

`intranet-next-app` is a Next.js 15 + Supabase app for managing CCAs at Sheares Hall (NUS). It has working features but no enforced test harness — Vitest is installed and ~21 ad-hoc tests exist, but CI runs only `next build`. Two bug classes have hurt in the past:

- **Vertical auth failure (SSR session bleed):** wrong user entirely sees another user's SSR-rendered page.
- **Horizontal auth failure (broken access control):** correct user sees data their role/relationship-to-the-CCA does not permit.

Treat the harness as greenfield. Goal: a CI-enforced testing system that catches both bug classes before merge, scales to the rest of the codebase, and stays maintainable.

## 2. Goals

1. Catch SSR session-bleed regressions with an explicit canary test.
2. Catch horizontal-authorization regressions through an exhaustive, data-driven matrix that fails CI if any new route lacks declared access rules.
3. Provide fast feedback for pure logic (unit, component) and high-fidelity coverage for behavior that depends on Postgres + RLS (integration, E2E).
4. Use the canonical schema from `../intranet/db/changelogs/` rather than duplicating it.
5. Make test data human-readable so a reviewer can follow `expected darren to get 200` without spelunking.

## 3. Non-goals (v1 YAGNI)

- Per-PR preview environments (Vercel + Supabase branching). Stays as a phase-2 upgrade.
- Mutation testing.
- Cross-browser matrix on every PR (Chromium-only; opt-in pre-release for Firefox/WebKit).
- Coverage thresholds as hard gates (report, don't enforce, until the suite stabilizes).
- Storybook, visual regression, load testing, contract testing, fuzz testing.
- Adhoc / supplementary CCA-type personas (no distinct authorization behavior per Daniel).
- Real OAuth flow in E2E (bypassed via admin session minting; OAuth callback covered at unit level).

## 4. Stack

| Layer | Tool | Notes |
|---|---|---|
| Test runner | Vitest 4 (already installed) | Native TS, Jest API |
| DOM env | happy-dom | Replaces jsdom; ~2× faster, drop-in for RTL |
| Component | `@testing-library/react`, `user-event`, `jest-dom` | |
| Integration | Local Supabase via `supabase` CLI | Schema applied from `../intranet/db/liquibase` |
| RLS | direct `pg` client with set-claims | Bypasses route layer to test policies directly |
| E2E | Playwright | Chromium-only in CI; storage-state auth |
| Coverage | `@vitest/coverage-v8` | Reported, not enforced |

Explicitly rejected: Jest, Cypress, MSW, mocking the Supabase client chain.

## 5. Test data — single source of truth

Test data must read like a description of real Sheares Hall residents. Generated artifacts are derived from a typed source so SQL and human docs cannot drift.

### 5.1 File layout

```
tests/fixtures/
  personas.ts        # SOURCE OF TRUTH — typed exports of Persona, Cca, Position, Appointment
  ccas.ts            # SOURCE OF TRUTH — typed exports of CCAs
  generate.ts        # ts-node: renders seed.sql + PERSONAS.md from the above
  seed.sql           # GENERATED — applied to test DB after Liquibase
  PERSONAS.md        # GENERATED — narrative doc humans read
```

`generate.ts` runs in CI as a guard: if `seed.sql` / `PERSONAS.md` are out of sync with the TS sources, CI fails. Developers run `npm run fixtures:generate` after editing personas.

### 5.2 The 14 personas (+ anonymous)

Gmail emails (matching real auth — students sign in with personal Google accounts). NUS matric format. Sheares Hall blocks A-E. Names skew modern; 9 of 14 are female.

**Important: flags (`is_admin`, `is_jcrc`, `is_culture_sports_admin`) are NOT input.** They are derived in the `authenticated_user_info` view from the appointment/position graph:

- `is_jcrc` = has any appointment in a CCA where `cca_type = 'jcrc'`.
- `is_admin` = has any appointment whose position has at least one child position reporting to it (i.e., sits above someone in the reporting tree).
- `is_culture_sports_admin` = same as `is_admin`, restricted to appointments in `cca_type IN ('culture', 'sports')`.

Personas declare appointments; the harness asserts on derived flag values as part of the authorization matrix. The exact `is_admin` / `is_culture_sports_admin` value for non-`lead` positions (`vice`, `maincomm`, `team manager`) depends on the position-reporting graph, which `tests/fixtures/personas.ts` codifies based on `../intranet/data/cca-position/`.

| Key | Email | Name | Profile | Appointments | Expected derived flags |
|---|---|---|---|---|---|
| `anonymous` | — | — | not logged in | — | none — unauthenticated |
| `aria` | `aria.tan.sg@gmail.com` | Aria Tan | Y1 SoC, Block A #A203 | `resident` | all false |
| `mason` | `mason.lim.99@gmail.com` | Mason Lim | Y2 Eng, Block B #B315 | `member` Volleyball | all false |
| `chloe` | `chloe.ng.j@gmail.com` | Chloe Ng | Y3 Eng, Block C #C108 | `team manager` Volleyball | all false (TMS has no children) |
| `declan` | `declanho.sg@gmail.com` | Declan Ho | Y4 SoC, Block A #A412 | `lead` Volleyball | `is_admin`, `is_culture_sports_admin` |
| `alexis` | `alexis.goh.99@gmail.com` | Alexis Goh | Y3 FoS, Block D #D202 | `vice` Volleyball | depends on whether vice has reporting children — codified in personas.ts |
| `sienna` | `sienna.lee.j@gmail.com` | Sienna Lee | Y2 FASS, Block B #B210 | `member` Choir | all false |
| `kai` | `kai.koh.96@gmail.com` | Kai Koh | Y4 SoC, Block C #C401 | `lead` Choir | `is_admin`, `is_culture_sports_admin` |
| `harper` | `harper.tan.2k@gmail.com` | Harper Tan | Y3 BBA, Block E #E115 | `subcomm` SHWEB | all false |
| `ezra` | `ezrasim.nus@gmail.com` | Ezra Sim | Y3 SoC, Block A #A301 | `maincomm` SHWEB | likely `is_admin` (subcomm reports to maincomm); NOT `is_culture_sports_admin` (committee) |
| `layla` | `layla.ng.97@gmail.com` | Layla Ng | Y4 SDE, Block D #D405 | `lead` SHWEB | `is_admin` only — **the "admin without culture/sports" case** |
| `jasper` | `jasper.chua.sg@gmail.com` | Jasper Chua | Y3 FoS, Block B #B406 | `blockcomm` JCRC | `is_jcrc` (auto from any JCRC appointment); maybe `is_admin` |
| `brielle` | `brielle.koh.j@gmail.com` | Brielle Koh | Y4 FASS, Block C #C312 | `maincomm` JCRC | `is_jcrc` + likely `is_admin` |
| `nova` | `nova.tay.sg@gmail.com` | Nova Tay | Y3 SoC, Block A #A105 | `lead` Basketball + `subcomm` SECC | `is_admin`, `is_culture_sports_admin` — **the cross-CCA composition case** |
| `willow` | `willow.rahman.gg@gmail.com` | Willow Rahman | Y4 SDE, Block D #D108 | `lead` Dance | `is_admin`, `is_culture_sports_admin` — culture-side counterpart to Declan |

**Removed from prior draft:** Theo (flag-only `is_admin` with no appointments — impossible under the schema since the flag derives from holding a chair position somewhere).

All personas default to `stay_period = 'full-year'` unless explicitly varied for a test scenario.

### 5.2.1 Flag-combination coverage

| Combination | Persona(s) |
|---|---|
| no flags | aria, mason, chloe, sienna, harper |
| `is_admin` only (committee chair) | layla, ezra (likely) |
| `is_admin` + `is_culture_sports_admin` | declan, kai, nova, willow |
| `is_jcrc` only (no chair role) | jasper (if blockcomm has no children) |
| `is_jcrc` + `is_admin` | brielle (likely), jasper (if blockcomm has children) |
| `is_jcrc` + `is_admin` + `is_culture_sports_admin` | **not currently covered** — see open question 5 below |

### 5.3 The 7 CCAs

| CCA | `cca_type` | `cca_tier_type` | Why |
|---|---|---|---|
| Volleyball | sports | tier 1 | Primary sports CCA; full position roster (lead, vice, TMS, members) |
| Basketball | sports | tier 1 | Sports foil — Nova is lead here, Declan must not have access |
| Choir | culture | tier 1 | Primary culture CCA |
| Dance | culture | tier 2 | Culture foil + exercises `tier 2` differences |
| SHWEB | committee | none | Primary committee with lead/maincomm/subcomm rooster |
| SECC | committee | none | Committee foil for cross-committee scoping |
| JCRC | jcrc | none | Hall executive committee (no `lead` position — top is `maincomm`) |

### 5.4 What this set lets the matrix test

- Every `position_type` (`lead`, `vice`, `blockcomm`, `maincomm`, `subcomm`, `team manager`, `member`, `resident`) appears on at least one persona.
- Every `cca_type` except `adhoc` / `supplementary` has at least two CCAs to test cross-CCA scoping within a type.
- Cross-`cca_type` scoping: Declan (sports lead) ≠ chair powers in culture; Kai (culture lead) ≠ chair powers in sports.
- Position hierarchy: Harper (`subcomm`) < Ezra (`maincomm`) < Layla (`lead`) within SHWEB.
- JCRC flag derivation: Jasper (`blockcomm` JCRC) and Brielle (`maincomm` JCRC) both auto-derive `is_jcrc = true`. Tests confirm the view computes the flag from CCA type alone.
- Cross-CCA composition: Nova is `lead` Basketball + `subcomm` SECC — the historic bug class where chair-in-one ≠ chair-in-another.
- `is_admin` without `is_culture_sports_admin`: Layla (`lead` SHWEB) holds a committee chair, so she derives `is_admin = true` but not `is_culture_sports_admin`. Tests confirm the latter is correctly scoped to `cca_type IN ('culture', 'sports')`.

## 6. Repository layout

```
src/
  features/<domain>/utils/foo.ts
  features/<domain>/utils/foo.test.ts           # unit, co-located
  components/.../bar.tsx
  components/.../bar.test.tsx                   # component, co-located
  test-utils/
    render.tsx                                  # renderWithProviders (Auth, theme, router)
    api-request.ts                              # createApiRequest({ persona, body, params })
    pg-client.ts                                # pgClientAsPersona(key) — raw client with set-claims
    factories.ts                                # ad-hoc data factories beyond the seed
tests/
  fixtures/
    personas.ts / ccas.ts / generate.ts / seed.sql / PERSONAS.md
  integration/
    setup.ts                                    # admin client, withRollback, resetDb
    authorization/
      matrix.ts                                 # AUTH_MATRIX source of truth
      matrix.test.ts                            # parameterized walker, runs the matrix
      matrix-completeness.test.ts               # globs routes, fails if any missing
    rls/
      cca-user-preferences.rls.test.ts
      cca-subsidies.rls.test.ts
      cca-appointment.rls.test.ts
      ...                                       # one per file in ../intranet security/
    cca-rankings.test.ts                        # behavioral integration tests
    holiday-subsidy.test.ts
    ...
  e2e/
    fixtures.ts                                 # storage-state per persona
    auth-session-isolation.spec.ts              # SSR session-bleed canary
    authorization-ui.spec.ts                    # UI affordance checks
    dashboard-smoke.spec.ts
    cca-ranking-flow.spec.ts
    chair-rank-applicants.spec.ts
    chair-member-management.spec.ts
    holiday-subsidy-declaration.spec.ts
    feature-flag-disabled.spec.ts
scripts/
  setup-test-db.sh                              # boot Supabase, apply ../intranet schema, seed
vitest.config.mts                               # default (unit + component), happy-dom by file pattern
vitest.integration.config.mts                   # node env, longer timeouts, sequential per file
playwright.config.ts
```

## 7. Layer-by-layer specification

### 7.1 Static checks (CI gate, <1 min)

- `next lint` (existing)
- `prettier --check "src/**/*.{ts,tsx,js,jsx,json,css,md}"` (existing script)
- `tsc --noEmit` — new; enforces type safety since `next build` ignores TS errors with the current config
- `npm run fixtures:check` — runs `generate.ts` and fails if `seed.sql` / `PERSONAS.md` are stale relative to `personas.ts`

### 7.2 Unit (CI gate, <1 min)

- Vitest with `environment: 'node'` by default.
- Files: `src/features/*/utils/*.test.ts`, `src/lib/**/*.test.ts`, `src/utils/**/*.test.ts`.
- No DB, no DOM, no network. Mock only at module boundaries (e.g., `vi.mock` for `@/utils/supabase/server` if the unit imports it indirectly).
- Includes exhaustive enumeration of access-control helpers (`cca-chair-access.ts`, `cca-management-access.ts`) across every persona shape.
- Includes the unit test for the OAuth callback route (already exists; covers the path E2E bypasses).

### 7.3 Component (CI gate, <1 min)

- Vitest with `environment: 'happy-dom'` for `**/*.test.tsx`.
- `renderWithProviders` wraps components in `AuthProvider` (mock user), theme provider, and a mock router.
- `fetch` stubbed globally; tests assert on the URL/body the component called, not server responses.
- Targets components with logic (forms, ranking editor, member management dialog). Pure visual components are not tested at this layer.

### 7.4 Integration (CI gate, 3-6 min)

#### 7.4.1 Setup

- `scripts/setup-test-db.sh`:
  1. `supabase start` (uses `supabase/config.toml` to be added)
  2. Resolve `../intranet` (env var `INTRANET_REPO_PATH` overrides default of `../intranet`; CI clones it)
  3. Run Liquibase update against the local Supabase DB
  4. Run `npm run fixtures:generate` if `seed.sql` is missing
  5. `psql -f tests/fixtures/seed.sql`
- `vitest.integration.config.mts` uses `environment: 'node'`, `testTimeout: 30s`, `pool: 'forks'` for file-level parallelism.

#### 7.4.2 Isolation

- `withRollback(async (ctx) => { ... })` opens a transaction and rolls back at end. Tests calling RPCs that manage their own transactions opt out via `withReset(['table_a', 'table_b'], async () => { ... })` which truncates the named tables in a `beforeEach`.

#### 7.4.3 Calling route handlers

- `createApiRequest({ persona, method, body, params })` returns a `NextRequest`:
  - Looks up the persona's pre-minted session from a cache (built once at `setup.ts`).
  - Attaches Supabase auth cookies (`sb-<project>-auth-token`).
  - Builds the URL from a templated route + `params`.
- Test imports the route handler directly: `import { POST } from "@/app/api/user/saveRankings/route"`.
- Asserts on response status, body shape, and post-call DB state.

#### 7.4.4 The authorization matrix

- `tests/integration/authorization/matrix.ts` exports `AUTH_MATRIX: RouteAuthSpec[]`.
- `RouteAuthSpec`:
  ```ts
  type RouteAuthSpec = {
    route: string;                       // "GET /api/cca/[ccaId]/members"
    handler: () => Promise<RouteModule>; // dynamic import
    targets: TargetParams[];             // e.g. [{ ccaId: "volleyball" }, { ccaId: "basketball" }]
    expectations: Record<PersonaKey | "default", Expectation>;
  };
  type Expectation = {
    status: number;
    fieldsInclude?: string[];      // response body must contain these
    fieldsExclude?: string[];      // response body must NOT contain these
    bodyMatches?: (body: any, persona: PersonaKey) => void; // escape hatch
  };
  ```
- `matrix.test.ts` is a parameterized test that walks `AUTH_MATRIX × personas × targets` and asserts every cell.
- `matrix-completeness.test.ts` globs `src/app/api/**/route.ts`, derives the canonical route string for each exported HTTP method, and fails if any are missing from `AUTH_MATRIX`. **This is the discipline that prevents drift.**

#### 7.4.5 Behavioral integration tests

For each domain (rankings, holiday subsidy, CCA member management, etc.), a `<domain>.test.ts` file with scenario-style tests that exercise multi-step flows the matrix can't express:
- "Declan submits rankings; Alexis sees the updated rankings; the DB reflects them"
- "Brielle approves a subsidy; the status transitions; the member sees the approval"

These complement (don't replace) the matrix.

### 7.5 RLS policy tests (CI gate, part of integration job)

- `tests/integration/rls/<topic>.rls.test.ts` — one file per file in `../intranet/db/changelogs/security/`.
- Uses `pgClientAsPersona(key)` which opens a raw `pg.Client`, sets `request.jwt.claims` and `role`, and returns the client.
- Asserts on raw SQL results, bypassing the API route layer entirely.
- Catches policy weakening (e.g., `using (true)` slipped in during a migration), which the app-route layer could mask if the app code happens to filter correctly.

### 7.6 E2E (CI gate, 5-8 min wall-clock, 2 shards)

#### 7.6.1 Setup

- `playwright.config.ts` with:
  - `globalSetup`: runs `scripts/setup-test-db.sh`, starts `next start` (after `next build`), waits for `http://localhost:3000`, mints sessions via admin API for each persona and saves storage state to `.auth/<persona>.json`.
  - `globalTeardown`: kills Next.js, runs `supabase stop`.
  - `webServer` NOT used — we want full control over the production-mode server.
  - `projects: [{ name: "chromium" }]` only.
  - `workers: 4` in CI, `2` locally.
  - `trace: 'on-first-retry'`, `screenshot: 'only-on-failure'`, `video: 'retain-on-failure'`.
  - Sharding via `--shard=${{ matrix.shard }}/2`.

#### 7.6.2 Authentication bypass

- Real Google OAuth is **not** exercised. Sessions are minted via Supabase admin API in `globalSetup` and persisted as storage state. Tests declare `test.use({ storageState: ".auth/declan.json" })`.
- The OAuth callback (`src/app/auth/callback/route.ts`) is covered by a unit test instead. This trade-off is intentional and documented.

#### 7.6.3 The specs (8 total)

| Spec | Purpose |
|---|---|
| `auth-session-isolation.spec.ts` | Two parallel browser contexts, two personas, concurrent SSR loads, assert no cross-leak. **The canary for the SSR session-bleed bug class.** |
| `authorization-ui.spec.ts` | UI affordance checks: e.g. Mason has no "Add Member" button on Volleyball page; Aria can't navigate to `/dashboard/holidaySubsidy/approvals`. ~10 assertions. |
| `dashboard-smoke.spec.ts` | Load every dashboard page as each persona; assert no console errors, no 500s. |
| `cca-ranking-flow.spec.ts` | User submits CCA preference rankings → reload → rankings persisted. |
| `chair-rank-applicants.spec.ts` | Chair ranks applicants → save → reload → persisted. |
| `chair-member-management.spec.ts` | Chair adds member → removes member → CCA appears/disappears in member's "My CCA". |
| `holiday-subsidy-declaration.spec.ts` | Chair declares weekly subsidy → JCRC approves → status reflects in declarations view. |
| `feature-flag-disabled.spec.ts` | When a core service is flagged off, the relevant pages render `<ServiceDisabledState />` and APIs return 503. |

#### 7.6.4 DB reset cadence

- Per spec file (`beforeAll`), call `resetDb()` which truncates + reseeds via `seed.sql`. Within a file, tests share state and run serially (Playwright `test.describe.configure({ mode: 'serial' })`).

## 8. CI workflow

Replace the current single-job `1-ci-merge-request.yml` with parallel jobs:

| Job | Time | Services | Gates merge? |
|---|---|---|---|
| `static` (lint + prettier + tsc + fixtures-check) | <1 min | none | yes |
| `unit-and-component` (`npm test`) | <1 min | none | yes |
| `integration` (`npm run test:integration`) | 3-6 min | local Supabase + `../intranet` checkout | yes |
| `e2e` (Playwright, shard matrix `[1, 2]`) | 5-8 min each, parallel | local Supabase + `../intranet` + Next prod build | yes |
| `build` (`next build`, existing) | ~2 min | none | yes |

All run in parallel. Total wall-clock ~8 min dominated by E2E.

CI workflow snippet for integration:

```yaml
- uses: actions/checkout@v4
- uses: actions/checkout@v4
  with:
    repository: ShearesWeb/intranet
    path: intranet
    ref: main
- uses: supabase/setup-cli@v1
- uses: actions/setup-node@v4
  with: { node-version: '22.22', cache: 'npm' }
- run: npm ci
- run: INTRANET_REPO_PATH=./intranet ./scripts/setup-test-db.sh
- run: npm run test:integration
```

Pinning `../intranet` to `main` means schema drift between repos surfaces as test failures — a deliberate tripwire.

## 9. Local developer workflow

```
npm test                          # unit + component, watch-friendly
npm run test:watch                # vitest watch
npm run test:integration          # requires local Supabase running
npm run test:e2e                  # full E2E, headless
npm run test:e2e:ui               # Playwright UI mode for debugging
npm run test:all                  # everything
npm run fixtures:generate         # regenerate seed.sql + PERSONAS.md
npm run fixtures:check            # fail if generated artifacts are stale
```

Prerequisites for integration / E2E locally:
- Sibling `../intranet` repo cloned (or `INTRANET_REPO_PATH` set)
- Supabase CLI installed
- Docker running (for Supabase)

## 10. Migration from current state

The 21 existing tests are not all kept.

- **Keep:** all `src/features/*/utils/*.test.ts` (pure-logic unit tests) and `src/lib/__tests__/*.test.ts`.
- **Keep with light refactor:** hook tests (`use-recap-navigation.test.tsx`, `use-ranking-editor.test.tsx`), `AuthContext.test.tsx`, `middleware.test.ts`.
- **Replace:** the 3 mock-heavy API route tests (`saveRankings/route.test.ts`, `rank/route.test.ts`, `addApplicant/route.test.ts`). Their stubs reach into Supabase chained-call internals and break on every refactor. Their assertions move to `tests/integration/` against a real DB.
- **Author new:** the authorization matrix, RLS tests, E2E specs.

Migration is incremental — old and new can coexist during transition. The matrix's completeness check is the forcing function for full coverage.

## 11. Out of scope for v1 (phase-2 candidates)

- Per-PR preview environments via Vercel + Supabase branching for E2E and manual QA.
- Cross-browser matrix (Firefox, WebKit) on every PR.
- Hard coverage thresholds.
- Mutation testing for access-control helpers.
- Visual regression / Storybook.
- Adhoc / supplementary CCA-type personas (add if/when authorization rules diverge).
- Consuming Liquibase changelogs as a versioned artifact instead of cloning `../intranet`.

## 12. Risks & open questions

1. **Liquibase startup time in CI.** Estimated ~30-60s for a fresh apply. Acceptable. Mitigation: cache the migrated DB volume between CI runs keyed on `../intranet` commit SHA.
2. **Schema drift between `../intranet@main` and a working PR.** Pinning to `main` means a breaking schema change in `intranet` can red-CI every open PR in this repo until they rebase. Mitigation: communicate with DB team; consider a `INTRANET_PIN_SHA` env var for short-lived stabilization windows.
3. **Supabase admin API session minting in E2E.** Requires service-role key in CI; must be stored as a GitHub secret and never exposed to test browser contexts (only used in `globalSetup`).
4. **Position-reporting graph fidelity.** `is_admin` / `is_culture_sports_admin` derivation depends on the `reporting_position` graph in `cca_positions`. The seed must materialize a graph that matches the real Sheares Hall structure for non-`lead` derived flags (`vice`, `maincomm`, `team manager`) to be meaningful. Source: `../intranet/data/cca-position/`. The harness commits the exact graph in `tests/fixtures/personas.ts` and asserts the derived flags as part of integration tests.
5. **Open: `is_jcrc + is_admin + is_culture_sports_admin` triple coverage.** No current persona derives all three. To cover, add a 15th persona (e.g., `sage` — `lead` Dance + `maincomm` JCRC) or extend Willow with a JCRC appointment. Deferred to writing-plans unless reviewer wants it locked now.

## 13. Acceptance criteria

A reviewer should be able to:

- Run `npm test`, `npm run test:integration`, `npm run test:e2e` locally and have them all pass on `main`.
- Open `tests/fixtures/PERSONAS.md` and understand each persona's profile and intended use.
- Add a new API route, forget to add an entry to `AUTH_MATRIX`, and see CI fail with a clear message.
- Read `tests/integration/authorization/matrix.ts` and tell me exactly who can call what.
- Trigger the auth-session-isolation E2E spec failure by deliberately reintroducing a known SSR session-bleed pattern.
