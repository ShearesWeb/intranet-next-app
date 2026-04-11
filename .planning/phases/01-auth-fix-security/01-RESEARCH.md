# Phase 1: Auth Fix & Security - Research

**Researched:** 2026-04-11
**Domain:** Supabase SSR auth, Next.js 15 middleware, session management, Vitest setup
**Confidence:** HIGH

## Summary

Phase 1 fixes a critical SSR session bleed bug caused by the middleware's `setAll` being intentionally disabled (no-op), upgrades Supabase auth packages from `@supabase/ssr@0.7.0` to `@0.10.2` (and `@supabase/supabase-js` from `2.84.0` to `^2.102.1`), consolidates auth into exactly two patterns (middleware + AuthContext), removes the `withAuth` HOC, and establishes Vitest as the project's test framework.

The root cause of the session bleed is clear: the current `src/utils/supabase/middleware.ts` explicitly disables cookie writeback (`setAll() { // Intentionally disabled. }`), which means refreshed tokens are never written back to the browser. This causes stale sessions and potential cross-user contamination under SSR. The fix is to re-enable `setAll` in middleware following the canonical Supabase pattern where cookies are set on both the request object (for downstream server components) and the response object (for the browser).

The `@supabase/ssr@0.10.2` upgrade introduces a breaking signature change: `setAll` now receives a second `headers` argument containing cache-control headers (`Cache-Control: private, no-cache, no-store, must-revalidate, max-age=0`, `Expires: 0`, `Pragma: no-cache`). These headers MUST be applied to the HTTP response to prevent CDN/CloudFront from caching authenticated responses -- directly addressing the CloudFront concern noted in STATE.md.

**Primary recommendation:** Re-enable `setAll` in middleware with the dual cookie-write pattern (request + response), upgrade Supabase packages, apply cache-control headers from the new `setAll` signature, remove `withAuth` HOC completely, and set up Vitest with mocked Supabase boundary tests.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Middleware is the canonical place to write refreshed Supabase auth cookies back to the response during protected SSR requests.
- **D-02:** Phase 1 keeps middleware focused on the current protected surface (`/dashboard/*` and `/auth/*`) rather than expanding matcher scope.
- **D-03:** When a protected SSR request no longer has a valid session, redirect to login with an explicit reason and preserve the intended destination.
- **D-04:** Favor correctness and session isolation over minimizing cookie churn; if Supabase indicates a refreshed session, write the updated cookies.
- **D-05:** Use a single redirect contract such as `reason=session_expired&next=...` so login recovery is consistent.
- **D-06:** After forced re-login, return users to the original intended destination rather than always sending them to `/dashboard`.
- **D-07:** Keep responsibility split cleanly: the OAuth callback handles initial sign-in/session establishment, while middleware owns ongoing refresh and protected-route redirects.
- **D-08:** Auth must be consolidated strictly into two patterns: middleware and `AuthContext`. No third protection layer should remain.
- **D-09:** Remove all `withAuth` HOC usage in Phase 1 rather than leaving temporary holdouts.
- **D-10:** `AuthContext` owns client-visible auth state and auth UX (`signIn`, `signOut`, client session/user hydration), but it is not a second route-protection system.
- **D-11:** API routes continue to get authenticated-user information from shared server helpers such as `fetchUserInfo()` rather than duplicating auth resolution route by route.
- **D-12:** If Supabase authenticates a user who does not exist in intranet user data, fail closed: sign them out immediately.
- **D-13:** Use one canonical missing-user path/contract everywhere instead of separate callback and client-side destinations.
- **D-14:** Expired or invalid sessions recover through login as the canonical path, not a separate long-lived auth-error detour.
- **D-15:** Use Vitest as the initial Phase 1 test foundation.
- **D-16:** First automated coverage targets are middleware redirect/refresh behavior, OAuth callback handling, and shared server auth helpers.
- **D-17:** Mock Supabase at the boundary for the first test layer so tests stay deterministic and fast.
- **D-18:** Verification of the SSR session-bleed fix requires both automated tests and one targeted manual `Set-Cookie` header inspection step.

