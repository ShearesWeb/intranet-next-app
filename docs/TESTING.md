# Testing guide

This is the canonical reference for how this app is tested: the four test layers,
where each lives, how to run them, and — most importantly for day-to-day QA — how
to **act as any role** via the persona system.

## The four test layers

| Layer | Tool | Lives in | Environment | Runs in CI on |
|---|---|---|---|---|
| **Unit** | Vitest | `src/**/*.test.ts` | Node | every push + PR |
| **Component** | Vitest + Testing Library | `src/**/*.test.tsx` | happy-dom | every push + PR |
| **Integration** | Vitest | `tests/integration/**/*.test.ts` | live local Supabase/Postgres | PR |
| **E2E** | Playwright | `e2e/specs/**/*.spec.ts` | real browser + `next dev` | PR + nightly |

### Unit (`src/**/*.test.ts`)

Pure logic: scoring rules, serialization, access-check functions, route helpers.
No DB, no browser, no network. Fast — this is the bulk of the suite.
Config: `vitest.config.mts` (project `unit`, `environment: "node"`).

### Component (`src/**/*.test.tsx`)

React components and hooks rendered into a DOM via `@testing-library/react` on
`happy-dom`. Config: `vitest.config.mts` (project `component`,
`environment: "happy-dom"`). Test render helpers live in `src/test-utils/`.

Both unit and component tests run together via **`npm test`** (which is
`vitest run` across both projects). Watch mode: `npm run test:watch`.

### Integration (`tests/integration/**/*.test.ts`)

Tests that exercise the **real database** — Row-Level Security policies, column
grants, SQL views, and the derived role flags computed by Postgres. These run
against a local Supabase stack with the canonical schema applied from the
`vendor/intranet` submodule (Liquibase) and the shared fixtures seeded in.

Two impersonation styles are used:

- **`pgClientAsPersona(key)`** (`src/test-utils/pg-client.ts`) — opens a `pg`
  connection, sets `request.jwt.claims` + `SET ROLE authenticated` (or `anon`),
  so RLS/grants are enforced exactly as for a real signed-in user. This is how
  the `rls/` tests assert isolation (no cross-session bleed).
- **`getPersonaSession(key)`** (`tests/integration/setup.ts`) — mints a real
  Supabase auth session (access/refresh token) via the admin client, for tests
  that go through a Supabase client rather than raw SQL.

Config: `vitest.integration.config.mts`. Run with **`npm run test:integration`**
(watch: `npm run test:integration:watch`).

### E2E (`e2e/specs/**/*.spec.ts`)

Full-stack browser tests via Playwright against a real `next dev` server
(port 3001) wired to the local Supabase stack. This is where auth-cookie flows,
redirects, role-gated UI, and API routes are verified end to end.
Config: `e2e/playwright.config.ts`. Run with **`npm run e2e`**.

## Where does a test belong? The integration vs e2e boundary

There is one deliberate boundary worth calling out:

> **API-route auth-cookie flows are tested in e2e, not integration.**

The server-side Supabase client reads the session from cookies via
`next/headers` (`cookies()`). A directly-invoked route handler in a Vitest
process has no request context, so it **cannot populate those cookies** — there
is no authenticated session to read. Trying to test cookie-backed auth by
calling a handler function directly would test a fiction.

So the split is:

- **Integration** tests the database contract directly: RLS, grants, views,
  derived flags — using `pgClientAsPersona` / a real Supabase session. No HTTP,
  no cookies, no Next.js request lifecycle.
- **E2E** tests anything that depends on the cookie-backed session: hitting
  `/api/*` routes (`e2e/specs/api.spec.ts`), middleware redirects, and the
  role-gated dashboard UI — through a real browser that carries real session
  cookies.

When in doubt: if the behaviour under test reads cookies / `next/headers` or
renders a page, it's e2e; if it's a SQL-level guarantee, it's integration; if
it's pure logic, it's unit.

## Test-placement convention

- **Unit / component** colocate with the code they cover as
  `src/**/*.test.ts` / `src/**/*.test.tsx` (e.g.
  `src/lib/ranking/cca-ranking-metrics.test.ts`).
- Reserve a **`__tests__/`** directory **only** where a single directory
  accumulates many tests (e.g. `src/lib/auth/__tests__/`). Don't create
  `__tests__/` for a lone test — colocate it instead.
- **Integration** tests live in `tests/integration/**`, grouped by concern
  (`rls/`, `views/`, `smoke/`).
- **E2E** specs live in `e2e/specs/**` and use the `*.spec.ts` suffix.
  `*.spec.*` is reserved for Playwright; Vitest only picks up `*.test.*` — keep
  the suffixes distinct so the two runners never collide.

