# Technology Stack

**Analysis Date:** 2026-09-03

## Languages

**Primary:**
- TypeScript 5.7.2 - Full application including API routes, components, and utilities

**Secondary:**
- JavaScript (legacy) - Some config files use `.mjs` format (Next.js, PostCSS, OpenNext configs)

## Runtime

**Environment:**
- Node.js (via Cloudflare Workers runtime in production; local development via standard Node)

**Package Manager:**
- npm (repo CLAUDE.md documents `npm run` scripts; Makefile wraps the rest)
- Lockfile: `package-lock.json` (committed)

## Frameworks

**Core:**
- Next.js 15.1.2 - Full-stack web framework with App Router, API routes, SSR
- React 18 - UI component library (no major version specified, pinned to v18)

**Testing:**
- Vitest 4.1.4 - Unit and component test runner
  - Config: `vitest.config.mts` (unit tests in Node environment, component tests in happy-dom)
  - Integration tests: `vitest.integration.config.mts` (runs against real Postgres + PostgREST)

**Build/Dev:**
- @opennextjs/cloudflare 1.19.11 - Adapter for deploying Next.js on Cloudflare Workers
- wrangler 4.95.0 - Cloudflare Workers CLI and local development
- tsx 4.22.3 - TypeScript execution runtime for scripts

## UI & Styling

**Component Libraries:**
- @radix-ui/* (v1-2) - Headless UI primitives (accordion, avatar, checkbox, collapsible, dialog, dropdown, separator, slot, tooltip)
- Lucide React 0.545.0 - Icon library
- shadcn/ui (new-york style) - Pre-built shadcn components in `src/components/ui/`

**Styling:**
- Tailwind CSS 4.1.14 - Utility-first CSS framework with PostCSS integration
- @tailwindcss/postcss 4.1.14 - Tailwind PostCSS plugin
- PostCSS 8.5.10 - CSS transformation tool
- tailwind-merge 3.3.1 - Merges Tailwind classes intelligently
- clsx 2.1.1 - Classname builder (conditional CSS)
- class-variance-authority 0.7.1 - Component variant pattern helper
- tw-animate-css 1.4.0 - Additional Tailwind animation utilities
- next-themes 0.4.6 - Dark/light mode theme switching

**Fonts:**
- Google Fonts via Next.js font loader (Quicksand, Space Mono, Fredoka)

## Key Dependencies

**Critical:**
- @supabase/supabase-js 2.103.0 - Supabase JavaScript client library
- @supabase/ssr 0.10.2 - Supabase server-side rendering helpers (auth persistence via cookies)
- @supabase/postgrest-js 2.103.0 - PostgREST client (dev dependency for testing)

**Data Management:**
- @tanstack/react-table 8.21.3 - Headless table library with sorting, filtering, pagination

**Notifications:**
- sonner 2.0.7 - Toast notification library

## Configuration

**Build & Dev Config:**
- `next.config.mjs` - Next.js configuration with image remote patterns (Cloudfront CDN)
- `tsconfig.json` - TypeScript compiler options with path aliases (`@/*` → `./src/*`)
- `open-next.config.ts` - OpenNext Cloudflare configuration (R2 incremental cache)
- `wrangler.jsonc` - Cloudflare Workers configuration (R2 buckets, services bindings, env-specific settings)
- `postcss.config.mjs` - PostCSS configuration for Tailwind
- `vitest.config.mts` - Vitest configuration for unit/component tests
- `vitest.integration.config.mts` - Vitest configuration for integration tests

**Code Quality:**
- `.eslintrc.json` - ESLint extends Next.js core-web-vitals and TypeScript
- `.prettierrc` - Prettier config: tabs (width 2), semicolons, no single quotes, trailing commas, 100-char width

**Environment:**
- Build-time only: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (or alternatives `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`)
- No runtime secrets required - all Supabase auth is cookie-based via @supabase/ssr

## Platform Requirements

**Development:**
- Node.js (18+ implied by modern packages)
- Docker + Liquibase (for local integration testing via `make db-up`)
- PostgreSQL 12+ (for local DB testing)
- Make (task runner for `Makefile` commands)

**Production:**
- Cloudflare Workers (serverless compute)
- Cloudflare R2 (object storage for incremental cache)
- Supabase (PostgreSQL database + auth + file storage)
- Cloudfront CDN (image serving)

---

*Stack analysis: 2026-09-03*