### Claude's Discretion
- The existing client-side role cache may remain temporarily as a UX optimization, but it must be treated as non-authoritative. Server-side auth and authorization checks remain the security boundary.
- Planning may decide the smallest safe implementation details for the canonical missing-user destination, as long as the flow is unified and fail-closed.

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AUTH-01 | Fix SSR session bleed -- re-enable `setAll()` in middleware with proper cookie forwarding | Confirmed root cause: `setAll` is no-op in current middleware. Fix uses dual cookie-write pattern (request.cookies.set + response.cookies.set). v0.10.2 adds cache headers as second `setAll` argument that must be applied to response. |
| AUTH-02 | Upgrade `@supabase/ssr` to ^0.10.2 and `@supabase/supabase-js` to ^2.102.1 | Verified: current installed versions are 0.7.0 and 2.84.0 respectively. Target versions confirmed available on npm. v0.10.2 has breaking `setAll` signature (new `headers` second argument). `@supabase/ssr@0.10.2` requires `@supabase/supabase-js@^2.102.1` as peer dependency. |
| AUTH-03 | Consolidate auth into two patterns -- middleware (route protection + token refresh) and AuthContext (client state) | Research maps the three current auth layers (middleware, AuthContext, withAuth HOC) and identifies the consolidation path. Server-side helpers (`fetchUserInfo`) remain unchanged. |
| AUTH-04 | Remove `withAuth` HOC -- replace all usages with middleware + AuthContext pattern | Only two files use withAuth: `src/hoc/withAuth.tsx` (definition) and `src/app/testPage/page.tsx` (consumer). Removal scope is small and well-bounded. |
| AUTH-05 | Set up Vitest with at least auth flow tests as safety net | Vitest 4.1.4 available. Requires `vitest`, `@vitejs/plugin-react`, `vite-tsconfig-paths`. Tests mock Supabase at boundary for deterministic auth flow testing. |
</phase_requirements>

## Standard Stack

### Core

| Library | Current Version | Target Version | Purpose | Why Standard |
|---------|----------------|----------------|---------|--------------|
| `@supabase/ssr` | 0.7.0 | 0.10.2 | Server-side Supabase client with cookie-based sessions | Required upgrade: fixes cookie writeback, adds cache headers to `setAll` [VERIFIED: npm registry, package source] |
| `@supabase/supabase-js` | 2.84.0 | ^2.102.1 | Supabase client library (auth, database, storage) | Peer dependency of `@supabase/ssr@0.10.2` [VERIFIED: npm registry] |
| `vitest` | N/A (new) | 4.1.4 | Test framework | Decision D-15 locks Vitest. Fastest setup for Next.js 15 with native ESM and TypeScript support [VERIFIED: npm registry] |

### Supporting (new dev dependencies for testing)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@vitejs/plugin-react` | latest | Vitest React transform support | Required for any test that renders React components [VERIFIED: npm registry] |
| `vite-tsconfig-paths` | latest | Resolves `@/*` path aliases in Vitest | Required so test imports match `tsconfig.json` paths [VERIFIED: Vitest Next.js guide] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `vitest` | `jest` | Jest requires more config for ESM/TypeScript; Vitest is 10-20x faster startup. Decision D-15 locks Vitest. |
| `getClaims()` in middleware | `getUser()` in middleware | `getUser()` contacts auth server every call (slower, more load). `getClaims()` validates JWT locally for asymmetric keys, triggers refresh if token is expiring. The codebase already uses `getClaims()` -- keep it. |

**Installation:**
```bash
npm install @supabase/ssr@0.10.2 @supabase/supabase-js@^2.102.1
npm install -D vitest @vitejs/plugin-react vite-tsconfig-paths
```

**Version verification:**
- `@supabase/ssr@0.10.2` -- latest stable, published 2026-04-09 [VERIFIED: npm registry]
- `@supabase/supabase-js` -- latest 2.103.0, peer requirement `^2.102.1` [VERIFIED: npm registry]
- `vitest@4.1.4` -- latest stable [VERIFIED: npm registry]

