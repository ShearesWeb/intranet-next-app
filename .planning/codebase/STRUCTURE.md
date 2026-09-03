# Codebase Structure

**Analysis Date:** 2026-09-03

## Directory Layout

```
intranet-next-app/
├── .github/
│   └── workflows/          # CI/CD pipelines (1-4-feature, merge, preprod, prd)
├── .claude/                # Claude Code project config
├── .planning/
│   └── codebase/           # Codebase maps (ARCHITECTURE.md, STRUCTURE.md, etc.)
├── docs/                   # Documentation (TESTING.md, architecture notes)
├── e2e/                    # E2E test helpers (browser automation, if needed)
├── infra/                  # Terraform for Cloudflare (R2 buckets, custom domains)
│   └── config/             # Environment-specific Terraform variables
├── public/
│   ├── images/             # Static images
│   └── audio/              # Static audio files
├── src/
│   ├── app/                # Next.js 15 App Router
│   │   ├── api/            # Route handlers (HTTP endpoints)
│   │   ├── auth/           # Auth pages (login, callback, signin)
│   │   ├── dashboard/      # Protected dashboard pages
│   │   ├── fonts/          # Geist, Fredoka fonts
│   │   ├── globals.css     # Tailwind CSS + CSS variables for theme
│   │   ├── layout.tsx      # Root layout (AuthProvider, Toaster)
│   │   └── page.tsx        # Landing page (/)
│   ├── components/         # React UI components
│   │   ├── ui/             # shadcn/ui primitives
│   │   ├── layout/         # App layout (sidebar, breadcrumbs, page header)
│   │   ├── table/          # Data table (DataTable, OrderingTable)
│   │   ├── cca/            # CCA management components
│   │   ├── allocation/     # CCA allocation & preference components
│   │   ├── facilities/     # Facilities booking components
│   │   ├── holiday-subsidy/# Holiday subsidy components
│   │   ├── ranking/        # Ranking (both concepts) components
│   │   ├── auth/           # Auth UI (login prompt, etc.)
│   │   ├── shared/         # Shared UI helpers
│   │   ├── badges/         # Role & status badges
│   │   └── feature-flags/  # Feature flag display
│   ├── lib/                # Domain logic (no React)
│   │   ├── api/            # HTTP utilities (response envelopes, auth guards, errors)
│   │   ├── auth/           # Auth services (fetch user, auth context)
│   │   │   └── __tests__/  # Auth-specific tests
│   │   ├── supabase/       # Supabase client setup, middleware, helpers
│   │   │   └── __tests__/  # Supabase tests (cookie eviction, etc.)
│   │   ├── cca/            # CCA management logic (members, access control)
│   │   ├── allocation/     # CCA allocation logic
│   │   ├── facilities/     # Facilities booking logic
│   │   ├── holiday-subsidy/# Holiday subsidy logic
│   │   ├── ranking/        # Ranking metrics, editors, progress tracking
│   │   ├── timed-flags/    # Time-gated service windows (ranking periods, etc.)
│   │   ├── feature-flags.ts# Compile-time feature gates
│   │   ├── utils.ts        # Utility functions (cn, date formatting, etc.)
│   │   ├── managed-cca-data.ts # CCA data for chairs
│   │   ├── date.ts         # Date helpers
│   │   └── __tests__/      # Shared lib tests
│   ├── types/              # TypeScript type definitions (no runtime code)
│   │   ├── user.ts         # AuthenticatedUser, UserAppointment, role predicates
│   │   ├── members.ts      # Member-related types
│   │   ├── cca-data.ts     # CCA data structures
│   │   ├── ranking.ts      # Ranking-related types
│   │   ├── ranking-api.ts  # Ranking API request/response types
│   │   ├── allocation.ts   # Allocation types
│   │   ├── preferences.ts  # Preference/ranking preference types
│   │   ├── facilities.ts   # Facility booking types
│   │   ├── holiday-subsidy-api.ts # Subsidy API types
│   │   ├── declarations.ts # Holiday declaration types
│   │   ├── recap.ts        # Ranking recap types
│   │   ├── applicants.ts   # Applicant types
│   │   ├── weekly.ts       # Weekly schedule types
│   │   └── facilities.test.ts # Facilities type validation tests
│   ├── hooks/              # Client-side React hooks
│   │   └── use-role-auth.ts # Role auth hook (checks user permissions, cached)
│   ├── test-utils/         # Test utilities
│   │   └── integration/    # Integration test helpers
│   ├── middleware.ts       # Next.js middleware (auth, session isolation)
│   └── config/             # Config (if needed, currently in process.env)
├── tests/
│   ├── integration/        # Integration tests (route handlers vs real DB)
│   │   └── routes/         # One test file per route group
│   ├── fixtures/           # Test data (personas, seed.sql)
│   │   ├── personas.ts     # User personas (aria, declan, sage, etc.)
│   │   ├── generate.ts     # Script to regenerate seed.sql from personas
│   │   └── seed.sql        # SQL to seed test database
│   └── types/              # Test-only types
├── vendor/
│   └── intranet/           # Private submodule with schema, Makefile, changelog
├── .gitignore              # Git ignore rules
├── .env.example            # Example env vars (no secrets)
├── .prettierrc              # Prettier config
├── Makefile                # Build/test/deploy targets (main entry point)
├── package.json            # NPM dependencies and scripts
├── tsconfig.json           # TypeScript config
├── wrangler.jsonc          # Cloudflare Workers config (bindings, env)
├── open-next.config.ts     # OpenNext deployment config (R2 cache)
├── next.config.ts          # Next.js config
├── vitest.config.ts        # Vitest test runner config
└── eslint.config.js        # ESLint config
```

