# Technology Stack

**Analysis Date:** 2026-04-10

## Languages

**Primary:**
- TypeScript ^5.7.2 - All application code (`src/**/*.ts`, `src/**/*.tsx`)
- CSS (Tailwind v4) - Styling via `src/app/globals.css` and utility classes

**Secondary:**
- JavaScript (ESM) - Config files (`next.config.mjs`, `postcss.config.mjs`)

## Runtime

**Environment:**
- Node.js 22.22 (pinned in CI workflows `.github/workflows/*.yml`)
- No `.nvmrc` file present

**Package Manager:**
- npm (primary)
- Lockfile: `package-lock.json` present
- No yarn.lock (CI auto-detects but defaults to npm)

## Frameworks

**Core:**
- Next.js ^15.1.2 - Full-stack React framework (App Router)
- React ^18 / React DOM ^18 - UI library
- Tailwind CSS ^4.1.14 - Utility-first CSS framework (v4, uses `@import 'tailwindcss'` syntax)

**Infrastructure:**
- SST 3.17.10 - Serverless deployment framework for AWS (`sst.config.ts`)
- Pulumi - Infrastructure-as-code engine (used under SST)

**Testing:**
- Not detected - No test framework configured (no jest, vitest, or testing-library in dependencies)

**Build/Dev:**
- PostCSS ^8 with `@tailwindcss/postcss` ^4.1.14 (`postcss.config.mjs`)
- ESLint ^8 with `eslint-config-next` 14.2.13 (`.eslintrc.json`)
- ts-node ^10.9.2 - Used for running scripts (`tsconfig.scripts.json`)
- tw-animate-css ^1.4.0 - Tailwind animation utilities

## Key Dependencies

**Critical:**
- `@supabase/supabase-js` ^2.50.3 - Supabase client for database and auth
- `@supabase/ssr` ^0.7.0 - Server-side Supabase client for Next.js (cookie-based sessions)
- `next` ^15.1.2 - Core framework
- `sst` 3.17.10 - Deployment and infrastructure

**UI Components (shadcn/ui pattern):**
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

**Data & Interaction:**
- `@tanstack/react-table` ^8.21.3 - Data table library
- `framer-motion` ^12.4.10 - Animation library

**Notifications:**
- `sonner` ^2.0.7 - Toast notifications (primary, used in `src/app/layout.tsx`)
- `react-hot-toast` ^2.4.1 - Toast notifications (secondary, used in `src/hoc/withAuth.tsx`)

**Other:**
- `next-themes` ^0.4.6 - Dark/light mode support
- `csv-parse` ^5.6.0 - CSV parsing (used in scripts)
- `aphrodite` ^2.4.0 - CSS-in-JS (likely legacy, no active usage detected in main codebase)

## Configuration

**TypeScript:**
- Main config: `tsconfig.json` - strict mode, bundler module resolution, `@/*` path alias maps to `./src/*`
- Scripts config: `tsconfig.scripts.json` - CommonJS module, ES2017 target

**ESLint:**
- Config: `.eslintrc.json`
- Extends: `next/core-web-vitals`, `next/typescript`
- ESLint is ignored during builds (`next.config.mjs`: `eslint.ignoreDuringBuilds: true`)

**Build:**
- `next.config.mjs` - Remote image patterns for CloudFront (`deifkwefumgah.cloudfront.net`)
- `postcss.config.mjs` - Tailwind CSS v4 PostCSS plugin
- `sst.config.ts` - AWS deployment configuration with stage-based domains

**Environment:**
- `.env.local` present (not read - contains secrets)
- Required env vars:
  - `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
  - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY` or `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key (both supported as fallbacks)

**Fonts:**
- Local: Geist Sans (`src/app/fonts/GeistVF.woff`), Geist Mono (`src/app/fonts/GeistMonoVF.woff`)
- Google: Fredoka (weights 300-700)

## Platform Requirements

**Development:**
- Node.js 22.22+
- npm
- Supabase project with configured Google OAuth

**Production:**
- AWS (via SST/Pulumi)
- Production domain: `intranet.shweb.org`
- Pre-production domain: `intranet-beta.shweb.org`
- CloudFront CDN for image delivery (`deifkwefumgah.cloudfront.net`)

**CI/CD:**
- GitHub Actions with 3 workflows:
  - `.github/workflows/1-ci-merge-request.yml` - Build validation on PRs to main
  - `.github/workflows/2-preprod-release.yml` - Deploy to preprod on `v*.*.*-rc` tags
  - `.github/workflows/3-prd-release.yml` - Deploy to production on `v*.*.*` tags
- Tag-based release flow: `v1.2.3-rc` -> preprod -> auto-promotes to `v1.2.3` -> production

## Scripts

**Available npm scripts:**
- `npm run dev` - Start development server
- `npm run build` - Build Next.js app
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run run-script` - Execute scripts via ts-node (`scripts/index.ts`)

---

*Stack analysis: 2026-04-10*
