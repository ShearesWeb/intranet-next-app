# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

A Next.js 15 intranet app for Sheares Hall residents to manage CCAs (Co-Curricular Activities), member rankings, CCA allocation, holiday subsidies, and facilities — backed by Supabase, deployed on Cloudflare Workers via OpenNext.

**Core constraint**: No user data may leak between sessions (session isolation is the main correctness invariant).

## Commands

**`package.json` scripts are strictly the Next.js CLI commands.** Everything else
lives in the **Makefile** — `make help` lists targets.

```bash
# Next.js (package.json)
npm run dev                    # Next.js dev server
npm run build                  # Next.js build
npm run start                  # Next.js production server
npm run lint                   # next lint

# Quality + tests (Makefile)
make check                     # format-check + typecheck + test
make format                    # Prettier write  (format-check to verify)
make typecheck                 # tsc --noEmit (app + test scopes)
make test                      # Unit + component (Vitest)

# Integration DB + suite (Makefile)
make db-up                     # Start Postgres + schema + seed + PostgREST
make test-integration          # Route-handler suite (needs db-up)
make db-down                   # Stop it

# Manual QA (Makefile)
make e2e-personas              # List personas with role flags
make e2e-login PERSONA=declan  # Print a magic-link to log in as persona (no browser)

# Cloudflare (Makefile)
make preview                   # Build + run locally via wrangler dev
make deploy                    # Build + deploy to production ("intranet")
make deploy ENV=preprod        # Build + deploy to "intranet-preprod"
make cf-typegen                # Generate cloudflare-env.d.ts from wrangler bindings
```

**Running a single test**: `npx vitest run src/lib/ranking/cca-ranking-metrics.test.ts`

## Testing architecture

Three automated layers + manual QA via persona login — see `docs/TESTING.md` for full details:

| Layer | Tool | Location | Runs in CI |
|---|---|---|---|
| Unit | Vitest | `src/**/*.test.ts` | every push |
| Component | Vitest + react-dom `act` | `src/**/*.test.tsx` | every push |
| Integration | Vitest | `tests/integration/**/*.test.ts` | PR only |

**Test placement rule**: unit/component tests colocate with source (`src/**/*.test.*`). Use `__tests__/` subdirectory only when a directory accumulates many tests. Integration = `tests/integration/routes/` (one file per route group).

**Integration = real route handlers vs Postgres.** The suite runs the actual API route handlers against a plain Postgres + a lightweight PostgREST sidecar (no Supabase stack). `@/lib/supabase/server`'s `createClient` is mocked to a PostgREST-backed client carrying a self-signed persona JWT; RLS/RPC/embedded-joins run for real. The DB is reseeded before every test to stay pristine. Use `asPersona(key)` then invoke the handler (`tests/integration/helpers.ts`). Pure handler branching with the client mocked can also live in colocated unit tests (`src/app/api/**/route.test.ts`).

**Persona system**: The canonical way to QA as any role. Defined in `tests/fixtures/personas.ts`, seeded via `seed.sql`. `make e2e-login PERSONA=<persona>` prints a one-time Supabase magic-link you open in your own browser (no browser automation). Quick picks: `aria` = plain resident; `declan` = sports CCA chair; `sage` = all three flags (admin + JCRC + CSA).

**Local integration setup**: Requires Docker + Liquibase + `psql` + `vendor/intranet` submodule (private; holds the Makefile + changelog). Run `git submodule update --init --recursive`, then `make db-up` → `make test-integration` → `make db-down`. Override the schema-repo path with `INTRANET` (e.g. `../intranet`). `tests/fixtures/seed.sql` is committed and applied as-is; if you edit `personas.ts`, regenerate it with `npx tsx tests/fixtures/generate.ts`. See `docs/TESTING.md`.

## CI

Two workflows in `.github/workflows/`:

| Trigger | Workflow | What runs |
|---|---|---|
| Push to any non-`main` branch | `1-feature-branch-ci.yml` | prettier, lint, typecheck, unit + component tests |
| PR into `main` | `2-merge-request-ci.yml` | all of the above + `next build` + integration tests (Postgres + PostgREST) |

**Required secret**: `SUBMODULE_SSH_KEY` — a read-only deploy key for `ShearesWeb/intranet` (the private schema submodule). The built-in `GITHUB_TOKEN` can't access a sibling private repo. See `docs/TESTING.md` for one-time setup.

## Deployment

