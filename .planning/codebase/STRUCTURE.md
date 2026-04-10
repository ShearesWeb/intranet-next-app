# Codebase Structure

**Analysis Date:** 2026-04-10

## Directory Layout

```
intranet-next-app/
├── .github/workflows/       # CI/CD pipeline definitions
├── .next/                   # Next.js build output (generated, gitignored)
├── .open-next/              # OpenNext build output for SST/AWS (generated)
├── .planning/               # Project planning documents
├── .sst/                    # SST framework config and types (generated)
├── public/                  # Static assets
│   ├── audio/               # Audio files
│   └── images/              # Image assets (logos, placeholders)
├── scripts/                 # One-off utility scripts
├── src/                     # Application source code
│   ├── app/                 # Next.js App Router (pages + API routes)
│   │   ├── api/             # API route handlers
│   │   │   ├── cca/         # CCA management endpoints
│   │   │   ├── chair/       # Chair-specific endpoints
│   │   │   ├── holidaySubsidy/  # Holiday subsidy endpoints
│   │   │   ├── ping/        # Health check
│   │   │   ├── sportsCulture/   # Sports & culture endpoints
│   │   │   └── user/        # User-related endpoints
│   │   ├── auth/            # Authentication pages
│   │   │   ├── auth-error/  # Error page
│   │   │   ├── callback/    # OAuth callback handler
│   │   │   └── login/       # Login page
│   │   ├── dashboard/       # Protected dashboard pages
│   │   │   ├── ccaAllocation/   # CCA allocation (rank, rankApplicants)
│   │   │   ├── holidaySubsidy/  # Holiday subsidy (declaration, approvals, weekly)
│   │   │   └── mycca/       # User's CCAs and admin management
│   │   ├── fonts/           # Local font files (Geist)
│   │   └── testPage/        # Test/debug page
│   ├── components/          # Reusable React components
│   │   ├── auth/            # Auth-specific components
│   │   ├── badges/          # Badge display components
│   │   ├── dashboard/       # Dashboard-specific components
│   │   ├── feature-flags/   # Feature flag UI components
│   │   ├── layout/          # Layout components (sidebar, nav, breadcrumbs)
│   │   ├── table/           # Generic table components
│   │   └── ui/              # shadcn/ui primitives
│   ├── context/             # React Context providers
│   ├── hoc/                 # Higher-order components
│   ├── hooks/               # Custom React hooks
│   ├── lib/                 # Business logic, utilities, constants
│   │   └── constants/       # Constant values
│   ├── types/               # TypeScript type definitions
│   └── utils/               # Utility functions
│       └── supabase/        # Supabase client factories
├── components.json          # shadcn/ui configuration
├── next.config.mjs          # Next.js configuration
├── package.json             # Dependencies and scripts
├── postcss.config.mjs       # PostCSS configuration
├── sst.config.ts            # SST deployment configuration
├── tsconfig.json            # TypeScript configuration
└── tsconfig.scripts.json    # TypeScript config for scripts/
```

## Directory Purposes

**`src/app/`:**
- Purpose: Next.js App Router -- all pages, layouts, and API routes
- Contains: `page.tsx` (page components), `layout.tsx` (layout wrappers), `route.ts` (API handlers)
- Key files: `src/app/layout.tsx` (root layout), `src/app/page.tsx` (landing page), `src/app/dashboard/page.tsx` (dashboard home)

**`src/app/api/`:**
- Purpose: Server-side API endpoints organized by domain
- Contains: Route handler files (`route.ts`) with exported HTTP method functions (GET, POST, DELETE)
- Key files: `src/app/api/user/route.ts` (user profile), `src/app/api/user/checkRole/route.ts` (role verification), `src/app/api/cca/[ccaId]/members/route.ts` (CCA member management)
- Pattern: Each endpoint directory contains a single `route.ts` file

**`src/app/api/cca/`:**
- Purpose: CCA management API endpoints
- Contains: Member management, rankings, position search, managed positions
- Key routes: `[ccaId]/members/route.ts`, `[ccaId]/rankings/route.ts`, `[ccaId]/addMember/route.ts`, `[ccaId]/removeMember/route.ts`, `[ccaId]/updateMember/route.ts`, `[ccaId]/searchUsers/route.ts`, `managedPositions/route.ts`, `rankings/all/route.ts`

