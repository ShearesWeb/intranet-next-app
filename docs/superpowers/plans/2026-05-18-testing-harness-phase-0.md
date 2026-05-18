# Testing Harness Phase 0 — Static Checks + Unit Harness Hardening

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the existing-but-ungated test infrastructure into a CI-enforced gate, with happy-dom + Vitest projects in place and the cheapest layer of authorization defense (the `isChairPositionType` enumeration) made exhaustive.

**Architecture:** No new test layers introduced. Modify `vitest.config.mts` to split unit vs. component environments via the `projects` field, swap `jsdom` for `happy-dom`, add a `typecheck` npm script, and extend the existing CI workflow with `lint` + `format:check` + `typecheck` + `test` steps so they gate merge alongside the existing `next build`. Expand the existing `isChairPositionType` test to cover every value of the `position_type` enum from `../intranet/db/changelogs/enum/03.position-type.sql`.

**Tech Stack:** Vitest 4, happy-dom, TypeScript 5.7, Next.js 15, ESLint (next/core-web-vitals), Prettier 3, GitHub Actions.

**Spec reference:** `docs/superpowers/specs/2026-05-18-testing-harness-design.md` §§ 4, 7.1, 7.2, 7.3, 8, 10.

---

## File map

- **Modify** `package.json` — add `typecheck` script
- **Modify** `vitest.config.mts` — swap jsdom for happy-dom, restructure into projects
- **Modify** `src/features/cca/utils/cca-chair-access.test.ts` — exhaustive `position_type` enumeration
- **Modify** `.github/workflows/1-ci-merge-request.yml` — add lint/format/typecheck/test steps
- **Possibly modify** many source files — one-time prettier sweep if there is drift
- **Add devDependency** `happy-dom`
- **Remove devDependency** `jsdom` (not in package.json today — confirm it isn't pulled transitively; Vitest's old default. Currently jsdom is only mentioned in `vitest.config.mts`; happy-dom replaces it)

---

## Task 1: Add `typecheck` script and fix any latent errors

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Add the `typecheck` script**

Open `package.json` and add a new line to the `scripts` block between `"start"` and `"test"`. The file uses **tabs** for indentation — match that.

```jsonc
{
  "scripts": {
    "build": "next build",
    "dev": "next dev",
    "format": "prettier --write \"src/**/*.{ts,tsx,js,jsx,json,css,md}\"",
    "format:check": "prettier --check \"src/**/*.{ts,tsx,js,jsx,json,css,md}\"",
    "lint": "next lint",
    "run-script": "ts-node -P tsconfig.scripts.json scripts/index.ts",
    "start": "next start",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

- [ ] **Step 2: Run typecheck locally and observe output**

Run: `npm run typecheck`

Expected: either passes silently, or prints TypeScript errors. Note that `next.config.mjs` currently sets `eslint.ignoreDuringBuilds: true`, which means lint errors don't block CI today — but TypeScript errors *also* are not gated because `next build` does not type-check the way `tsc --noEmit` does. There may be latent errors.

- [ ] **Step 3: Fix any TypeScript errors that surface**

If `tsc --noEmit` reports errors, fix them one by one. Do NOT mass-suppress with `// @ts-expect-error` — fix the underlying type issue. If a fix requires non-obvious refactoring, stop and ask the user before proceeding.

If the project has many ambient `any` types or `@ts-ignore`s, focus on the errors `tsc` actually flags. Don't go hunting for stylistic issues — TDD-equivalent at this layer is "make tsc happy."

- [ ] **Step 4: Re-run typecheck until clean**

Run: `npm run typecheck`

Expected: exit code 0, no output.

- [ ] **Step 5: Run the existing test suite to confirm nothing broke**

Run: `npm test`

Expected: all existing tests pass.

- [ ] **Step 6: Commit**

```bash
git add package.json
# Plus any source files that were touched to fix tsc errors
git commit -m "chore(testing): add typecheck script and clean up TS errors"
```

If no source files needed changes, the commit message can be simply `chore(testing): add typecheck script`.

---

## Task 2: Swap jsdom for happy-dom

**Files:**
- Modify: `package.json` (devDependency)
- Modify: `vitest.config.mts`

- [ ] **Step 1: Install happy-dom**

Run: `npm install --save-dev happy-dom`