**Stack**: Cloudflare Workers via [`@opennextjs/cloudflare`](https://opennext.js.org/cloudflare). Config lives in `wrangler.jsonc` (Worker bindings) and `open-next.config.ts` (R2 incremental cache).

- **Production**: Worker `"intranet"` → `intranet.shweb.org`
- **Preprod**: Worker `"intranet-preprod"` → `intranet-beta.shweb.org`

**Terraform** (`infra/`): Owns R2 cache buckets and Cloudflare Workers custom domains. Resource naming convention: `{env}-web-{resource}-{project}` (e.g. `prd-web-cache-intranet-web`). Apply per environment with `var.env = "prd" | "preprod"`. **wrangler and Terraform must not manage the same resource** — Terraform owns R2 + custom domains; wrangler owns the Worker script and its bindings.

**Two `NEXT_PUBLIC_*` env vars** are the only build-time inputs needed for a real deploy (`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY`). No runtime secrets are needed — all Supabase auth is cookie-based via `@supabase/ssr`.

## Architecture

### Layer map

```
src/app/              → Pages, layouts, API routes (Next.js App Router)
src/app/api/          → Route handlers, thin (~30-60 lines), delegate to src/lib/
src/lib/              → Domain logic, access control, feature flags (no React)
src/utils/supabase/   → Supabase client factory (server.ts, client.ts, middleware.ts)
src/types/            → Shared TypeScript types (no deps)
src/components/       → UI components (layout/, table/, ui/, cca/, etc.)
src/hooks/            → Client-side hooks
```

### Key abstractions

**`AuthenticatedUser`** (`src/types/user.ts`): Fully-resolved user with profile, `is_admin` / `is_jcrc` / `is_culture_sports_admin` flags, and CCA appointments. Built by `fetchUserInfo()` in `src/lib/auth/fetch-user-info.ts` from JWT claims + the `authenticated_user_info` Supabase view.

**`AccessResult<T>`** (`src/lib/cca/cca-chair-access.ts`): `{ ok: true; data: T } | { ok: false; status: number; error: string }`. Used by all CCA-related API routes to verify chair/management access.

**Feature flags** (`src/lib/feature-flags.ts`): Compile-time constants (`CORE_SERVICE_FLAGS`). Changing them requires a code edit + deploy. Consumed by layouts (UI gating), API routes (503 responses), and sidebar nav. Active flags: `memberRanking`, `ccaApplications`, `holidaySubsidy`, `facilities`.

**`AppLayout`** (`src/components/layout/app-layout.tsx`): Wraps every dashboard page. Provides sidebar + breadcrumbs (auto-generated from URL path). All dashboard pages use it.

### Auth flow

`src/middleware.ts` → validates Supabase JWT claims on every `/dashboard/*` request → redirects unauthenticated users to login. The server-side Supabase client (`src/utils/supabase/server.ts`) reads session from cookies via `@supabase/ssr`. Client-side auth state lives in `AuthContext` (`src/lib/auth/auth-context.tsx`); consume via `useAuth()`.

### API route pattern

```ts
// Thin handler — auth guard + delegate to lib
export async function GET(req, { params }) {
  try {
    const result = await requireChairAccess(params.ccaId);
    if (!result.ok) return apiError(result.error, result.status);
    const data = await someService(result.data);
    return apiOk(data);
  } catch (e) {
    return handleApiError(e);
  }
}
```

Response envelope: `{ data: T, error: null }` on success; `{ data: null, error: string }` on error. Helpers: `apiOk()`, `apiError()`, `handleApiError()` from `@/lib/api/response`. Auth guards: `requireAuth()`, `requireChairAccess()`, `requireJcrcAccess()` from `@/lib/api/auth`.

### Data flow

Pages are client components that `fetch()` to `/api/*` routes in `useEffect`. Role checks cached in `localStorage` (5-min TTL) by `useRoleAuth()` (`src/hooks/use-role-auth.ts`). Read-only pages may be server components with direct Supabase calls. No global state library.

### Ranking — two concepts

There are two different "ranking" concepts in the codebase that share the same route/identifier names:

1. **Member evaluation ranking** — chairs grade members (attendance, performance, etc.) by CCA type. Logic in `src/lib/ranking/`.
2. **CCA allocation preference** — residents rank their preferred CCAs for allocation. User-facing copy uses "preference", but identifiers, hooks, and DB aliases keep the name `ranking`.

## Conventions

### Naming

- Filenames: `kebab-case.ts` / `kebab-case.tsx`
- Components (code): `PascalCase`
- Hooks: filename `use-kebab-case.ts`, function `useCamelCase`
- Types/interfaces: `PascalCase`
- Functions: `camelCase`
- Constants: `UPPER_SNAKE_CASE`
- API route handlers: `GET`, `POST`, `PATCH`, `DELETE`

### Component patterns

- `"use client"` only for interactive pages; read-only pages are server components
- Use `<PageHeader>` from `@/components/layout/page-header` for page titles (flat `h1 + p` block, no Card wrappers on page headers — see `mycca/` and `holiday-subsidy/` pages as reference)
- Use `<EmptyState>` from `@/components/layout/empty-state`, `<ErrorCard>` from `@/components/layout/error-card`
- Use `<DataTable>` from `@/components/table/data-table` for all data tables; `<OrderingTable>` for drag-and-drop ranking
- shadcn/ui (new-york style) primitives in `src/components/ui/`
- `cn()` from `@/lib/utils` for class merging
- User-facing copy for CCA allocation uses "preference" (not "ranking")

### Imports

- `@/*` maps to `./src/*`
- Named imports for everything except Next.js page/layout defaults
- Type imports: `import { type Foo } from "..."`

### Error handling

- API routes: `try/catch` → `handleApiError()` in catch
- Auth guards throw `ApiError` (from `@/lib/api/errors`), caught by route handlers
- User-facing errors: `toast.error(...)` via `sonner`
- Debug: `console.error("Error [context]:", error)`

### Styling

- Tailwind CSS v4 — uses `@import 'tailwindcss'` syntax (not `@tailwind base/components/utilities`)
- CSS variables for theming in `src/app/globals.css`
- `cn()` combines `clsx` + `tailwind-merge`

<!-- GSD:skills-start source:skills/ -->

## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, or `.github/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:profile-start -->

## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
