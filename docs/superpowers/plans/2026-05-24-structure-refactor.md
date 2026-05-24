# Structure Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dissolve `src/features/` and consolidate into the Next.js-native layout: `components/` by domain, `lib/` for services+logic, `hooks/` flat, `types/` flat.

**Architecture:** Pure file-move refactor with import rewrites. No logic changes. Each task moves one domain atomically so the build stays green after each commit. The final task cleans up empty directories and verifies the build.

**Tech Stack:** Next.js 15, TypeScript, path aliases (`@/*` → `./src/*`)

---

## File Structure

### New directories to create

- `src/components/cca/`
- `src/components/ranking/`
- `src/components/allocation/`
- `src/components/holiday-subsidy/`
- `src/lib/cca/`
- `src/lib/ranking/`
- `src/lib/allocation/`
- `src/lib/holiday-subsidy/`
- `src/hooks/` (top-level)
- `src/types/` (already exists, will receive new files)

### Directories to delete after migration

- `src/features/` (entire tree)
- `src/lib/hooks/` (move use-mobile.ts to src/hooks/)

---

### Task 1: Move CCA domain

**Files:**
- Move: `src/features/cca/components/*.tsx` → `src/components/cca/`
- Move: `src/features/cca/hooks/use-*.ts` → `src/hooks/`
- Move: `src/features/cca/hooks/member-status-helpers.ts` → `src/lib/cca/member-status-helpers.ts`
- Move: `src/features/cca/services/*.ts` → `src/lib/cca/`
- Move: `src/features/cca/utils/*.ts` → `src/lib/cca/`
- Move: `src/features/cca/types/*.ts` → `src/types/`
- Move: `src/lib/hooks/use-mobile.ts` → `src/hooks/use-mobile.ts`

- [ ] **Step 1: Create target directories and move files**

```bash
mkdir -p src/components/cca src/lib/cca src/hooks

# Components
mv src/features/cca/components/add-member-modal.tsx src/components/cca/
mv src/features/cca/components/member-group-table.tsx src/components/cca/
mv src/features/cca/components/save-error-dialog.tsx src/components/cca/

# Hooks → flat hooks/
mv src/features/cca/hooks/use-cca-list.ts src/hooks/
mv src/features/cca/hooks/use-cca-members.ts src/hooks/
mv src/features/cca/hooks/use-managed-ccas.ts src/hooks/
mv src/features/cca/hooks/use-member-save.ts src/hooks/
mv src/features/cca/hooks/use-member-search.ts src/hooks/
mv src/features/cca/hooks/use-role-auth.ts src/hooks/

# member-status-helpers is NOT a hook — goes to lib/cca
mv src/features/cca/hooks/member-status-helpers.ts src/lib/cca/

# Services → lib/cca
mv src/features/cca/services/member-service.ts src/lib/cca/
mv src/features/cca/services/position-service.ts src/lib/cca/

# Utils → lib/cca (including tests)
mv src/features/cca/utils/cca-chair-access.ts src/lib/cca/
mv src/features/cca/utils/cca-chair-access.test.ts src/lib/cca/
mv src/features/cca/utils/cca-management-access.ts src/lib/cca/
mv src/features/cca/utils/cca-management-access.test.ts src/lib/cca/
mv src/features/cca/utils/cca-cut-status.ts src/lib/cca/
mv src/features/cca/utils/cca-member-management.ts src/lib/cca/
mv src/features/cca/utils/member-helpers.ts src/lib/cca/

# Types → types/
mv src/features/cca/types/cca-data.ts src/types/
mv src/features/cca/types/members.ts src/types/

# Also move orphaned lib hook
mv src/lib/hooks/use-mobile.ts src/hooks/
rmdir src/lib/hooks
```

- [ ] **Step 2: Rewrite all imports across the entire codebase**

Run these sed replacements on all `.ts` and `.tsx` files under `src/`:

```bash
# CCA components
find src -type f \( -name '*.ts' -o -name '*.tsx' \) -exec sed -i '' \
  's|@/features/cca/components/|@/components/cca/|g' {} +

# CCA hooks
find src -type f \( -name '*.ts' -o -name '*.tsx' \) -exec sed -i '' \
  's|@/features/cca/hooks/use-|@/hooks/use-|g' {} +

# member-status-helpers (not a hook, goes to lib/cca)
find src -type f \( -name '*.ts' -o -name '*.tsx' \) -exec sed -i '' \
  's|@/features/cca/hooks/member-status-helpers|@/lib/cca/member-status-helpers|g' {} +

# CCA services
find src -type f \( -name '*.ts' -o -name '*.tsx' \) -exec sed -i '' \
  's|@/features/cca/services/|@/lib/cca/|g' {} +

# CCA utils
find src -type f \( -name '*.ts' -o -name '*.tsx' \) -exec sed -i '' \
  's|@/features/cca/utils/|@/lib/cca/|g' {} +

# CCA types
find src -type f \( -name '*.ts' -o -name '*.tsx' \) -exec sed -i '' \
  's|@/features/cca/types/|@/types/|g' {} +

# lib/hooks/use-mobile → hooks/use-mobile
find src -type f \( -name '*.ts' -o -name '*.tsx' \) -exec sed -i '' \
  's|@/lib/hooks/use-mobile|@/hooks/use-mobile|g' {} +
```

- [ ] **Step 3: Verify no remaining @/features/cca/ imports**

```bash
grep -rn "@/features/cca/" src/ --include='*.ts' --include='*.tsx'
grep -rn "@/lib/hooks/" src/ --include='*.ts' --include='*.tsx'
```