## Architecture Patterns

### Recommended Auth Architecture (Post Phase 1)

```
src/
  middleware.ts                          # Entry point, matcher config (unchanged location)
  utils/supabase/
    middleware.ts                         # updateSession: cookie refresh + writeback + redirects
    server.ts                            # createClient for API routes/server components
    client.ts                            # createClient for browser (unchanged)
  context/
    AuthContext.tsx                       # Client auth state, signIn/signOut, user hydration
  lib/
    fetch-user-info.ts                   # Server-side user resolution (unchanged)
  app/
    auth/
      callback/route.ts                  # OAuth code exchange + missing-user check
      login/page.tsx                     # Login page with reason/next params
    testPage/                            # REMOVE (only consumer of withAuth)
  hoc/
    withAuth.tsx                         # REMOVE entirely
```

### Pattern 1: Middleware Cookie Writeback (the critical fix)

**What:** The middleware `setAll` callback must write cookies to BOTH the request (for downstream server components) AND the response (for the browser). In v0.10.2, it must also apply cache-control headers from the second argument to the response.

**When to use:** Always in the middleware Supabase client.

**Example:**
```typescript
// Source: @supabase/ssr v0.10.2 types.d.ts + official Supabase SSR docs
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          // Write to request so downstream Server Components see refreshed token
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          // Recreate response to pick up modified request headers
          supabaseResponse = NextResponse.next({ request });
          // Write to response so browser receives refreshed token
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
          // Apply cache-control headers to prevent CDN caching of auth responses
          Object.entries(headers).forEach(([key, value]) =>
            supabaseResponse.headers.set(key, value)
          );
        },
      },
    }
  );

  // Trigger token validation and potential refresh
  const { data, error } = await supabase.auth.getClaims();
  // ... redirect logic ...

  return supabaseResponse;
}
```
[VERIFIED: @supabase/ssr v0.10.2 source code inspection + official Supabase SSR docs]

### Pattern 2: Server-Side Client (API routes / Server Components)

**What:** Server client with `setAll` omitted or wrapped in try/catch. Middleware handles cookie writeback; server components cannot reliably set cookies in Next.js App Router.

**When to use:** In API routes and server components.

**Example:**
```typescript
// Source: existing src/utils/supabase/server.ts pattern, adapted for v0.10.2
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient(options: { allowCookieWrite?: boolean } = {}) {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          // Server Components cannot reliably set cookies.
          // Middleware handles this. Only the OAuth callback
          // should use allowCookieWrite: true.
          if (!options.allowCookieWrite) return;
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component -- cookies are read-only.
          }
        },
      },
    }
  );
}
```
[VERIFIED: existing codebase pattern + @supabase/ssr v0.10.2 documentation guidance]

### Pattern 3: Redirect Contract for Expired Sessions

**What:** When middleware detects no valid session on a protected route, redirect to `/auth/login` with `reason` and `next` query parameters.

**When to use:** All auth redirects from middleware.

