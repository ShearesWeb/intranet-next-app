# Phase 1: Auth Fix & Security - Context

**Gathered:** 2026-04-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 1 fixes SSR session bleed, upgrades Supabase auth dependencies, and consolidates the app onto exactly two auth patterns: middleware for route protection and token refresh, and `AuthContext` for client-side session/user state.

This phase does **not** add new auth capabilities. It clarifies how the existing Google OAuth + Supabase flow should behave so user sessions stay isolated and predictable.

</domain>

<decisions>
## Implementation Decisions

### Session Refresh & Cookie Writeback
- **D-01:** Middleware is the canonical place to write refreshed Supabase auth cookies back to the response during protected SSR requests.
- **D-02:** Phase 1 keeps middleware focused on the current protected surface (`/dashboard/*` and `/auth/*`) rather than expanding matcher scope.
- **D-03:** When a protected SSR request no longer has a valid session, redirect to login with an explicit reason and preserve the intended destination.
- **D-04:** Favor correctness and session isolation over minimizing cookie churn; if Supabase indicates a refreshed session, write the updated cookies.
- **D-05:** Use a single redirect contract such as `reason=session_expired&next=...` so login recovery is consistent.
- **D-06:** After forced re-login, return users to the original intended destination rather than always sending them to `/dashboard`.
- **D-07:** Keep responsibility split cleanly: the OAuth callback handles initial sign-in/session establishment, while middleware owns ongoing refresh and protected-route redirects.

### Auth Ownership Boundaries
- **D-08:** Auth must be consolidated strictly into two patterns: middleware and `AuthContext`. No third protection layer should remain.
- **D-09:** Remove all `withAuth` HOC usage in Phase 1 rather than leaving temporary holdouts.
- **D-10:** `AuthContext` owns client-visible auth state and auth UX (`signIn`, `signOut`, client session/user hydration), but it is not a second route-protection system.
- **D-11:** API routes continue to get authenticated-user information from shared server helpers such as `fetchUserInfo()` rather than duplicating auth resolution route by route.

### Unauthorized & Missing-User Handling
- **D-12:** If Supabase authenticates a user who does not exist in intranet user data, fail closed: sign them out immediately.
- **D-13:** Use one canonical missing-user path/contract everywhere instead of separate callback and client-side destinations.
- **D-14:** Expired or invalid sessions recover through login as the canonical path, not a separate long-lived auth-error detour.

### Test Safety Net
- **D-15:** Use Vitest as the initial Phase 1 test foundation.
- **D-16:** First automated coverage targets are middleware redirect/refresh behavior, OAuth callback handling, and shared server auth helpers.
- **D-17:** Mock Supabase at the boundary for the first test layer so tests stay deterministic and fast.
- **D-18:** Verification of the SSR session-bleed fix requires both automated tests and one targeted manual `Set-Cookie` header inspection step.

### Claude's Discretion
- The existing client-side role cache may remain temporarily as a UX optimization, but it must be treated as non-authoritative. Server-side auth and authorization checks remain the security boundary.
- Planning may decide the smallest safe implementation details for the canonical missing-user destination, as long as the flow is unified and fail-closed.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase Definition
- `.planning/ROADMAP.md` — Phase 1 scope, success criteria, and sequencing.
- `.planning/REQUIREMENTS.md` — `AUTH-01` through `AUTH-05`, plus Phase 1 constraints.
- `.planning/PROJECT.md` — project-level priorities, security constraints, and locked refactor direction.
- `.planning/STATE.md` — current blockers and session notes relevant to Phase 1.

### Existing Auth Seams
- `src/utils/supabase/middleware.ts` — current middleware refresh/protection behavior and cookie-write seam.
- `src/utils/supabase/server.ts` — shared server Supabase client and `allowCookieWrite` behavior.
- `src/middleware.ts` — middleware entrypoint and matcher scope.
- `src/app/auth/callback/route.ts` — OAuth callback, code exchange, and current missing-user flow.
- `src/context/AuthContext.tsx` — client auth state, sign-in/sign-out flow, and current mismatch handling.
- `src/lib/fetch-user-info.ts` — canonical server-side authenticated-user resolution.
- `src/app/api/user/route.ts` — current client-facing auth/session API surface.

### Validation Targets
- `package.json` — confirms the current lack of test tooling and where Vitest setup will connect.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/utils/supabase/middleware.ts` — central place to fix SSR refresh/writeback without scattering auth logic across pages.
- `src/utils/supabase/server.ts` — shared server client already supports an `allowCookieWrite` switch.
- `src/lib/fetch-user-info.ts` — widely reused authenticated-user helper for API routes; this should stay the server auth source of truth.
- `src/context/AuthContext.tsx` — existing client session container that can stay after route-protection logic is removed from other layers.
- `src/app/api/user/route.ts` — stable endpoint for client hydration and sign-out cleanup.

### Established Patterns
- Middleware currently protects `/dashboard/*` and `/auth/*`, while API routes authenticate server-side via shared helpers.
- Server-side user resolution already flows through `fetchUserInfo()` across many API routes, so Phase 1 should strengthen that path instead of inventing a new one.
- The app currently has overlapping auth enforcement (`middleware`, `AuthContext`, `withAuth`), and Phase 1 explicitly removes that overlap.
- No automated test framework exists yet, so Vitest setup is net-new work in this phase.

### Integration Points
- `src/middleware.ts` controls which requests enter the auth middleware path.
- `src/app/auth/callback/route.ts` owns session establishment after Google OAuth.
- `src/context/AuthContext.tsx` and `src/components/auth/login-form.tsx` own the client login/logout experience and recovery flow.
- `src/app/page.tsx` and protected dashboard routes will be affected by any redirect-contract changes.
- `src/hooks/useRoleAuth.ts` is adjacent to auth behavior but should remain secondary to server-side authorization.

</code_context>

<specifics>
## Specific Ideas

- Keep the protected matcher narrow for Phase 1; fix the current SSR session-bleed path before considering broader route coverage.
- Make redirect behavior explicit and inspectable by preserving both a reason and a `next` destination.
- Use manual `Set-Cookie` inspection as part of acceptance evidence, not as a substitute for automated coverage.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 01-auth-fix-security*
*Context gathered: 2026-04-11*
