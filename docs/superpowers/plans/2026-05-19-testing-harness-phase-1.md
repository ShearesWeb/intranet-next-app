# Testing Harness Phase 1 — Fixtures Pipeline + Integration Test Infrastructure

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the typed-fixtures pipeline (single source of truth for personas + CCAs that generates `seed.sql` and `PERSONAS.md`) and the integration test infrastructure (local Supabase + Liquibase-applied schema + helpers for raw-pg and route-handler tests), so subsequent phases can write authorization-matrix, RLS, and behavioral tests against a real database.

**Architecture:** Bring up a local Supabase stack from `supabase/config.toml`. Apply the canonical schema from sibling repo `../intranet/db/changelogs/qa.changelog-master.xml` via Liquibase. Generate `seed.sql` and `PERSONAS.md` from typed TS sources (`tests/fixtures/personas.ts`, `tests/fixtures/ccas.ts`) via `tests/fixtures/generate.ts`; a CI guard (`fixtures:check`) fails if generated artifacts drift from source. Add a separate Vitest "integration" config (`vitest.integration.config.mts`) that runs against the live local DB in `node` env with per-test transactional rollback. Provide three helpers in `src/test-utils/`: `pgClientAsPersona` (raw `pg` client with claims set), `createApiRequest` (NextRequest minted with a persona's Supabase session cookies), `renderWithProviders` (RTL render wrapping AuthProvider + theme + router). Land one end-to-end smoke integration test asserting the persona graph produces the expected derived flags from the canonical `authenticated_user_info` view. **No authorization matrix and no RLS tests in this phase** — those are Phase 2 / Phase 3.

**Tech Stack:** Vitest 4, happy-dom (already configured for component env), Supabase CLI (new prerequisite), Liquibase 4.x (already installed locally), Postgres 15 (via Supabase), `pg` node driver (new dep), `@supabase/supabase-js` (already present), GitHub Actions.

**Spec reference:** `docs/superpowers/specs/2026-05-18-testing-harness-design.md` §§ 5, 6, 7.4.1, 7.4.2, 7.4.3, 7.4.5, plus the static-check addition for `fixtures:check` from § 7.1.

**Phase 0 baseline:** `b1649c1 Testing harness Phase 0 — static checks + unit hardening (#42)` is committed on `main`. It delivered `typecheck`, `format:check`, happy-dom, the unit/component Vitest projects, exhaustive `isChairPositionType` enumeration, and CI gating on lint/format/typecheck/test in `.github/workflows/2-merge-request-ci.yml`.

**Explicitly deferred to later phases (do not touch in Phase 1):**
- Spec § 7.4.4 — `AUTH_MATRIX`, `matrix.test.ts`, `matrix-completeness.test.ts` → Phase 2
- Spec § 7.5 — RLS policy tests → Phase 3
- Spec § 7.6 — E2E + Playwright → Phase 4
- Spec § 8 — adding an `integration` job to `2-merge-request-ci.yml` → Phase 2 (lands with the matrix)
- Behavioral integration tests beyond the single smoke test → Phase 2

---

## Prerequisites (one-time, before Task 1)

1. **Install the Supabase CLI locally.** On macOS: `brew install supabase/tap/supabase`. Verify with `supabase --version`. The implementer should do this once before starting Task 1 and confirm Docker is running (`docker info`); `supabase start` requires Docker.
2. **Confirm the sibling repo exists.** `ls /Users/bytedance/intranet/db/changelogs/qa.changelog-master.xml` must succeed. If it doesn't, clone it: `git clone git@github.com:ShearesWeb/intranet ../intranet`.
3. **Confirm Liquibase is available.** `liquibase --version` should print a version. (Phase 0 already required this implicitly; confirm.)

Do not proceed if any prerequisite is missing — stop and ask the user. None of these install steps belongs in a task because they aren't idempotent commits.

---

## File map

**New files (created):**

- `supabase/config.toml` — local Supabase project config (ports, auth settings)
- `tests/fixtures/personas.ts` — typed source of truth: persona records, appointments, derived-flag expectations
- `tests/fixtures/ccas.ts` — typed source of truth: 8 CCA definitions
- `tests/fixtures/positions.ts` — typed source of truth: position-reporting graph per CCA
- `tests/fixtures/types.ts` — shared TypeScript types for the fixture domain
- `tests/fixtures/generate.ts` — ts-node script that emits `seed.sql` and `PERSONAS.md`
- `tests/fixtures/seed.sql` — **generated**; checked into git so CI can verify drift
- `tests/fixtures/PERSONAS.md` — **generated**; checked into git so reviewers can read it
- `tests/integration/setup.ts` — global integration setup: pg pool, admin Supabase client, `withRollback`, `resetDb`, persona session cache
- `tests/integration/smoke/derived-flags.test.ts` — smoke test for the persona graph
- `src/test-utils/pg-client.ts` — `pgClientAsPersona(key)` helper
- `src/test-utils/api-request.ts` — `createApiRequest({ persona, method, body, params })` helper
- `src/test-utils/render.tsx` — `renderWithProviders` for component tests (no DB)
- `src/test-utils/factories.ts` — placeholder for ad-hoc factories (empty exports for now)
- `src/test-utils/index.ts` — barrel re-export
- `scripts/setup-test-db.sh` — boots Supabase, runs Liquibase, applies seed
- `vitest.integration.config.mts` — Vitest config for the integration project
- `tsconfig.scripts.json` already exists — extend `include` for fixtures (Task 4)

**Modified files:**

- `package.json` — add `pg`, `@types/pg`, `dotenv`; add scripts `fixtures:generate`, `fixtures:check`, `test:integration`, `test:integration:watch`, `db:test:setup`, `db:test:reset`
- `.gitignore` — ignore Supabase working artifacts but **not** `tests/fixtures/seed.sql` or `PERSONAS.md`
- `.github/workflows/2-merge-request-ci.yml` — add a `fixtures:check` step after step 8 ("Typecheck")
- `.github/workflows/1-feature-branch-ci.yml` — add the same `fixtures:check` step
- `tsconfig.scripts.json` — include the fixtures generator so `npm run fixtures:generate` resolves types

**Untouched in this phase:**
- `src/` source files — no application code changes
- `tests/integration/authorization/`, `tests/integration/rls/` — not created until Phase 2/3
- `tests/e2e/` — Phase 4

---

## Task 1: Set up local Supabase config

**Files:**
- Create: `supabase/config.toml`
- Modify: `.gitignore`

**Rationale:** Spec § 7.4.1 mandates `supabase start` as the integration test bootstrap. We need a committed `config.toml` so CI and local devs get the same ports and settings. We don't commit the Docker volume or runtime working directory.

- [ ] **Step 1: Initialize the Supabase project**

Run from the repo root:

```bash
supabase init
```

This creates `supabase/config.toml` and a small `supabase/` directory tree (e.g., `supabase/.gitignore`, `supabase/seed.sql` — note: the Supabase CLI's `seed.sql` is unrelated to our `tests/fixtures/seed.sql` and will not be used; we apply seeds manually).

Expected: no errors, `supabase/config.toml` exists.

- [ ] **Step 2: Edit `supabase/config.toml` to pin ports we control**

Open `supabase/config.toml` and ensure these values (edit, don't append; the file has many sections — only override these keys, leave the rest at CLI defaults):

```toml
project_id = "intranet-next-app-test"

[api]
enabled = true
port = 54321

[db]
port = 54322
shadow_port = 54320
major_version = 15

[studio]
enabled = false

[inbucket]
enabled = false

[storage]
enabled = false

[auth]
enabled = true
site_url = "http://localhost:3000"
additional_redirect_urls = ["http://localhost:3000/auth/callback"]
jwt_expiry = 3600
enable_signup = true
enable_anonymous_sign_ins = false
minimum_password_length = 6

[auth.email]
enable_signup = true
double_confirm_changes = false
enable_confirmations = false

[edge_runtime]
enabled = false

[analytics]
enabled = false
```

Rationale for these specific overrides:
- We disable studio/inbucket/storage/edge_runtime/analytics — they consume RAM and we don't test them.
- `enable_confirmations = false` lets `auth.admin.createUser` mint immediately-usable sessions for the persona cache (spec § 7.6.2 pattern reused for integration).
- Port `54321` for Kong (Supabase API), `54322` for Postgres — these are the CLI defaults and match what `INTRANET_REPO_PATH` Liquibase calls will hit.

- [ ] **Step 3: Smoke-test that Supabase boots**

Run:

```bash
supabase start
```

Expected: ~30-60s on first run (pulls Docker images). Final output prints API URL `http://127.0.0.1:54321`, DB URL `postgresql://postgres:postgres@127.0.0.1:54322/postgres`, anon/service-role keys, and the JWT secret. Copy these for Task 5 — but also note `supabase status` reprints them anytime.

If `supabase start` fails with "port in use," some other process holds 54321/54322. Stop that process; do not change ports — CI assumes these. If it fails with "Docker not running," start Docker Desktop.

- [ ] **Step 4: Stop Supabase to leave the environment clean for subsequent tasks**

Run:

```bash
supabase stop
```

Expected: containers stopped. (We'll boot again in Task 6 via the script.)

- [ ] **Step 5: Update `.gitignore`**

Open `/Users/bytedance/intranet-next-app/.gitignore` and append these lines at the bottom:

```
# Supabase local working artifacts (config.toml IS committed; these are not)
supabase/.branches/
supabase/.temp/

# Test DB bootstrap output
.supabase-test-db.log

# Liquibase per-run output
liquibase.properties
```

Do not add `supabase/` wholesale — `supabase/config.toml` must remain tracked.

- [ ] **Step 6: Commit**

```bash
git add supabase/config.toml supabase/.gitignore .gitignore
git commit -m "chore(testing): add local Supabase config for integration tests"
```

(If `supabase init` created additional files like `supabase/migrations/`, `git status` to inspect; we don't use Supabase migrations — we use Liquibase from the sibling repo. Delete any auto-generated `supabase/migrations/`, `supabase/functions/`, `supabase/seed.sql` before committing. Keep only `config.toml` and `.gitignore`.)

---

## Task 2: Define the typed fixture types and CCAs

**Files:**
- Create: `tests/fixtures/types.ts`
- Create: `tests/fixtures/ccas.ts`

**Rationale:** Spec § 5.1 makes the TS files the single source of truth. We start with types and the 8 CCAs because personas reference CCAs by key, so types and `ccas.ts` must compile before `personas.ts`.

- [ ] **Step 1: Create `tests/fixtures/types.ts`**

Write the file `/Users/bytedance/intranet-next-app/tests/fixtures/types.ts`:

```ts
// Single source of truth — types shared by personas.ts, ccas.ts, positions.ts, and generate.ts.
// Mirrors the public schema from ../intranet/db/changelogs/.

export type CcaType = "sports" | "culture" | "committee" | "jcrc" | "adhoc" | "supplementary";

export type CcaTierType = "tier 1" | "tier 2" | "none";

export type PositionType =
	| "lead"
	| "vice"
	| "blockcomm"
	| "maincomm"
	| "subcomm"
	| "team manager"
	| "member"
	| "resident";

export type StayPeriod = "full-year" | "semester-1" | "semester-2";

export type Block = "A" | "B" | "C" | "D" | "E";

// Keys are stable string identifiers used as references; they are NOT inserted into the DB.
export type CcaKey =
	| "volleyball"
	| "basketball"
	| "choir"
	| "dance"
	| "drama"
	| "shweb"
	| "secc"
	| "jcrc";

export type Cca = {
	key: CcaKey;
	name: string;
	type: CcaType;
	tierType: CcaTierType;
	description: string;
};

// A position record. `reportsTo` is the position name (within the same CCA) this reports to.
// "lead" positions typically have `reportsTo: null`. JCRC's top is "maincomm" with `reportsTo: null`.
export type PositionDef = {
	ccaKey: CcaKey;
	positionType: PositionType;
	name: string; // human-readable name, unique within CCA (matches users.room — name unique per cca_id constraint)
	reportsTo: string | null; // name of another position in the same CCA, or null for the top
	capacity: number | null;
};

export type Appointment = {
	ccaKey: CcaKey;
	positionName: string; // matches PositionDef.name in the same CCA
	points: number;
};

export type PersonaKey =
	| "anonymous"
	| "aria"
	| "mason"
	| "chloe"
	| "declan"
	| "alexis"
	| "sienna"
	| "kai"
	| "harper"
	| "ezra"
	| "layla"
	| "jasper"
	| "brielle"
	| "nova"
	| "willow"
	| "sage";

export type ExpectedDerivedFlags = {
	is_admin: boolean;
	is_jcrc: boolean;
	is_culture_sports_admin: boolean;
};

export type Persona = {
	key: PersonaKey;
	// `anonymous` is the unauthenticated sentinel — has no user row.
	email: string | null;
	name: string | null;
	matric: string | null; // NUS format, e.g. "A0123456X"
	room: string | null; // canonical "SH/<block>/<floor>/<unit>" form
	stayPeriod: StayPeriod;
	appointments: Appointment[];
	expected: ExpectedDerivedFlags;
};
```

- [ ] **Step 2: Create `tests/fixtures/ccas.ts`**

Write the file `/Users/bytedance/intranet-next-app/tests/fixtures/ccas.ts`:

```ts
import type { Cca } from "./types";

// Spec § 5.3 — the 8 CCAs.
export const CCAS: readonly Cca[] = [
	{
		key: "volleyball",
		name: "Volleyball",
		type: "sports",
		tierType: "tier 1",
		description: "Primary sports CCA; full position roster including vice and team manager.",
	},
	{
		key: "basketball",
		name: "Basketball",
		type: "sports",
		tierType: "tier 1",
		description: "Sports foil — Nova is lead here; Declan must not have access.",
	},
	{
		key: "choir",
		name: "Choir",
		type: "culture",
		tierType: "tier 1",
		description: "Primary culture CCA.",
	},
	{
		key: "dance",
		name: "Dance",
		type: "culture",
		tierType: "tier 2",
		description: "Culture foil exercising tier 2 differences.",
	},
	{
		key: "drama",
		name: "Drama",
		type: "culture",
		tierType: "tier 1",
		description: "Sage's CCA — supports the triple-flag persona.",
	},
	{
		key: "shweb",
		name: "SHWEB",
		type: "committee",
		tierType: "none",
		description: "Primary committee with lead / maincomm / subcomm roster.",
	},
	{
		key: "secc",
		name: "SECC",
		type: "committee",
		tierType: "none",
		description: "Committee foil for cross-committee scoping.",
	},
	{
		key: "jcrc",
		name: "JCRC",
		type: "jcrc",
		tierType: "none",
		description: "Hall executive committee — no lead position; top is maincomm.",
	},
] as const;

export function ccaByKey(key: string): Cca {
	const cca = CCAS.find((c) => c.key === key);
	if (!cca) throw new Error(`Unknown CCA key: ${key}`);
	return cca;
}
```

- [ ] **Step 3: Typecheck**

Run:

```bash
npm run typecheck
```

Expected: passes. `tsconfig.json` already includes `tests/**/*.ts` via its `include` pattern (defaults to `**/*.ts`). If it doesn't (e.g., `tsconfig.json` restricts to `src/`), update the plan — but the existing config compiles `tests/` per `tsconfig.json`'s `include`. Verify by inspecting `tsconfig.json` if uncertain.

- [ ] **Step 4: Commit**

```bash
git add tests/fixtures/types.ts tests/fixtures/ccas.ts
git commit -m "test(fixtures): add fixture types and CCA definitions"
```

---

## Task 3: Define the position graph

**Files:**
- Create: `tests/fixtures/positions.ts`

**Rationale:** Spec § 5.2 says "the exact `is_admin` / `is_culture_sports_admin` value for non-`lead` positions depends on the position-reporting graph, which `tests/fixtures/personas.ts` codifies." We separate the graph into its own file because (a) it's reused — the derived-flag expectations in personas.ts must be consistent with the graph, and (b) the generator emits `cca_positions` rows before `cca_appointments` rows, so the data layers naturally separate.

The fixture graph below is **defensible but synthetic** — it does not mirror every quirk of the real Sheares Hall structure. It is documented so anyone reading `PERSONAS.md` can see exactly why each persona derives the flags it does. Spec § 12 risk #4 notes that the implementer should consult `../intranet/data/cca-position/` to confirm the graph is reasonable; the seed below errs on the side of "minimal but correct for matrix coverage."

- [ ] **Step 1: Create `tests/fixtures/positions.ts`**

Write `/Users/bytedance/intranet-next-app/tests/fixtures/positions.ts`:

```ts
import type { PositionDef } from "./types";

// Position graph per CCA.
//
// Sports/culture CCAs (Volleyball, Basketball, Choir, Dance, Drama):
//   lead (no parent)
//   ├── vice (no children — keeps Alexis's flags off)
//   ├── team manager (no children — keeps Chloe's flags off, per spec § 5.2)
//   └── member (no children)
//
// Committee CCAs (SHWEB, SECC):
//   lead (no parent)
//   └── maincomm
//       └── subcomm (no children)
//
// JCRC:
//   maincomm (no parent — JCRC has no lead, per spec § 5.3)
//   └── blockcomm (no children — keeps Jasper's is_admin off; only is_jcrc)
//
// Derived-flag consequences (asserted in smoke test):
// - "lead" in any non-JCRC CCA → has children → is_admin = true
//   For culture/sports CCAs → also is_culture_sports_admin = true
// - "maincomm" in committee/JCRC → has children (subcomm/blockcomm) → is_admin = true
//   In JCRC → also is_jcrc; never is_culture_sports_admin (cca_type != culture/sports)
// - "vice", "team manager", "subcomm", "blockcomm", "member", "resident" → no children → no flags from chain.
//   `is_jcrc` still derives from CCA membership alone for anyone with a JCRC appointment.

export const POSITIONS: readonly PositionDef[] = [
	// Volleyball
	{ ccaKey: "volleyball", positionType: "lead", name: "Captain", reportsTo: null, capacity: 1 },
	{ ccaKey: "volleyball", positionType: "vice", name: "Vice Captain", reportsTo: "Captain", capacity: 1 },
	{ ccaKey: "volleyball", positionType: "team manager", name: "Team Manager", reportsTo: "Captain", capacity: 1 },
	{ ccaKey: "volleyball", positionType: "member", name: "Player", reportsTo: "Captain", capacity: 12 },

	// Basketball
	{ ccaKey: "basketball", positionType: "lead", name: "Captain", reportsTo: null, capacity: 1 },
	{ ccaKey: "basketball", positionType: "vice", name: "Vice Captain", reportsTo: "Captain", capacity: 1 },
	{ ccaKey: "basketball", positionType: "team manager", name: "Team Manager", reportsTo: "Captain", capacity: 1 },
	{ ccaKey: "basketball", positionType: "member", name: "Player", reportsTo: "Captain", capacity: 12 },

	// Choir
	{ ccaKey: "choir", positionType: "lead", name: "Conductor", reportsTo: null, capacity: 1 },
	{ ccaKey: "choir", positionType: "vice", name: "Vice Conductor", reportsTo: "Conductor", capacity: 1 },
	{ ccaKey: "choir", positionType: "member", name: "Chorister", reportsTo: "Conductor", capacity: 20 },

	// Dance
	{ ccaKey: "dance", positionType: "lead", name: "Captain", reportsTo: null, capacity: 1 },
	{ ccaKey: "dance", positionType: "vice", name: "Vice Captain", reportsTo: "Captain", capacity: 1 },
	{ ccaKey: "dance", positionType: "member", name: "Dancer", reportsTo: "Captain", capacity: 20 },

	// Drama
	{ ccaKey: "drama", positionType: "lead", name: "Director", reportsTo: null, capacity: 1 },
	{ ccaKey: "drama", positionType: "vice", name: "Assistant Director", reportsTo: "Director", capacity: 1 },
	{ ccaKey: "drama", positionType: "member", name: "Cast", reportsTo: "Director", capacity: 15 },

	// SHWEB
	{ ccaKey: "shweb", positionType: "lead", name: "President", reportsTo: null, capacity: 1 },
	{ ccaKey: "shweb", positionType: "maincomm", name: "Maincomm", reportsTo: "President", capacity: 5 },
	{ ccaKey: "shweb", positionType: "subcomm", name: "Subcomm", reportsTo: "Maincomm", capacity: 15 },

	// SECC
	{ ccaKey: "secc", positionType: "lead", name: "President", reportsTo: null, capacity: 1 },
	{ ccaKey: "secc", positionType: "maincomm", name: "Maincomm", reportsTo: "President", capacity: 5 },
	{ ccaKey: "secc", positionType: "subcomm", name: "Subcomm", reportsTo: "Maincomm", capacity: 15 },

	// JCRC — top is maincomm, not lead
	{ ccaKey: "jcrc", positionType: "maincomm", name: "Maincomm", reportsTo: null, capacity: 5 },
	{ ccaKey: "jcrc", positionType: "blockcomm", name: "Blockcomm", reportsTo: "Maincomm", capacity: 10 },
] as const;

export function findPosition(ccaKey: string, positionName: string): PositionDef {
	const pos = POSITIONS.find((p) => p.ccaKey === ccaKey && p.name === positionName);
	if (!pos) throw new Error(`Unknown position: ${ccaKey}/${positionName}`);
	return pos;
}
```

- [ ] **Step 2: Typecheck**

Run:

```bash
npm run typecheck
```

Expected: passes.

- [ ] **Step 3: Commit**

```bash
git add tests/fixtures/positions.ts
git commit -m "test(fixtures): define position-reporting graph per CCA"
```

---

## Task 4: Define the 15 personas

**Files:**
- Create: `tests/fixtures/personas.ts`

**Rationale:** Spec § 5.2 lists all 15 personas with their appointments and expected derived flags. We encode them here as the source of truth. The smoke test (Task 11) will assert that the canonical `authenticated_user_info` view computes the same flags from the appointment graph.

Important: every `room` value must satisfy the DB CHECK constraint `^SH/[A-E]/[1-8]/(1[0-9]{2}|[2-7][0-9]{2}|8[0-2][0-9])$` (from `../intranet/db/changelogs/table/core/02.user.sql` line 21). The spec's shorthand `A203` becomes `SH/A/2/203`, `B315` becomes `SH/B/3/315`, etc.

- [ ] **Step 1: Create `tests/fixtures/personas.ts`**

Write `/Users/bytedance/intranet-next-app/tests/fixtures/personas.ts`:

```ts
import type { Persona } from "./types";

// Spec § 5.2 — 15 personas + anonymous. Rooms use canonical SH/<block>/<floor>/<unit> form.
// `expected` flags must match what the `authenticated_user_roles` view computes from
// the position graph in positions.ts. Drift fails the Task 11 smoke test.
export const PERSONAS: readonly Persona[] = [
	{
		key: "anonymous",
		email: null,
		name: null,
		matric: null,
		room: null,
		stayPeriod: "full-year",
		appointments: [],
		expected: { is_admin: false, is_jcrc: false, is_culture_sports_admin: false },
	},
	{
		key: "aria",
		email: "aria.tan.sg@gmail.com",
		name: "Aria Tan",
		matric: "A0250001A",
		room: "SH/A/2/203",
		stayPeriod: "full-year",
		appointments: [],
		expected: { is_admin: false, is_jcrc: false, is_culture_sports_admin: false },
	},
	{
		key: "mason",
		email: "mason.lim.99@gmail.com",
		name: "Mason Lim",
		matric: "A0250002B",
		room: "SH/B/3/315",
		stayPeriod: "full-year",
		appointments: [{ ccaKey: "volleyball", positionName: "Player", points: 0 }],
		expected: { is_admin: false, is_jcrc: false, is_culture_sports_admin: false },
	},
	{
		key: "chloe",
		email: "chloe.ng.j@gmail.com",
		name: "Chloe Ng",
		matric: "A0250003C",
		room: "SH/C/1/108",
		stayPeriod: "full-year",
		appointments: [{ ccaKey: "volleyball", positionName: "Team Manager", points: 0 }],
		// team manager has no children in the graph → no admin flag
		expected: { is_admin: false, is_jcrc: false, is_culture_sports_admin: false },
	},
	{
		key: "declan",
		email: "declanho.sg@gmail.com",
		name: "Declan Ho",
		matric: "A0250004D",
		room: "SH/A/4/412",
		stayPeriod: "full-year",
		appointments: [{ ccaKey: "volleyball", positionName: "Captain", points: 0 }],
		// lead has children (vice, team manager, member) → is_admin; sports → is_culture_sports_admin
		expected: { is_admin: true, is_jcrc: false, is_culture_sports_admin: true },
	},
	{
		key: "alexis",
		email: "alexis.goh.99@gmail.com",
		name: "Alexis Goh",
		matric: "A0250005E",
		room: "SH/D/2/202",
		stayPeriod: "full-year",
		appointments: [{ ccaKey: "volleyball", positionName: "Vice Captain", points: 0 }],
		// vice has no children in our graph → no flags
		expected: { is_admin: false, is_jcrc: false, is_culture_sports_admin: false },
	},
	{
		key: "sienna",
		email: "sienna.lee.j@gmail.com",
		name: "Sienna Lee",
		matric: "A0250006F",
		room: "SH/B/2/210",
		stayPeriod: "full-year",
		appointments: [{ ccaKey: "choir", positionName: "Chorister", points: 0 }],
		expected: { is_admin: false, is_jcrc: false, is_culture_sports_admin: false },
	},
	{
		key: "kai",
		email: "kai.koh.96@gmail.com",
		name: "Kai Koh",
		matric: "A0250007G",
		room: "SH/C/4/401",
		stayPeriod: "full-year",
		appointments: [{ ccaKey: "choir", positionName: "Conductor", points: 0 }],
		// lead Choir (culture) → is_admin + is_culture_sports_admin
		expected: { is_admin: true, is_jcrc: false, is_culture_sports_admin: true },
	},
	{
		key: "harper",
		email: "harper.tan.2k@gmail.com",
		name: "Harper Tan",
		matric: "A0250008H",
		room: "SH/E/1/115",
		stayPeriod: "full-year",
		appointments: [{ ccaKey: "shweb", positionName: "Subcomm", points: 0 }],
		// subcomm has no children → no flags
		expected: { is_admin: false, is_jcrc: false, is_culture_sports_admin: false },
	},
	{
		key: "ezra",
		email: "ezrasim.nus@gmail.com",
		name: "Ezra Sim",
		matric: "A0250009I",
		room: "SH/A/3/301",
		stayPeriod: "full-year",
		appointments: [{ ccaKey: "shweb", positionName: "Maincomm", points: 0 }],
		// maincomm has subcomm child → is_admin. SHWEB is committee, not culture/sports → not CSA
		expected: { is_admin: true, is_jcrc: false, is_culture_sports_admin: false },
	},
	{
		key: "layla",
		email: "layla.ng.97@gmail.com",
		name: "Layla Ng",
		matric: "A0250010J",
		room: "SH/D/4/405",
		stayPeriod: "full-year",
		appointments: [{ ccaKey: "shweb", positionName: "President", points: 0 }],
		// lead SHWEB (committee) → is_admin only, NOT is_culture_sports_admin
		expected: { is_admin: true, is_jcrc: false, is_culture_sports_admin: false },
	},
	{
		key: "jasper",
		email: "jasper.chua.sg@gmail.com",
		name: "Jasper Chua",
		matric: "A0250011K",
		room: "SH/B/4/406",
		stayPeriod: "full-year",
		appointments: [{ ccaKey: "jcrc", positionName: "Blockcomm", points: 0 }],
		// blockcomm has no children → no admin; any JCRC appointment → is_jcrc
		expected: { is_admin: false, is_jcrc: true, is_culture_sports_admin: false },
	},
	{
		key: "brielle",
		email: "brielle.koh.j@gmail.com",
		name: "Brielle Koh",
		matric: "A0250012L",
		room: "SH/C/3/312",
		stayPeriod: "full-year",
		appointments: [{ ccaKey: "jcrc", positionName: "Maincomm", points: 0 }],
		// maincomm JCRC has blockcomm child → is_admin; JCRC → is_jcrc; not culture/sports
		expected: { is_admin: true, is_jcrc: true, is_culture_sports_admin: false },
	},
	{
		key: "nova",
		email: "nova.tay.sg@gmail.com",
		name: "Nova Tay",
		matric: "A0250013M",
		room: "SH/A/1/105",
		stayPeriod: "full-year",
		appointments: [
			{ ccaKey: "basketball", positionName: "Captain", points: 0 },
			{ ccaKey: "secc", positionName: "Subcomm", points: 0 },
		],
		// lead Basketball (sports) → is_admin + is_culture_sports_admin
		// subcomm SECC has no children → contributes nothing
		expected: { is_admin: true, is_jcrc: false, is_culture_sports_admin: true },
	},
	{
		key: "willow",
		email: "willow.rahman.gg@gmail.com",
		name: "Willow Rahman",
		matric: "A0250014N",
		room: "SH/D/1/108",
		stayPeriod: "full-year",
		appointments: [{ ccaKey: "dance", positionName: "Captain", points: 0 }],
		// lead Dance (culture) → is_admin + is_culture_sports_admin
		expected: { is_admin: true, is_jcrc: false, is_culture_sports_admin: true },
	},
	{
		key: "sage",
		email: "sage.lim.97@gmail.com",
		name: "Sage Lim",
		matric: "A0250015O",
		room: "SH/E/3/305",
		stayPeriod: "full-year",
		appointments: [
			{ ccaKey: "drama", positionName: "Director", points: 0 },
			{ ccaKey: "jcrc", positionName: "Maincomm", points: 0 },
		],
		// lead Drama (culture) → is_admin + is_culture_sports_admin
		// maincomm JCRC → is_admin (additive, same flag); is_jcrc
		expected: { is_admin: true, is_jcrc: true, is_culture_sports_admin: true },
	},
] as const;

export function personaByKey(key: string): Persona {
	const p = PERSONAS.find((x) => x.key === key);
	if (!p) throw new Error(`Unknown persona key: ${key}`);
	return p;
}

export function authenticatedPersonas(): readonly Persona[] {
	return PERSONAS.filter((p) => p.email !== null);
}
```

- [ ] **Step 2: Typecheck**

Run:

```bash
npm run typecheck
```

Expected: passes.

- [ ] **Step 3: Commit**

```bash
git add tests/fixtures/personas.ts
git commit -m "test(fixtures): add 15 personas with appointments and expected derived flags"
```

---

## Task 5: Build the generator, add npm scripts, generate artifacts

**Files:**
- Create: `tests/fixtures/generate.ts`
- Modify: `tsconfig.scripts.json`
- Modify: `package.json` — add `pg`, `@types/pg`, `dotenv` deps; add scripts
- Generated: `tests/fixtures/seed.sql`, `tests/fixtures/PERSONAS.md`

**Rationale:** Spec § 5.1 — generator transforms TS sources into the SQL seed and human-readable markdown. We commit the generated files so CI can `diff` and fail on drift. `fixtures:check` regenerates into a temp dir and `diff`s — the discipline that prevents PERSONAS.md going stale.

- [ ] **Step 1: Install pg and dotenv**

Run:

```bash
npm install --save-dev pg @types/pg dotenv
```

Expected: `pg`, `@types/pg`, `dotenv` appear in `devDependencies` in `package.json`.

- [ ] **Step 2: Extend `tsconfig.scripts.json` to include the fixtures generator**

Read `/Users/bytedance/intranet-next-app/tsconfig.scripts.json` first to see its current shape. It currently targets `scripts/`. Extend `include` to also cover the fixtures generator. The full file should look like:

```jsonc
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "module": "CommonJS",
    "target": "ES2017",
    "moduleResolution": "node"
  },
  "include": ["scripts/**/*.ts", "tests/fixtures/**/*.ts"]
}
```

If `tsconfig.scripts.json`'s existing contents differ from the above shape, **preserve any extra `compilerOptions`** the project already sets (e.g., `esModuleInterop: true`); only ensure `tests/fixtures/**/*.ts` ends up in `include`.

- [ ] **Step 3: Create `tests/fixtures/generate.ts`**

Write `/Users/bytedance/intranet-next-app/tests/fixtures/generate.ts`:

```ts
/* eslint-disable @typescript-eslint/no-explicit-any */
// Renders tests/fixtures/seed.sql and tests/fixtures/PERSONAS.md from the typed
// TS sources (personas.ts, ccas.ts, positions.ts). Run via `npm run fixtures:generate`.
// CI guards drift via `npm run fixtures:check`.

import * as fs from "node:fs";
import * as path from "node:path";
import { CCAS } from "./ccas";
import { POSITIONS } from "./positions";
import { PERSONAS } from "./personas";
import type { Cca, PositionDef, Persona } from "./types";

const OUT_DIR = path.resolve(__dirname);
const SQL_FILE = path.join(OUT_DIR, "seed.sql");
const MD_FILE = path.join(OUT_DIR, "PERSONAS.md");

// SQL string escaping — single-quote-doubled.
function q(value: string | number | null): string {
	if (value === null) return "NULL";
	if (typeof value === "number") return String(value);
	return `'${value.replace(/'/g, "''")}'`;
}

function renderSql(): string {
	const lines: string[] = [];
	lines.push("-- GENERATED by tests/fixtures/generate.ts — do not edit by hand.");
	lines.push("-- Run `npm run fixtures:generate` after editing personas.ts / ccas.ts / positions.ts.");
	lines.push("");
	lines.push("BEGIN;");
	lines.push("");
	lines.push("-- Truncate everything we own, in FK-safe order.");
	lines.push("TRUNCATE TABLE cca_appointments, cca_positions, ccas, users RESTART IDENTITY CASCADE;");
	lines.push("");

	// --- CCAs ---
	lines.push("-- CCAs (spec § 5.3)");
	for (const cca of CCAS) {
		lines.push(
			`INSERT INTO ccas (name, cca_type, cca_tier_type, description) VALUES (${q(cca.name)}, ${q(cca.type)}, ${q(cca.tierType)}, ${q(cca.description)});`,
		);
	}
	lines.push("");

	// --- Positions, two passes (FK self-reference) ---
	lines.push("-- CCA positions: insert all rows first, then patch reporting_position via UPDATE.");
	for (const pos of POSITIONS) {
		const ccaSubquery = `(SELECT id FROM ccas WHERE name = ${q(ccaName(pos.ccaKey))})`;
		const cap = pos.capacity === null ? "NULL" : String(pos.capacity);
		lines.push(
			`INSERT INTO cca_positions (cca_id, position_type, name, capacity) VALUES (${ccaSubquery}, ${q(pos.positionType)}, ${q(pos.name)}, ${cap});`,
		);
	}
	lines.push("");

	lines.push("-- Patch self-FKs (reporting_position).");
	for (const pos of POSITIONS) {
		if (pos.reportsTo === null) continue;
		const ccaSubquery = `(SELECT id FROM ccas WHERE name = ${q(ccaName(pos.ccaKey))})`;
		lines.push(
			`UPDATE cca_positions SET reporting_position = (` +
				`SELECT id FROM cca_positions WHERE cca_id = ${ccaSubquery} AND name = ${q(pos.reportsTo)}` +
				`) WHERE cca_id = ${ccaSubquery} AND name = ${q(pos.name)};`,
		);
	}
	lines.push("");

	// --- Users (only those with email; skip anonymous) ---
	lines.push("-- Users (spec § 5.2). The anonymous persona has no row.");
	for (const p of PERSONAS) {
		if (p.email === null) continue;
		lines.push(
			`INSERT INTO users (email, name, room, stay_period, matric) VALUES (${q(p.email)}, ${q(p.name)}, ${q(p.room)}, ${q(p.stayPeriod)}, ${q(p.matric)});`,
		);
	}
	lines.push("");

	// --- Appointments ---
	lines.push("-- CCA appointments.");
	for (const p of PERSONAS) {
		if (p.email === null) continue;
		for (const apt of p.appointments) {
			const ccaSubquery = `(SELECT id FROM ccas WHERE name = ${q(ccaName(apt.ccaKey))})`;
			const positionSubquery = `(SELECT id FROM cca_positions WHERE cca_id = ${ccaSubquery} AND name = ${q(apt.positionName)})`;
			const userSubquery = `(SELECT id FROM users WHERE email = ${q(p.email)})`;
			lines.push(
				`INSERT INTO cca_appointments (user_id, position_id, points) VALUES (${userSubquery}, ${positionSubquery}, ${String(apt.points)});`,
			);
		}
	}
	lines.push("");

	lines.push("COMMIT;");
	lines.push("");
	return lines.join("\n");
}

function ccaName(key: string): string {
	const cca = CCAS.find((c) => c.key === key);
	if (!cca) throw new Error(`Unknown CCA key in seed: ${key}`);
	return cca.name;
}

function renderMd(): string {
	const lines: string[] = [];
	lines.push("<!-- GENERATED by tests/fixtures/generate.ts — do not edit by hand. -->");
	lines.push("");
	lines.push("# Test personas");
	lines.push("");
	lines.push(
		"These personas are the single source of truth for test data. The TS source is `tests/fixtures/personas.ts`. After editing, run `npm run fixtures:generate` and commit the updated `seed.sql` and `PERSONAS.md`. CI enforces no drift via `npm run fixtures:check`.",
	);
	lines.push("");
	lines.push("## CCAs");
	lines.push("");
	lines.push("| Key | Name | Type | Tier |");
	lines.push("|---|---|---|---|");
	for (const cca of CCAS) {
		lines.push(`| \`${cca.key}\` | ${cca.name} | ${cca.type} | ${cca.tierType} |`);
	}
	lines.push("");

	lines.push("## Personas");
	lines.push("");
	lines.push("| Key | Email | Name | Room | Appointments | is_admin | is_jcrc | is_culture_sports_admin |");
	lines.push("|---|---|---|---|---|---|---|---|");
	for (const p of PERSONAS) {
		const appts = p.appointments.length === 0
			? "—"
			: p.appointments.map((a) => `${ccaName(a.ccaKey)} / ${a.positionName}`).join("; ");
		lines.push(
			`| \`${p.key}\` | ${p.email ?? "—"} | ${p.name ?? "—"} | ${p.room ?? "—"} | ${appts} | ${flag(p.expected.is_admin)} | ${flag(p.expected.is_jcrc)} | ${flag(p.expected.is_culture_sports_admin)} |`,
		);
	}
	lines.push("");

	lines.push("## Position graph");
	lines.push("");
	const byCca = new Map<string, PositionDef[]>();
	for (const pos of POSITIONS) {
		const arr = byCca.get(pos.ccaKey) ?? [];
		arr.push(pos);
		byCca.set(pos.ccaKey, arr);
	}
	for (const cca of CCAS) {
		const positions = byCca.get(cca.key) ?? [];
		if (positions.length === 0) continue;
		lines.push(`### ${cca.name}`);
		lines.push("");
		lines.push("| Position | Type | Reports to | Capacity |");
		lines.push("|---|---|---|---|");
		for (const pos of positions) {
			lines.push(`| ${pos.name} | ${pos.positionType} | ${pos.reportsTo ?? "—"} | ${pos.capacity ?? "—"} |`);
		}
		lines.push("");
	}
	return lines.join("\n");
}

function flag(b: boolean): string {
	return b ? "✓" : "—";
}

function main(): void {
	const sql = renderSql();
	const md = renderMd();
	fs.writeFileSync(SQL_FILE, sql, "utf8");
	fs.writeFileSync(MD_FILE, md, "utf8");
	console.log(`Wrote ${SQL_FILE} (${sql.length} bytes) and ${MD_FILE} (${md.length} bytes).`);
}

// Check mode: render in-memory, diff against disk, exit non-zero on drift.
function check(): void {
	const sql = renderSql();
	const md = renderMd();
	let drift = false;
	for (const [file, expected] of [
		[SQL_FILE, sql] as const,
		[MD_FILE, md] as const,
	]) {
		const actual = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
		if (actual !== expected) {
			drift = true;
			console.error(`DRIFT: ${file} is out of sync with TS sources.`);
		}
	}
	if (drift) {
		console.error("\nRun `npm run fixtures:generate` and commit the updated files.");
		process.exit(1);
	}
	console.log("Fixtures up to date.");
}

if (process.argv.includes("--check")) {
	check();
} else {
	main();
}
```

- [ ] **Step 4: Add npm scripts**

Open `/Users/bytedance/intranet-next-app/package.json`. The `scripts` block currently is (Phase 0 baseline):

```jsonc
{
  "scripts": {
    "build": "next build",
    "dev": "next dev",
    "format": "prettier --write \"src/**/*.{ts,tsx,js,jsx,json,css,md}\"",
    "format:check": "prettier --check \"src/**/*.{ts,tsx,js,jsx,json,css,md}\"",
    "lint": "next lint",
    "run-script": "ts-node -P tsconfig.scripts.json scripts/index.ts",
    "start": "next start",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

Update it to include the new scripts (preserve **tab** indentation — the file uses tabs):

```jsonc
{
  "scripts": {
    "build": "next build",
    "db:test:reset": "psql \"postgresql://postgres:postgres@127.0.0.1:54322/postgres\" -v ON_ERROR_STOP=1 -f tests/fixtures/seed.sql",
    "db:test:setup": "bash scripts/setup-test-db.sh",
    "dev": "next dev",
    "fixtures:check": "ts-node -P tsconfig.scripts.json tests/fixtures/generate.ts --check",
    "fixtures:generate": "ts-node -P tsconfig.scripts.json tests/fixtures/generate.ts",
    "format": "prettier --write \"src/**/*.{ts,tsx,js,jsx,json,css,md}\"",
    "format:check": "prettier --check \"src/**/*.{ts,tsx,js,jsx,json,css,md}\"",
    "lint": "next lint",
    "run-script": "ts-node -P tsconfig.scripts.json scripts/index.ts",
    "start": "next start",
    "test": "vitest run",
    "test:integration": "vitest run --config vitest.integration.config.mts",
    "test:integration:watch": "vitest --config vitest.integration.config.mts",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  }
}
```

(Scripts are sorted alphabetically; preserve the project's existing style. If the project's current ordering is **not** alphabetical, match its style; readability matters less than consistency with what's there.)

- [ ] **Step 5: Generate the fixtures**

Run:

```bash
npm run fixtures:generate
```

Expected: prints `Wrote tests/fixtures/seed.sql (...) and tests/fixtures/PERSONAS.md (...).`

- [ ] **Step 6: Inspect the generated files**

Open `tests/fixtures/seed.sql` and `tests/fixtures/PERSONAS.md` in an editor. Spot-check:
- `seed.sql` starts with the generator header and ends with `COMMIT;`. There are 8 `INSERT INTO ccas`, 26 `INSERT INTO cca_positions`, 13 `UPDATE ... reporting_position`, 15 `INSERT INTO users`, and 17 `INSERT INTO cca_appointments` (15 personas, 2 with two appointments).
- `PERSONAS.md` shows the persona table with checkmarks matching the `expected` values.

If counts are off, fix `personas.ts` / `positions.ts` and re-run.

- [ ] **Step 7: Verify `fixtures:check` passes**

Run:

```bash
npm run fixtures:check
```

Expected: prints `Fixtures up to date.` and exits 0.

- [ ] **Step 8: Verify `fixtures:check` catches drift**

Manually edit `tests/fixtures/seed.sql` (e.g., delete a line), then:

```bash
npm run fixtures:check
```

Expected: exits non-zero, prints `DRIFT: ...` and the instruction to regenerate. Now run `npm run fixtures:generate` to restore the file, and confirm `npm run fixtures:check` passes again.

- [ ] **Step 9: Run all checks together**

```bash
npm run typecheck && npm run lint && npm test
```

Expected: all pass. (The new fixture files are pure TS data with no runtime side effects; nothing should break.)

- [ ] **Step 10: Commit**

```bash
git add tsconfig.scripts.json package.json package-lock.json tests/fixtures/generate.ts tests/fixtures/seed.sql tests/fixtures/PERSONAS.md
git commit -m "test(fixtures): add generator script and commit generated seed.sql + PERSONAS.md"
```

---

## Task 6: Create the test-DB bootstrap script

**Files:**
- Create: `scripts/setup-test-db.sh`

**Rationale:** Spec § 7.4.1 — the script boots Supabase, applies the canonical Liquibase changelog from `../intranet`, and applies `seed.sql`. Used both locally (`npm run db:test:setup`) and (later) by CI.

- [ ] **Step 1: Create the script**

Write `/Users/bytedance/intranet-next-app/scripts/setup-test-db.sh`:

```bash
#!/usr/bin/env bash
# scripts/setup-test-db.sh
#
# Boot the local Supabase stack, apply the canonical schema from the sibling
# intranet repo via Liquibase, and load tests/fixtures/seed.sql.
#
# Usage:
#   ./scripts/setup-test-db.sh            # full bootstrap
#   ./scripts/setup-test-db.sh --reseed   # skip supabase start + liquibase; just rerun seed.sql
#
# Env vars:
#   INTRANET_REPO_PATH   absolute or relative path to the intranet repo
#                        (default: ../intranet, resolved from this script's directory)
#   SUPABASE_DB_URL      override DB connection string
#                        (default: postgresql://postgres:postgres@127.0.0.1:54322/postgres)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

INTRANET_REPO_PATH="${INTRANET_REPO_PATH:-$REPO_ROOT/../intranet}"
SUPABASE_DB_URL="${SUPABASE_DB_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"
LIQUIBASE_CHANGELOG="$INTRANET_REPO_PATH/db/changelogs/qa.changelog-master.xml"

RESEED_ONLY=0
if [[ "${1:-}" == "--reseed" ]]; then
	RESEED_ONLY=1
fi

log() { printf '[setup-test-db] %s\n' "$*"; }
die() { printf '[setup-test-db] ERROR: %s\n' "$*" >&2; exit 1; }

if [[ ! -f "$LIQUIBASE_CHANGELOG" ]]; then
	die "Liquibase changelog not found at $LIQUIBASE_CHANGELOG. Set INTRANET_REPO_PATH or clone the intranet repo."
fi

if [[ "$RESEED_ONLY" -eq 0 ]]; then
	if ! command -v supabase >/dev/null 2>&1; then
		die "supabase CLI not found. brew install supabase/tap/supabase"
	fi
	if ! command -v liquibase >/dev/null 2>&1; then
		die "liquibase not found. brew install liquibase"
	fi

	log "Starting Supabase (this can take ~30-60s on first run)…"
	supabase start

	log "Applying Liquibase changelog from $INTRANET_REPO_PATH"
	liquibase \
		--changeLogFile="$LIQUIBASE_CHANGELOG" \
		--url="jdbc:postgresql://127.0.0.1:54322/postgres" \
		--username=postgres \
		--password=postgres \
		--contexts=local \
		update
fi

log "Ensuring fixtures are up to date"
npm run --silent fixtures:check || {
	log "Fixtures drift detected — regenerating"
	npm run --silent fixtures:generate
}

log "Applying seed.sql"
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f "$REPO_ROOT/tests/fixtures/seed.sql"

log "Done. DB ready at $SUPABASE_DB_URL"
```

- [ ] **Step 2: Make it executable**

Run:

```bash
chmod +x scripts/setup-test-db.sh
```

- [ ] **Step 3: Run the full bootstrap end-to-end**

Run:

```bash
./scripts/setup-test-db.sh
```

Expected timeline:
- `supabase start`: ~30-60s on first run, ~5s on subsequent
- Liquibase apply: ~10-30s
- `psql -f seed.sql`: ~1-2s
- Final log: `Done. DB ready at postgresql://postgres:postgres@127.0.0.1:54322/postgres`

If Liquibase fails complaining about missing schemas (`auth`, `storage`), confirm the changelog includes `qa/` first; `qa.changelog-master.xml` already does (`<includeAll path="qa/" />` is the first include — see `../intranet/db/changelogs/qa.changelog-master.xml`). If it fails complaining about port conflicts on 54322, run `supabase stop` then retry.

If Liquibase succeeds but seed fails with a CHECK violation on `users.room`, the room formatting in `personas.ts` is wrong. Cross-reference the regex in `../intranet/db/changelogs/table/core/02.user.sql`.

- [ ] **Step 4: Verify data landed**

Run:

```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c "SELECT count(*) AS ccas FROM ccas; SELECT count(*) AS positions FROM cca_positions; SELECT count(*) AS users FROM users; SELECT count(*) AS appointments FROM cca_appointments;"
```

Expected (matches Task 5 step 6): ccas=8, positions=26, users=15, appointments=17.

- [ ] **Step 5: Smoke-test the canonical derived-flag view from raw SQL**

Run:

```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" <<'SQL'
SELECT u.email,
       (SELECT bool_or(
           EXISTS (SELECT 1 FROM cca_positions child WHERE child.reporting_position = p.id)
       ) FROM cca_appointments a
         JOIN cca_positions p ON p.id = a.position_id
        WHERE a.user_id = u.id) AS is_admin_computed
FROM users u
ORDER BY u.email;
SQL
```

Expected: emails matching `expected.is_admin` in personas.ts (declan, kai, layla, ezra, brielle, nova, willow, sage = true; others = false).

If any row mismatches, the position graph in `positions.ts` doesn't materialize the chain the spec assumes. Fix the graph and re-run `npm run fixtures:generate && ./scripts/setup-test-db.sh --reseed`.

- [ ] **Step 6: Test the --reseed shortcut**

Run:

```bash
./scripts/setup-test-db.sh --reseed
```

Expected: skips `supabase start` and Liquibase, just truncates + re-inserts. Fast (~1s).

- [ ] **Step 7: Stop Supabase to leave the env clean**

```bash
supabase stop
```

- [ ] **Step 8: Commit**

```bash
git add scripts/setup-test-db.sh
git commit -m "test(infra): add scripts/setup-test-db.sh to bootstrap Supabase + Liquibase + seed"
```

---

## Task 7: Add the integration Vitest config

**Files:**
- Create: `vitest.integration.config.mts`

**Rationale:** Spec § 7.4.1 — integration tests need `environment: 'node'`, longer timeouts, and isolation from the unit/component projects (which run on every `npm test`). A separate config keeps `npm test` fast.

- [ ] **Step 1: Create the config**

Write `/Users/bytedance/intranet-next-app/vitest.integration.config.mts`:

```ts
import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

// Integration test config — runs against a live local Supabase / Postgres.
// Required env: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_DB_URL
// (populated by `scripts/setup-test-db.sh` writing .env.test, or by `supabase status`).
export default defineConfig({
	plugins: [tsconfigPaths()],
	test: {
		name: "integration",
		environment: "node",
		include: ["tests/integration/**/*.test.ts"],
		setupFiles: ["./tests/integration/setup.ts"],
		globals: true,
		testTimeout: 30_000,
		hookTimeout: 30_000,
		// File-level parallelism via forks. Each file gets a fresh worker so any
		// module-level connection state doesn't bleed across files.
		pool: "forks",
		poolOptions: {
			forks: {
				singleFork: false,
			},
		},
	},
});
```

- [ ] **Step 2: Verify the config parses**

Run:

```bash
npx vitest --config vitest.integration.config.mts list
```

Expected: lists 0 tests (we haven't written any yet). No config errors.

- [ ] **Step 3: Commit**

```bash
git add vitest.integration.config.mts
git commit -m "test(infra): add vitest.integration.config.mts"
```

---

## Task 8: Integration setup helpers — admin client, `withRollback`, `resetDb`, persona session cache

**Files:**
- Create: `tests/integration/setup.ts`
- Create: `tests/integration/helpers.ts`

**Rationale:** Spec § 7.4.2 — `withRollback` for per-test isolation. Spec § 7.4.3 — persona sessions are minted once globally and reused. The setup module reads Supabase URLs/keys from env (populated from `supabase status` or `.env.test`) so the same code works locally and in CI.

We split this into two files:
- `setup.ts` — Vitest globalSetup-style: loads env, exports module-level pool / admin client, pre-mints persona sessions.
- `helpers.ts` — the test-side API: `withRollback`, `resetDb`, `personaSession(key)`.

- [ ] **Step 1: Verify Supabase env is reachable**

Before writing code, confirm `supabase status` prints the values the helpers will consume. Boot Supabase:

```bash
supabase start
supabase status
```

Note the API URL (`http://127.0.0.1:54321`), DB URL, anon key, and service-role key. Add them to a new file `.env.test` at repo root (this file is gitignored — see Step 6):

```
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_ANON_KEY=<paste anon key from supabase status>
SUPABASE_SERVICE_ROLE_KEY=<paste service_role key from supabase status>
SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres
```

(These are local-only ephemeral keys. They are signed with the default Supabase CLI dev JWT secret and are not sensitive.)

- [ ] **Step 2: Create `tests/integration/setup.ts`**

Write `/Users/bytedance/intranet-next-app/tests/integration/setup.ts`:

```ts
// Integration test setup — runs once per Vitest worker. Loads env, opens a pg pool,
// creates an admin Supabase client, and pre-mints sessions for every persona.
//
// Imported via Vitest's `setupFiles` in vitest.integration.config.mts.

import { config as loadDotenv } from "dotenv";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { Pool } from "pg";
import { afterAll, beforeAll } from "vitest";
import { authenticatedPersonas } from "../fixtures/personas";
import type { PersonaKey } from "../fixtures/types";

loadDotenv({ path: ".env.test" });

const SUPABASE_URL = required("SUPABASE_URL");
const SUPABASE_ANON_KEY = required("SUPABASE_ANON_KEY");
const SUPABASE_SERVICE_ROLE_KEY = required("SUPABASE_SERVICE_ROLE_KEY");
const SUPABASE_DB_URL = required("SUPABASE_DB_URL");

function required(name: string): string {
	const v = process.env[name];
	if (!v) {
		throw new Error(
			`Integration tests require ${name} in env. Run \`./scripts/setup-test-db.sh\` and copy values from \`supabase status\` into .env.test.`,
		);
	}
	return v;
}

export const pgPool = new Pool({ connectionString: SUPABASE_DB_URL, max: 8 });

export const supabaseAdmin: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
	auth: { autoRefreshToken: false, persistSession: false },
});

export const supabaseAnonClientFactory = () =>
	createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
		auth: { autoRefreshToken: false, persistSession: false },
	});