Expected: no output for both commands.

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add -A src/components/cca src/hooks src/lib/cca src/types/cca-data.ts src/types/members.ts
git add -A src/features/cca src/lib/hooks
git add -u src/  # catch import rewrites in existing files
git commit -m "refactor: move CCA domain out of features/ into Next.js-native layout"
```

---

### Task 2: Move ranking domain

**Files:**
- Move: `src/features/ranking/components/*.tsx` → `src/components/ranking/`
- Move: `src/features/ranking/hooks/use-*.ts` + tests → `src/hooks/`
- Move: `src/features/ranking/services/*.ts` → `src/lib/ranking/`
- Move: `src/features/ranking/utils/*.ts` + tests → `src/lib/ranking/`
- Move: `src/features/ranking/types/*.ts` → `src/types/`

- [ ] **Step 1: Create target directories and move files**

```bash
mkdir -p src/components/ranking src/lib/ranking

# Components
mv src/features/ranking/components/points-recap-card.tsx src/components/ranking/
mv src/features/ranking/components/position-ranking-card.tsx src/components/ranking/
mv src/features/ranking/components/recap-slide-content.tsx src/components/ranking/

# Hooks + tests
mv src/features/ranking/hooks/use-ranking-editor.ts src/hooks/
mv src/features/ranking/hooks/use-ranking-editor.test.tsx src/hooks/
mv src/features/ranking/hooks/use-recap-audio.ts src/hooks/
mv src/features/ranking/hooks/use-recap-data.ts src/hooks/
mv src/features/ranking/hooks/use-recap-navigation.ts src/hooks/
mv src/features/ranking/hooks/use-recap-navigation.test.tsx src/hooks/

# Services
mv src/features/ranking/services/user-ranking-service.ts src/lib/ranking/

# Utils + tests
mv src/features/ranking/utils/cca-ranking-comments.ts src/lib/ranking/
mv src/features/ranking/utils/cca-ranking-comments.test.ts src/lib/ranking/
mv src/features/ranking/utils/cca-ranking-metrics.ts src/lib/ranking/
mv src/features/ranking/utils/cca-ranking-metrics.test.ts src/lib/ranking/
mv src/features/ranking/utils/create-recap-image-blob.ts src/lib/ranking/
mv src/features/ranking/utils/create-recap-image-blob.test.tsx src/lib/ranking/
mv src/features/ranking/utils/ranking-editor.ts src/lib/ranking/
mv src/features/ranking/utils/ranking-editor.test.ts src/lib/ranking/
mv src/features/ranking/utils/ranking-route.ts src/lib/ranking/
mv src/features/ranking/utils/ranking-route.test.ts src/lib/ranking/
mv src/features/ranking/utils/recap-slides.ts src/lib/ranking/
mv src/features/ranking/utils/recap-slides.test.ts src/lib/ranking/

# Types
mv src/features/ranking/types/ranking.ts src/types/
mv src/features/ranking/types/ranking-api.ts src/types/
mv src/features/ranking/types/recap.ts src/types/
```

- [ ] **Step 2: Rewrite all imports**

```bash
find src -type f \( -name '*.ts' -o -name '*.tsx' \) -exec sed -i '' \
  's|@/features/ranking/components/|@/components/ranking/|g' {} +

find src -type f \( -name '*.ts' -o -name '*.tsx' \) -exec sed -i '' \
  's|@/features/ranking/hooks/|@/hooks/|g' {} +

find src -type f \( -name '*.ts' -o -name '*.tsx' \) -exec sed -i '' \
  's|@/features/ranking/services/|@/lib/ranking/|g' {} +

find src -type f \( -name '*.ts' -o -name '*.tsx' \) -exec sed -i '' \
  's|@/features/ranking/utils/|@/lib/ranking/|g' {} +

find src -type f \( -name '*.ts' -o -name '*.tsx' \) -exec sed -i '' \
  's|@/features/ranking/types/|@/types/|g' {} +
```

- [ ] **Step 3: Verify no remaining @/features/ranking/ imports**

```bash
grep -rn "@/features/ranking/" src/ --include='*.ts' --include='*.tsx'
```

Expected: no output.

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add -A src/components/ranking src/lib/ranking src/hooks src/types/ranking.ts src/types/ranking-api.ts src/types/recap.ts
git add -A src/features/ranking
git add -u src/
git commit -m "refactor: move ranking domain out of features/ into Next.js-native layout"
```

---

### Task 3: Move allocation domain

**Files:**
- Move: `src/features/allocation/components/*.tsx` → `src/components/allocation/`
- Move: `src/features/allocation/utils/ranking-columns.tsx` → `src/components/allocation/ranking-columns.tsx` (has JSX)
- Move: `src/features/allocation/hooks/use-*.ts` → `src/hooks/`
- Move: `src/features/allocation/utils/*.ts` + tests → `src/lib/allocation/`
- Move: `src/features/allocation/types/*.ts` → `src/types/`

- [ ] **Step 1: Create target directories and move files**

```bash
mkdir -p src/components/allocation src/lib/allocation

# Components
mv src/features/allocation/components/add-applicant-dialog.tsx src/components/allocation/
mv src/features/allocation/components/allocation-algorithm-steps.tsx src/components/allocation/
mv src/features/allocation/components/allocation-faq.tsx src/components/allocation/
mv src/features/allocation/components/allocation-guide-hero.tsx src/components/allocation/
mv src/features/allocation/components/allocation-tips.tsx src/components/allocation/
mv src/features/allocation/components/position-card.tsx src/components/allocation/
mv src/features/allocation/components/rank-ordering-step.tsx src/components/allocation/
mv src/features/allocation/components/rank-selection-step.tsx src/components/allocation/

# ranking-columns.tsx has JSX → goes to components
mv src/features/allocation/utils/ranking-columns.tsx src/components/allocation/

# Hooks
mv src/features/allocation/hooks/use-applicant-rankings.ts src/hooks/
mv src/features/allocation/hooks/use-rankable-positions.ts src/hooks/

# Utils + tests → lib/allocation
mv src/features/allocation/utils/allocation-guide-content.ts src/lib/allocation/
mv src/features/allocation/utils/applicant-diff.ts src/lib/allocation/
mv src/features/allocation/utils/applicant-diff.test.ts src/lib/allocation/
mv src/features/allocation/utils/ranking-changes.ts src/lib/allocation/
mv src/features/allocation/utils/ranking-changes.test.ts src/lib/allocation/

# Types
mv src/features/allocation/types/applicants.ts src/types/
mv src/features/allocation/types/preferences.ts src/types/
```

- [ ] **Step 2: Rewrite all imports**

```bash
find src -type f \( -name '*.ts' -o -name '*.tsx' \) -exec sed -i '' \
  's|@/features/allocation/components/|@/components/allocation/|g' {} +

find src -type f \( -name '*.ts' -o -name '*.tsx' \) -exec sed -i '' \
  's|@/features/allocation/hooks/|@/hooks/|g' {} +

# ranking-columns moved to components, not lib
find src -type f \( -name '*.ts' -o -name '*.tsx' \) -exec sed -i '' \
  's|@/features/allocation/utils/ranking-columns|@/components/allocation/ranking-columns|g' {} +

# All other utils → lib/allocation
find src -type f \( -name '*.ts' -o -name '*.tsx' \) -exec sed -i '' \
  's|@/features/allocation/utils/|@/lib/allocation/|g' {} +

find src -type f \( -name '*.ts' -o -name '*.tsx' \) -exec sed -i '' \
  's|@/features/allocation/types/|@/types/|g' {} +
```

- [ ] **Step 3: Verify no remaining @/features/allocation/ imports**

```bash
grep -rn "@/features/allocation/" src/ --include='*.ts' --include='*.tsx'
```

Expected: no output.

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add -A src/components/allocation src/lib/allocation src/hooks/use-applicant-rankings.ts src/hooks/use-rankable-positions.ts src/types/applicants.ts src/types/preferences.ts
git add -A src/features/allocation
git add -u src/
git commit -m "refactor: move allocation domain out of features/ into Next.js-native layout"
```

---

### Task 4: Move holiday-subsidy domain

**Files:**
- Move: `src/features/holiday-subsidy/components/*.tsx` → `src/components/holiday-subsidy/`
- Move: `src/features/holiday-subsidy/hooks/use-*.ts` → `src/hooks/`
- Move: `src/features/holiday-subsidy/services/*.ts` → `src/lib/holiday-subsidy/`
- Move: `src/features/holiday-subsidy/utils/*.ts` + tests → `src/lib/holiday-subsidy/`
- Move: `src/features/holiday-subsidy/types/api.ts` → `src/types/holiday-subsidy-api.ts` (renamed)
- Move: `src/features/holiday-subsidy/types/*.ts` → `src/types/`

- [ ] **Step 1: Create target directories and move files**

```bash
mkdir -p src/components/holiday-subsidy src/lib/holiday-subsidy

# Components
mv src/features/holiday-subsidy/components/approval-cca-table.tsx src/components/holiday-subsidy/
mv src/features/holiday-subsidy/components/chair-cca-table.tsx src/components/holiday-subsidy/
mv src/features/holiday-subsidy/components/declaration-section-card.tsx src/components/holiday-subsidy/
mv src/features/holiday-subsidy/components/guide-faq.tsx src/components/holiday-subsidy/
mv src/features/holiday-subsidy/components/guide-phase-card.tsx src/components/holiday-subsidy/
mv src/features/holiday-subsidy/components/guide-process-overview.tsx src/components/holiday-subsidy/
mv src/features/holiday-subsidy/components/subsidy-declaration-form-dialog.tsx src/components/holiday-subsidy/
mv src/features/holiday-subsidy/components/weekly-approvals-table.tsx src/components/holiday-subsidy/
mv src/features/holiday-subsidy/components/weekly-commitment-table.tsx src/components/holiday-subsidy/
mv src/features/holiday-subsidy/components/weekly-page-header.tsx src/components/holiday-subsidy/

# Hooks
mv src/features/holiday-subsidy/hooks/use-chair-subsidy-ccas.ts src/hooks/
mv src/features/holiday-subsidy/hooks/use-subsidy-approval-details.ts src/hooks/
mv src/features/holiday-subsidy/hooks/use-subsidy-approvals-index.ts src/hooks/
mv src/features/holiday-subsidy/hooks/use-subsidy-declarations.ts src/hooks/
mv src/features/holiday-subsidy/hooks/use-week-selection.ts src/hooks/
mv src/features/holiday-subsidy/hooks/use-weekly-approvals.ts src/hooks/
mv src/features/holiday-subsidy/hooks/use-weekly-commitment.ts src/hooks/

# Services → lib/holiday-subsidy
mv src/features/holiday-subsidy/services/approval-service.ts src/lib/holiday-subsidy/
mv src/features/holiday-subsidy/services/declaration-service.ts src/lib/holiday-subsidy/
mv src/features/holiday-subsidy/services/weekly-service.ts src/lib/holiday-subsidy/

# Utils + tests → lib/holiday-subsidy
mv src/features/holiday-subsidy/utils/declaration-mappers.ts src/lib/holiday-subsidy/
mv src/features/holiday-subsidy/utils/holiday-subsidy-guide-content.ts src/lib/holiday-subsidy/
mv src/features/holiday-subsidy/utils/holiday-weeks.ts src/lib/holiday-subsidy/
mv src/features/holiday-subsidy/utils/holiday-weeks.test.ts src/lib/holiday-subsidy/
mv src/features/holiday-subsidy/utils/weekly-change-set.ts src/lib/holiday-subsidy/
mv src/features/holiday-subsidy/utils/weekly-change-set.test.ts src/lib/holiday-subsidy/

# Types — api.ts renamed to avoid ambiguity
mv src/features/holiday-subsidy/types/api.ts src/types/holiday-subsidy-api.ts
mv src/features/holiday-subsidy/types/declarations.ts src/types/
mv src/features/holiday-subsidy/types/weekly.ts src/types/
```

- [ ] **Step 2: Rewrite all imports**

```bash
find src -type f \( -name '*.ts' -o -name '*.tsx' \) -exec sed -i '' \
  's|@/features/holiday-subsidy/components/|@/components/holiday-subsidy/|g' {} +

find src -type f \( -name '*.ts' -o -name '*.tsx' \) -exec sed -i '' \
  's|@/features/holiday-subsidy/hooks/|@/hooks/|g' {} +

find src -type f \( -name '*.ts' -o -name '*.tsx' \) -exec sed -i '' \
  's|@/features/holiday-subsidy/services/|@/lib/holiday-subsidy/|g' {} +

find src -type f \( -name '*.ts' -o -name '*.tsx' \) -exec sed -i '' \
  's|@/features/holiday-subsidy/utils/|@/lib/holiday-subsidy/|g' {} +

# Renamed type: api → holiday-subsidy-api
find src -type f \( -name '*.ts' -o -name '*.tsx' \) -exec sed -i '' \
  's|@/features/holiday-subsidy/types/api|@/types/holiday-subsidy-api|g' {} +

# All other types
find src -type f \( -name '*.ts' -o -name '*.tsx' \) -exec sed -i '' \
  's|@/features/holiday-subsidy/types/|@/types/|g' {} +
```

- [ ] **Step 3: Verify no remaining @/features/holiday-subsidy/ imports**

```bash
grep -rn "@/features/holiday-subsidy/" src/ --include='*.ts' --include='*.tsx'
```

Expected: no output.

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add -A src/components/holiday-subsidy src/lib/holiday-subsidy src/hooks src/types/holiday-subsidy-api.ts src/types/declarations.ts src/types/weekly.ts
git add -A src/features/holiday-subsidy
git add -u src/
git commit -m "refactor: move holiday-subsidy domain out of features/ into Next.js-native layout"
```

---

### Task 5: Delete features/ directory, verify build, update CLAUDE.md

**Files:**
- Delete: `src/features/` (should be empty after Tasks 1-4)
- Modify: `CLAUDE.md` — remove all references to `features/`

- [ ] **Step 1: Verify features/ is empty and delete it**

```bash
find src/features -type f 2>/dev/null
```

Expected: no output (all files moved). If any files remain, they were missed — move them before proceeding.

```bash
rm -rf src/features
```

- [ ] **Step 2: Verify no remaining @/features/ imports anywhere**

```bash
grep -rn "@/features/" src/ --include='*.ts' --include='*.tsx'
```

Expected: no output.

- [ ] **Step 3: Full build verification**

```bash
npx tsc --noEmit && npm run build
```

Expected: both pass with no errors.

- [ ] **Step 4: Run lint**

```bash
npm run lint
```

Expected: passes (or only pre-existing warnings, no new errors).

- [ ] **Step 5: Update CLAUDE.md**

Remove or rewrite all references to `src/features/` in `CLAUDE.md`. Update the Architecture, Component Patterns, and Module Design sections to reflect the new layout:

- `src/components/{domain}/` for domain-specific components
- `src/lib/{domain}/` for services, utils, business logic
- `src/hooks/` for all hooks (flat)
- `src/types/` for all shared types (flat)

Remove mentions of:
- `src/features/*/components/`
- `src/features/*/hooks/`
- `src/features/*/services/`
- `src/features/*/utils/`
- `src/features/*/types/`
- Any references to the `features/` directory

Update import examples to use new paths:
- `@/features/cca/hooks/use-role-auth` → `@/hooks/use-role-auth`
- `@/features/cca/utils/cca-chair-access` → `@/lib/cca/cca-chair-access`
- etc.

- [ ] **Step 6: Commit**

```bash
git add -A src/features CLAUDE.md
git add -u src/
git commit -m "refactor: delete features/ directory, update CLAUDE.md conventions"
```