Expected: `happy-dom` appears in `devDependencies` in `package.json`. No other changes.

- [ ] **Step 2: Update `vitest.config.mts` to use happy-dom**

Replace the contents of `/Users/bytedance/intranet-next-app/vitest.config.mts` with:

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: "happy-dom",
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    globals: true,
  },
});
```

(Only the `environment` value changed from `"jsdom"` to `"happy-dom"`.)

- [ ] **Step 3: Run the full test suite**

Run: `npm test`

Expected: all tests still pass under happy-dom.

If a test fails because it depended on a jsdom-specific behavior (rare, but possible — happy-dom does not implement every WHATWG quirk), investigate the specific failure. Common cases: `XMLSerializer`, `Range#getBoundingClientRect`, or `URL.createObjectURL` may behave differently. Fix the test (preferred) or, as a last resort, pin the affected test file to `jsdom` via a `// @vitest-environment jsdom` pragma at the top of that single file and install `jsdom` as a devDependency.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json vitest.config.mts
git commit -m "chore(testing): replace jsdom with happy-dom"
```

---

## Task 3: Split Vitest into unit (node) and component (happy-dom) projects

**Files:**
- Modify: `vitest.config.mts`

**Rationale:** Pure-logic tests (`*.test.ts` in `src/features/*/utils/`, `src/lib/`, `src/utils/`) don't need a DOM and run ~2× faster in `node`. Component / hook tests (`*.test.tsx`) need `happy-dom`. Vitest's `projects` field lets one config file declare both with a glob-based split.

- [ ] **Step 1: Restructure `vitest.config.mts` with the projects field**

Replace the contents of `vitest.config.mts` with:

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    globals: true,
    projects: [
      {
        plugins: [tsconfigPaths(), react()],
        test: {
          name: "unit",
          environment: "node",
          include: ["src/**/*.test.ts"],
          globals: true,
        },
      },
      {
        plugins: [tsconfigPaths(), react()],
        test: {
          name: "component",
          environment: "happy-dom",
          include: ["src/**/*.test.tsx"],
          globals: true,
        },
      },
    ],
  },
});
```

- [ ] **Step 2: Run the full test suite**

Run: `npm test`

Expected: Vitest runs both projects. Output shows two project names ("unit" and "component"). All tests pass.

If a `*.test.ts` file is failing because it actually needs a DOM (e.g., it imports a React component or `document`), either rename it to `*.test.tsx` (preferred — most accurate signal) or add a `// @vitest-environment happy-dom` pragma at the top of that file.

If a `*.test.tsx` file is failing because it doesn't use the DOM, that's harmless — leave it; the slight overhead of running it under happy-dom is fine.

- [ ] **Step 3: Run only the unit project to confirm filtering works**

Run: `npx vitest run --project unit`

Expected: only `*.test.ts` files run.

- [ ] **Step 4: Run only the component project to confirm filtering works**

Run: `npx vitest run --project component`

Expected: only `*.test.tsx` files run.

- [ ] **Step 5: Commit**

```bash
git add vitest.config.mts
# Plus any test files renamed from .ts to .tsx
git commit -m "chore(testing): split Vitest into unit (node) and component (happy-dom) projects"
```

---

## Task 4: One-time prettier sweep to align formatting with the gate we're about to add

**Files:**
- Possibly modify: many files under `src/` (formatting only)

**Rationale:** CI is about to start gating on `prettier --check`. Any pre-existing drift will make the first PR fail. Run `prettier --write` once, commit the result as a pure-formatting sweep, then `format:check` is maintainable going forward.

- [ ] **Step 1: Check current drift**

Run: `npm run format:check`

Expected: either passes (no drift — skip to Step 4 with no commit), or prints a list of files that would be reformatted.

- [ ] **Step 2: If drift exists, apply prettier across the codebase**

Run: `npm run format`

Expected: prettier reformats the listed files.

- [ ] **Step 3: Verify the suite still passes**

Run: `npm test && npm run typecheck`

Expected: both pass. Prettier formatting changes should not affect semantics.

- [ ] **Step 4: Inspect the diff**

Run: `git diff --stat`

Expected: many files with small line-count changes. Spot-check a few diffs (`git diff src/app/dashboard/page.tsx` for example) to confirm changes are purely whitespace/quote/semicolon — no logic changes.

- [ ] **Step 5: Commit (skip if no drift)**

