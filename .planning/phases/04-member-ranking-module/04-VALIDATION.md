---
phase: 04
slug: member-ranking-module
status: ready
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-11
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest `4.1.4` with `jsdom` environment |
| **Config file** | `vitest.config.mts` |
| **Quick run command** | `npx vitest run src/features/ranking/**/*.test.ts src/app/api/user/saveRankings/route.test.ts` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run the task-local `<automated>` command from the active PLAN, or the phase quick run command if multiple ranking test files changed.
- **After every plan wave:** Run `npm test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 4-01-01 | 01 | 1 | RANK-02 | T-04-03 | Shared ranking contracts exist before page/route refactors import them | structural | `node -e "const fs=require('fs'); ['src/features/ranking/types/ranking.ts','src/features/ranking/types/ranking-api.ts'].forEach((p)=>{if(!fs.existsSync(p)) throw new Error('Missing '+p)}); console.log('ranking type contracts present');"` | ✅ planned | ⬜ pending |
| 4-01-02 | 01 | 1 | RANK-02 | T-04-03 | Helper relocation keeps the build green after import rewrites | build | `npm run build` | ✅ planned | ⬜ pending |
| 4-01-03 | 01 | 1 | RANK-02 | T-04-01, T-04-02 | Ranking metrics/comment semantics stay locked before page decomposition | unit | `npx vitest run src/features/ranking/utils/cca-ranking-metrics.test.ts src/features/ranking/utils/cca-ranking-comments.test.ts` | ✅ planned | ⬜ pending |
| 4-02-01 | 02 | 2 | RANK-01 | T-04-06 | Recap contracts, slide order, totals, and image export stay deterministic after extraction | unit | `npx vitest run src/features/ranking/utils/recap-slides.test.ts src/features/ranking/utils/create-recap-image-blob.test.ts` | ✅ planned | ⬜ pending |
| 4-02-02 | 02 | 2 | RANK-01 | T-04-04, T-04-05 | Recap hook wiring preserves fetch URL, fallback mapping, and seen-state persistence | build + unit | `npx vitest run src/features/ranking/utils/recap-slides.test.ts src/features/ranking/utils/create-recap-image-blob.test.ts && npm run build` | ✅ planned | ⬜ pending |
| 4-03-01 | 03 | 3 | RANK-01 | T-04-07, T-04-08 | Navigation bounds, swipe handling, and audio lifecycle stay isolated and testable | unit | `npx vitest run src/features/ranking/hooks/use-recap-navigation.test.tsx` | ✅ planned | ⬜ pending |
| 4-03-02 | 03 | 3 | RANK-01 | T-04-09 | Thin feature-local recap composition stays within the line budget and still builds | build + structural | `node -e "const fs=require('fs'); const p='src/features/ranking/components/points-recap-card.tsx'; const lines=fs.readFileSync(p,'utf8').split('\n').length; if(lines>150){throw new Error(p+' has '+lines+' lines');} console.log(lines);" && npx vitest run src/features/ranking/hooks/use-recap-navigation.test.tsx src/features/ranking/utils/recap-slides.test.ts && npm run build` | ✅ planned | ⬜ pending |
| 4-04-01 | 04 | 2 | RANK-02 | T-04-10, T-04-11 | Ranking editor math, diffing, and chunking stay correct after utility extraction | unit | `npx vitest run src/features/ranking/utils/ranking-editor.test.ts` | ✅ planned | ⬜ pending |
| 4-04-02 | 04 | 2 | RANK-02 | T-04-11, T-04-12 | Hook/component refactor preserves fetch/save flow, gating, and page line budget | build + unit | `node -e "const fs=require('fs'); const p='src/app/dashboard/mycca/admin/rankMembers/[ccaName]/page.tsx'; const lines=fs.readFileSync(p,'utf8').split('\n').length; if(lines>150){throw new Error(p+' has '+lines+' lines');} console.log(lines);" && npx vitest run src/features/ranking/utils/ranking-editor.test.ts src/features/ranking/hooks/use-ranking-editor.test.tsx && npm run build` | ✅ planned | ⬜ pending |
| 4-05-01 | 05 | 2 | RANK-03 | T-04-13 | Rankings route helpers stay behavior-compatible after extraction | unit | `npx vitest run src/features/ranking/utils/ranking-route.test.ts` | ✅ planned | ⬜ pending |
| 4-05-02 | 05 | 2 | RANK-03 | T-04-13, T-04-14 | Save route uses one RPC-backed replacement path and still builds locally | build + unit | `npx vitest run src/features/ranking/utils/ranking-route.test.ts src/app/api/user/saveRankings/route.test.ts && npm run build` | ✅ planned | ⬜ pending |
| 4-05-03 | 05 | 2 | RANK-03 | T-04-14, T-04-15 | Human deployment checkpoint is gated by a concrete automated preflight before real-environment verification | unit + build + manual | `npx vitest run src/features/ranking/utils/ranking-route.test.ts src/app/api/user/saveRankings/route.test.ts && npm run build && node -e "const fs=require('fs'); const sql='db/changelog/04-member-ranking-replace-user-cca-rankings.sql'; const route='src/app/api/user/saveRankings/route.ts'; if(!fs.readFileSync(sql,'utf8').includes('create or replace function public.replace_user_cca_rankings')) throw new Error('missing RPC SQL'); if(!fs.readFileSync(route,'utf8').includes('supabase.rpc(\"replace_user_cca_rankings\"')) throw new Error('missing RPC call'); console.log('preflight OK');"` | ✅ planned | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

No separate Wave 0 remains. Every planned task now carries a concrete `<automated>` command, and the only manual checkpoint (`4-05-03`) is explicitly gated by an automated preflight covering tests, build, and artifact presence.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Points recap slideshow renders and navigates identically after decomposition | RANK-01 | Animation, swipe, keyboard navigation, and audio lifecycle need browser confirmation | Load `/dashboard`, open the recap card, step through slides with keyboard and swipe gestures, and confirm audio/share actions still work |
| Rank members page keeps the same save UX and visual grouping after page decomposition | RANK-02 | UI parity and interaction timing are difficult to prove with unit tests alone | Load `/dashboard/mycca/admin/rankMembers/[ccaName]`, edit rankings and remarks, verify cards/tables render correctly and save states remain unchanged |
| RPC migration works against the real Supabase schema and policies | RANK-03 | Local repo inspection cannot verify live DB constraints, grants, or RLS behavior | Run the Liquibase changelog in the real pipeline, invoke the save flow with both insert/update and deletion cases, and confirm no partial data loss occurs on forced failure |

---

## Validation Sign-Off

- [x] All tasks have concrete `<automated>` verify commands
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] No unresolved placeholder verification references remain
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** ready for execution