**`src/app/api/chair/`:**
- Purpose: Chair-specific ranking and applicant management
- Contains: Position listing, applicant add/remove, ranking
- Key routes: `positions/forChair/route.ts`, `positions/[position_id]/addApplicant/route.ts`, `positions/[position_id]/removeApplicant/route.ts`, `positions/[position_id]/rank/route.ts`

**`src/app/api/holidaySubsidy/`:**
- Purpose: Holiday subsidy declaration and approval workflows
- Contains: Declaration CRUD, approval workflows, weekly commitment tracking
- Key routes: `approvals/route.ts` (JCRC approval list), `approvals/[ccaId]/route.ts`, `declarations/[ccaId]/route.ts`, `weekly/[ccaId]/[weekId]/route.ts`, `approvals/weekly/[ccaId]/[weekId]/route.ts`

**`src/app/api/user/`:**
- Purpose: User-centric API endpoints
- Contains: Profile, role checking, CCA fetching, ranking operations, search
- Key routes: `route.ts` (GET user info, DELETE cookies), `checkRole/route.ts`, `getCCAs/route.ts`, `getManagedCCAs/route.ts`, `getRankablePositions/[email]/route.ts`, `saveRankings/route.ts`, `search/route.ts`

**`src/app/dashboard/`:**
- Purpose: Protected dashboard pages (all require authentication via middleware)
- Contains: Feature-specific page directories
- Subdirectories: `ccaAllocation/` (CCA application and ranking), `holidaySubsidy/` (subsidy management), `mycca/` (personal CCAs and admin)

**`src/components/`:**
- Purpose: Reusable React components organized by concern
- Contains: UI primitives (shadcn), layout scaffolding, domain-specific components

**`src/components/ui/`:**
- Purpose: shadcn/ui component library (New York style)
- Contains: Pre-built UI primitives -- button, card, dialog, table, sidebar, tabs, tooltip, etc.
- Key files: `button.tsx`, `card.tsx`, `dialog.tsx`, `sidebar.tsx`, `table.tsx`
- Note: Generated via `npx shadcn@latest add`. Do not manually edit these files.

**`src/components/layout/`:**
- Purpose: Application shell and navigation components
- Contains: `app-layout.tsx` (main layout with sidebar + breadcrumbs), `app-sidebar.tsx` (sidebar with nav items and role-based filtering), `nav-main.tsx` (collapsible nav menu), `nav-user.tsx` (user dropdown in sidebar footer), `app-loading.tsx` (skeleton loading state)

**`src/components/table/`:**
- Purpose: Generic, reusable table components built on TanStack Table
- Contains: `simple-table.tsx` (sortable/filterable data table), `selection-table.tsx` (table with row selection checkboxes), `ordering-table.tsx` (drag-to-reorder table)
- Pattern: Accept generic `<TData>` type parameter and column definitions

**`src/components/badges/`:**
- Purpose: Styled badge components for CCA types and position types
- Contains: `cca-type-badge.tsx`, `position-type-badge.tsx`, `type-badges.tsx`

**`src/context/`:**
- Purpose: React Context providers for global client-side state
- Contains: `AuthContext.tsx` -- the only context provider
- Key exports: `AuthProvider` (component), `useAuth()` (hook)

**`src/hoc/`:**
- Purpose: Higher-order components for cross-cutting concerns
- Contains: `withAuth.tsx` -- wraps client components with auth check and redirect

**`src/hooks/`:**
- Purpose: Custom React hooks
- Contains: `useRoleAuth.ts` (role-based authorization with caching), `use-mobile.ts` (responsive breakpoint detection)

