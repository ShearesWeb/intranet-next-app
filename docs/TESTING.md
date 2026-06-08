# Testing guide

Three automated test layers plus a manual QA harness for role-based testing.

## Automated test layers

| Layer | Tool | Location | Runs in CI |
|---|---|---|---|
| **Unit** | Vitest | `src/**/*.test.ts` | every push + PR |
| **Component** | Vitest + Testing Library | `src/**/*.test.tsx` | every push + PR |
| **Integration** | Vitest | `tests/integration/**/*.test.ts` | PR only |

### Unit (`src/**/*.test.ts`)

Pure logic: scoring rules, serialization, access-check functions, route helpers.
No DB, no browser, no network.
Config: `vitest.config.mts` (project `unit`, `environment: "node"`).

### Component (`src/**/*.test.tsx`)

React components and hooks rendered into a DOM via `@testing-library/react` on
`happy-dom`. Config: `vitest.config.mts` (project `component`, `environment: "happy-dom"`).
Test render helpers live in `src/test-utils/`.

Both unit and component tests run together via **`npm test`** (`vitest run` across both projects). Watch mode: `npm run test:watch`.

### Integration (`tests/integration/**/*.test.ts`)

Tests that exercise the **real database** — Row-Level Security policies, column
grants, SQL views, and the derived role flags computed by Postgres. These run
against a local Supabase stack with the canonical schema applied from the
`vendor/intranet` submodule (Liquibase) and the shared fixtures seeded in.

Two impersonation styles:

- **`pgClientAsPersona(key)`** (`src/test-utils/pg-client.ts`) — opens a `pg`
  connection, sets `request.jwt.claims` + `SET ROLE authenticated` (or `anon`),
  so RLS/grants are enforced exactly as for a real signed-in user.
- **`getPersonaSession(key)`** (`tests/integration/setup.ts`) — mints a real
  Supabase auth session (access/refresh token) via the admin client, for tests
  that go through a Supabase client rather than raw SQL.

Config: `vitest.integration.config.mts`. Run with **`npm run test:integration`**
(watch: `npm run test:integration:watch`).

## Test placement convention

- **Unit / component** colocate with the code they cover as `src/**/*.test.ts` / `src/**/*.test.tsx`.
- Reserve a **`__tests__/`** directory only where a single directory accumulates many tests. Don't create `__tests__/` for a lone test — colocate it instead.
- **Integration** tests live in `tests/integration/**`, grouped by concern (`rls/`, `views/`, `smoke/`).

## Where does a test belong?

API route handlers depend on `next/headers` cookies for auth — there is no authenticated session in a Vitest process. Anything that reads cookies or renders a page must be verified manually via the persona login tool. SQL-level guarantees (RLS, views, derived flags) go in integration. Pure logic goes in unit.

---

## Manual QA — persona login system

**The persona system is the canonical way to test any role.** It opens a real browser window already logged in as a specific user, so you can click through the app as that role.

Personas are defined in `tests/fixtures/personas.ts`, documented in `tests/fixtures/PERSONAS.md`, and seeded into the test DB via `seed.sql`. The `expected` role flags on each persona are computed by Postgres from the position graph — a smoke test (`tests/integration/smoke/derived-flags.test.ts`) fails if they ever drift.

### Prerequisites

The local Supabase stack must be running (see [Running integration tests locally](#running-integration-tests-locally) below).

### Commands

```bash
# List every persona with its role flags ([admin] [JCRC] [CSA]) and appointments.
npm run e2e:personas

# Open a real Chromium window already logged in as <persona> on /dashboard.
# Boots a dev server on :3001 if one isn't already running.
# Close the browser or press Ctrl+C to exit.
npm run e2e:login <persona>     # e.g. npm run e2e:login declan
```

### Persona → role table

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
(sports) or `layla` (committee); **JCRC-only** → `jasper`; **all three flags** → `sage`; **multi-CCA** → `nova`.

---

## Running integration tests locally

Prerequisites:

- **Docker** (Supabase runs its services in containers)
- the **Supabase CLI** — `brew install supabase/tap/supabase`
- **Liquibase** — `brew install liquibase`
- **`psql`** (postgresql client)
- the **`vendor/intranet`** submodule (holds the Liquibase changelog)

```bash
# One-time: fetch the private schema submodule.
git submodule update --init --recursive

# Boot Supabase, apply the schema (Liquibase), and seed the fixtures.
npm run db:test:setup

# Run the integration suite.
npm run test:integration
```

`npm run db:test:setup` (→ `scripts/setup-test-db.sh`) does: `supabase start` →
drop Supabase-shipped storage stubs → `liquibase update` against the
`vendor/intranet` changelog → check/regenerate fixtures → load `tests/fixtures/seed.sql`.
To wipe and re-seed without re-running Liquibase: `npm run db:test:reset`.

The integration runner reads connection details from `.env.test`:
`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_URL`.
Populate these from `supabase status` after the stack is up.

The persona login tool (`npm run e2e:login`) also requires the local Supabase stack to be running — it mints a real session for the chosen persona against the local instance.

## CI

| Trigger | Workflow | What runs |
|---|---|---|
| **Push** to any non-`main` branch | `1-feature-branch-ci.yml` | prettier, lint, typecheck, fixtures drift check, unit + component tests |
| **PR** into `main` | `2-merge-request-ci.yml` | all of the above + `next build` + integration tests (live Supabase) |

Every integration job provisions the live stack via `.github/actions/setup-test-stack`.

> **Required secret — `SUBMODULE_SSH_KEY`** (a repo-scoped, read-only deploy key for `ShearesWeb/intranet`). One-time setup:
>
> ```bash
> ssh-keygen -t ed25519 -f intranet_ci -N ""
> gh repo deploy-key add intranet_ci.pub -R ShearesWeb/intranet -t "CI (ro)"
> gh secret set SUBMODULE_SSH_KEY -R ShearesWeb/intranet-next-app < intranet_ci
> rm intranet_ci intranet_ci.pub
> ```

## Troubleshooting

- **`supabase` not running / connection refused.** Run `npm run db:test:setup` (or `supabase start`). Check `supabase status`. Start Docker first if it isn't running.
- **`Integration tests require <VAR> in env`.** Create/populate `.env.test` from `supabase status`.
- **Fixtures drift (`fixtures:check` fails).** Run **`npm run fixtures:generate`** and commit the updated `tests/fixtures/seed.sql` and `tests/fixtures/PERSONAS.md`.
- **`Liquibase changelog not found`.** Run `git submodule update --init --recursive`.
- **`Unknown persona`.** Run `npm run e2e:personas` to see valid keys.