export type PersonaSession = {
	accessToken: string;
	refreshToken: string;
	userId: string; // Supabase auth.users.id (UUID), NOT public.users.id (int).
	email: string;
};

// Lazy cache so unrelated tests don't pay the cost of minting 15 sessions.
const sessionCache = new Map<PersonaKey, PersonaSession>();

export async function getPersonaSession(key: PersonaKey): Promise<PersonaSession> {
	if (key === "anonymous") {
		throw new Error("anonymous persona has no session; use the anon client directly");
	}
	const cached = sessionCache.get(key);
	if (cached) return cached;

	const persona = authenticatedPersonas().find((p) => p.key === key);
	if (!persona || !persona.email) throw new Error(`No email for persona ${key}`);

	// Idempotent create: if user already exists, sign in to retrieve tokens.
	const password = `persona-${key}-${SUPABASE_SERVICE_ROLE_KEY.slice(-6)}`;
	const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
		email: persona.email,
		password,
		email_confirm: true,
	});

	let userId: string;
	if (createErr && !/already.*registered|already exists/i.test(createErr.message)) {
		throw new Error(`admin.createUser(${persona.email}) failed: ${createErr.message}`);
	}
	if (created?.user) {
		userId = created.user.id;
	} else {
		const { data: list, error: listErr } = await supabaseAdmin.auth.admin.listUsers();
		if (listErr) throw listErr;
		const found = list.users.find((u) => u.email === persona.email);
		if (!found) throw new Error(`Could not resolve auth user for ${persona.email}`);
		userId = found.id;
		// Reset password to the deterministic one in case it was created with a different value previously.
		const { error: updErr } = await supabaseAdmin.auth.admin.updateUserById(userId, { password });
		if (updErr) throw updErr;
	}

	const anon = supabaseAnonClientFactory();
	const { data: signIn, error: signInErr } = await anon.auth.signInWithPassword({
		email: persona.email,
		password,
	});
	if (signInErr || !signIn.session) {
		throw new Error(`signInWithPassword(${persona.email}) failed: ${signInErr?.message ?? "no session"}`);
	}

	const session: PersonaSession = {
		accessToken: signIn.session.access_token,
		refreshToken: signIn.session.refresh_token,
		userId,
		email: persona.email,
	};
	sessionCache.set(key, session);
	return session;
}