**Example:**
```typescript
// In updateSession, after getClaims fails or returns no valid sub:
const loginUrl = request.nextUrl.clone();
loginUrl.pathname = "/auth/login";
loginUrl.searchParams.set("reason", "session_expired");
loginUrl.searchParams.set("next", request.nextUrl.pathname);
return NextResponse.redirect(loginUrl);
```
[ASSUMED -- specific query param names are Claude's discretion per D-05]

### Anti-Patterns to Avoid

- **Module-level Supabase client:** Never store a Supabase client in a module-level variable. Vercel's Fluid compute model can reuse server instances across requests, causing one user's session to leak into another's. Always create the client inside the request handler. [CITED: supabase.com/docs/guides/auth/server-side/advanced-guide]
- **Skipping `setAll` in middleware:** This is the root cause of the current session bleed. The middleware MUST implement `setAll` with both request and response cookie writes. [VERIFIED: codebase inspection]
- **Using `getSession()` for server-side auth:** Official Supabase guidance states: "Always use `supabase.auth.getClaims()` to protect pages and user data. Never trust `supabase.auth.getSession()` inside server code." [CITED: supabase.com/docs/guides/auth/server-side/creating-a-client]
- **Triple auth enforcement:** Having middleware + AuthContext + withAuth HOC creates overlapping, inconsistent protection. Phase 1 removes withAuth entirely. [VERIFIED: codebase has all three patterns active]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cookie chunking/encoding | Custom cookie serialization | `@supabase/ssr` `setAll`/`getAll` | Supabase tokens can exceed 4KB cookie limit; the library handles chunking automatically with base64url encoding [VERIFIED: @supabase/ssr source] |
| JWT validation | Custom JWT verify logic | `supabase.auth.getClaims()` | Handles JWKS caching, asymmetric/symmetric key detection, token refresh triggering [CITED: supabase.com/docs/reference/javascript/auth-getclaims] |
| CDN cache prevention for auth | Manual Cache-Control headers | `setAll` second `headers` argument in v0.10.2 | Library provides exactly the right headers: `Cache-Control: private, no-cache, no-store, must-revalidate, max-age=0`, `Expires: 0`, `Pragma: no-cache` [VERIFIED: @supabase/ssr v0.10.2 source] |
| Test mocking of Supabase | Hand-written fetch mocks | `vi.mock("@supabase/ssr")` at module boundary | Mock `createServerClient` and `createBrowserClient` to return controlled auth responses [ASSUMED -- standard vitest mocking pattern] |

**Key insight:** The Supabase SSR library handles the hard parts (cookie chunking, token refresh, cache headers). The session bleed bug exists because the library's writeback mechanism was intentionally disabled. Re-enabling it with the correct dual-write pattern is the fix.

## Common Pitfalls

### Pitfall 1: Forgetting to Write Cookies to Both Request AND Response
**What goes wrong:** If cookies are only written to the response but not the request, downstream Server Components in the same render still see the stale token. If only written to the request, the browser never receives the refreshed token.
**Why it happens:** The dual-write pattern is non-obvious. Most developers only think about the response.
**How to avoid:** Follow the exact pattern: `request.cookies.set()` first, then recreate the response with `NextResponse.next({ request })`, then `response.cookies.set()`.
**Warning signs:** Users are randomly logged out, or server-rendered pages show stale data while client-side works.
[CITED: supabase.com/docs/guides/auth/server-side/creating-a-client]

### Pitfall 2: CDN Caching Authenticated Responses
**What goes wrong:** CloudFront (or other CDN) caches an SSR response containing `Set-Cookie` headers with a refreshed JWT. The next user receives the cached response and gets signed in as the wrong user.
**Why it happens:** Default CDN cache policies may cache responses even with `Set-Cookie` present.
**How to avoid:** Apply the cache headers from `setAll`'s second argument to the response. For CloudFront specifically: set Minimum TTL to 0 in cache policy, or use `Cache-Control: no-cache="Set-Cookie"`. The `@supabase/ssr@0.10.2` library provides these headers automatically.
**Warning signs:** Session bleed only happens in production (behind CDN), not in dev.
[CITED: supabase.com/docs/guides/auth/server-side/advanced-guide]

### Pitfall 3: Race Condition on Concurrent Token Refresh
**What goes wrong:** Two browser tabs open simultaneously with an expired session. Both send the same refresh token. Supabase refresh tokens are single-use, so one succeeds and the other fails, logging the user out.
**Why it happens:** Supabase refresh tokens are consumed on use. Concurrent requests with the same expired access token will race to refresh.
**How to avoid:** This is a known Supabase limitation. The current middleware scope (`/dashboard/*` and `/auth/*`) limits exposure. No custom mitigation needed for Phase 1 -- awareness is sufficient.
**Warning signs:** Intermittent "Invalid Refresh Token" errors in logs.
[CITED: github.com/supabase/ssr/issues/68]

### Pitfall 4: `setAll` Signature Change in v0.10.2
**What goes wrong:** Code written for v0.7.0's `setAll(cookiesToSet)` breaks silently with v0.10.2 because the second `headers` argument is ignored, leaving CDN cache prevention absent.
**Why it happens:** The signature changed from `setAll(cookies)` to `setAll(cookies, headers)`. TypeScript won't error because extra parameters in callbacks are allowed.
**How to avoid:** Explicitly handle the `headers` parameter in all `setAll` implementations that write to an HTTP response (middleware). Server-side `createClient` where `setAll` is a no-op or try/catch can safely ignore it.
**Warning signs:** Middleware works locally but session bleed persists behind CloudFront in production.
[VERIFIED: @supabase/ssr v0.10.2 types.d.ts source inspection]

### Pitfall 5: Breaking OAuth Callback on Upgrade
**What goes wrong:** After upgrading `@supabase/supabase-js`, the `exchangeCodeForSession` method defers the `SIGNED_IN` event (changed in v2.91.0), potentially causing the OAuth callback to redirect before cookies are written.
**Why it happens:** v2.91.0 changed when the `SIGNED_IN` event fires relative to cookie writes.
**How to avoid:** The callback route (`src/app/auth/callback/route.ts`) already uses `allowCookieWrite: true` and awaits the exchange. Ensure the `setAll` in the server client with `allowCookieWrite` actually writes cookies (it currently does). Test the full OAuth flow after the upgrade.
**Warning signs:** After Google OAuth redirect, user lands on login page instead of dashboard.
[CITED: github.com/supabase/supabase-js/issues/2037]

## Code Examples

### Complete Middleware updateSession (target implementation)

```typescript
// Source: Composite of @supabase/ssr v0.10.2 types + official Supabase Next.js SSR guide
// File: src/utils/supabase/middleware.ts

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
          // v0.10.2: Apply cache-control headers to prevent CDN caching
          Object.entries(headers).forEach(([key, value]) =>
            supabaseResponse.headers.set(key, value)
          );
        },
      },
    }
  );

  // IMPORTANT: Do not add logic between createServerClient and getClaims.
  const { data, error } = await supabase.auth.getClaims();
  const isAuthenticated = Boolean(data?.claims?.sub);
  const path = request.nextUrl.pathname;

  if (error) {
    if (path.startsWith("/auth")) {
      return supabaseResponse;
    }
    if (!error.message.includes("Auth session missing")) {
      console.error("Auth error in middleware:", error);
    }
    // D-03, D-05, D-06: Redirect to login with reason and preserve destination
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/auth/login";
    loginUrl.searchParams.set("reason", "session_expired");
    loginUrl.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (!isAuthenticated && path.startsWith("/dashboard")) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/auth/login";
    loginUrl.searchParams.set("reason", "session_expired");
    loginUrl.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isAuthenticated && path.startsWith("/auth")) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
```

### Vitest Configuration

```typescript
// Source: Next.js Vitest guide + project tsconfig.json
// File: vitest.config.mts

import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: "jsdom",
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    globals: true,
  },
});
```

### Example Auth Middleware Test

```typescript
// Source: Standard Vitest mocking pattern for @supabase/ssr
// File: src/utils/supabase/__tests__/middleware.test.ts

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock at the module boundary per D-17
vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(),
}));

describe("updateSession", () => {
  it("redirects to login with reason when session is missing", async () => {
    // Arrange: mock getClaims to return error
    const mockGetClaims = vi.fn().mockResolvedValue({
      data: { claims: null },
      error: { message: "Auth session missing" },
    });

    const { createServerClient } = await import("@supabase/ssr");
    (createServerClient as any).mockReturnValue({
      auth: { getClaims: mockGetClaims },
    });

    const { updateSession } = await import("../middleware");
    const request = new NextRequest("http://localhost/dashboard/mycca");

    // Act
    const response = await updateSession(request);

    // Assert
    expect(response.status).toBe(307);
    const location = response.headers.get("location");
    expect(location).toContain("/auth/login");
    expect(location).toContain("reason=session_expired");
    expect(location).toContain("next=%2Fdashboard%2Fmycca");
  });

  it("writes refreshed cookies to response when setAll is called", async () => {
    // Test verifying the dual cookie-write pattern
    // ...
  });
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `get`/`set`/`remove` cookie methods | `getAll`/`setAll` cookie methods | `@supabase/ssr` v0.4.0 (June 2024) | Must use batch methods; old API deprecated [VERIFIED: github.com/orgs/supabase/discussions/27037] |
| `setAll(cookies)` signature | `setAll(cookies, headers)` signature | `@supabase/ssr` v0.10.0 (March 2026) | Must apply cache headers to response to prevent CDN caching [VERIFIED: @supabase/ssr v0.10.2 source] |
| `getUser()` for middleware auth | `getClaims()` for middleware auth | Supabase docs update 2025-2026 | `getClaims()` validates JWT locally (for asymmetric keys), triggers refresh if needed, avoids auth server round-trip [CITED: supabase.com/docs/guides/auth/server-side/creating-a-client] |
| `cookies.encode` option | `encode: "tokens-only"` experimental | `@supabase/ssr` v0.8.0 (Nov 2025) | Reduces cookie payload; experimental, not needed for Phase 1 [VERIFIED: github.com/supabase/ssr releases] |

**Deprecated/outdated:**
- `withAuth` HOC pattern: Was a legacy protection layer. Middleware + AuthContext is the canonical approach. [VERIFIED: codebase inspection]
- `react-hot-toast` in `withAuth.tsx`: Removing the HOC also removes this import. Other files still use it but are out of scope for Phase 1. [VERIFIED: grep of codebase]
- `supabase.auth.getSession()` for server-side auth: Officially discouraged. Use `getClaims()` or `getUser()`. [CITED: supabase.com/docs/guides/auth/server-side/creating-a-client]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Redirect query params should be `reason=session_expired&next=...` | Architecture Patterns, Pattern 3 | Low -- naming is Claude's discretion per D-05. Can use any consistent scheme. |
| A2 | The `testPage` directory can be removed entirely (it is only a withAuth test page) | Architecture Patterns | Low -- if it serves another purpose, convert it to use middleware protection instead. |
| A3 | `@vitejs/plugin-react` latest is compatible with Vitest 4.1.4 | Standard Stack | Low -- both are maintained by the Vite ecosystem and tested together. |
| A4 | The project uses asymmetric JWT signing (making `getClaims()` local-only validation) | Common Pitfalls | Medium -- if using symmetric keys, `getClaims()` still works but contacts the auth server (same as `getUser()`). See STATE.md blocker about verifying JWT signing key type. |

## Open Questions

1. **JWT Signing Key Type (Symmetric vs Asymmetric)**
   - What we know: `getClaims()` validates locally for asymmetric keys but contacts the auth server for symmetric keys. STATE.md notes this as a Phase 1 blocker/concern.
   - What's unclear: Which type the Supabase project uses. This affects `getClaims()` performance but NOT correctness -- both modes work for auth validation.
   - Recommendation: Check the Supabase dashboard's Auth settings (JWT Configuration section). If symmetric, `getClaims()` still works correctly; it just won't be as fast. No code change needed either way.

2. **CloudFront Cache Policy for Authenticated Routes**
   - What we know: STATE.md flags this for review. The v0.10.2 `setAll` headers address it from the application side. CloudFront may also need policy changes.
   - What's unclear: Whether the current CloudFront distribution has cache policies that might override the `Cache-Control` headers.
   - Recommendation: The v0.10.2 headers (`private, no-cache, no-store, must-revalidate, max-age=0`) are aggressive enough for most CDN configs. If CloudFront has a managed cache policy with minimum TTL > 0, it may need a policy update -- but that is infrastructure work outside the codebase. Phase 1 can proceed with application-level headers.

3. **`auth-error` Page Consolidation**
   - What we know: D-13 requires a single canonical missing-user path. Currently, the OAuth callback redirects to `/auth/login?reason=user_not_found`, and AuthContext redirects to `/auth/auth-error?reason=user_not_found`.
   - What's unclear: Whether `/auth/auth-error` should remain as a page or if all error flows should go through `/auth/login` with reason params.
   - Recommendation: Consolidate to `/auth/login?reason=...` as the single path per D-13 and D-14. The login page already handles `reason` params via `LoginForm`. The `auth-error` page can be removed or redirected.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Runtime | Yes | 22.22.0 | -- |
| npm | Package management | Yes | 11.10.1 | -- |
| `@supabase/ssr` | Auth fix (upgrade) | Yes (npm) | 0.10.2 target | -- |
| `@supabase/supabase-js` | Auth (peer dep) | Yes (npm) | ^2.102.1 target | -- |
| `vitest` | Testing framework | Yes (npm) | 4.1.4 target | -- |
| Supabase project | Auth backend | Yes (assumed -- env vars configured) | -- | -- |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:** None.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.4 (to be installed in Phase 1) |
| Config file | `vitest.config.mts` (Wave 0 -- does not exist yet) |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` |

### Phase Requirements -> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AUTH-01 | Middleware writes refreshed cookies to response via `setAll` | unit | `npx vitest run src/utils/supabase/__tests__/middleware.test.ts -t "writes refreshed cookies"` | Wave 0 |
| AUTH-01 | Middleware redirects to login when session is missing | unit | `npx vitest run src/utils/supabase/__tests__/middleware.test.ts -t "redirects to login"` | Wave 0 |
| AUTH-01 | Middleware applies cache-control headers when setAll fires | unit | `npx vitest run src/utils/supabase/__tests__/middleware.test.ts -t "cache headers"` | Wave 0 |
| AUTH-02 | Package versions match target after upgrade | smoke | `npm ls @supabase/ssr @supabase/supabase-js` | N/A (CLI check) |
| AUTH-03 | No withAuth imports remain in codebase | smoke | `grep -r "withAuth" src/ --include="*.ts" --include="*.tsx"` | N/A (CLI check) |
| AUTH-04 | withAuth HOC file and testPage removed | smoke | `test ! -f src/hoc/withAuth.tsx && test ! -d src/app/testPage` | N/A (CLI check) |
| AUTH-05 | Vitest config exists and suite runs | smoke | `npx vitest run` | Wave 0 |
| AUTH-01 | SSR response has Set-Cookie after token refresh | manual | Inspect Set-Cookie headers in browser DevTools on SSR navigation | N/A (D-18 manual step) |
| D-03/D-05 | Redirect includes reason and next params | unit | `npx vitest run src/utils/supabase/__tests__/middleware.test.ts -t "redirect contract"` | Wave 0 |
| D-12 | OAuth callback signs out user not in DB | unit | `npx vitest run src/app/auth/__tests__/callback.test.ts -t "missing user"` | Wave 0 |
| D-13 | AuthContext redirects to canonical login path, not auth-error | unit | `npx vitest run src/context/__tests__/AuthContext.test.tsx -t "missing user redirect"` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run --reporter=verbose` (quick, subset tests)
- **Per wave merge:** `npx vitest run` (full suite)
- **Phase gate:** Full suite green + manual Set-Cookie inspection before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `vitest.config.mts` -- Vitest configuration file (does not exist yet)
- [ ] `src/utils/supabase/__tests__/middleware.test.ts` -- covers AUTH-01, D-03, D-05
- [ ] `src/app/auth/__tests__/callback.test.ts` -- covers D-12 (OAuth callback missing-user handling)
- [ ] `src/context/__tests__/AuthContext.test.tsx` -- covers D-13 (AuthContext missing-user redirect)
- [ ] Framework install: `npm install -D vitest @vitejs/plugin-react vite-tsconfig-paths`
- [ ] `package.json` test script: `"test": "vitest run"`, `"test:watch": "vitest"`

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | YES | Supabase Auth (Google OAuth PKCE flow), `getClaims()` for JWT validation |
| V3 Session Management | YES | `@supabase/ssr` cookie-based sessions, middleware token refresh with `setAll` |
| V4 Access Control | YES (partial) | Middleware route protection for `/dashboard/*`; API-level authorization via `fetchUserInfo()` unchanged |
| V5 Input Validation | No | No user input handling changes in Phase 1 |
| V6 Cryptography | No | JWT signing handled by Supabase Auth server, not application code |

### Known Threat Patterns for Auth Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| SSR session bleed (current bug) | Information Disclosure | Enable `setAll` dual cookie-write in middleware [VERIFIED: root cause confirmed] |
| CDN caching Set-Cookie headers | Information Disclosure | Apply `Cache-Control: private, no-cache, no-store` from `setAll` headers param [VERIFIED: @supabase/ssr v0.10.2 provides these] |
| Token reuse after signout | Elevation of Privilege | `getClaims()` validates JWT signature and expiry; full signout verification requires `getUser()` call to auth server [CITED: supabase.com/docs/reference/javascript/auth-getuser] |
| Missing-user bypass (authenticated but not in DB) | Spoofing | Fail closed: sign out immediately in OAuth callback (D-12) [VERIFIED: existing callback already does this] |
| Refresh token race condition | Denial of Service | Known Supabase limitation; single-use refresh tokens. No custom mitigation for Phase 1. [CITED: github.com/supabase/ssr/issues/68] |
| Module-level client reuse (Fluid compute) | Information Disclosure | Always create client per-request inside handler. Current code does this correctly. [CITED: supabase.com/docs/guides/auth/server-side/advanced-guide] |

## Sources

### Primary (HIGH confidence)
- `@supabase/ssr` v0.10.2 source code (extracted from npm, inspected `types.d.ts`, `createServerClient.ts`, `cookies.ts`) -- setAll signature change, cache headers, skipAutoInitialize
- npm registry -- verified versions: `@supabase/ssr@0.10.2`, `@supabase/supabase-js@2.103.0`, `vitest@4.1.4`
- Existing codebase inspection -- confirmed `setAll` no-op root cause, `withAuth` usage scope (2 files), current installed versions (ssr 0.7.0, supabase-js 2.84.0)
- [Supabase SSR Creating a Client](https://supabase.com/docs/guides/auth/server-side/creating-a-client) -- `getClaims()` recommendation, proxy architecture
- [Supabase SSR Advanced Guide](https://supabase.com/docs/guides/auth/server-side/advanced-guide) -- session bleed prevention, CDN caching guidance

### Secondary (MEDIUM confidence)
- [Supabase SSR Releases on GitHub](https://github.com/supabase/ssr/releases) -- changelog for v0.8.0 through v0.10.2
- [Supabase SSR Discussion #27037](https://github.com/orgs/supabase/discussions/27037) -- setAll/getAll API migration context from v0.3 to v0.4
- [GitHub Issue #40985](https://github.com/supabase/supabase/issues/40985) -- getClaims vs getUser guidance (still pending official docs update)
- [Next.js Vitest Guide](https://nextjs.org/docs/app/guides/testing/vitest) -- official Vitest setup for Next.js
- [Wisp Blog: Setting up Vitest for Next.js 15](https://www.wisp.blog/blog/setting-up-vitest-for-nextjs-15) -- practical vitest config example

### Tertiary (LOW confidence)
- [GitHub Issue supabase-js #2037](https://github.com/supabase/supabase-js/issues/2037) -- exchangeCodeForSession deferred SIGNED_IN event (v2.91.0 breaking change); exact impact on this codebase unverified

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- versions verified against npm registry, source code inspected for API changes
- Architecture: HIGH -- root cause confirmed by codebase inspection, fix pattern verified against official docs and library source
- Pitfalls: HIGH -- documented from official sources, library source code, and known GitHub issues
- Testing setup: MEDIUM -- Vitest config pattern is standard but not yet validated against this specific project's build setup

**Research date:** 2026-04-11
**Valid until:** 2026-05-11 (30 days -- Supabase SSR is relatively stable post-0.10.0)