**`src/lib/`:**
- Purpose: Shared business logic and utility functions used by both API routes and components
- Contains: Feature flags, access control helpers, ranking logic, subsidy week calculations
- Key files:
  - `feature-flags.ts` -- Core service toggle flags and gating utilities
  - `fetch-user-info.ts` -- Server-side user resolution from JWT claims + DB
  - `cca-chair-access.ts` -- Chair (lead/vice) authorization checks
  - `cca-management-access.ts` -- Managed CCA position access checks
  - `cca-ranking-metrics.ts` -- CCA-type-specific ranking metric definitions
  - `cca-ranking-comments.ts` -- Ranking comment field serialization/deserialization
  - `cca-member-management.ts` -- Member management permission rules
  - `cca-cut-status.ts` -- Cut status normalization logic
  - `holiday-subsidy-weeks.ts` -- Holiday week definitions and editability logic
  - `utils.ts` -- `cn()` class name merge utility (clsx + tailwind-merge)

**`src/lib/constants/`:**
- Purpose: Constant value definitions
- Contains: `auth.ts` (cache key names)

**`src/types/`:**
- Purpose: Shared TypeScript type definitions
- Contains: Domain model interfaces
- Key files:
  - `User.ts` -- `AuthenticatedUser`, `UserAppointment`, `UserRoleFlags`, `PositionType`, `CcaType`
  - `CCAPosition.ts` -- `CCAPosition` interface
  - `dashboard.ts` -- View model types (`CCAData`, `RankablePosition`, `SportsCulturePosition`, `Member`, `Position`, `Applicant`, `PendingChange`)
  - `holiday-subsidy.ts` -- Subsidy types (`SubsidyRow`, `SubsidyDeclaration`, `SubsidyStatus`)

**`src/utils/supabase/`:**
- Purpose: Supabase client factory functions for different contexts
- Contains:
  - `server.ts` -- Server-side client with cookie-based auth (default: cookie writes disabled)
  - `client.ts` -- Browser-side client
  - `middleware.ts` -- Middleware client for session validation

**`scripts/`:**
- Purpose: One-off utility scripts for data operations
- Contains: `index.ts` (user onboarding CSV import -- currently fully commented out), `users.csv` (user data), `errors.txt`
- Run via: `npm run run-script`

## Key File Locations

**Entry Points:**
- `src/app/layout.tsx`: Root layout -- AuthProvider, Toaster, fonts
- `src/app/page.tsx`: Landing page (server component, redirects if authenticated)
- `src/app/dashboard/page.tsx`: Dashboard home page
- `src/middleware.ts`: Request middleware for auth route protection

**Configuration:**
- `next.config.mjs`: Next.js config (ESLint ignored during builds, CloudFront image domain)
- `tsconfig.json`: TypeScript config (strict mode, `@/*` path alias to `./src/*`)
- `sst.config.ts`: SST deployment config (AWS, domain mapping by stage)
- `components.json`: shadcn/ui config (New York style, Tailwind CSS variables, lucide icons)
- `postcss.config.mjs`: PostCSS with Tailwind plugin

**Core Logic:**
- `src/lib/fetch-user-info.ts`: Server-side authenticated user resolution
- `src/lib/feature-flags.ts`: Feature toggle system
- `src/lib/cca-chair-access.ts`: Chair authorization logic
- `src/lib/cca-management-access.ts`: Managed CCA access verification
- `src/context/AuthContext.tsx`: Client-side auth state management

**Testing:**
- No test files detected. No test framework configured.

## Naming Conventions

**Files:**
- Page components: `page.tsx` (Next.js convention)
- Layouts: `layout.tsx` (Next.js convention)
- API routes: `route.ts` (Next.js convention)
- Components: `kebab-case.tsx` (e.g., `app-layout.tsx`, `login-form.tsx`, `loading-spinner.tsx`)
- Lib modules: `kebab-case.ts` (e.g., `feature-flags.ts`, `cca-chair-access.ts`)
- Type files: `PascalCase.ts` for single-type files (e.g., `User.ts`, `CCAPosition.ts`), `kebab-case.ts` for multi-type files (e.g., `holiday-subsidy.ts`, `dashboard.ts`)
- Hooks: `camelCase.ts` prefixed with `use` (e.g., `useRoleAuth.ts`, `use-mobile.ts` -- mixed convention)

**Directories:**
- API route segments: `camelCase` (e.g., `checkRole`, `getCCAs`, `saveRankings`, `holidaySubsidy`)
- Dashboard page segments: `camelCase` (e.g., `ccaAllocation`, `holidaySubsidy`, `mycca`)
- Dynamic segments: `[paramName]` (e.g., `[ccaId]`, `[ccaName]`, `[email]`, `[position_id]`, `[weekId]`)
- Component directories: `kebab-case` (e.g., `feature-flags`, `ui`)