beforeAll(async () => {
	// Ping the DB once so connection failures surface clearly before any test runs.
	const r = await pgPool.query("SELECT 1 AS ok");
	if (r.rows[0]?.ok !== 1) throw new Error("pg pool health check failed");
});

afterAll(async () => {
	await pgPool.end();
});

export { authenticatedPersonas };
```

- [ ] **Step 3: Create `tests/integration/helpers.ts`**

Write `/Users/bytedance/intranet-next-app/tests/integration/helpers.ts`:

```ts
import * as fs from "node:fs";
import * as path from "node:path";
import { pgPool } from "./setup";
import type { PoolClient } from "pg";

const SEED_SQL = fs.readFileSync(
	path.resolve(__dirname, "../fixtures/seed.sql"),
	"utf8",
);

// Run a test body inside a transaction that is always rolled back. Use for the
// vast majority of integration tests: zero cross-test pollution, zero re-seed cost.
//
//   await withRollback(async (client) => {
//     await client.query("INSERT INTO ...");
//     // assertions
//   });
//
export async function withRollback<T>(
	body: (client: PoolClient) => Promise<T>,
): Promise<T> {
	const client = await pgPool.connect();
	try {
		await client.query("BEGIN");
		const out = await body(client);
		return out;
	} finally {
		try {
			await client.query("ROLLBACK");
		} finally {
			client.release();
		}
	}
}

