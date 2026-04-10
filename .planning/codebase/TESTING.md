# Testing Patterns

**Analysis Date:** 2026-04-10

## Test Framework

**Runner:**
- None configured. No test framework is installed or configured in this project.
- No Jest, Vitest, Mocha, Cypress, or Playwright configuration files exist.
- No test runner appears in `package.json` scripts.
- No test-related dependencies in `package.json` (no `jest`, `vitest`, `@testing-library/*`, `cypress`, `playwright`).

**Assertion Library:**
- None installed.

**Run Commands:**
```bash
# No test commands exist in package.json
# Available scripts are: build, dev, lint, run-script, start
```

## Test File Organization

**Location:**
- No test files exist anywhere in `src/`.
- Zero `.test.ts`, `.test.tsx`, `.spec.ts`, or `.spec.tsx` files found in the source tree.
- No `__tests__/` directories in the source tree.

**Naming:**
- No convention established.

## Test Coverage

**Requirements:** None enforced. No coverage tool configured.

**Current Coverage:** 0% -- no tests exist.

## What Exists Instead of Tests

**Manual testing page:**
- `src/app/testPage/page.tsx` exists as a manual test/debug page (not an automated test).

**ESLint as sole quality gate:**
- `npm run lint` runs `next lint` with `next/core-web-vitals` and `next/typescript` rules.
- However, `eslint.ignoreDuringBuilds: true` in `next.config.mjs` means lint errors do not fail the build.

**No CI pipeline detected:**
- No `.github/workflows/`, `.circleci/`, or other CI config files found.
- Deployment via SST (`sst.config.ts`) but no test step in the deployment pipeline.

## Recommendations for Adding Tests

If tests are to be added, the following setup would be consistent with the existing stack:

**Recommended framework:** Vitest (native ESM support, fast, works well with Next.js)

**Recommended setup files to create:**
- `vitest.config.ts` at project root
- `src/setupTests.ts` for global test setup

**Recommended dependencies to add:**
```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom
```

**Recommended vitest.config.ts:**
```typescript
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/setupTests.ts'],
    globals: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

**Recommended package.json scripts:**
```json
{
  "test": "vitest",
  "test:watch": "vitest --watch",
  "test:coverage": "vitest --coverage"
}
```

**Where to place test files:**
- Co-locate with source files: `src/lib/cca-chair-access.test.ts` next to `src/lib/cca-chair-access.ts`
- Page component tests: `src/app/dashboard/__tests__/page.test.tsx`
- API route tests: `src/app/api/user/__tests__/route.test.ts`

**Highest-value targets for initial test coverage:**

1. **Pure business logic in `src/lib/` (unit tests, no mocking needed):**
   - `src/lib/cca-chair-access.ts` -- `checkCcaAuthorization()` has clear input/output
   - `src/lib/cca-ranking-metrics.ts` -- `getRankingScore()`, `getRankingMetricKeys()`, `hasRequiredRankingInputs()`
   - `src/lib/cca-ranking-comments.ts` -- `extractRankingCommentFields()`, `buildRankingComments()`
   - `src/lib/cca-cut-status.ts` -- `normalizeCutStatusForCca()`
   - `src/lib/cca-member-management.ts` -- `canManageCcaMembers()`
   - `src/lib/feature-flags.ts` -- `isCoreServiceEnabled()`, `getCoreServiceTitle()`, `isFeatureFlaggedItemEnabled()`
   - `src/lib/holiday-subsidy-weeks.ts` -- `getEditableWeekIds()`, `isWeekEditable()`, `getWeekLabel()`

2. **Navigation/access logic (unit tests with minimal mocking):**
   - `src/components/layout/app-sidebar.tsx` -- `buildNavItems()` is a pure function that takes a user object

3. **API routes (integration tests, requires Supabase mocking):**
   - `src/app/api/user/route.ts`
   - `src/app/api/cca/[ccaId]/members/route.ts`
   - `src/app/api/holidaySubsidy/declarations/[ccaId]/route.ts`

**Example test for existing code:**
```typescript
// src/lib/cca-chair-access.test.ts
import { describe, it, expect } from 'vitest';
import { checkCcaAuthorization, isChairPositionType } from './cca-chair-access';

describe('isChairPositionType', () => {
  it('returns true for lead', () => {
    expect(isChairPositionType('lead')).toBe(true);
  });

  it('returns true for vice', () => {
    expect(isChairPositionType('vice')).toBe(true);
  });

  it('returns false for member', () => {
    expect(isChairPositionType('member')).toBe(false);
  });

  it('handles null/undefined', () => {
    expect(isChairPositionType(null)).toBe(false);
    expect(isChairPositionType(undefined)).toBe(false);
  });
});

describe('checkCcaAuthorization', () => {
  it('returns unauthorized when no user', () => {
    const result = checkCcaAuthorization({ requestingUser: null });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(401);
    }
  });

  it('grants chair access when user has lead appointment for CCA', () => {
    const result = checkCcaAuthorization({
      requestingUser: {
        id: 1,
        appointments: [
          { cca_id: 10, cca_name: 'Basketball', position_id: 1, position_name: 'Lead', is_admin: false, position_type: 'lead', points: 0 },
        ],
      },
      cca: { id: 10 },
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.hasChairAccess).toBe(true);
    }
  });
});
```

**Example test for feature flags:**
```typescript
// src/lib/feature-flags.test.ts
import { describe, it, expect } from 'vitest';
import { getCoreServiceTitle, isCoreServiceEnabled } from './feature-flags';

describe('getCoreServiceTitle', () => {
  it('converts camelCase to title case', () => {
    expect(getCoreServiceTitle('memberRanking')).toBe('Member Ranking');
  });

  it('preserves CCA as uppercase', () => {
    expect(getCoreServiceTitle('ccaApplications')).toBe('CCA Applications');
  });
});
```

**Mocking patterns for Supabase (when testing API routes):**
```typescript
// Mock the server Supabase client
vi.mock('@/utils/supabase/server', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: mockData, error: null }),
    })),
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }),
    },
  })),
}));

// Mock fetchUserInfo for auth
vi.mock('@/lib/fetch-user-info', () => ({
  fetchUserInfo: vi.fn().mockResolvedValue(mockAuthenticatedUser),
}));
```

## Summary

This codebase has **zero automated test coverage**. There is no test framework installed, no test configuration, no test files, and no CI pipeline to run tests. The only quality gate is ESLint, which is also configured to be skipped during builds. All testing appears to be manual.

The `src/lib/` directory contains well-isolated pure functions that would be straightforward to test without any mocking infrastructure, making it the ideal starting point for introducing tests.

---

*Testing analysis: 2026-04-10*
