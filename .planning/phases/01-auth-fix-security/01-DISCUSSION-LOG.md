# Phase 1: Auth Fix & Security - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in `01-CONTEXT.md` — this log preserves the alternatives considered.

**Date:** 2026-04-11
**Phase:** 1-auth-fix-security
**Areas discussed:** Session refresh & cookie writeback, Auth ownership boundaries, Unauthorized and missing-user handling, Auth test safety net

---

## Session refresh & cookie writeback

| Option | Description | Selected |
|--------|-------------|----------|
| Write refreshed cookies from middleware on protected SSR requests | Middleware becomes the canonical place to persist refreshed Supabase auth cookies during protected SSR requests. | ✓ |
| Keep cookie writes limited to auth transitions only | Only write cookies during the OAuth callback or other explicit auth transitions. | |
| You decide | Leave the exact trigger to implementation as long as SSR session bleed is fixed and tests prove it. | |

**User's choice:** Write refreshed cookies from middleware on protected SSR requests
**Notes:** Cookie writeback should be centralized in middleware during protected SSR requests.

| Option | Description | Selected |
|--------|-------------|----------|
| Keep the current matcher and fix the existing protected SSR path | Keep middleware focused on `/dashboard/*` and `/auth/*`; API routes continue authenticating server-side. | ✓ |
| Expand middleware coverage beyond the current matcher | Broaden middleware coverage to more routes that may read auth during SSR. | |
| You decide | Leave matcher scope to implementation as long as the SSR bug is fixed. | |

**User's choice:** Keep the current matcher and fix the existing protected SSR path
**Notes:** Phase 1 should stay scoped to the current protected SSR surface.

| Option | Description | Selected |
|--------|-------------|----------|
| Redirect to login with an explicit reason and next path | Make expired sessions explicit and recoverable. | ✓ |
| Redirect silently to login | Simpler flow with less explanation. | |
| You decide | Leave the redirect details to implementation. | |

**User's choice:** Redirect to login with an explicit reason and next path
**Notes:** Recovery flow should preserve both why the redirect happened and where the user was headed.

| Option | Description | Selected |
|--------|-------------|----------|
| Prefer correctness over minimizing cookie churn | Favor session isolation and correctness. | ✓ |
| Prefer minimal cookie writes | Reduce cookie churn even if refresh logic stays narrower. | |
| You decide | Leave the refresh strategy to implementation. | |

**User's choice:** Prefer correctness over minimizing cookie churn
**Notes:** Session correctness is higher priority than minimizing writes.

| Option | Description | Selected |
|--------|-------------|----------|
| Preserve the intended destination after re-login | Return users to the exact page they were trying to reach. | ✓ |
| Always return users to the dashboard root | Always land on `/dashboard` after re-authentication. | |
| You decide | Leave post-login destination handling to implementation. | |

**User's choice:** Preserve the intended destination after re-login
**Notes:** Existing `next`-style redirect support should be carried forward.

| Option | Description | Selected |
|--------|-------------|----------|
| Use a single explicit reason + next query contract | Keep redirect handling inspectable and consistent. | ✓ |
| Avoid explicit reason metadata where possible | Keep redirects simpler and less structured. | |
| You decide | Leave the redirect query shape to implementation. | |

**User's choice:** Use a single explicit reason + next query contract
**Notes:** A stable `reason=...&next=...` contract should be used.

| Option | Description | Selected |
|--------|-------------|----------|
| Callback handles sign-in; middleware owns ongoing refresh and protection | Keeps the callback focused on initial sign-in and middleware on steady-state auth. | ✓ |
| Keep more session responsibility in the callback path | Let the callback route continue to carry more of the session lifecycle. | |
| You decide | Leave the split to implementation. | |

**User's choice:** Callback handles sign-in; middleware owns ongoing refresh and protection
**Notes:** Responsibility should be cleanly separated between initial sign-in and ongoing SSR protection.

---

## Auth ownership boundaries

| Option | Description | Selected |
|--------|-------------|----------|
| Strictly reduce auth to middleware + AuthContext only | Use middleware for protection + refresh, keep `AuthContext` only for client session/user state, and remove `withAuth` entirely. | ✓ |
| Allow limited page-level wrapper logic | Keep a small amount of page-level auth wrapper logic where convenient. | |
| You decide | Leave the final ownership split to implementation. | |

**User's choice:** Strictly reduce auth to middleware + AuthContext only
**Notes:** Phase 1 should end with exactly two auth patterns.

| Option | Description | Selected |
|--------|-------------|----------|
| Remove all `withAuth` usage now | Migrate all affected pages in this phase. | ✓ |
| Allow temporary `withAuth` leftovers | Leave some low-risk usages for later. | |
| You decide | Leave the exact removal pace to implementation. | |

**User's choice:** Remove all `withAuth` usage now
**Notes:** No temporary `withAuth` leftovers should remain after Phase 1.

