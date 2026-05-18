---
phase: 2
slug: infrastructure-cleanup
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-11
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (installed in Phase 1) |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run --reporter=verbose` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run --reporter=verbose`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 1 | INFR-01 | — | N/A | grep | `grep -r "react-hot-toast" src/ \| wc -l` returns 0 | ✅ | ⬜ pending |
| 02-01-02 | 01 | 1 | INFR-01 | — | N/A | cli | `npm ls react-hot-toast 2>&1 \| grep -c "empty"` | ✅ | ⬜ pending |
| 02-02-01 | 02 | 1 | INFR-02 | — | N/A | cli | `npm ls aphrodite 2>&1 \| grep -c "empty"` | ✅ | ⬜ pending |
| 02-02-02 | 02 | 1 | INFR-02 | — | N/A | grep | `grep -r "require.*fs\b" src/ \| wc -l` returns 0 | ✅ | ⬜ pending |
| 02-03-01 | 03 | 2 | INFR-03 | — | N/A | grep | `grep -rn "fetch.*getManagedCCAs" src/app/api/ \| wc -l` returns 0 | ✅ | ⬜ pending |
| 02-04-01 | 04 | 3 | INFR-04 | — | N/A | config | `grep "ignoreDuringBuilds" next.config.mjs \| wc -l` returns 0 | ✅ | ⬜ pending |
| 02-04-02 | 04 | 3 | INFR-04 | — | N/A | build | `npm run build` exits 0 | ✅ | ⬜ pending |
| 02-05-01 | 05 | 2 | INFR-05 | — | N/A | grep | `grep -rn "no-explicit-any" src/ \| wc -l` returns 0 | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements. Vitest installed in Phase 1. Phase 2 verifications are grep/CLI checks, not unit tests.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Toast notifications display correctly after sonner migration | INFR-01 | Visual confirmation needed | Trigger a toast in dev mode, verify it renders via sonner's styling |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