## Directory Purposes

**`.github/workflows/`:**
- Purpose: CI/CD pipelines; numbered 1-4 in execution order
- Key files:
  - `1-feature-branch-ci.yml` — Run on every push to non-main branches; prettier, lint, typecheck, unit/component tests
  - `2-merge-request-ci.yml` — Run on PR to main; all of above + `next build` + integration tests
  - `3-preprod-deploy.yaml` — Run on PR merge to main; cuts `vX.Y.Z-rc` tag, Terraform apply, deploys to preprod, cuts `vX.Y.Z`
  - `4-prd-deploy.yaml` — Run on `workflow_dispatch` against a `vX.Y.Z` tag; Terraform apply, deploys to prd

**`src/app/`:**
- Purpose: Next.js 15 App Router entry points (pages, layouts, API routes)
- Sub-structure:
  - `api/` — HTTP route handlers; thin wrappers delegating to `src/lib/`
  - `auth/` — Auth pages (`login`, `callback`)
  - `dashboard/` — Protected pages (my-cca, allocation, facilities, etc.)
- Pattern: Pages are client or server components; decide based on interactivity needs

**`src/components/`:**
- Purpose: React UI components organized by feature domain
- Sub-structure:
  - `ui/` — shadcn/ui primitives (Button, Card, Dialog, etc.)
  - `layout/` — App-wide layouts (AppLayout, PageHeader, Sidebar, Breadcrumbs)
  - `cca/` — CCA management UI (member table, position editor, etc.)
  - `allocation/` — Allocation preference UI
  - `facilities/` — Facilities booking UI (catalog, schedules, claims)
  - `holiday-subsidy/` — Holiday subsidy declaration UI
  - `ranking/` — Ranking UI (metrics, editor, recap)
  - `shared/` — Shared helpers and components
- Pattern: Each component is a single `.tsx` file unless it accumulates sub-components (use `__components/` subdirectory sparingly)

**`src/lib/`:**
- Purpose: Domain logic, business rules, access control (no React)
- Structure: One subdirectory per feature domain
  - `api/` — HTTP utilities (`apiOk()`, `apiError()`, `handleApiError()`, auth guards)
  - `auth/` — User profile resolution, JWT validation, auth context
  - `supabase/` — Supabase client factory, middleware, session isolation
  - `cca/` — CCA hierarchy, member management, access control
  - `allocation/` — CCA allocation logic and preference ranking
  - `facilities/` — Facility catalog, booking, approvals
  - `holiday-subsidy/` — Holiday subsidy declarations, approvals
  - `ranking/` — Ranking metrics, editors, progress tracking
  - `timed-flags/` — Time-gated service windows (e.g., ranking periods)
- Pattern: Each service exports typed functions; use `ApiError` for known failures

**`src/types/`:**
- Purpose: Shared TypeScript types mirroring Supabase schema
- Key files:
  - `user.ts` — `AuthenticatedUser`, `UserAppointment`, role predicates (`deriveChairKinds`, `isCultureSportsChair`)
  - `cca-data.ts` — CCA and appointment types
  - `ranking.ts` — Ranking domain types
  - `ranking-api.ts` — Ranking API envelope types (requests, responses)
- Pattern: No runtime code; interfaces only

**`tests/`:**
- Purpose: Automated testing (integration layer)
- Structure:
  - `integration/routes/` — One test file per route group; runs against real Postgres + PostgREST
  - `fixtures/` — Test data (personas, seed.sql)
