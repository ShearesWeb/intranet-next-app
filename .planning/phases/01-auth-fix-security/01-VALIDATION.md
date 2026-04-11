---
phase: 1
slug: auth-fix-security
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-11
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.4 |
| **Config file** | `vitest.config.mts` (Wave 0 — does not exist yet) |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~5 seconds (unit tests with mocked Supabase) |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green + manual Set-Cookie inspection
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 01-01-01 | 01 | 0 | AUTH-05 | — | N/A (framework setup) | smoke | `npx vitest run` | ❌ W0 | ⬜ pending |
| 01-02-01 | 02 | 1 | AUTH-02 | — | N/A (package upgrade) | smoke | `npm ls @supabase/ssr @supabase/supabase-js` | N/A | ⬜ pending |
| 01-03-01 | 03 | 1 | AUTH-01 | T-1-01 | Middleware writes refreshed cookies to both request and response | unit | `npx vitest run src/utils/supabase/__tests__/middleware.test.ts` | ❌ W0 | ⬜ pending |
| 01-03-02 | 03 | 1 | AUTH-01 | T-1-02 | Middleware applies cache-control headers to prevent CDN caching | unit | `npx vitest run src/utils/supabase/__tests__/middleware.test.ts -t "cache headers"` | ❌ W0 | ⬜ pending |
| 01-03-03 | 03 | 1 | AUTH-03 | — | Redirect includes reason and next params | unit | `npx vitest run src/utils/supabase/__tests__/middleware.test.ts -t "redirect"` | ❌ W0 | ⬜ pending |
| 01-04-01 | 04 | 2 | AUTH-04 | — | No withAuth imports remain | smoke | `grep -r "withAuth" src/ --include="*.ts" --include="*.tsx"` | N/A | ⬜ pending |
| 01-05-01 | 05 | 2 | AUTH-03 | T-1-04 | OAuth callback signs out missing DB user | unit | `npx vitest run src/app/auth/__tests__/callback.test.ts -t "missing user"` | ❌ W0 | ⬜ pending |
| 01-05-02 | 05 | 2 | AUTH-03 | — | AuthContext uses canonical login redirect | unit | `npx vitest run src/context/__tests__/AuthContext.test.tsx -t "missing user"` | ❌ W0 | ⬜ pending |
| 01-06-01 | 06 | 3 | AUTH-01 | T-1-01 | SSR Set-Cookie header present after token refresh | manual | Inspect in browser DevTools | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `vitest.config.mts` — Vitest configuration with jsdom environment, React plugin, tsconfig paths
- [ ] `src/utils/supabase/__tests__/middleware.test.ts` — stubs for AUTH-01 (cookie writeback, cache headers, redirect contract)
- [ ] `src/app/auth/__tests__/callback.test.ts` — stubs for D-12 (missing-user sign-out)
- [ ] `src/context/__tests__/AuthContext.test.tsx` — stubs for D-13 (canonical login redirect)
- [ ] Framework install: `npm install -D vitest @vitejs/plugin-react vite-tsconfig-paths`
- [ ] `package.json` test scripts: `"test": "vitest run"`, `"test:watch": "vitest"`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| SSR response includes Set-Cookie with refreshed JWT | AUTH-01, D-18 | Requires real Supabase session with expired token in browser | 1. Log in. 2. Wait for token to near expiry (or manually expire). 3. Navigate to a dashboard page. 4. Inspect Network tab for Set-Cookie header on SSR response. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
