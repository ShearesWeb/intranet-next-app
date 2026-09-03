# External Integrations

**Analysis Date:** 2026-09-03

## APIs & External Services

**None detected** - This application does not integrate with third-party APIs (Stripe, Twilio, etc.). All business logic is self-contained or delegated to platform services (Supabase, Cloudflare).

## Data Storage

**Databases:**
- Supabase (PostgreSQL)
  - Connection: Environment variable `NEXT_PUBLIC_SUPABASE_URL`
  - Client: `@supabase/supabase-js` and `@supabase/ssr` (server-side rendering helpers)
  - Auth: Cookie-based session via `@supabase/ssr` - no runtime secrets needed
  - Access: `src/lib/supabase/server.ts` (server-side), `src/lib/supabase/client.ts` (browser-side)
  - RLS: Row-level security policies applied at database level
  - PostgREST: Used in local testing for integration tests via `tests/integration/`

**File Storage:**
- Supabase Storage (user profile pictures)
  - Bucket: `user-profile-pictures`
  - Usage: Profile photo storage for authenticated users
  - Access: `src/lib/auth/fetch-user-info.ts` retrieves public URLs via `supabase.storage.from("user-profile-pictures").getPublicUrl()`

**Caching:**
- Cloudflare R2 (Next.js incremental cache)
  - Binding: `NEXT_INC_CACHE_R2_BUCKET` in `wrangler.jsonc`
  - Buckets: `prd-web-cache-intranet-web` (production), `preprod-web-cache-intranet-web` (preprod)
  - Configuration: `open-next.config.ts` uses `r2IncrementalCache` override
  - Note: No ISR (Incremental Static Revalidation) or on-demand revalidation used - app is entirely dynamic

## Authentication & Identity

**Auth Provider:**
- Supabase Auth (built-in PostgreSQL auth)
  - Implementation: Magic links + JWT tokens
  - Session management: Cookies via `@supabase/ssr` middleware
  - User info: Fetched from Supabase view `authenticated_user_info` in `src/lib/auth/fetch-user-info.ts`
  - Type: `AuthenticatedUser` in `src/types/user.ts`
  - Flags: `is_admin`, `is_jcrc`, `is_culture_sports_admin` (from JWT claims + DB view)
  - Middleware: `src/middleware.ts` validates JWT on every `/dashboard/*` and `/auth/*` request

**Magic Link Login:**
- Endpoint: `/auth/callback` handles Supabase redirect (`src/app/auth/callback/route.ts`)
- QA: `make e2e-login PERSONA=<name>` generates magic links for test personas (defined in `tests/fixtures/personas.ts`)

**Session Isolation:**
- Primary correctness invariant: No user data leaks between sessions
- Mechanism: Supabase RLS policies + row-level permission checks in API route handlers
- Access guards: `requireAuth()`, `requireChairAccess()`, `requireJcrcAccess()` from `src/lib/api/auth.ts`

## Monitoring & Observability

**Error Tracking:**
- Not detected - No external error tracking service (Sentry, LogRocket, etc.) configured

**Logs:**
- Console logging via `console.error()` for debugging
- Cloudflare Workers logging (via wrangler in development/preview)
- No persistent log aggregation detected

**Metrics:**
- Not detected - No performance monitoring service (DataDog, New Relic, etc.) configured

## CDN & Image Serving

**CDN:**
- Cloudfront (AWS CloudFront)
  - Hostname: `deifkwefumgah.cloudfront.net`
  - Usage: Static asset delivery (SVG patterns, images)
  - Configuration: `next.config.mjs` allowlist for remote image patterns
  - Example: Landing page uses `https://deifkwefumgah.cloudfront.net/shadcnblocks/...` for hero graphics

**Image Processing:**
- Cloudflare Images binding (via wrangler `images` configuration)
  - Used for optimized image serving on Workers
  - Binding: `IMAGES` in `wrangler.jsonc`

## CI/CD & Deployment

**Hosting:**
- Cloudflare Workers
  - Production: Worker `"intranet"` → `intranet.shweb.org` (via Terraform custom domain)
  - Preprod: Worker `"intranet-preprod"` → `intranet-beta.shweb.org` (via Terraform custom domain)
  - Deployment: OpenNext adapter (`opennextjs-cloudflare` CLI)

**Terraform Infrastructure:**
- Location: `infra/` directory
- Manages: R2 buckets, Cloudflare Workers custom domains
- Convention: Resource names follow `{env}-web-{resource}-{project}` pattern
- Bindings: Terraform owns R2 + custom domains; wrangler owns Worker script + bindings

**CI Pipeline:**
- GitHub Actions via `.github/workflows/`
  - `1-feature-branch-ci.yml` - Push to non-main branches: prettier, lint, typecheck, unit/component tests
  - `2-merge-request-ci.yml` - PR into main: all of above + `next build` + integration tests
  - `3-preprod-deploy.yaml` - PR merged or `vX.Y.Z-rc` tag pushed: cuts tag, Terraform apply, deploys preprod
  - `4-prd-deploy.yaml` - `workflow_dispatch` on `vX.Y.Z` tag: Terraform apply, deploys production
  - Requires secret: `SUBMODULE_SSH_KEY` (read-only deploy key for private schema repo `ShearesWeb/intranet`)

**Versioning:**
- Semantic versioning: Merging PR into main cuts `vX.Y.Z-rc` tag and deploys to preprod
- Successful preprod deploy cuts `vX.Y.Z` tag (marks as production-ready)
- Production deploy via manual `workflow_dispatch` against a `vX.Y.Z` tag

## Environment Configuration

**Required build-time env vars:**
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` OR `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY` OR `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase public API key (fallback chain in `src/lib/supabase/server.ts` and `client.ts`)

**Secrets location:**
- GitHub Actions secrets: `SUBMODULE_SSH_KEY` (for schema repo access)
- Cloudflare: Environment variables managed via `wrangler env` or CI pipeline

**No runtime secrets:**
- All Supabase auth is cookie-based via `@supabase/ssr`
- No API keys, database passwords, or other secrets needed at runtime

## Webhooks & Callbacks

**Incoming:**
- `/auth/callback` - Supabase magic link redirect handler (`src/app/auth/callback/route.ts`)
- No other webhook endpoints detected

**Outgoing:**
- Not detected - No outgoing webhooks or callbacks to external services

## Additional Integrations

**Google Fonts:**
- Endpoint: `fonts.googleapis.com` (via Next.js `next/font/google`)
- Fonts loaded: Quicksand, Space Mono, Fredoka
- Usage: Typography in dashboard and component library

**PostgREST (Local Testing Only):**
- Purpose: Mock Supabase backend for integration tests without using Supabase platform
- Deployment: Docker container (`postgrest/postgrest`)
- Configuration: `Makefile` target `db-up` starts PostgREST on port 3001
- Auth: Self-signed JWT (`super-secret-jwt-token-with-at-least-32-characters-long`)
- Connection: Integration tests use `@test-utils/integration/persona-supabase.ts` to mock Supabase client against PostgREST

---

*Integration audit: 2026-09-03*