- Pattern: Use `asPersona(key)` to call routes as a specific user; DB is reseeded before each test

**`vendor/intranet/`:**
- Purpose: Private Git submodule containing Supabase schema, Makefile, changelog
- Not in this repo directly; cloned during `git submodule update --init --recursive`
- Holds: `docs/`, `src/migrations/`, `sql/seed.sql`, `Makefile` targets for `db-up`, `db-down`
- Required secret: `SUBMODULE_SSH_KEY` (deploy key for read-only access)

**`infra/`:**
- Purpose: Terraform configuration for Cloudflare infrastructure
- Contains: R2 bucket definitions, custom domain bindings
- Pattern: Resource naming: `{env}-web-{resource}-{project}` (e.g., `prd-web-cache-intranet-web`)
- Envs: `prd`, `preprod`
- Run: `make deploy ENV=prd` (CI only; never deploy from workstation)

**`docs/`:**
- Purpose: Project documentation
- Key files:
  - `TESTING.md` — Full testing architecture guide (unit, component, integration, persona QA)

## Key File Locations

**Entry Points:**
- `src/middleware.ts` — Validates auth, refreshes session, clears foreign-projref cookies on every request
- `src/app/layout.tsx` — Root layout; wraps app in `AuthProvider` + `Toaster`
- `src/app/page.tsx` — Landing page (/)
- `src/app/auth/callback/route.ts` — OAuth callback; exchanges auth code for Supabase session
- `src/app/dashboard/page.tsx` — Dashboard home; renders feature-gated action cards

**Configuration:**
- `package.json` — NPM dependencies (Next.js, Supabase, Tailwind, etc.)
- `tsconfig.json` — TypeScript compiler options (strict mode, path aliases)
- `wrangler.jsonc` — Cloudflare Workers config (bindings: R2, KV, Durable Objects)
- `open-next.config.ts` — OpenNext adapter config (R2 incremental cache)
- `next.config.ts` — Next.js config (redirects, rewrites, image optimization)
- `vitest.config.ts` — Vitest test runner config (globals, environment)
- `.prettierrc` — Prettier format rules
- `Makefile` — Build, test, integration, deploy targets (run `make help`)

**Core Logic:**
- `src/lib/auth/fetch-user-info.ts` — Resolve current user from Supabase view + JWT claims
- `src/lib/auth/auth-context.tsx` — Client-side auth state; provides `useAuth()` hook
- `src/lib/supabase/server.ts` — Server-side Supabase client factory; used by all services
- `src/lib/api/auth.ts` — Auth guards (`requireAuth()`, `requireChairAccess()`, `requireJcrcAccess()`)
- `src/lib/cca/cca-management-access.ts` — CCA access control envelope (`getManagedCcaAccess()`)
- `src/lib/feature-flags.ts` — Compile-time feature gates; used by pages + API routes

**Testing:**
- `vitest.config.ts` — Test runner config (environment, globals, project setup)
- `src/**/*.test.ts` — Unit tests (colocated with source)
- `src/**/*.test.tsx` — Component tests (colocated with source)
- `tests/integration/routes/*.test.ts` — Integration tests (real DB)
- `tests/fixtures/personas.ts` — User personas for QA and seed generation
- `tests/fixtures/seed.sql` — Generated SQL to seed test DB

## Naming Conventions

**Files:**
- Source: `kebab-case.ts` or `kebab-case.tsx`
  - Example: `src/lib/cca/member-service.ts`, `src/components/layout/app-layout.tsx`
- Tests: `kebab-case.test.ts` or `kebab-case.test.tsx` (colocated with source or in `__tests__/`)
  - Example: `src/lib/cca/member-service.test.ts`
- Config: Varies by tool
  - Build: `next.config.ts`, `wrangler.jsonc`, `vitest.config.ts`
  - Lint/format: `.prettierrc`, `eslint.config.js`
- Special: `page.tsx`, `layout.tsx`, `route.ts` (Next.js App Router conventions)

**Directories:**
- Feature domains: `kebab-case` (plural or singular depending on context)
  - Example: `src/components/cca/`, `src/lib/allocation/`
- Special: `__tests__/`, `__components/` (one level of indirection for many related items)

**Components (code):**
- React components: `PascalCase`
  - Example: `DataTable`, `AppLayout`, `CcaMemberForm`

**Hooks:**
- Filename: `use-kebab-case.ts`
  - Example: `use-role-auth.ts`
- Function: `useCamelCase()`
  - Example: `useRoleAuth()`, `useAuth()`