## Switching roles / testing as any role

**The persona system is the canonical way to act as any role** — for automated
e2e specs and for manual/QA poking around the app. Do not hand-craft sessions or
toggle role flags by hand; pick a persona.

Personas are the single source of truth for test data. They're defined in
`tests/fixtures/personas.ts`, documented (generated) in
`tests/fixtures/PERSONAS.md`, and seeded into the test DB via `seed.sql`. The
`expected` role flags on each persona are computed by Postgres from the position
graph — a smoke test (`tests/integration/smoke/derived-flags.test.ts`) fails if
they ever drift.

### Commands

```bash
# List every persona with its role flags ([admin] [JCRC] [CSA]) and appointments.
npm run e2e:personas

# Open a real Chromium window already logged in as <persona> on /dashboard.
# Boots a dev server on :3001 if one isn't already running. For manual QA:
# click around the app as that role. Ctrl+C or close the window to exit.
npm run e2e:login <persona>     # e.g. npm run e2e:login declan

# Run just the e2e specs tagged for <persona> (greps on @<persona>).
npm run e2e:test <persona>            # e.g. npm run e2e:test jasper
npm run e2e:test <persona> --headed   # same, with a visible browser
```

All three are thin wrappers over `e2e/cli.ts`. Running it with no command (or an
unknown one) prints the usage and the persona list.

### Persona → role table

15 authenticated personas plus `anonymous`. `is_admin` / `is_jcrc` /
`is_culture_sports_admin` (CSA) are **derived** from appointments — see
`tests/fixtures/PERSONAS.md` for the full position graph and the reasoning
behind each flag.

| Persona | Appointment(s) | is_admin | is_jcrc | is_CSA |
|---|---|:---:|:---:|:---:|
| `anonymous` | — (unauthenticated) | — | — | — |
| `aria` | none (regular resident) | — | — | — |
| `mason` | Volleyball / Player | — | — | — |
| `chloe` | Volleyball / Team Manager | — | — | — |
| `declan` | Volleyball / Captain | ✓ | — | ✓ |
| `alexis` | Volleyball / Vice Captain | — | — | — |
| `sienna` | Choir / Chorister | — | — | — |
| `kai` | Choir / Conductor | ✓ | — | ✓ |
| `harper` | SHWEB / Subcomm | — | — | — |
| `ezra` | SHWEB / Maincomm | ✓ | — | — |
| `layla` | SHWEB / President | ✓ | — | — |
| `jasper` | JCRC / Blockcomm | — | ✓ | — |
| `brielle` | JCRC / Maincomm | ✓ | ✓ | — |
| `nova` | Basketball / Captain; SECC / Subcomm | ✓ | — | ✓ |
| `willow` | Dance / Captain | ✓ | — | ✓ |
| `sage` | Drama / Director; JCRC / Maincomm | ✓ | ✓ | ✓ |

Quick picks: a **plain resident** → `aria`; a **chair with no JCRC** → `declan`
(sports) or `layla` (committee); **JCRC-only** → `jasper`; **all three flags** →
`sage`; **multi-CCA** → `nova`.

### The `@persona` tag convention

Every e2e test is tagged with the persona it acts as, in its title — e.g.
`test("@declan - CCA Admin shows Volleyball", ...)`. `npm run e2e:test <persona>`
simply runs Playwright with `--grep @<persona>`, so the tag is what scopes a run
to one role. Anonymous/unauthenticated cases use `@anonymous` and drive the
plain `page` fixture (no session).

In a spec, acquire a logged-in page through the `asPersona` fixture from
`e2e/fixtures.ts`:

```ts
import { test, expect } from "../fixtures";

test("@declan - CCA Admin shows Volleyball", async ({ asPersona }) => {
  const page = await asPersona("declan");
  await page.goto("/dashboard/my-cca/admin");
  await expect(page.getByRole("main").getByText("Volleyball")).toBeVisible();
});
```

`asPersona(key)` attaches that persona's session cookies to a browser context.
Sessions are pre-minted once per run by `e2e/global-setup.ts` and cached
(`e2e/.session-cache.json`, 45-min TTL) so specs don't re-authenticate.

## Running integration tests locally

Integration and e2e both need a live local Supabase stack. Prerequisites:

- **Docker** (Supabase runs its services in containers)
- the **Supabase CLI** — `brew install supabase/tap/supabase`
- **Liquibase** — `brew install liquibase`
- **`psql`** (postgresql client)
- the **`vendor/intranet`** submodule (holds the Liquibase changelog)

Then:

```bash
# One-time (or after a clone): fetch the private schema submodule.
# db:test:setup auto-runs this if the submodule isn't initialized, but you can
# do it explicitly:
git submodule update --init --recursive

# Boot Supabase, apply the schema (Liquibase), and seed the fixtures.
# First run pulls Docker images and can take ~30-60s+.
npm run db:test:setup

# Run the integration suite.
npm run test:integration
```

`npm run db:test:setup` (→ `scripts/setup-test-db.sh`) does: `supabase start` →
drop the Supabase-shipped storage stubs → `liquibase update` against the
`vendor/intranet` changelog → check/regenerate fixtures → load
`tests/fixtures/seed.sql`. To wipe and re-seed without re-running Liquibase:
`npm run db:test:reset`.

The integration runner reads connection details from `.env.test`:
`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
`SUPABASE_DB_URL`. Populate it from `supabase status` after the stack is up
(`SUPABASE_DB_URL` is the `supabase_admin` superuser conn — see the script
header). E2E reads the same stack and accepts the same env (or the `NEXT_PUBLIC_*`
equivalents) for its `next dev` web server.

To run e2e locally once the stack is up:

```bash
npx playwright install --with-deps chromium   # one-time
npm run e2e                                    # headless chromium
npm run e2e:ui                                 # Playwright UI mode
```

## CI

Three workflows in `.github/workflows/`:

| Trigger | Workflow | What runs |
|---|---|---|
| **Push** to any non-`main` branch | `1-feature-branch-ci.yml` | `fast-feedback`: prettier, lint, typecheck, **fixtures drift check**, **unit + component** tests (no browser); plus **`integration-tests`** (live Supabase + `npm run test:integration`). |
| **PR** into `main` | `2-merge-request-ci.yml` | `build-static-assets` (the static gate above **+ `next build`**), **`integration-tests`** (live Supabase), and **`e2e-tests`** (live Supabase + Playwright headless chromium). |
| **Nightly** (cron `17 2 * * *`) + manual dispatch | `3-nightly-e2e.yml` | Full e2e suite as a regression safety net; always uploads the Playwright report artifact. |

Every `integration-tests`/`e2e-tests` job (feature-branch, PR, and nightly)
provisions the live stack via the composite action
`.github/actions/setup-test-stack` — the same `npm run db:test:setup` recipe used
locally — then exports the Supabase connection env for the runner.

> **Required secret — `SUBMODULE_SSH_KEY`** (a repo-scoped, read-only **deploy
> key** — not tied to any person). `vendor/intranet` is a separate private repo,
> and a workflow's built-in `GITHUB_TOKEN` can't read a sibling private repo, so
> each test job loads this deploy key via `webfactory/ssh-agent` to fetch the
> submodule (checkout uses `GITHUB_TOKEN` for this repo). The
> `fast-feedback`/`build-static-assets` jobs don't need it.
>
> One-time setup (needs admin on `ShearesWeb/intranet`):
>
> ```bash
> ssh-keygen -t ed25519 -f intranet_ci -N ""                                    # 1. make a key
> gh repo deploy-key add intranet_ci.pub -R ShearesWeb/intranet -t "CI (ro)"    # 2. public → submodule repo (read-only)
> gh secret set SUBMODULE_SSH_KEY -R ShearesWeb/intranet-next-app < intranet_ci # 3. private → this repo's secret
> rm intranet_ci intranet_ci.pub
> ```

## Troubleshooting

- **`supabase` not running / connection refused.** The stack isn't up. Run
  `npm run db:test:setup` (or `supabase start`). Check `supabase status`. If
  Docker isn't running, start Docker first.
- **`Integration tests require <VAR> in env` / missing `.env.test`.** The
  integration runner couldn't find `SUPABASE_URL` / `SUPABASE_ANON_KEY` /
  `SUPABASE_SERVICE_ROLE_KEY` / `SUPABASE_DB_URL`. Create/populate `.env.test`
  from `supabase status`.
- **Fixtures drift (`fixtures:check` fails).** You edited
  `tests/fixtures/personas.ts` (or related fixtures) without regenerating the
  derived artifacts. Run **`npm run fixtures:generate`** and commit the updated
  `tests/fixtures/seed.sql` and `tests/fixtures/PERSONAS.md`.
- **`Liquibase changelog not found`.** The `vendor/intranet` submodule isn't
  initialized. Run `git submodule update --init --recursive` (this needs read
  access to `ShearesWeb/intranet`).
- **Stale e2e sessions / odd auth state.** Delete `e2e/.session-cache.json`; the
  next run re-mints sessions.
- **`Unknown persona`.** Run `npm run e2e:personas` to see valid keys.
