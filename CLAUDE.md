<!-- GSD:project-start source:PROJECT.md -->
## Project

**Intranet Next App — Refactor & Overhaul**

A Next.js 15 intranet application for managing CCAs (Co-Curricular Activities), member rankings, CCA allocation, and holiday subsidies, backed by Supabase. The app has working features but suffers from a critical auth bug (SSR session bleed), poor code organization (1000+ line page components), scattered business logic, and inconsistent UI patterns. This project is a complete refactor to fix auth, restructure the codebase following best practices, and standardize the UI.

**Core Value:** Users can securely authenticate and manage CCA operations without session bleed or data leaking between accounts.

### Constraints

- **Tech stack**: Next.js 15 App Router + Supabase + TypeScript — no framework changes
- **Feature parity**: All existing features must continue working after refactor
- **Auth security**: Session isolation must be verified — no user data can leak between sessions
- **Deployment**: SST/OpenNext on AWS — deployment pipeline must remain functional
<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->
## Technology Stack

## Languages
- TypeScript ^5.7.2 - All application code (`src/**/*.ts`, `src/**/*.tsx`)
- CSS (Tailwind v4) - Styling via `src/app/globals.css` and utility classes
- JavaScript (ESM) - Config files (`next.config.mjs`, `postcss.config.mjs`)
## Runtime
- Node.js 22.22 (pinned in CI workflows `.github/workflows/*.yml`)
- No `.nvmrc` file present
- npm (primary)
- Lockfile: `package-lock.json` present
- No yarn.lock (CI auto-detects but defaults to npm)
## Frameworks
- Next.js ^15.1.2 - Full-stack React framework (App Router)
- React ^18 / React DOM ^18 - UI library
- Tailwind CSS ^4.1.14 - Utility-first CSS framework (v4, uses `@import 'tailwindcss'` syntax)
- SST 3.17.10 - Serverless deployment framework for AWS (`sst.config.ts`)
- Pulumi - Infrastructure-as-code engine (used under SST)
- Not detected - No test framework configured (no jest, vitest, or testing-library in dependencies)
- PostCSS ^8 with `@tailwindcss/postcss` ^4.1.14 (`postcss.config.mjs`)
- ESLint ^8 with `eslint-config-next` 14.2.13 (`.eslintrc.json`)
- ts-node ^10.9.2 - Used for running scripts (`tsconfig.scripts.json`)
- tw-animate-css ^1.4.0 - Tailwind animation utilities
## Key Dependencies
- `@supabase/supabase-js` ^2.50.3 - Supabase client for database and auth
- `@supabase/ssr` ^0.7.0 - Server-side Supabase client for Next.js (cookie-based sessions)
- `next` ^15.1.2 - Core framework
- `sst` 3.17.10 - Deployment and infrastructure
- `@radix-ui/react-accordion` ^1.2.12
- `@radix-ui/react-avatar` ^1.1.10
- `@radix-ui/react-checkbox` ^1.3.3
- `@radix-ui/react-collapsible` ^1.1.12
- `@radix-ui/react-dialog` ^1.1.15
- `@radix-ui/react-dropdown-menu` ^2.1.16
- `@radix-ui/react-navigation-menu` ^1.2.14
- `@radix-ui/react-separator` ^1.1.8
- `@radix-ui/react-slot` ^1.2.4
- `@radix-ui/react-tooltip` ^1.2.8
- `class-variance-authority` ^0.7.1 - Component variant system
- `clsx` ^2.1.1 - Conditional class names
- `tailwind-merge` ^3.3.1 - Tailwind class deduplication
- `lucide-react` ^0.545.0 - Icon library
- `@tanstack/react-table` ^8.21.3 - Data table library
- `framer-motion` ^12.4.10 - Animation library
- `sonner` ^2.0.7 - Toast notifications (primary, used in `src/app/layout.tsx`)
- `react-hot-toast` ^2.4.1 - Toast notifications (secondary, used in `src/hoc/withAuth.tsx`)
- `next-themes` ^0.4.6 - Dark/light mode support
- `csv-parse` ^5.6.0 - CSV parsing (used in scripts)
- `aphrodite` ^2.4.0 - CSS-in-JS (likely legacy, no active usage detected in main codebase)
## Configuration
- Main config: `tsconfig.json` - strict mode, bundler module resolution, `@/*` path alias maps to `./src/*`
- Scripts config: `tsconfig.scripts.json` - CommonJS module, ES2017 target
- Config: `.eslintrc.json`
- Extends: `next/core-web-vitals`, `next/typescript`
- ESLint is ignored during builds (`next.config.mjs`: `eslint.ignoreDuringBuilds: true`)
- `next.config.mjs` - Remote image patterns for CloudFront (`deifkwefumgah.cloudfront.net`)
- `postcss.config.mjs` - Tailwind CSS v4 PostCSS plugin
- `sst.config.ts` - AWS deployment configuration with stage-based domains
- `.env.local` present (not read - contains secrets)
- Required env vars:
- Local: Geist Sans (`src/app/fonts/GeistVF.woff`), Geist Mono (`src/app/fonts/GeistMonoVF.woff`)
- Google: Fredoka (weights 300-700)
## Platform Requirements
- Node.js 22.22+
- npm
- Supabase project with configured Google OAuth
- AWS (via SST/Pulumi)
- Production domain: `intranet.shweb.org`
- Pre-production domain: `intranet-beta.shweb.org`
- CloudFront CDN for image delivery (`deifkwefumgah.cloudfront.net`)
- GitHub Actions with 3 workflows:
- Tag-based release flow: `v1.2.3-rc` -> preprod -> auto-promotes to `v1.2.3` -> production
## Scripts
- `npm run dev` - Start development server
- `npm run build` - Build Next.js app
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run run-script` - Execute scripts via ts-node (`scripts/index.ts`)
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

## Naming Patterns
- Page components: `page.tsx` (Next.js App Router convention)
- Layout components: `layout.tsx`
- API routes: `route.ts`
- UI primitives: `kebab-case.tsx` (e.g., `loading-spinner.tsx`, `dropdown-menu.tsx`)
- Custom components: `kebab-case.tsx` (e.g., `cca-type-badge.tsx`, `points-recap-card.tsx`)
- Hooks: `camelCase.ts` prefixed with `use` (e.g., `useRoleAuth.ts`, `use-mobile.ts` -- mixed conventions exist)
- Types: `PascalCase.ts` (e.g., `User.ts`, `CCAPosition.ts`) or `kebab-case.ts` (e.g., `holiday-subsidy.ts`, `dashboard.ts`)
- Lib modules: `kebab-case.ts` (e.g., `cca-chair-access.ts`, `feature-flags.ts`, `fetch-user-info.ts`)
- Constants: `kebab-case.ts` in `src/lib/constants/` (e.g., `auth.ts`)
- React components: `PascalCase` (e.g., `AppLayout`, `SimpleTable`, `CcaTypeBadge`)
- Hooks: `camelCase` prefixed with `use` (e.g., `useAuth`, `useRoleAuth`, `useIsMobile`)
- Library/utility functions: `camelCase` (e.g., `fetchUserInfo`, `checkCcaAuthorization`, `canManageCcaMembers`)
- API route handlers: uppercase HTTP method names (e.g., `GET`, `POST`, `PATCH`, `DELETE`)
- Internal helpers within files: `camelCase` (e.g., `authorizeChair`, `validatePosition`)
- Local state: `camelCase` (e.g., `loadingCCAs`, `userPositions`, `ccaData`)
- Constants: `UPPER_SNAKE_CASE` for module-level constants (e.g., `CACHE_DURATION`, `STORAGE_KEY`, `CHAIR_POSITION_TYPES`, `HOLIDAY_WEEKS`)
- Exported const objects: `PascalCase` or `UPPER_SNAKE_CASE` (e.g., `SubsidyStatus`, `CORE_SERVICE_FLAGS`)
- Interfaces: `PascalCase` (e.g., `AuthenticatedUser`, `CCAData`, `SimpleTableColumn`)
- Type aliases: `PascalCase` (e.g., `PositionType`, `CcaType`, `CoreServiceKey`)
- Generic result types: discriminated union pattern `{ ok: true; data: T } | { ok: false; status: number; error: string }` used in `src/lib/cca-chair-access.ts` and `src/lib/cca-management-access.ts`
## Code Style
- No dedicated Prettier config file detected -- relies on editor defaults
- Indentation: mixed tabs and spaces (inconsistent across files -- `src/context/AuthContext.tsx` uses mixed tab/space indentation)
- Semicolons: present in most files but not enforced universally
- String quotes: double quotes predominant in JSX and imports; single quotes appear in some files (e.g., `src/app/dashboard/mycca/page.tsx`)
- Trailing commas: generally present after last property/parameter
- ESLint with `next/core-web-vitals` and `next/typescript` extends in `.eslintrc.json`
- ESLint is set to `ignoreDuringBuilds: true` in `next.config.mjs` -- linting errors do not block builds
- Frequent `eslint-disable` comments throughout codebase, primarily for `@typescript-eslint/no-explicit-any` and `@typescript-eslint/no-unused-vars`
## Import Organization
- `@/*` maps to `./src/*` (configured in `tsconfig.json`)
- Use `@/components/ui/button` not `../ui/button`
- Use `@/lib/utils` not `../../lib/utils`
- Named imports preferred: `import { Button } from "@/components/ui/button"`
- Default imports for pages: `export default function Dashboard()`
- Type imports use inline `type` keyword: `import { type ClassValue } from "clsx"`
## Component Patterns
- Use `"use client"` directive at top for interactive pages
- Wrap content in `<AppLayout>` for dashboard pages
- Show `<AppLoading />` or `<LoadingSpinner />` while data loads
- Use `useAuth()` hook to access user context
- Fetch data with `fetch('/api/...')` in `useEffect` hooks
- Export as `export default function PageName()`
- shadcn/ui (new-york style) primitives in `src/components/ui/`
- Use `cn()` utility from `src/lib/utils.ts` for conditional class merging
- Use `class-variance-authority` (`cva`) for variant-based styling (see `src/components/ui/button.tsx`)
- Components accept `className` prop for external customization
- Component functions use `function` keyword (not arrow functions) for shadcn components
- Use `isCoreServiceEnabled()` in layout files to gate entire feature sections
- Render `<ServiceDisabledState service="..." />` when disabled
- Example: `src/app/dashboard/holidaySubsidy/layout.tsx`, `src/app/dashboard/ccaAllocation/layout.tsx`
## API Route Patterns
- Success: `NextResponse.json({ data })` or `NextResponse.json({ success: true, ... })`
- Error: `NextResponse.json({ error: "message" }, { status: 4xx/5xx })`
- Some routes use `{ success: boolean, data: [], message: "..." }` pattern (e.g., `src/app/api/user/search/route.ts`)
- No single standardized response envelope -- varies between routes
## Error Handling
- `try/catch` around async operations
- Toast notifications for user-facing errors via `sonner` (`toast.error(...)`) in most places
- Legacy `react-hot-toast` still used in `src/hoc/withAuth.tsx` and `src/app/dashboard/mycca/page.tsx`
- `console.error()` for developer debugging
- Loading/error state managed with `useState` booleans
- Wrap entire handler body in `try/catch`
- Catch block logs `console.error(...)` and returns generic error JSON
- Supabase errors checked inline: `if (error) { return NextResponse.json({ error: error.message }, { status: 500 }); }`
- Specific error codes handled (e.g., Postgres `23505` unique violation -> 409 Conflict in `src/app/api/holidaySubsidy/declarations/[ccaId]/route.ts`)
- Uses a result-type pattern: `AccessResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string }`
- Defined in `src/lib/cca-chair-access.ts` and `src/lib/cca-management-access.ts`
- Callers check `if (!authResult.ok)` and forward `authResult.status` / `authResult.error`
## Logging
- `console.error("Error [context]:", error)` for unexpected errors
- `console.warn(...)` for non-critical issues (e.g., cookie clearing failure)
- `console.log(...)` for informational messages (e.g., "No authenticated user found")
- No log levels, no structured JSON logging, no external logging service
## Comments
- File-level comment showing file path (legacy pattern from Windows paths): `// C:\Ron\intranet-next-app\src\hoc\withAuth.tsx`
- File-level comment with relative path: `// src/app/api/ping/route.ts`
- Inline comments using `//` with checkmark emojis for step annotations: `// ✅ Check client-side cache first` (seen in `src/hooks/useRoleAuth.ts`, `src/app/api/sportsCulture/available/route.ts`)
- Block explanation comments after function definitions (see `src/hoc/withAuth.tsx` lines 34-66)
- Minimal usage. One JSDoc comment found in `src/lib/fetch-user-info.ts`: `/** Get the authenticated user's ID... */`
- Most functions have no documentation comments
## State Management
- No global state management library (no Redux, Zustand, Jotai)
- `AuthContext` (`src/context/AuthContext.tsx`) provides user session via React Context
- `useAuth()` hook is the single context consumer
- `useRoleAuth()` hook in `src/hooks/useRoleAuth.ts` caches role data in `localStorage` with 5-minute TTL
- Data fetched via raw `fetch()` in `useEffect` hooks
- No client-side caching beyond manual `localStorage` usage in `useRoleAuth`
## Styling
- CSS variables for theming defined in `src/app/globals.css`
- Utility classes applied directly in JSX
- `cn()` helper from `src/lib/utils.ts` combines `clsx` + `tailwind-merge`
- `aphrodite` package is listed as a dependency but no active usage detected in source files
- Custom fonts: Geist Sans, Geist Mono (local), Fredoka (Google Font)
## Module Design
- Named exports preferred for components: `export function AppLayout(...)`, `export function SimpleTable(...)`
- Named exports for library functions: `export function fetchUserInfo()`, `export function checkCcaAuthorization()`
- Default exports only for Next.js page/layout convention: `export default function Dashboard()`
- Re-exports from UI components: `export { Button, buttonVariants }`
- Not used. Each module is imported directly from its file path.
- Pure business logic functions (no React dependencies) in `src/lib/`
- Authorization: `src/lib/cca-chair-access.ts`, `src/lib/cca-management-access.ts`
- Feature flags: `src/lib/feature-flags.ts`
- Domain logic: `src/lib/cca-ranking-metrics.ts`, `src/lib/cca-ranking-comments.ts`, `src/lib/cca-cut-status.ts`
- Data fetching (server-only): `src/lib/fetch-user-info.ts` (marked `"use server"`)
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

## Pattern Overview
- Next.js 15 App Router with file-system-based routing for both pages and API routes
- Supabase as the sole backend (auth, database, storage) -- no custom backend server
- Client-side state management via React Context (AuthContext) with server-side data fetching via API routes
- Feature flag system controlling service availability at both layout (UI) and API layers
- Role-based access control enforced through CCA appointment/position data from Supabase
- SST (Serverless Stack) for AWS deployment via OpenNext
## Layers
- Purpose: Render UI, handle user interactions, manage client-side state
- Location: `src/app/` (pages), `src/components/` (reusable components)
- Contains: Page components (`page.tsx`), layout components (`layout.tsx`), UI primitives, feature-specific components
- Depends on: AuthContext, API routes (via `fetch()`), `src/lib/` utilities
- Used by: End users via browser
- Purpose: Server-side data access, authorization enforcement, business logic
- Location: `src/app/api/`
- Contains: Next.js route handlers (`route.ts`) organized by domain (user, cca, chair, holidaySubsidy, sportsCulture)
- Depends on: `src/lib/` (business logic helpers), `src/utils/supabase/server.ts` (Supabase server client), `src/types/`
- Used by: Presentation layer via `fetch()` calls
- Purpose: Shared domain logic, access control checks, feature flags, data transformation
- Location: `src/lib/`
- Contains: Authorization helpers, feature flag system, ranking metrics/comments, subsidy week logic, member management rules
- Depends on: `src/types/`, `src/utils/supabase/server.ts`
- Used by: API layer, some layout components (for feature flag checks)
- Purpose: Provide authenticated Supabase clients for server and client contexts
- Location: `src/utils/supabase/`
- Contains: `server.ts` (server-side client with cookie-based auth), `client.ts` (browser client), `middleware.ts` (session refresh)
- Depends on: `@supabase/ssr`, environment variables
- Used by: API routes (server client), AuthContext (browser client), middleware
- Purpose: Session management, user identity resolution, route protection
- Location: `src/middleware.ts`, `src/context/AuthContext.tsx`, `src/hoc/withAuth.tsx`, `src/lib/fetch-user-info.ts`
- Contains: Middleware for route protection, React context for client-side auth state, HOC for page protection, server-side user info fetching
- Depends on: Supabase Auth, `src/utils/supabase/`
- Used by: All protected pages and API routes
- Purpose: Shared TypeScript interfaces and types
- Location: `src/types/`
- Contains: User types, CCA position types, dashboard view models, holiday subsidy types
- Depends on: Nothing
- Used by: All layers
## Data Flow
- Server state: No global store; each page fetches data via `fetch()` to API routes in `useEffect`
- Client auth state: `AuthContext` at `src/context/AuthContext.tsx` provides `user`, `session`, `loading`, `signIn`, `signOut`
- Role authorization: `useRoleAuth` hook at `src/hooks/useRoleAuth.ts` fetches and caches (localStorage, 5min TTL) role check results from `/api/user/checkRole`
- Page-local state: `useState` and `useCallback` within individual page components
- No Redux, Zustand, or other external state management library
## Key Abstractions
- Purpose: Represents a fully resolved user with profile, role flags, and CCA appointments
- Defined in: `src/types/User.ts`
- Built by: `src/lib/fetch-user-info.ts` (`fetchUserInfo()`)
- Pattern: Server-side resolution from JWT claims + Supabase DB view (`authenticated_user_info`)
- Purpose: Encapsulates authorization check results with typed ok/error union
- Defined in: `src/lib/cca-chair-access.ts` and `src/lib/cca-management-access.ts`
- Pattern: `AccessResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string }`
- Used by: All CCA-related API routes to verify chair/management access before data operations
- Purpose: Toggle entire feature domains on/off (memberRanking, ccaApplications, holidaySubsidy)
- Defined in: `src/lib/feature-flags.ts`
- Pattern: Compile-time constants (not runtime/remote config). Change requires code edit and redeploy.
- Consumed by: Layout components (UI gating), API routes (503 responses), sidebar navigation (item filtering)
- Purpose: Provides consistent sidebar + breadcrumb + content area for all dashboard pages
- Defined in: `src/components/layout/app-layout.tsx`
- Pattern: Wraps page content with `SidebarProvider` > `AppSidebar` + `SidebarInset` with auto-generated breadcrumbs from URL path
- Used by: Every dashboard page component
- Purpose: Metric-based ranking with CCA-type-specific scoring rules
- Defined in: `src/lib/cca-ranking-metrics.ts` (metric keys, scoring), `src/lib/cca-ranking-comments.ts` (serialization/deserialization)
- Pattern: Different metric keys for sports (attendance), culture (attendance + performance), and resident (helpfulness + initiative + attitude) CCA types
## Entry Points
- Location: `src/app/layout.tsx`
- Triggers: Every page request
- Responsibilities: Wraps all pages with `AuthProvider`, `Toaster`, font configuration
- Location: `src/middleware.ts`
- Triggers: Requests to `/dashboard/*` and `/auth/*`
- Responsibilities: Session validation via Supabase JWT claims, redirect unauthenticated users to login, redirect authenticated users away from auth pages
- Location: `src/app/page.tsx`
- Triggers: Root URL `/`
- Responsibilities: Server component that checks auth, redirects to `/dashboard` if logged in, otherwise shows landing page
- Location: `src/app/dashboard/page.tsx`
- Triggers: `/dashboard`
- Responsibilities: Displays welcome card, points recap, navigation cards for CCAs, ranking, sports & culture
- Location: `src/app/auth/callback/route.ts`
- Triggers: OAuth redirect from Google
- Responsibilities: Exchange auth code for session, validate user exists in DB, redirect to intended page
- Location: `src/app/api/user/route.ts`
- Triggers: GET from AuthContext on page load, DELETE on sign out
- Responsibilities: Return authenticated user profile, clear auth cookies on logout
## Error Handling
- API routes wrap logic in try/catch, return `NextResponse.json({ error: "message" }, { status: N })` with specific HTTP status codes (401, 403, 404, 500)
- Client pages use `toast.error()` (from both `react-hot-toast` and `sonner`) to display errors from failed API calls
- Authorization failures return structured errors via `AccessResult` pattern: `{ ok: false, status: 403, error: "You are not authorized..." }`
- Supabase query errors are logged with `console.error()` and returned as 500 responses
- Feature-disabled responses return 503 with descriptive message via `getCoreServiceDisabledApiResponse()`
- No global error boundary component detected; individual pages handle their own error states
## Cross-Cutting Concerns
- `is_admin` flag for full admin access
- `is_jcrc` flag for JCRC-specific features (holiday subsidy approvals, member ranking override)
- `is_culture_sports_admin` flag for sports/culture admin features
- Position-based: "lead" and "vice" position types grant chair access to manage their specific CCA
- All enforced via `checkCcaAuthorization()` and `getManagedCcaAccess()` in `src/lib/`
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, or `.github/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