```bash
git add -u
git commit -m "chore(format): prettier sweep before enabling format:check in CI"
```

If `git status` shows no modified files (no drift existed), skip this commit entirely and move to Task 5.

---

## Task 5: Exhaustively enumerate `position_type` in `isChairPositionType` tests

**Files:**
- Modify: `src/features/cca/utils/cca-chair-access.test.ts`
- Test: `src/features/cca/utils/cca-chair-access.test.ts`

**Rationale:** `isChairPositionType` is the lowest-cost layer of authorization defense in the codebase. The existing test only checks 3 of the 8 `position_type` enum values. The canonical enum from `../intranet/db/changelogs/enum/03.position-type.sql` is:

```
'lead', 'vice', 'blockcomm', 'maincomm', 'subcomm', 'team manager', 'member', 'resident'
```

Only `lead` and `vice` should return true. Every other value, plus `null`, `undefined`, and the empty string, must return false. A parameterized test makes this explicit and ratchets coverage to the full enum.

- [ ] **Step 1: Replace the `isChairPositionType` describe block with an exhaustive enumeration**

In `/Users/bytedance/intranet-next-app/src/features/cca/utils/cca-chair-access.test.ts`, locate the existing `describe("isChairPositionType", ...)` block (lines 22-33 in the current file). Replace it with:

```ts
describe("isChairPositionType", () => {
	// Canonical position_type enum from ../intranet/db/changelogs/enum/03.position-type.sql
	const CHAIR_POSITIONS = ["lead", "vice"] as const;
	const NON_CHAIR_POSITIONS = [
		"blockcomm",
		"maincomm",
		"subcomm",
		"team manager",
		"member",
		"resident",
	] as const;

	it.each(CHAIR_POSITIONS)("recognises %s as a chair position", (positionType) => {
		expect(isChairPositionType(positionType)).toBe(true);
	});

	it.each(NON_CHAIR_POSITIONS)("rejects %s as a chair position", (positionType) => {
		expect(isChairPositionType(positionType)).toBe(false);
	});

	it.each([undefined, null, ""])("rejects falsy / empty position type %p", (positionType) => {
		expect(isChairPositionType(positionType as string | null | undefined)).toBe(false);
	});

	it("is case-insensitive", () => {
		expect(isChairPositionType("LEAD")).toBe(true);
		expect(isChairPositionType("Vice")).toBe(true);
		expect(isChairPositionType("MEMBER")).toBe(false);
	});

	it("trims surrounding whitespace", () => {
		expect(isChairPositionType("  lead  ")).toBe(true);
		expect(isChairPositionType(" vice")).toBe(true);
		expect(isChairPositionType("member ")).toBe(false);
	});
});
```

- [ ] **Step 2: Run the test**

Run: `npx vitest run src/features/cca/utils/cca-chair-access.test.ts`

Expected: every case passes. You should see `it.each` generating one test row per enum value — 2 chair, 6 non-chair, 3 falsy, plus 2 special cases.

If a case fails, the implementation is wrong (not the test). Inspect `src/features/cca/utils/cca-chair-access.ts:15-19` (the `CHAIR_POSITION_TYPES` set and the `isChairPositionType` function) and fix.

- [ ] **Step 3: Run the full suite to confirm nothing else broke**

Run: `npm test`

Expected: all tests pass under both Vitest projects.

- [ ] **Step 4: Commit**

```bash
git add src/features/cca/utils/cca-chair-access.test.ts
git commit -m "test(testing): exhaustively enumerate position_type in isChairPositionType"
```

---

## Task 6: Wire CI to gate on lint, format, typecheck, and test

**Files:**
- Modify: `.github/workflows/1-ci-merge-request.yml`

**Rationale:** All four checks now pass locally on `main`. Add them to the CI workflow so any PR that breaks any of them fails to merge. Phase 0 keeps everything in the existing single job; Phase 5 will split into parallel jobs.

- [ ] **Step 1: Add the four new steps to the existing job**

Open `/Users/bytedance/intranet-next-app/.github/workflows/1-ci-merge-request.yml`. After step 5 ("📦 Install Dependencies", currently ending at line 61) and before step 6 ("🚧 Build with Next.js", currently at line 63-64), insert four new steps. Renumber the build step accordingly. The full file should end up as:

```yaml
# .github/workflows/ci-merge-request.yml
name: Merge Request CI

# Trigger:
# - Runs when a pull request targets the `main` branch
on:
  pull_request:
    branches:
      - main

jobs:
  build-static-assets:
    name: ⚙️ Build Next.js Static Assets
    runs-on: ubuntu-latest
    environment: preprod

    env:
      # Supabase Configuration
      NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY: ${{ secrets.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY }}

    steps:
      - name: 1. 📄 Checkout Repository
        uses: actions/checkout@v4

      - name: 2. ⚙️ Detect Package Manager
        id: detect-pm
        run: |
          if [ -f "yarn.lock" ]; then
            echo "manager=yarn" >> $GITHUB_OUTPUT
            echo "command=install" >> $GITHUB_OUTPUT
          elif [ -f "package.json" ]; then
            echo "manager=npm" >> $GITHUB_OUTPUT
            echo "command=ci" >> $GITHUB_OUTPUT
          else
            echo "Unable to detect package manager"
            exit 1
          fi

      - name: 3. ⚙️ Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "22.22"
          cache: ${{ steps.detect-pm.outputs.manager }}

      - name: 4. ⬇️ Restore Next.js Cache
        uses: actions/cache@v4
        with:
          path: |
            .next/cache
          key: ${{ runner.os }}-nextjs-${{ hashFiles('**/package-lock.json', '**/yarn.lock') }}
          restore-keys: |
            ${{ runner.os }}-nextjs-

      - name: 5. 📦 Install Dependencies
        run: |
          if [ "${{ steps.detect-pm.outputs.manager }}" = "npm" ]; then
            npm ci --prefer-offline --no-audit --no-fund
          else
            yarn install --frozen-lockfile --prefer-offline
          fi

      - name: 6. 🎨 Prettier Check
        run: ${{ steps.detect-pm.outputs.manager }} run format:check

      - name: 7. 🧹 Lint
        run: ${{ steps.detect-pm.outputs.manager }} run lint

      - name: 8. 🔎 Typecheck
        run: ${{ steps.detect-pm.outputs.manager }} run typecheck

      - name: 9. 🧪 Unit + Component Tests
        run: ${{ steps.detect-pm.outputs.manager }} test

      - name: 10. 🚧 Build with Next.js
        run: ${{ steps.detect-pm.outputs.manager }} run build
```

- [ ] **Step 2: Locally verify the same command sequence that CI will run**

Run each command in order and confirm each exits 0:

```bash
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
```

Expected: all five exit 0. If `npm run lint` reports errors (it has never been a CI gate before), fix them or — if there are too many — stop and ask the user how aggressively to fix them. Do not add `|| true` or otherwise suppress the gate.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/1-ci-merge-request.yml
git commit -m "ci(testing): gate merge on format, lint, typecheck, and tests"
```

- [ ] **Step 4: Push and verify CI on a throwaway PR**

This step is optional but recommended:

```bash
git push origin HEAD:test-phase-0-ci
gh pr create --title "test: verify phase 0 CI gates" --body "Throwaway PR to confirm the new CI steps run. Close without merging."
```

Watch the GitHub Actions run; confirm all six steps (5 new + the existing build) appear and pass. Close the PR.

---

## Self-review checklist

- [ ] All six tasks have exact file paths.
- [ ] All code blocks contain complete, runnable content (no `// ... existing code` placeholders).
- [ ] Each task ends with a commit step.
- [ ] No "fix any error" without telling the implementer to stop and ask if it requires non-obvious refactoring.
- [ ] No references to fixtures, personas, or integration helpers — those are Phase 1.
- [ ] No new CI jobs — Phase 5 handles the parallel-job restructure.
- [ ] Spec coverage: § 7.1 (static checks) → Tasks 1, 4, 6. § 7.2 (unit env config) → Tasks 2, 3, 5. § 7.3 (component env config) → Task 3. § 8 (CI gating) → Task 6.

## What this does NOT do (deferred)

- No fixtures pipeline (Phase 1)
- No local Supabase / `../intranet` bootstrap (Phase 1)
- No authorization matrix (Phase 2)
- No RLS tests (Phase 3)
- No E2E (Phase 4)
- No CI restructure into parallel jobs (Phase 5)
- No coverage reporting (deferred indefinitely per spec § 3)