**Types/Interfaces:**
- `PascalCase`
  - Example: `AuthenticatedUser`, `UserAppointment`, `CcaRow`

**Functions:**
- `camelCase`
  - Example: `fetchUserInfo()`, `getMembers()`, `getManagedCcaAccess()`

**Constants:**
- `UPPER_SNAKE_CASE`
  - Example: `CORE_SERVICE_FLAGS`, `TEAM_STATUS_CCA_KINDS`, `CACHE_HEADERS`

**API Route Handlers:**
- Export named async functions: `GET`, `POST`, `PATCH`, `DELETE`
  - Example:
    ```typescript
    export async function GET(req, { params }) { ... }
    export async function POST(req, { params }) { ... }
    ```

## Where to Add New Code

**New Feature (e.g., "Holiday Subsidy Allocations"):**
1. **Page/Route:**
   - Create `src/app/dashboard/holiday-subsidy-allocation/page.tsx` (or directory if multiple pages)
   - If read-only: server component with direct Supabase calls
   - If interactive: client component that fetches from API routes

2. **API Route:**
   - Create `src/app/api/holiday-subsidy-allocation/route.ts`
   - Implement `GET`, `POST`, `PATCH` as needed (thin 30-60 lines each)
   - Delegate to service layer

3. **Domain Logic:**
   - Add to existing `src/lib/holiday-subsidy/` directory or create new `src/lib/holiday-subsidy-allocation/`
   - Export typed service functions: `async function getAllocations(...): Promise<AllocationRow[]>`
   - Implement access guards: `await requireJcrcAccess()` or similar

4. **Types:**
   - Add to `src/types/holiday-subsidy-api.ts` or create `src/types/holiday-subsidy-allocation.ts`
   - Define request/response envelopes

5. **Components:**
   - Create `src/components/holiday-subsidy/allocation-table.tsx` and related components
   - Reuse `<DataTable>`, `<Card>`, `<Button>` from `ui/`
   - Wrap page in `<AppLayout>` (provides sidebar + breadcrumbs)

6. **Tests:**
   - Unit/component: `src/components/holiday-subsidy/allocation-table.test.tsx`
   - Integration: `tests/integration/routes/holiday-subsidy-allocation.test.ts`

**New Component/Module:**
- Create file in appropriate feature directory: `src/components/cca/new-component.tsx`
- If it spawns many sub-components, create subdirectory: `src/components/cca/new-component/__components/`
- Export as `export function NewComponent() { ... }`
- Use `"use client"` only if interactive

**Utilities:**
- Shared helpers: `src/lib/utils.ts` (e.g., `cn()`, `formatDate()`)
- Feature-specific helpers: Same directory as the feature (e.g., `src/lib/cca/member-helpers.ts`)

**Types for a New Feature:**
- Add to `src/types/` as a new file if the feature is substantial
- Small types can go inline in component or route handler
- Always export types from `src/types/*.ts`; never define types in `src/lib/`

## Special Directories

**`src/components/ui/`:**
- Purpose: shadcn/ui primitives (copy-pasted; not from node_modules)
- Generated: No (hand-maintained copies for consistency)
- Committed: Yes
- Pattern: Import specific primitives: `import { Button } from "@/components/ui/button"`

**`node_modules/`:**
- Purpose: NPM dependencies
- Generated: Yes (by `npm install` or `bun install`)
- Committed: No (in `.gitignore`)

**`.env.local` / `.env.development.local`:**
- Purpose: Local env vars (not committed)
- Contains: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, etc.
- Required for: `npm run dev`, integration tests
- Secrets: Never commit; add to `.env.example` if generic

**`.next/`:**
- Purpose: Next.js build cache
- Generated: Yes (by `npm run build`)
- Committed: No (in `.gitignore`)

**`tests/fixtures/seed.sql`:**
- Purpose: Generated SQL to seed test database (personas, test data)
- Generated: Yes (by `npx tsx tests/fixtures/generate.ts`)
- Committed: Yes (must be in sync with `personas.ts`)
- Edit: Never hand-edit; regenerate if `personas.ts` changes

**`vendor/intranet/`:**
- Purpose: Private schema submodule
- Generated: No (external repo)
- Committed: As submodule reference (not the contents)
- Initialize: `git submodule update --init --recursive`

**`.planning/codebase/`:**
- Purpose: Codebase documentation (ARCHITECTURE.md, STRUCTURE.md, etc.)
- Generated: No (hand-maintained or auto-generated by `/gsd-*` commands)
- Committed: Yes
- Used by: `/gsd-plan-phase`, `/gsd-execute-phase` for context

---

*Structure analysis: 2026-09-03*