**Exports:**
- React components: Named `PascalCase` exports (e.g., `export function AppLayout`, `export function NavMain`)
- Pages: Default exports (e.g., `export default function Dashboard()`)
- Utility functions: Named `camelCase` exports (e.g., `export function checkCcaAuthorization`)
- Types/interfaces: `PascalCase` (e.g., `AuthenticatedUser`, `CCAPosition`, `SubsidyRow`)

## Where to Add New Code

**New Dashboard Feature:**
- Page: `src/app/dashboard/{featureName}/page.tsx`
- Sub-pages: `src/app/dashboard/{featureName}/{subPage}/page.tsx`
- Layout (for feature flag gating): `src/app/dashboard/{featureName}/layout.tsx`
- Dynamic routes: `src/app/dashboard/{featureName}/[paramName]/page.tsx`
- Pattern: Wrap content in `<AppLayout>`, use `useAuth()` for user data, fetch from API routes in `useEffect`

**New API Endpoint:**
- Route handler: `src/app/api/{domain}/{action}/route.ts`
- Dynamic params: `src/app/api/{domain}/[paramName]/{action}/route.ts`
- Pattern: Import `createClient` from `@/utils/supabase/server`, call `fetchUserInfo()` for auth, return `NextResponse.json()`
- Always add `Cache-Control: no-store, private` header
- Check feature flags with `getCoreServiceDisabledApiResponse()` if applicable

**New Reusable Component:**
- UI primitives: Add via `npx shadcn@latest add {component}` -- outputs to `src/components/ui/`
- Domain components: `src/components/{domain}/{component-name}.tsx`
- Table components: `src/components/table/{table-name}.tsx`
- Badge components: `src/components/badges/{badge-name}.tsx`

**New Business Logic:**
- Shared logic: `src/lib/{feature-name}.ts`
- Constants: `src/lib/constants/{name}.ts`
- Pattern: Export pure functions, keep server-only code marked with `"use server"` directive

**New Types:**
- Domain types: `src/types/{TypeName}.ts` or add to `src/types/dashboard.ts` for view models
- Pattern: Export interfaces/types, import in both API routes and components

**New Hook:**
- Location: `src/hooks/{hookName}.ts`
- Pattern: Prefix with `use`, mark `'use client'`, leverage `useAuth()` for user context

**New Feature Flag:**
- Add key to `CORE_SERVICE_FLAGS` in `src/lib/feature-flags.ts`
- Add layout gate in the feature's `layout.tsx`
- Add API gate via `getCoreServiceDisabledApiResponse()` in route handlers
- Add `featureFlag` property to nav items in `src/components/layout/app-sidebar.tsx`

**Adding Navigation Items:**
- Edit `navOptions` array in `src/components/layout/app-sidebar.tsx`
- Set `adminOnly`, `jcrcOnly`, `chairOnly`, and `featureFlag` properties for access control

## Special Directories

**`.next/`:**
- Purpose: Next.js build output and cache
- Generated: Yes (by `next build` / `next dev`)
- Committed: No (gitignored)

**`.open-next/`:**
- Purpose: OpenNext build artifacts for AWS Lambda deployment
- Generated: Yes (by SST build process)
- Committed: No (should be gitignored)

**`.sst/`:**
- Purpose: SST framework generated types and platform config
- Generated: Yes (by SST)
- Committed: No (gitignored)

**`node_modules/`:**
- Purpose: Installed npm dependencies
- Generated: Yes (by `npm install`)
- Committed: No (gitignored)

**`public/`:**
- Purpose: Static files served at root URL
- Generated: No
- Committed: Yes
- Contents: `images/shweb-logo.png`, `images/profile-placeholder.png`, `audio/` directory

**`scripts/`:**
- Purpose: One-off data migration/onboarding scripts (currently all commented out)
- Generated: No
- Committed: Yes
- Note: Contains hardcoded paths and commented-out credentials -- legacy code

---

*Structure analysis: 2026-04-10*