// For tests that exercise RPCs which manage their own transactions, or for
// `beforeAll`-style hard resets in a single file.
export async function resetDb(): Promise<void> {
	const client = await pgPool.connect();
	try {
		await client.query(SEED_SQL);
	} finally {
		client.release();
	}
}
```

- [ ] **Step 4: Smoke-test the imports**

Run:

```bash
npm run typecheck
```

Expected: passes. (No tests yet; we just verify the helpers compile.)

- [ ] **Step 5: Add `.env.test` to `.gitignore`**

Open `/Users/bytedance/intranet-next-app/.gitignore` and add (at the bottom):

```
# Local-only Supabase env for integration tests (regenerated from `supabase status`).
.env.test
```

- [ ] **Step 6: Commit**

```bash
git add tests/integration/setup.ts tests/integration/helpers.ts .gitignore
git commit -m "test(integration): add setup with admin client, persona session cache, withRollback"
```

---

## Task 9: `pgClientAsPersona` helper

**Files:**
- Create: `src/test-utils/pg-client.ts`

**Rationale:** Spec § 7.5 will need this for RLS tests, but it also serves any integration test that wants to bypass the route layer and assert directly on the DB with a specific persona's identity. The helper:
1. Opens a raw `pg.Client` (not from the pool — RLS-bound sessions can't share connections).
2. Patches `auth.email()` to read `current_setting('request.jwt.claims', true)::json->>'email'`, since the dummy auth schema returns NULL otherwise.
3. Sets `request.jwt.claims` to the persona's email + role and switches to the `authenticated` role.
4. Returns a tidy `{ query, end }` interface.

The `auth.email()` override is set once per session (it's a `CREATE OR REPLACE` in the qa changelog at startup is too late — we need the override to read from the GUC). We patch it idempotently per connection.

- [ ] **Step 1: Create the helper**

Write `/Users/bytedance/intranet-next-app/src/test-utils/pg-client.ts`:

```ts
import { Client } from "pg";
import { personaByKey } from "../../tests/fixtures/personas";
import type { PersonaKey } from "../../tests/fixtures/types";

