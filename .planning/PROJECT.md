# Intranet Next App — Refactor & Overhaul

## What This Is

A Next.js 15 intranet application for managing CCAs (Co-Curricular Activities), member rankings, CCA allocation, and holiday subsidies, backed by Supabase. The app has working features but suffers from a critical auth bug (SSR session bleed), poor code organization (1000+ line page components), scattered business logic, and inconsistent UI patterns. This project is a complete refactor to fix auth, restructure the codebase following best practices, and standardize the UI.

## Core Value

Users can securely authenticate and manage CCA operations without session bleed or data leaking between accounts.

## Requirements

### Validated

- ✓ Google OAuth sign-in via Supabase — existing
- ✓ CCA management (create, view, manage members) — existing
- ✓ Member ranking system with metrics and comments — existing
- ✓ CCA allocation with applicant ranking — existing
- ✓ Holiday subsidy tracking (weekly, approvals) — existing
- ✓ Sports & culture availability management — existing
- ✓ Role-based access control (JCRC positions, chair roles) — existing
- ✓ Feature flag system for service gating — existing
- ✓ SST/OpenNext deployment pipeline — existing
- ✓ SSR session bleed fixed with middleware cookie writeback and no-cache headers — validated in Phase 01: Auth Fix & Security
- ✓ Supabase auth packages upgraded to current SSR-safe versions — validated in Phase 01: Auth Fix & Security
- ✓ Auth consolidated to middleware + AuthContext with `withAuth` removed — validated in Phase 01: Auth Fix & Security
- ✓ Vitest auth safety net added for middleware, callback, and AuthContext flows — validated in Phase 01: Auth Fix & Security
- ✓ Standardized on `sonner` as the single toast library with `react-hot-toast` removed — validated in Phase 02: Infrastructure Cleanup
- ✓ Removed unused dependencies (`aphrodite`, `fs`, `logger`) from the runtime dependency graph — validated in Phase 02: Infrastructure Cleanup
- ✓ Replaced self-calling managed-CCA API routes with direct shared-lib calls — validated in Phase 02: Infrastructure Cleanup
- ✓ Replaced `any` suppressions with shared TypeScript interfaces across the infrastructure cleanup scope — validated in Phase 02: Infrastructure Cleanup
- ✓ Re-enabled ESLint enforcement during production builds and added Prettier formatting tooling — validated in Phase 02: Infrastructure Cleanup

### Active

- [ ] Refactor CCA management pages — extract logic from giant components into hooks and utilities
- [ ] Refactor member ranking pages — break up 500+ line components, proper typing
- [ ] Refactor allocation pages — separate data fetching, state, and rendering concerns
- [ ] Refactor holiday subsidy pages — consistent patterns, remove hardcoded week definitions
- [ ] UI consistency pass — standardize component patterns, spacing, and styling across all pages
- [ ] Fix non-atomic delete-then-insert in saveRankings

### Out of Scope

- New features beyond current functionality — this is a refactor, not a feature release
- Migration away from Supabase — Supabase stays as the backend
- Migration away from Next.js App Router — staying on current framework
- Mobile app — web-only for now
- Real-time/websocket features — not needed for current use cases

## Context

- **Codebase state:** Brownfield Next.js 15 app with Supabase backend, deployed via SST/OpenNext to AWS
- **Critical bug:** SSR session bleed fixed in Phase 01 — middleware now refreshes auth cookies onto both request and response with private no-cache headers.
- **Code quality:** 35+ eslint-disable directives, dual toast libraries, 1000+ line page components, `any` types throughout
- **Auth pattern:** Consolidated to two patterns — middleware for route protection/refresh and `AuthContext` for client auth state.
- **Feature flags:** Hardcoded compile-time constants — all currently set to `false`
- **Existing codebase map:** `.planning/codebase/` contains detailed analysis (7 documents, 1483 lines)

## Constraints

- **Tech stack**: Next.js 15 App Router + Supabase + TypeScript — no framework changes
- **Feature parity**: All existing features must continue working after refactor
- **Auth security**: Session isolation must be verified — no user data can leak between sessions
- **Deployment**: SST/OpenNext on AWS — deployment pipeline must remain functional

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Fix auth before refactoring features | Session bleed is a security bug that affects all users | Completed in Phase 01 |
| Refactor in feature order: CCA → Ranking → Allocation → Subsidies | User-specified priority order based on feature importance | — Pending |
| Standardize on sonner for toasts | Already has provider in layout.tsx, newer library | Completed in Phase 02 |
| Research latest Supabase packages | Current auth patterns may be outdated, need to verify best practices | Completed in Phase 01 |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-11 after Phase 02 completion*
