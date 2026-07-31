# Testing guide

Three automated test layers plus a manual QA harness for role-based testing.

## Automated test layers

| Layer | Tool | Location | Runs in CI |
|---|---|---|---|
| **Unit** | Vitest | `src/**/*.test.ts` | every push + PR |
| **Component** | Vitest + react-dom `act` | `src/**/*.test.tsx` | every push + PR |
| **Integration** | Vitest | `tests/integration/**/*.test.ts` | PR only |

### Unit (`src/**/*.test.ts`)

Pure logic: scoring rules, serialization, access-check functions, route helpers.
No DB, no browser, no network. Route handlers can also be unit-tested here with
the supabase client mocked (see `src/app/api/**/route.test.ts`).
Config: `vitest.config.mts` (project `unit`, `environment: "node"`).

### Component (`src/**/*.test.tsx`)

React components and hooks rendered into a DOM with `react-dom/client` + `act` on
`happy-dom`. Config: `vitest.config.mts` (project `component`, `environment: "happy-dom"`).

Both unit and component tests run together via **`make test`** (`vitest run` across both projects).

### Integration (`tests/integration/**/*.test.ts`)

These run the **real Next.js API route handlers** against a **plain Postgres + a
lightweight PostgREST sidecar** — no Supabase stack. One file per route group
under `tests/integration/routes/`.

How it works:

- The handler's data client (`@/lib/supabase/server`'s `createClient`) is replaced
  in `tests/integration/setup.ts` with a Postgres-backed stand-in
  (`src/test-utils/integration/persona-supabase.ts`). Its `.from()` / `.rpc()` are
  the genuine `@supabase/postgrest-js` client pointed at the PostgREST sidecar, so
  embedded joins and RPCs run for real — nothing is hand-rolled.
- A test "becomes" a persona with `asPersona(key)` (`tests/integration/helpers.ts`).
  That binds a self-signed HS256 JWT carrying `{ email, role }`. PostgREST verifies
  it, switches to the `authenticated` role, and exposes the claims as
  `request.jwt.claims` — which the schema's `auth.email()` reads for RLS. The
  `anonymous` persona sends no token (PostgREST falls back to the `anon` role).
- The DB is kept pristine: `setup.ts` reseeds `tests/fixtures/seed.sql` before
  every test (it deletes its own fixture rows first, cascading away anything a
  test created).

A test looks like:

```ts
import { asPersona, readJson } from "../helpers";

it("returns the authenticated user", async () => {
  asPersona("declan");
  const { GET } = await import("@/app/api/user/route");
  const { status, data } = await readJson(await GET());
  expect(status).toBe(200);
  expect(data.email).toBe("declanho.sg@gmail.com");
});
```

Config: `vitest.integration.config.mts` (serial — one shared DB). Run with
**`make test-integration`** — the DB must be up first
(see [below](#running-integration-tests-locally)).

## Test placement convention

- **Unit / component** colocate with the code they cover as `src/**/*.test.ts` / `src/**/*.test.tsx`.
- Reserve a **`__tests__/`** directory only where a single directory accumulates many tests. Don't create `__tests__/` for a lone test — colocate it instead.
- **Integration** tests live in `tests/integration/routes/`, one file per route group.

## Where does a test belong?

Pure logic and handler branching (with the client mocked) → unit. A route's real
end-to-end behavior against the DB (auth gating, RLS, RPC results, response
envelope) → integration. Anything that needs a real browser session or rendered
page → manual QA via the persona login tool.

---

## Manual QA — persona login system

**The persona system is the canonical way to test any role.** `make e2e-login` mints
a one-time Supabase magic-link you open in your own browser to "assume" that role.
No Playwright, no browser automation.

Personas are defined in `tests/fixtures/personas.ts`, documented in
`tests/fixtures/PERSONAS.md`, and seeded into the test DB via `seed.sql`. The
`expected` role flags on each persona are computed by Postgres from the position
graph; the integration suite asserts them via `authenticated_user_info`.

### Commands

```bash
# List every persona with its role flags ([admin] [JCRC] [CSA]) and appointments.
make e2e-personas

# Print a one-time magic-link to log in as <persona>. Open it in your browser
# (with the dev app running) to browse as that role.
make e2e-login PERSONA=<persona>     # e.g. make e2e-login PERSONA=declan
```

`make e2e-login` needs a real Supabase Auth (GoTrue): set `SUPABASE_URL` and
`SUPABASE_SERVICE_ROLE_KEY` in `.env.test` or `.env.local` (your dev Supabase
project, or a local `supabase start`).

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

- **Docker** (runs the Postgres + PostgREST containers)
- **Liquibase** — `brew install liquibase`
- **`psql`** (postgresql client)
- the **`vendor/intranet`** submodule (holds the Makefile + Liquibase changelog)

```bash
# One-time: fetch the private schema submodule.
git submodule update --init --recursive

# Bring up Postgres + schema + seed + PostgREST, then run the suite.
make db-up
make test-integration

# Stop it when done.
make db-down
```

`make db-up` does: start the vendor Postgres → `liquibase update --contexts=local`
→ harness SQL (`tests/integration/harness.sql`: point `auth.email()` at the JWT
claims; create the `authenticator` login role PostgREST connects as) → seed
`tests/fixtures/seed.sql` → start the PostgREST sidecar.

Connection details live in `.env.test`: `DATABASE_URL`, `POSTGREST_URL`,
`SUPABASE_JWT_SECRET`. The schema repo path defaults to `vendor/intranet`; override
with `INTRANET` (e.g. a local checkout at `../intranet`).

## CI

| Trigger | Workflow | What runs |
|---|---|---|
| **Push** to any non-`main` branch | `1-feature-branch-ci.yml` | prettier, lint, typecheck, unit + component tests |
| **PR** into `main` | `2-merge-request-ci.yml` | all of the above + `next build` + integration tests (Postgres + PostgREST) |

The integration job provisions the stack via `.github/actions/setup-test-stack`
(which runs `make db-up`).

> **Required secret — `SUBMODULE_SSH_KEY`** (a repo-scoped, read-only deploy key for `ShearesWeb/intranet`). One-time setup:
>
> ```bash
> ssh-keygen -t ed25519 -f intranet_ci -N ""
> gh repo deploy-key add intranet_ci.pub -R ShearesWeb/intranet -t "CI (ro)"
> gh secret set SUBMODULE_SSH_KEY -R ShearesWeb/intranet-next-app < intranet_ci
> rm intranet_ci intranet_ci.pub
> ```

## Troubleshooting

- **Integration DB not reachable.** Run `make db-up` (start Docker first if it isn't running).
- **schema repo not found.** Run `git submodule update --init`, or set `INTRANET` to a schema-repo checkout (e.g. `../intranet`).
- **Edited `personas.ts`?** Regenerate the committed fixtures: `npx tsx tests/fixtures/generate.ts` (writes `tests/fixtures/seed.sql` + `PERSONAS.md`).
- **`make e2e-login` fails.** Set `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (a real Supabase Auth is required to mint the magic-link).
- **`Unknown persona`.** Run `make e2e-personas` to see valid keys.