const DB_URL =
	process.env.SUPABASE_DB_URL ??
	"postgresql://postgres:postgres@127.0.0.1:54322/postgres";

// Patch auth.email() to read from JWT claims set via SET LOCAL. Idempotent —
// safe to run on every connection. (The qa stub installs a NULL-returning
// auth.email(); production Supabase reads from request.jwt.claims, so this
// matches production behavior.)
const PATCH_AUTH_EMAIL = `
CREATE OR REPLACE FUNCTION auth.email()
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
	SELECT (current_setting('request.jwt.claims', true)::json ->> 'email')::text;
$$;
`;

let patchApplied = false;

export type PersonaPgClient = {
	query: Client["query"];
	end: () => Promise<void>;
};

export async function pgClientAsPersona(key: PersonaKey): Promise<PersonaPgClient> {
	const persona = personaByKey(key);
	const client = new Client({ connectionString: DB_URL });
	await client.connect();

	if (!patchApplied) {
		// Run via an admin connection (the one we just opened is admin until we
		// switch role below) — patch is idempotent and cheap, so we just run it once
		// per process and trust subsequent connections inherit the function definition.
		await client.query(PATCH_AUTH_EMAIL);
		patchApplied = true;
	}

	if (key === "anonymous") {
		await client.query("SET ROLE anon");
		return wrap(client);
	}

	if (!persona.email) {
		throw new Error(`Persona ${key} has no email; cannot impersonate authenticated`);
	}

	const claims = JSON.stringify({ email: persona.email, role: "authenticated" });
	// Set the GUC at the SESSION level (not LOCAL) so functions called outside
	// an explicit transaction can still read it.
	await client.query("SELECT set_config('request.jwt.claims', $1, false)", [claims]);
	await client.query("SET ROLE authenticated");

	return wrap(client);
}

