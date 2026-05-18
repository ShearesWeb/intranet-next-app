# External Integrations

**Analysis Date:** 2026-04-10

## APIs & External Services

**Supabase (Primary Backend):**
- Supabase is the sole backend service, providing database, authentication, and file storage
- SDK: `@supabase/supabase-js` ^2.50.3, `@supabase/ssr` ^0.7.0
- Auth env vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`

**No other external API integrations detected.** All business logic runs through Supabase.

## Data Storage

**Database: Supabase (PostgreSQL)**

Connection is established through the Supabase JS client (not raw SQL). Three client patterns exist:

- **Server client:** `src/utils/supabase/server.ts` - Used in API routes and server actions. Cookie-based session with write disabled by default.
- **Browser client:** `src/utils/supabase/client.ts` - Used in React client components via `AuthContext`.
- **Middleware client:** `src/utils/supabase/middleware.ts` - Used in `src/middleware.ts` for session validation. Cookie writes intentionally disabled.

**Database Tables (accessed via Supabase client):**

| Table/View | Type | Used In |
|---|---|---|
| `authenticated_user_info` | View (likely) | `src/lib/fetch-user-info.ts` - User lookup by email |
| `public_user_info` | View (likely) | `src/app/api/user/search/route.ts`, `src/app/api/cca/[ccaId]/members/route.ts` |
| `ccas` | Table | CCA lookup and management across multiple API routes |
| `cca_positions` | Table | Position data for CCAs (sports, culture, committee) |
| `cca_appointments` | Table | User-to-position assignments (members, applications) |
| `cca_allocation_events` | Table | Audit log for CCA allocation changes |
| `cca_member_rankings` | Table | Member ranking data per CCA |
| `cca_user_ranking` | Table/View | User ranking for chair position management |
| `cca_capacity_info` | View (likely) | Position capacity info for chair management |
| `managed_cca_positions` | View (likely) | `src/lib/cca-management-access.ts` - Managed CCA access check |
| `user_cca_applications` | Table/View | `src/app/api/user/saveRankings/route.ts`, `src/app/api/user/getRankablePositions/[email]/route.ts` |
| `subsidies` | Table | Holiday subsidy declarations |
| `user_subsidies` | View (likely) | Holiday subsidy per-user aggregation |

**File Storage:**
- Supabase Storage bucket: `user-profile-pictures`
  - Used in `src/lib/fetch-user-info.ts` to generate public URLs for profile photos
  - Public URLs served via Supabase CDN

**Caching:**
- No dedicated caching layer (no Redis, no Memcached)
- Client-side role auth caching in localStorage (`src/hooks/useRoleAuth.ts`, 5-minute TTL)
- API routes use `Cache-Control: no-store, private` headers
- Legacy cookie-based user cache (being cleaned up via `AUTH_USER_CACHE_KEY` in `src/lib/constants/auth.ts`)

## Authentication & Identity

**Auth Provider: Supabase Auth with Google OAuth**

- OAuth provider: Google (configured via `signInWithOAuth({ provider: 'google' })`)
- Flow:
  1. User clicks login -> `src/context/AuthContext.tsx` calls `supabase.auth.signInWithOAuth`
  2. Google OAuth redirect to `src/app/auth/callback/route.ts`
  3. Code exchange: `supabase.auth.exchangeCodeForSession(code)`
  4. User validation: `fetchUserInfo()` checks if user exists in `authenticated_user_info` table
  5. If no matching user in DB -> sign out and redirect to login with `user_not_found` error
- Session management: Cookie-based via `@supabase/ssr`
- Token validation: `supabase.auth.getClaims()` used in middleware and server functions
- Custom JWT claims supported: `app_user_id`, `intranet_user_id`, `internal_user_id` (`src/lib/fetch-user-info.ts`)

**Route Protection:**
- Middleware (`src/middleware.ts`) protects `/dashboard/*` and `/auth/*` routes
- Client-side HOC: `src/hoc/withAuth.tsx` - Wraps pages requiring auth (redirects to `/auth/login`)
- Role checking: `src/hooks/useRoleAuth.ts` - Checks user positions via `/api/user/checkRole`

**Authorization Model:**
- Role flags on user: `is_admin`, `is_jcrc`, `is_culture_sports_admin` (from `authenticated_user_info` view)
- Position-based access: Chair positions (lead/vice) grant CCA management access (`src/lib/cca-chair-access.ts`)
- Managed CCA access: Combines chair access with `managed_cca_positions` view (`src/lib/cca-management-access.ts`)

**Feature Flags:**
- Hardcoded feature flags in `src/lib/feature-flags.ts`
- Three core service flags: `memberRanking`, `ccaApplications`, `holidaySubsidy` (all currently `false`)
- JCRC override: `memberRanking` can be enabled for JCRC users
- API routes check flags via `getCoreServiceDisabledApiResponse()` returning 503 when disabled
- UI component: `src/components/feature-flags/service-disabled-state.tsx`

## Monitoring & Observability

**Error Tracking:**
- None configured (no Sentry, Datadog, or similar)

**Logs:**
- `console.log`, `console.error`, `console.warn` throughout codebase
- No structured logging framework

## CI/CD & Deployment

**Hosting:**
- AWS via SST (Serverless Stack) 3.17.10
- SST uses `sst.aws.Nextjs` construct (`sst.config.ts`)
- Pulumi as the infrastructure engine under SST
- CloudFront for static asset delivery

**CI Pipeline: GitHub Actions**

| Workflow | Trigger | Purpose |
|---|---|---|
| `1-ci-merge-request.yml` | PR to `main` | Build validation (`next build`) |
| `2-preprod-release.yml` | Tag `v*.*.*-rc` | Deploy to preprod (`sst deploy --stage preprod`) |
| `3-prd-release.yml` | Tag `v*.*.*` | Deploy to production (`sst deploy --stage prd`) |

**Deployment Flow:**
1. PR merged to `main`
2. Tag `v1.2.3-rc` -> triggers preprod deploy
3. On success, preprod workflow auto-creates `v1.2.3` tag
4. `v1.2.3` tag -> triggers production deploy

**Required CI Secrets:**
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY`
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_REGION` (GitHub variable, not secret)

**Environments:**
- `preprod` - Pre-production (domain: `intranet-beta.shweb.org`)
- `prd` - Production (domain: `intranet.shweb.org`, protected: true, removal: retain)

## Image Delivery

**CloudFront CDN:**
- Remote images allowed from `deifkwefumgah.cloudfront.net` (configured in `next.config.mjs`)
- User profile photos stored in Supabase Storage, served via Supabase CDN URLs

**Static Assets:**
- Next.js Image component used for optimized images (`next/image`)
- Local images in `public/images/` (e.g., `shweb-logo.png`)

## Webhooks & Callbacks

**Incoming:**
- `/auth/callback` (`src/app/auth/callback/route.ts`) - OAuth callback from Google via Supabase Auth

**Outgoing:**
- None detected

## Environment Configuration

**Required env vars (all prefixed `NEXT_PUBLIC_` for client access):**
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY` - Supabase anon key (preferred name)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anon key (fallback name)

**Secrets location:**
- `.env.local` for local development
- GitHub Actions secrets for CI/CD
- AWS credentials in GitHub Actions secrets

**Note:** Both `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are supported as fallbacks for each other. This dual-name pattern appears in `src/utils/supabase/server.ts`, `src/utils/supabase/client.ts`, `src/utils/supabase/middleware.ts`, and `sst.config.ts`.

## Legacy / Commented-Out Integrations

**Firebase Admin SDK** (`scripts/index.ts`):
- Entirely commented out
- Was previously used for user onboarding (creating Firebase Auth users alongside Supabase users)
- References `firebase-adminsdk-mtuwq@intranet-next-app.iam.gserviceaccount.com`
- Contains hardcoded credentials in comments (service role key and private key) -- these should be rotated

---

*Integration audit: 2026-04-10*
