---
phase: 05
slug: allocation-holiday-subsidy-modules
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-04-11
---

# Phase 05 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.4 |
| **Config file** | `vitest.config.mts` |
| **Quick run command** | `npx vitest run src/features/allocation src/features/holiday-subsidy` |
| **Full suite command** | `npm run test && npm run build` |
| **Task smoke command** | `npx eslint <touched files> && wc -l <thin-shell page>` |
| **Estimated task runtime** | ~10-30 seconds |
| **Estimated wave-boundary runtime** | ~120 seconds |

---

## Sampling Rate

- **After every task commit:** Run the task-local `<automated>` command (targeted Vitest or eslint + `wc -l` smoke check)
- **After every plan wave:** Run `npm run test && npm run build`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max task feedback latency:** 30 seconds
- **Max wave-boundary feedback latency:** 120 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 05-00-01 | 00 | 0 | ALLOC-02 | — | Allocation diff helpers preserve existing selection/order and applicant save semantics before page moves | unit | `npx vitest run src/features/allocation/utils/ranking-changes.test.ts src/features/allocation/utils/applicant-diff.test.ts` | ❌ W0 | ⬜ pending |
| 05-00-02 | 00 | 0 | HSUB-01, HSUB-02 | — | Holiday week normalization and weekly change-set helpers preserve current behavior before consumer rewiring | unit | `npx vitest run src/features/holiday-subsidy/utils/holiday-weeks.test.ts src/features/holiday-subsidy/utils/weekly-change-set.test.ts` | ❌ W0 | ⬜ pending |
| 05-00-03 | 00 | 0 | HSUB-01 | — | Declaration create/edit/delete route contract is verified before declaration files change | manual gate + lint smoke | `npx eslint "src/app/dashboard/holidaySubsidy/declaration/[ccaName]/page.tsx" "src/app/dashboard/holidaySubsidy/declaration/[ccaName]/subsidy-declaration-form-dialog.tsx" "src/app/api/holidaySubsidy/declarations/[ccaId]/route.ts"` | N/A | ⬜ pending |
| 05-01-01 | 01 | 1 | ALLOC-02 | — | Allocation contracts move into feature-local files and compile cleanly | unit + lint smoke | `npx vitest run src/features/allocation/utils/ranking-changes.test.ts src/features/allocation/utils/applicant-diff.test.ts && npx eslint "src/features/allocation/types/preferences.ts" "src/features/allocation/types/applicants.ts" "src/app/dashboard/ccaAllocation/rank/page.tsx" "src/app/dashboard/ccaAllocation/rankApplicants/page.tsx" "src/types/dashboard.ts"` | N/A | ⬜ pending |
| 05-02-01 | 02 | 1 | HSUB-01, HSUB-02 | — | Non-declaration subsidy consumers switch to the JSON-backed week adapter without touching declaration files | unit + lint smoke | `npx vitest run src/features/holiday-subsidy/utils/holiday-weeks.test.ts src/features/holiday-subsidy/utils/weekly-change-set.test.ts && npx eslint "src/app/api/holidaySubsidy/weekly/[ccaId]/[weekId]/route.ts" "src/app/dashboard/holidaySubsidy/weekly/[ccaName]/page.tsx" "src/app/dashboard/holidaySubsidy/approvals/weekly/[ccaName]/page.tsx" "src/app/dashboard/holidaySubsidy/approvals/[ccaName]/page.tsx"` | N/A | ⬜ pending |
| 05-03-01 | 03 | 2 | ALLOC-01, ALLOC-02 | — | rank page becomes a thin shell | unit + lint smoke | `npx vitest run src/features/allocation/utils/ranking-changes.test.ts src/features/allocation/utils/applicant-diff.test.ts && npx eslint "src/features/allocation/hooks/use-rankable-positions.ts" "src/features/allocation/components/rank-selection-step.tsx" "src/features/allocation/components/rank-ordering-step.tsx" "src/features/allocation/utils/ranking-columns.tsx" "src/app/dashboard/ccaAllocation/rank/page.tsx" && wc -l "src/app/dashboard/ccaAllocation/rank/page.tsx"` | N/A | ⬜ pending |
| 05-04-01 | 04 | 2 | ALLOC-01, ALLOC-02 | — | rankApplicants page and allocation landing page become thin shells without changing save sequencing or guide copy | unit + lint smoke | `npx vitest run src/features/allocation/utils/ranking-changes.test.ts src/features/allocation/utils/applicant-diff.test.ts && npx eslint "src/features/allocation/hooks/use-applicant-rankings.ts" "src/features/allocation/components/position-search-box.tsx" "src/features/allocation/components/position-card.tsx" "src/features/allocation/components/allocation-guide-hero.tsx" "src/features/allocation/components/allocation-algorithm-steps.tsx" "src/features/allocation/components/allocation-faq.tsx" "src/features/allocation/utils/allocation-guide-content.ts" "src/app/dashboard/ccaAllocation/rankApplicants/page.tsx" "src/app/dashboard/ccaAllocation/page.tsx" && wc -l "src/app/dashboard/ccaAllocation/rankApplicants/page.tsx" "src/app/dashboard/ccaAllocation/page.tsx"` | N/A | ⬜ pending |
| 05-05-01 | 05 | 2 | HSUB-01 | — | Holiday subsidy route handlers compile against feature-local type contracts | unit + lint smoke | `npx vitest run src/features/holiday-subsidy/utils/holiday-weeks.test.ts src/features/holiday-subsidy/utils/weekly-change-set.test.ts && npx eslint "src/app/api/holidaySubsidy/approvals/[ccaId]/route.ts" "src/app/api/holidaySubsidy/approvals/route.ts" "src/app/api/holidaySubsidy/approvals/weekly/[ccaId]/[weekId]/route.ts" "src/app/api/holidaySubsidy/declarations/[ccaId]/route.ts" "src/app/api/holidaySubsidy/weekly/[ccaId]/[weekId]/route.ts"` | N/A | ⬜ pending |
| 05-06-01 | 06 | 3 | HSUB-01 | — | Declaration page becomes a thin shell using the verified declaration contract | lint smoke | `npx eslint "src/features/holiday-subsidy/hooks/use-subsidy-declarations.ts" "src/features/holiday-subsidy/components/subsidy-declaration-form-dialog.tsx" "src/features/holiday-subsidy/components/declaration-section-card.tsx" "src/features/holiday-subsidy/utils/declaration-mappers.ts" "src/app/dashboard/holidaySubsidy/declaration/[ccaName]/page.tsx" && wc -l "src/app/dashboard/holidaySubsidy/declaration/[ccaName]/page.tsx"` | N/A | ⬜ pending |
| 05-07-01 | 07 | 1 | HSUB-01 | — | Holiday landing and approvals index pages become thin shells | lint smoke | `npx eslint "src/features/holiday-subsidy/hooks/use-chair-subsidy-ccas.ts" "src/features/holiday-subsidy/hooks/use-subsidy-approvals-index.ts" "src/features/holiday-subsidy/components/chair-cca-table.tsx" "src/features/holiday-subsidy/components/approval-cca-table.tsx" "src/app/dashboard/holidaySubsidy/page.tsx" "src/app/dashboard/holidaySubsidy/approvals/page.tsx" && wc -l "src/app/dashboard/holidaySubsidy/page.tsx" "src/app/dashboard/holidaySubsidy/approvals/page.tsx"` | N/A | ⬜ pending |
| 05-08-01 | 08 | 4 | HSUB-01 | — | Approval-detail page becomes a thin shell with shared declaration infrastructure | lint smoke | `npx eslint "src/features/holiday-subsidy/hooks/use-subsidy-approval-details.ts" "src/features/holiday-subsidy/components/declaration-section-card.tsx" "src/features/holiday-subsidy/utils/declaration-mappers.ts" "src/app/dashboard/holidaySubsidy/approvals/[ccaName]/page.tsx" && wc -l "src/app/dashboard/holidaySubsidy/approvals/[ccaName]/page.tsx"` | N/A | ⬜ pending |
| 05-08-02 | 08 | 4 | HSUB-01, HSUB-02 | — | Weekly commitment and weekly approvals remain behaviorally identical through separate hooks | unit + lint smoke | `npx vitest run src/features/holiday-subsidy/utils/holiday-weeks.test.ts src/features/holiday-subsidy/utils/weekly-change-set.test.ts && npx eslint "src/features/holiday-subsidy/hooks/use-weekly-commitment.ts" "src/features/holiday-subsidy/components/weekly-commitment-table.tsx" "src/features/holiday-subsidy/components/weekly-page-header.tsx" "src/features/holiday-subsidy/hooks/use-weekly-approvals.ts" "src/features/holiday-subsidy/components/weekly-approvals-table.tsx" "src/app/dashboard/holidaySubsidy/weekly/[ccaName]/page.tsx" "src/app/dashboard/holidaySubsidy/approvals/weekly/[ccaName]/page.tsx" && wc -l "src/app/dashboard/holidaySubsidy/weekly/[ccaName]/page.tsx" "src/app/dashboard/holidaySubsidy/approvals/weekly/[ccaName]/page.tsx"` | N/A | ⬜ pending |
| 05-09-01 | 09 | 1 | HSUB-01 | — | Guide page is decomposed into feature-local sections | lint smoke | `npx eslint "src/features/holiday-subsidy/components/guide-process-overview.tsx" "src/features/holiday-subsidy/components/guide-phase-card.tsx" "src/features/holiday-subsidy/components/guide-faq.tsx" "src/features/holiday-subsidy/utils/holiday-subsidy-guide-content.ts" "src/app/dashboard/holidaySubsidy/guide/page.tsx" && wc -l "src/app/dashboard/holidaySubsidy/guide/page.tsx"` | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/features/allocation/utils/applicant-diff.test.ts` — covers add/remove/reorder diff behavior extracted from `rankApplicants/page.tsx`
- [ ] `src/features/allocation/utils/ranking-changes.test.ts` — covers selected-id and ranking-order change detection extracted from `rank/page.tsx`
- [ ] `src/config/holiday-weeks.json` + `src/features/holiday-subsidy/utils/holiday-weeks.test.ts` — lock JSON-to-runtime normalization, options, and editable-week behavior
- [ ] `src/features/holiday-subsidy/utils/weekly-change-set.test.ts` — covers dirty-row and save-payload logic extracted from weekly commitment flows
- [ ] Manual declaration-flow verification note — confirm current `POST`/`PATCH`/`DELETE` routing behavior before any declaration page or declaration route file is edited

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Declaration create/edit/delete path uses the intended route parameter shape in live runtime | HSUB-01 | Research found a potential `ccaName` vs `ccaId` mismatch between page mutations and `src/app/api/holidaySubsidy/declarations/[ccaId]/route.ts` | Exercise declaration create, edit, and delete flows from the dashboard UI and confirm requests hit the expected route with successful responses before refactor parity is asserted |
| Weekly approvals authorization behavior remains unchanged | HSUB-01 | The weekly approvals API route contains commented or temporary authorization logic that should not drift accidentally during refactor | Verify approval screen access with intended user roles before and after the refactor and confirm no new authorization behavior is introduced |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Task feedback latency < 30s, with full build reserved for wave boundaries
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