function wrap(client: Client): PersonaPgClient {
	return {
		query: client.query.bind(client),
		end: async () => {
			try {
				await client.query("RESET ROLE");
				await client.query("SELECT set_config('request.jwt.claims', '', false)");
			} finally {
				await client.end();
			}
		},
	};
}
```

- [ ] **Step 2: Typecheck**

Run:

```bash
npm run typecheck
```

Expected: passes.

- [ ] **Step 3: Commit**

```bash
git add src/test-utils/pg-client.ts
git commit -m "test(utils): add pgClientAsPersona for RLS-aware DB tests"
```

---

## Task 10: `createApiRequest` helper

**Files:**
- Create: `src/test-utils/api-request.ts`

**Rationale:** Spec § 7.4.3 — integration tests import route handlers directly and call them with a `NextRequest` that carries a persona's auth cookies. The handler then resolves the user via the standard `@/utils/supabase/server` path, exercising the real cookie → JWT → user flow.

Supabase SSR stores the auth token under a cookie named `sb-<project-ref>-auth-token`. For local Supabase, the project ref is the suffix of the API URL. We compute it from `SUPABASE_URL`.

- [ ] **Step 1: Create the helper**

Write `/Users/bytedance/intranet-next-app/src/test-utils/api-request.ts`:

```ts
import { NextRequest } from "next/server";
import { getPersonaSession } from "../../tests/integration/setup";
import type { PersonaKey } from "../../tests/fixtures/types";