| Option | Description | Selected |
|--------|-------------|----------|
| Keep AuthContext focused on client state and auth UX | `AuthContext` owns client-visible session/user state and auth UX only. | ✓ |
| Let AuthContext keep some protection behavior | Continue mixing some protection behavior into client context. | |
| You decide | Leave the exact role of AuthContext to implementation. | |

**User's choice:** Keep AuthContext focused on client state and auth UX
**Notes:** Client protection logic should not compete with middleware.

| Option | Description | Selected |
|--------|-------------|----------|
| Keep shared server helpers as the API auth source of truth | API routes keep using shared helpers such as `fetchUserInfo()`. | ✓ |
| Push more auth resolution down into individual API routes | Let routes resolve more auth state directly. | |
| You decide | Leave API auth ownership details to implementation. | |

**User's choice:** Keep shared server helpers as the API auth source of truth
**Notes:** Shared server helpers should stay canonical for API authentication.

---

## Unauthorized and missing-user handling

| Option | Description | Selected |
|--------|-------------|----------|
| Fail closed and sign the user out immediately | Treat a valid Supabase login without a matching intranet record as a hard auth failure. | ✓ |
| Show an explanatory state before sign-out | Keep the session briefly and explain before forcing sign-out. | |
| You decide | Leave the exact behavior to implementation. | |

**User's choice:** Fail closed and sign the user out immediately
**Notes:** Unknown app users should not keep an authenticated session.

| Option | Description | Selected |
|--------|-------------|----------|
| Use one canonical missing-user error path everywhere | Unify callback, middleware, and client handling. | ✓ |
| Allow separate destinations by flow | Keep separate destinations where locally convenient. | |
| You decide | Leave the exact destination handling to implementation. | |

**User's choice:** Use one canonical missing-user error path everywhere
**Notes:** Missing-user handling must be unified across layers.

| Option | Description | Selected |
|--------|-------------|----------|
| Redirect to login as the canonical recovery path | Use login as the default recovery path for expired/invalid sessions. | ✓ |
| Use a dedicated auth-error page for invalid sessions | Prefer a distinct auth-error page before login. | |
| You decide | Leave the recovery path to implementation. | |

**User's choice:** Redirect to login as the canonical recovery path
**Notes:** Invalid sessions should recover through the normal login path.

| Option | Description | Selected |
|--------|-------------|----------|
| Keep role cache as a UX optimization only | Keep client role cache but treat it as non-authoritative. | |
| Reduce or remove the client role cache now | Tighten Phase 1 by changing the cache immediately. | |
| You decide | Leave role-cache treatment to implementation. | ✓ |

**User's choice:** You decide
**Notes:** Implementation may keep the current client role cache temporarily as a UX optimization, with server checks remaining authoritative.

---

## Auth test safety net

| Option | Description | Selected |
|--------|-------------|----------|
| Use Vitest as the Phase 1 test foundation | Set up Vitest first and keep the initial auth safety net in-process. | ✓ |
| Start with end-to-end auth tests first | Start with browser-style auth coverage before lower-level tests. | |
| You decide | Leave the initial test tool choice to implementation. | |

**User's choice:** Use Vitest as the Phase 1 test foundation
**Notes:** Test setup should be lightweight and aligned with the requirement.

| Option | Description | Selected |
|--------|-------------|----------|
| Focus first on middleware, callback, and server auth helpers | Cover the auth seam first. | ✓ |
| Focus first on broader page-level auth flows | Prioritize page-level flows over lower-level auth helpers. | |
| You decide | Leave the first coverage targets to implementation. | |

**User's choice:** Focus first on middleware, callback, and server auth helpers
**Notes:** Highest-risk auth seams should be tested before broader flows.

| Option | Description | Selected |
|--------|-------------|----------|
| Mock Supabase at the boundary and keep tests fast | Keep initial tests deterministic and fast. | ✓ |
| Bias toward heavier integration-style tests | Prefer fewer mocks and heavier tests. | |
| You decide | Leave the mocking strategy to implementation. | |

**User's choice:** Mock Supabase at the boundary and keep tests fast
**Notes:** Boundary mocking is preferred for the first layer of auth coverage.

| Option | Description | Selected |
|--------|-------------|----------|
| Use automated tests plus one manual header verification step | Prove the SSR session-bleed fix with both automation and header inspection. | ✓ |
| Trust automated tests as the main proof | Skip explicit manual header inspection unless needed. | |
| You decide | Leave the final verification mix to implementation. | |

**User's choice:** Use automated tests plus one manual header verification step
**Notes:** Manual `Set-Cookie` verification remains part of acceptance evidence.

---

## Claude's Discretion

- The client-side role cache may remain temporarily as a UX optimization, but it should not be treated as authoritative.

## Deferred Ideas

None.