type Method = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

export type CreateApiRequestOptions = {
	persona: PersonaKey;
	method: Method;
	path: string; // path-only, e.g. "/api/user" or "/api/cca/5/members"
	body?: unknown;
	searchParams?: Record<string, string | undefined>;
	headers?: Record<string, string>;
};

const BASE_URL = "http://localhost:3000";

function projectRef(): string {
	// Supabase local exposes its API at http://127.0.0.1:54321; the SSR cookie name is
	// `sb-<project_ref>-auth-token`. The CLI uses the host portion of the URL as ref —
	// stripping the port — but practically the local CLI always uses literal "127" here.
	// Match Supabase JS's own logic: parseHost(supabaseUrl).split(".")[0]
	const url = new URL(process.env.SUPABASE_URL ?? "http://127.0.0.1:54321");
	return url.hostname.split(".")[0];
}

export async function createApiRequest(opts: CreateApiRequestOptions): Promise<NextRequest> {
	const url = new URL(opts.path, BASE_URL);
	for (const [k, v] of Object.entries(opts.searchParams ?? {})) {
		if (v !== undefined) url.searchParams.set(k, v);
	}

	const headers = new Headers(opts.headers);
	headers.set("content-type", "application/json");

	let cookie = "";
	if (opts.persona !== "anonymous") {
		const session = await getPersonaSession(opts.persona);
		const cookieName = `sb-${projectRef()}-auth-token`;
		const cookieValue = JSON.stringify([
			session.accessToken,
			session.refreshToken,
			null,
			null,
			null,
		]);
		cookie = `${cookieName}=${encodeURIComponent(cookieValue)}`;
		headers.set("cookie", cookie);
	}

	const init: { method: Method; headers: Headers; body?: string } = {
		method: opts.method,
		headers,
	};
	if (opts.body !== undefined && opts.method !== "GET") {
		init.body = JSON.stringify(opts.body);
	}

	return new NextRequest(url.toString(), init);
}
```

- [ ] **Step 2: Typecheck**

Run:

```bash
npm run typecheck
```

Expected: passes.

- [ ] **Step 3: Commit**

```bash
git add src/test-utils/api-request.ts
git commit -m "test(utils): add createApiRequest for route-handler integration tests"
```

---

## Task 11: `renderWithProviders` and the test-utils barrel

**Files:**
- Create: `src/test-utils/render.tsx`
- Create: `src/test-utils/factories.ts`
- Create: `src/test-utils/index.ts`

**Rationale:** Spec § 6 — `renderWithProviders` is part of the test-utils surface even though Phase 1 doesn't author component tests that use it. We land the shape now so Phase 2's component tests can adopt it. `factories.ts` is intentionally empty (just a placeholder export); ad-hoc factories will be added as needs arise.

Important: this is a Vite-compiled `.tsx`. It must not import `react-testing-library` at module-evaluation time for Node-only integration tests. We use static imports — the Vitest config splits projects by file glob, so this file only ever loads under the component env.

- [ ] **Step 1: Inspect the existing AuthContext shape**

Run:

```bash
cat src/context/AuthContext.tsx | head -60
```

Note what the `AuthProvider` accepts (likely it fetches user info from `/api/user` on mount). For test rendering we need to bypass that fetch — either via `vi.mock('@/context/AuthContext', ...)` per-test or by exporting a `TestAuthProvider` from `render.tsx` that injects a user directly.

We'll provide a lightweight injection point — `renderWithProviders` accepts an optional `user` and stubs the AuthContext via a separately exported `MockAuthContext.Provider`. We don't import the real `AuthProvider` at all; the test-utils render path renders a stand-in.

- [ ] **Step 2: Create `src/test-utils/render.tsx`**

Write `/Users/bytedance/intranet-next-app/src/test-utils/render.tsx`:

```tsx
import { render, type RenderOptions, type RenderResult } from "@testing-library/react";
import { ThemeProvider } from "next-themes";
import * as React from "react";

// Mock auth shape — keep in sync with src/context/AuthContext.tsx surface as
// consumers evolve. Tests that need the real provider should construct it directly.
export type MockUser = {
	id: number;
	email: string;
	name: string;
	is_admin: boolean;
	is_jcrc: boolean;
	is_culture_sports_admin: boolean;
};

const MockAuthContext = React.createContext<{
	user: MockUser | null;
	loading: boolean;
	signIn: () => Promise<void>;
	signOut: () => Promise<void>;
} | null>(null);

export function useMockAuth() {
	const ctx = React.useContext(MockAuthContext);
	if (!ctx) throw new Error("useMockAuth used outside MockAuthProvider");
	return ctx;
}

type RenderWithProvidersOptions = RenderOptions & {
	user?: MockUser | null;
};

export function renderWithProviders(
	ui: React.ReactElement,
	options: RenderWithProvidersOptions = {},
): RenderResult {
	const { user = null, ...renderOptions } = options;

	const noop = async () => {};

	function Wrapper({ children }: { children: React.ReactNode }) {
		return (
			<ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
				<MockAuthContext.Provider value={{ user, loading: false, signIn: noop, signOut: noop }}>
					{children}
				</MockAuthContext.Provider>
			</ThemeProvider>
		);
	}

	return render(ui, { wrapper: Wrapper, ...renderOptions });
}
```

This file imports `@testing-library/react` which is **not** in `package.json` yet. We'll install it now.

- [ ] **Step 3: Install React Testing Library**

Run:

```bash
npm install --save-dev @testing-library/react@^16 @testing-library/jest-dom@^6 @testing-library/user-event@^14
```

Expected: three new devDeps added.

- [ ] **Step 4: Create `src/test-utils/factories.ts`**

Write `/Users/bytedance/intranet-next-app/src/test-utils/factories.ts`:

```ts
// Placeholder for ad-hoc data factories. Add domain-specific builders here as
// needed — e.g. `buildSubsidyDeclaration({ overrides })`. Phase 1 ships an
// empty module so the import path is stable.

export {};
```

- [ ] **Step 5: Create `src/test-utils/index.ts`**

Write `/Users/bytedance/intranet-next-app/src/test-utils/index.ts`:

```ts
export * from "./api-request";
export * from "./factories";
export * from "./pg-client";
export * from "./render";
```

- [ ] **Step 6: Typecheck**

Run:

```bash
npm run typecheck
```

Expected: passes. If TypeScript flags missing types for `@testing-library/react`, ensure `tsconfig.json`'s `compilerOptions.types` is not restricting types; the `@types/react` already declares JSX, and `@testing-library/react` ships its own types.

- [ ] **Step 7: Run the existing unit + component suite**

Run:

```bash
npm test
```

Expected: no regressions. New test-utils files have no `.test.*` siblings yet, so the suite size is unchanged.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json src/test-utils/render.tsx src/test-utils/factories.ts src/test-utils/index.ts
git commit -m "test(utils): add renderWithProviders, factories placeholder, and barrel re-export"
```

---

## Task 12: Smoke integration test for the persona graph

**Files:**
- Create: `tests/integration/smoke/derived-flags.test.ts`

**Rationale:** Validates the entire Phase 1 pipeline end-to-end:
- DB is up
- Liquibase applied
- seed.sql loaded
- `internal.auth_user_id()` resolves the persona via the patched `auth.email()`
- The `authenticated_user_info` view computes `is_admin`, `is_jcrc`, `is_culture_sports_admin` correctly for every persona

If this test passes, Phase 2 can write the matrix on solid ground.

- [ ] **Step 1: Make sure the test DB is running**

Run:

```bash
./scripts/setup-test-db.sh
```

Confirm it ends with the "DB ready" message and `.env.test` has the right values (Task 8 step 1).

- [ ] **Step 2: Create the test**

Write `/Users/bytedance/intranet-next-app/tests/integration/smoke/derived-flags.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { pgClientAsPersona } from "../../../src/test-utils/pg-client";
import { authenticatedPersonas } from "../../fixtures/personas";

describe("authenticated_user_info derived flags match personas.ts expectations", () => {
	for (const persona of authenticatedPersonas()) {
		it(`${persona.key} (${persona.email})`, async () => {
			const client = await pgClientAsPersona(persona.key);
			try {
				const result = await client.query(
					"SELECT is_admin, is_jcrc, is_culture_sports_admin FROM authenticated_user_info",
				);
				expect(result.rows).toHaveLength(1);
				const row = result.rows[0];
				expect({
					is_admin: row.is_admin,
					is_jcrc: row.is_jcrc,
					is_culture_sports_admin: row.is_culture_sports_admin,
				}).toEqual(persona.expected);
			} finally {
				await client.end();
			}
		});
	}

	it("anonymous returns zero rows from authenticated_user_info", async () => {
		const client = await pgClientAsPersona("anonymous");
		try {
			const result = await client.query("SELECT * FROM authenticated_user_info");
			expect(result.rows).toHaveLength(0);
		} finally {
			await client.end();
		}
	});
});
```

- [ ] **Step 3: Run only the integration suite**

Run:

```bash
npm run test:integration
```

Expected: 16 tests pass (15 authenticated + 1 anonymous). Runtime ~5-15s.

If a derived-flag assertion fails, the position graph in `positions.ts` is inconsistent with the persona's `expected` flags. Either:
- Fix the persona's `expected` (if the graph is what we want)
- Fix the graph in `positions.ts` (if the persona spec is what we want)
- Run `npm run fixtures:generate && ./scripts/setup-test-db.sh --reseed && npm run test:integration` after either change.

If the test fails with "permission denied for view authenticated_user_info" — the `authenticated` role isn't granted SELECT on the view. The qa changelog already grants it (see `../intranet/db/changelogs/view/core/03.authenticated-user-info.sql:93`). Confirm Liquibase actually applied — re-run `./scripts/setup-test-db.sh`.

If the test fails because `auth.email()` returns NULL — the GUC patch in `pgClientAsPersona` didn't take effect. Spot-check by running:

```bash
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -c "\df+ auth.email"
```

The function body should now contain `current_setting('request.jwt.claims'...)`. If it still returns `NULL`, the patch didn't run — verify `pgClientAsPersona` was actually invoked before the test query.

- [ ] **Step 4: Commit**

```bash
git add tests/integration/smoke/derived-flags.test.ts
git commit -m "test(integration): smoke test asserting persona graph yields expected derived flags"
```

---

## Task 13: Wire `fixtures:check` into CI

**Files:**
- Modify: `.github/workflows/2-merge-request-ci.yml`
- Modify: `.github/workflows/1-feature-branch-ci.yml`

**Rationale:** Spec § 7.1 — `fixtures:check` is a static gate. Adding it to both CI workflows means a PR that edits `personas.ts` without regenerating `seed.sql` fails fast. **No integration job is added in this phase** — that's Phase 2's responsibility, alongside the matrix that exercises it.

- [ ] **Step 1: Open `.github/workflows/2-merge-request-ci.yml`**

Read the current file (already inspected in plan prep — relevant snippet):

```yaml
      - name: 8. 🔎 Typecheck
        run: ${{ steps.detect-pm.outputs.manager }} run typecheck

      - name: 9. 🧪 Unit + Component Tests
        run: ${{ steps.detect-pm.outputs.manager }} test

      - name: 10. 🚧 Build with Next.js
        run: ${{ steps.detect-pm.outputs.manager }} run build
```

Insert a new step between "Typecheck" and "Unit + Component Tests". Renumber the trailing steps. The final ordering should be:

```yaml
      - name: 8. 🔎 Typecheck
        run: ${{ steps.detect-pm.outputs.manager }} run typecheck

      - name: 9. 🧾 Fixtures Drift Check
        run: ${{ steps.detect-pm.outputs.manager }} run fixtures:check

      - name: 10. 🧪 Unit + Component Tests
        run: ${{ steps.detect-pm.outputs.manager }} test

      - name: 11. 🚧 Build with Next.js
        run: ${{ steps.detect-pm.outputs.manager }} run build
```

- [ ] **Step 2: Open `.github/workflows/1-feature-branch-ci.yml`**

Apply the same insertion pattern: a "Fixtures Drift Check" step that runs `npm run fixtures:check` between the typecheck step and the test step. Renumber subsequent steps to stay sequential.

(If `1-feature-branch-ci.yml`'s step numbering differs from `2-*`, match the local convention — insert the new step adjacent to typecheck, renumber forward.)

- [ ] **Step 3: Run the full local CI sequence**

Run:

```bash
npm run format:check && npm run lint && npm run typecheck && npm run fixtures:check && npm test && npm run build
```

Expected: all six exit 0.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/1-feature-branch-ci.yml .github/workflows/2-merge-request-ci.yml
git commit -m "ci(testing): gate on tests/fixtures drift via npm run fixtures:check"
```

- [ ] **Step 5: (Optional) Push to a throwaway branch and verify CI passes**

```bash
git push origin HEAD:test-phase-1-ci
gh pr create --title "test: verify phase 1 fixtures CI gate" --body "Throwaway PR to confirm fixtures:check runs in CI. Close without merging."
```

Watch the run; confirm the new step appears in both workflows. Close the PR.

---

## Self-review checklist

- [ ] All 13 tasks have exact file paths.
- [ ] Every code block is complete and runnable — no `// TODO`, no `// ... existing code`, no "fill in details".
- [ ] Each task ends with a commit step (Task 1 step 6, Task 2 step 4, etc.).
- [ ] No references to fixtures, personas, or matrix things not defined in this plan or already present in code:
  - `AUTH_MATRIX` is not referenced — that's Phase 2.
  - `RouteAuthSpec` is not referenced — that's Phase 2.
  - RLS-test files are not created — that's Phase 3.
  - E2E specs are not created — that's Phase 4.
- [ ] Type consistency: `PersonaKey`, `CcaKey`, `Persona`, `Cca`, `PositionDef`, `Appointment` all defined once in `types.ts` and consistently referenced.
- [ ] Spec coverage:
  - § 5 (test data) → Tasks 2, 3, 4, 5 (types, ccas, positions, personas, generator, generated artifacts).
  - § 6 (repo layout) → Tasks 9, 10, 11 (src/test-utils/*) and Tasks 7, 8, 12 (tests/integration/*).
  - § 7.4.1 (db setup) → Tasks 1, 6, 8 (Supabase config, bootstrap script, env loading).
  - § 7.4.2 (isolation) → Task 8 (withRollback).
  - § 7.4.3 (calling route handlers) → Task 10 (createApiRequest) + persona session cache in Task 8.
  - § 7.4.5 (behavioral integration tests) → Task 12 lands one smoke test as proof-of-concept; further behavioral tests are Phase 2 scope.
  - § 7.1 fixtures check → Task 5 + Task 13.
- [ ] Phase 1 explicit exclusions stated up front: no auth matrix, no RLS, no E2E, no integration CI job.

## What this does NOT do (deferred)

- **§ 7.4.4 (`AUTH_MATRIX` + completeness check)** — Phase 2.
- **§ 7.5 (RLS tests)** — Phase 3. `pgClientAsPersona` exists for this layer but no RLS test files yet.
- **§ 7.6 (E2E + Playwright)** — Phase 4. `renderWithProviders` exists but no Playwright config.
- **§ 8 integration CI job** — Phase 2 lands the integration job alongside the matrix it exercises.
- **Behavioral domain tests** (rankings, holiday subsidy, etc., per § 7.4.5) — beyond the single smoke test, these are Phase 2 scope.
- **Coverage reporting** — deferred indefinitely per spec § 3.
