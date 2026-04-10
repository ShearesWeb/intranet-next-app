# Technology Stack

**Project:** Intranet Next App -- Auth & Refactor
**Researched:** 2026-04-10
**Focus:** Supabase auth patterns, package upgrades, and server/client client creation for Next.js 15 App Router

## Executive Summary

The current app runs `@supabase/ssr@0.7.0` and `@supabase/supabase-js@2.84.0` (resolved) on Next.js 15.5.6. The auth middleware has a **critical bug**: `setAll()` is intentionally disabled in both the middleware and server client, meaning refreshed tokens are never written back to the response. This causes session bleed between users in SSR contexts. The fix requires upgrading `@supabase/ssr` to `^0.10.2` (which adds cache headers to `setAll` to prevent CDN caching) and implementing the standard cookie-forwarding pattern that Supabase officially recommends.

## Recommended Stack

### Core Framework

| Technology | Current | Target | Purpose | Why |
|------------|---------|--------|---------|-----|
| Next.js | 15.5.6 | ^15.5.6 (stay) | Full-stack framework | Stay on 15.x -- upgrading to 16 is out of scope (renames middleware to proxy, requires React 19). Refactor first, upgrade later. |
| React | ^18 | ^18 (stay) | UI library | Next.js 15 supports React 18. React 19 upgrade is a separate effort tied to Next.js 16. |
| TypeScript | ^5.7.2 | ^5.7.2 (stay) | Type safety | Already current. No changes needed. |
| Tailwind CSS | ^4.1.14 | ^4.1.14 (stay) | Styling | Already on v4. No changes needed. |

**Confidence:** HIGH -- verified via npm ls and Next.js release notes.

**Rationale for staying on Next.js 15:** Next.js 16 (current latest: 16.2.3) introduces breaking changes that conflict with this refactor's scope: middleware renamed to proxy (with Node.js runtime replacing Edge), React 19 required, and Turbopack as default bundler. The session bleed fix and code refactor should be completed on the stable 15.x branch before considering a framework upgrade.

### Supabase Packages

| Technology | Current (installed) | Target | Purpose | Why |
|------------|---------------------|--------|---------|-----|
| `@supabase/ssr` | 0.7.0 | ^0.10.2 | SSR cookie-based auth | v0.10.0 adds cache headers to `setAll` callback (prevents CDN session leaking). v0.10.1 fixes auth options in `createBrowserClient`. v0.10.2 is latest. |
| `@supabase/supabase-js` | 2.84.0 | ^2.102.1 | Supabase client | Latest stable. Includes `getClaims()` improvements and typing fixes. No breaking changes from 2.84 to 2.102. |

**Confidence:** HIGH -- versions verified via npm registry and GitHub CHANGELOG.md (changelog reviewed commit-by-commit from 0.7.0 to 0.10.2).

**Breaking changes between 0.7.0 and 0.10.2:**
- **v0.8.0** (2025-11-26): Added `cookies.encode` option for minimal cookie sizes. Non-breaking addition.
- **v0.10.0** (2026-03-30): `setAll` callback now receives a **second argument `headers`** containing `Cache-Control`, `Expires`, and `Pragma` headers. These MUST be applied to the response to prevent CDN caching of auth responses. This is the most important change -- existing code that ignores the second argument will silently fail to set cache headers.
- **v0.10.1** (2026-04-08): Fixed `createBrowserClient` to respect user-provided auth options.
- No other breaking changes. The `getAll`/`setAll` API has been stable since v0.4.0.

### API Keys

| Technology | Current | Target | Purpose | Why |
|------------|---------|--------|---------|-----|
| Env var name | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY` with `NEXT_PUBLIC_SUPABASE_ANON_KEY` fallback | Keep current pattern | Client-side Supabase key | Both publishable (`sb_publishable_...`) and legacy anon keys work identically. Supabase recommends publishable keys for new projects, but migration is optional. The current fallback pattern is fine. |

**Confidence:** HIGH -- verified via Supabase API keys docs. Publishable key is preferred but anon key is not deprecated.

### Supporting Libraries (No Changes)

| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| `@tanstack/react-table` | ^8.21.3 | Data tables | Keep |
| `framer-motion` | ^12.4.10 | Animations | Keep |
| `sonner` | ^2.0.7 | Toast notifications (primary) | Keep -- standardize on this |
| `next-themes` | ^0.4.6 | Dark/light mode | Keep |
| `lucide-react` | ^0.545.0 | Icons | Keep |
| shadcn/ui (Radix primitives) | various | UI components | Keep |

### Libraries to Remove

| Library | Why Remove |
|---------|-----------|
| `react-hot-toast` ^2.4.1 | Duplicate of sonner. Used only in `withAuth.tsx` HOC which should be eliminated. |
| `aphrodite` ^2.4.0 | Legacy CSS-in-JS. No active usage detected. |
| `fs` ^0.0.1-security | Browser shim for Node's fs. Unnecessary in Next.js App Router. |
| `logger` ^0.0.1 | Placeholder package. No real functionality. |

**Confidence:** HIGH -- these were identified in the codebase analysis and confirmed unused.

## Critical Auth Pattern Changes

### The Session Bleed Bug (Root Cause)

The current middleware (`src/utils/supabase/middleware.ts`) and server client (`src/utils/supabase/server.ts`) both **intentionally disable `setAll()`**:

```typescript
// middleware.ts -- CURRENT (BROKEN)
setAll() {
    // Intentionally disabled.
    // Middleware must not mutate auth cookies server-side.
},

// server.ts -- CURRENT (BROKEN)
setAll(cookiesToSet) {
    if (!allowCookieWrite) {
        // Intentionally disabled by default.
        return;
    }
    // ...
},
```

This means when Supabase refreshes an expired JWT, the new token is **never written back to the response**. The browser continues using the stale token. In SSR, this causes one user's refreshed session to be served to another user because the response cookies don't match the actual auth state.

### Recommended Middleware Pattern (Target)

Based on the official Supabase SSR docs for Next.js (verified 2026-04-10):

```typescript
// src/utils/supabase/middleware.ts -- TARGET
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ??
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet, headers) {
          // Forward refreshed cookies to the request (for Server Components)
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )

          // Recreate response with updated request
          supabaseResponse = NextResponse.next({
            request,
          })

          // Forward refreshed cookies to the response (for the browser)
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )

          // Apply cache headers from @supabase/ssr v0.10+
          // Prevents CDN from caching responses with Set-Cookie headers
          if (headers) {
            Object.entries(headers).forEach(([key, value]) =>
              supabaseResponse.headers.set(key, value)
            )
          }
        },
      },
    }
  )

  // Validate the JWT -- use getClaims() for performance (local verification)
  // Use getUser() only if you need to verify server-side logout
  const { data, error } = await supabase.auth.getClaims()
  const isAuthenticated = Boolean(data?.claims?.sub)

  const path = request.nextUrl.pathname

  if (!isAuthenticated && path.startsWith('/dashboard')) {
    const url = request.nextUrl.clone()
    url.pathname = '/auth/login'
    return NextResponse.redirect(url)
  }

  if (isAuthenticated && path.startsWith('/auth')) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
```

**Key differences from current code:**
1. `setAll` is **enabled** and properly writes cookies to both request and response
2. The `headers` second parameter (new in v0.10.0) is applied to the response for CDN cache prevention
3. `request.cookies.set()` forwards refreshed tokens to downstream Server Components
4. Response is recreated after cookie mutation to ensure consistency

### Recommended Server Client Pattern (Target)

```typescript
// src/utils/supabase/server.ts -- TARGET
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ??
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // setAll was called from a Server Component (read-only context).
            // This is safe to ignore IF middleware is refreshing sessions.
          }
        },
      },
    }
  )
}
```

**Key differences from current code:**
1. No `allowCookieWrite` option -- always attempt to write cookies
2. The `try/catch` handles the Server Component read-only context gracefully
3. No explicit disabling of cookie writes -- middleware handles the critical path
4. Removed the `options` parameter -- single simple function signature

### Browser Client Pattern (No Changes Needed)

```typescript
// src/utils/supabase/client.ts -- stays the same
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ??
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

The browser client is unchanged. `createBrowserClient` handles cookies automatically via the browser's cookie jar.

## getClaims() vs getUser() vs getSession()

**Confidence:** MEDIUM -- official docs are still being updated (GitHub issue #40985 still open). Pattern below is based on current docs and resolved issue #39947.

### Decision Matrix

| Method | Network Call | What It Checks | When to Use |
|--------|-------------|----------------|-------------|
| `getClaims()` | Local (with asymmetric keys) or network (symmetric) | JWT signature + expiration via JWKS | **Middleware, Server Components, Route Handlers** -- default choice for auth checks |
| `getUser()` | Always network | Full session validity with auth server | When you need to verify server-side logout or ban status |
| `getSession()` | None (reads local storage) | Nothing -- reads cached session | **NEVER in server code.** Only safe in Client Components for non-security purposes |

### Asymmetric JWT Keys (Prerequisite for Fast getClaims)

For `getClaims()` to work without a network call, the Supabase project must use **asymmetric JWT signing keys** (RSA, ECC, or Ed25519). This is configured in the Supabase Dashboard under Settings > JWT Signing Keys.

- **New projects (2025+):** Likely already on asymmetric keys
- **Older projects:** May use symmetric (HMAC) keys. Check the dashboard.
- **Migration:** Dashboard provides a one-click "Migrate JWT secret" flow that creates an asymmetric standby key, then "Rotate keys" activates it.

**Recommendation:** Verify the project uses asymmetric keys. If not, migrate before relying on `getClaims()` for performance. If on symmetric keys, `getClaims()` still works but makes a network call (same as `getUser()`).

### Current Code Uses getClaims Correctly

The current middleware already uses `getClaims()` -- this is good. The issue is not the auth check method but the disabled `setAll()`.

## AuthContext Cleanup

The current `AuthContext.tsx` uses `supabase.auth.getSession()` on line 96:

```typescript
supabase.auth.getSession().then(({ data: { session } }) => {
    fetchUser(session).finally(() => isMounted && setLoading(false));
});
```

This is acceptable in a Client Component (browser context) where `getSession()` reads from the browser's cookie/storage. However, the pattern of calling `/api/user` to cross-reference the session email is unusual and adds latency. Consider simplifying once the auth middleware is fixed -- the session data from `getSession()` in the browser will be trustworthy once middleware properly refreshes tokens.

## Installation / Upgrade

```bash
# Upgrade Supabase packages
npm install @supabase/ssr@^0.10.2 @supabase/supabase-js@^2.102.1

# Remove unused packages
npm uninstall react-hot-toast aphrodite fs logger
```

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Framework | Next.js 15 (stay) | Next.js 16 | Breaking changes (middleware->proxy, React 19 required). Out of scope for this refactor. |
| Auth verification | `getClaims()` | `getUser()` | `getUser()` adds latency (always hits auth server). `getClaims()` is sufficient for route protection when using asymmetric keys. |
| Auth verification | `getClaims()` | `getSession()` | `getSession()` does NOT validate the JWT. Never use in server code. |
| SSR package | `@supabase/ssr` | `@supabase/auth-helpers-nextjs` | auth-helpers is deprecated. @supabase/ssr is the official replacement. |
| Cookie pattern | `getAll`/`setAll` | `get`/`set`/`remove` | Old 3-method API is deprecated since v0.4.0. Can silently lose cookies when `set` overwrites response. |
| Toast library | sonner | react-hot-toast | App already has sonner as primary. react-hot-toast is only used in the legacy `withAuth` HOC. |

## What NOT to Do

1. **Do NOT use `getSession()` in server code** -- it does not revalidate the JWT. Supabase docs explicitly warn against this.
2. **Do NOT disable `setAll()` in middleware** -- this is the root cause of the session bleed bug. The middleware MUST write refreshed cookies back to the response.
3. **Do NOT upgrade to Next.js 16 during this refactor** -- the middleware-to-proxy rename and React 19 requirement would compound the scope.
4. **Do NOT use the old `get`/`set`/`remove` cookie API** -- it's deprecated and can silently drop cookies.
5. **Do NOT cache auth-related pages with ISR** -- use `export const dynamic = 'force-dynamic'` on any page that handles authentication. The `@supabase/ssr` v0.10+ cache headers help but are defense-in-depth, not a replacement for proper dynamic rendering.
6. **Do NOT create the Supabase client at module level** -- always create inside request handlers/components to avoid sharing state between requests.

## Migration Steps (Current to Target)

### Step 1: Upgrade packages
```bash
npm install @supabase/ssr@^0.10.2 @supabase/supabase-js@^2.102.1
```

### Step 2: Fix middleware `setAll()`
Replace the disabled `setAll()` with the full cookie-forwarding pattern shown above. This is the single most critical change -- it fixes session bleed.

### Step 3: Fix server client
Replace the `allowCookieWrite` gating with the `try/catch` pattern. Remove the `CreateClientOptions` type.

### Step 4: Verify asymmetric JWT keys
Check Supabase Dashboard > Settings > JWT Signing Keys. If on symmetric keys, migrate to asymmetric. This enables local `getClaims()` verification without network calls.

### Step 5: Test session refresh
1. Login with user A
2. Wait for JWT to expire (or manually expire in dev tools)
3. Navigate to a dashboard page
4. Verify the refreshed token is written back via `Set-Cookie` header
5. Open a second browser/incognito, login as user B
6. Verify user B never sees user A's data

### Step 6: Remove unused packages
```bash
npm uninstall react-hot-toast aphrodite fs logger
```

### Step 7: Update AuthContext (optional, lower priority)
Consider removing the `/api/user` cross-reference pattern once middleware auth is stable. The session from `getSession()` in the browser will be trustworthy.

## Future Considerations (Out of Scope)

| Topic | When to Address | Why Later |
|-------|----------------|-----------|
| Next.js 16 upgrade | After refactor is complete | Requires middleware->proxy rename, React 19, Turbopack evaluation |
| `@supabase/ssr` v1.0 | When released | Will finalize the `getAll`/`setAll` API. Current code is already using the target API. |
| Publishable key migration | Optional, any time | Env var fallback pattern already supports it. No urgency. |
| React 19 | Tied to Next.js 16 | Breaking changes in form actions, `useFormState` -> `useActionState` |

## Sources

- [Supabase SSR Docs: Creating a Client](https://supabase.com/docs/guides/auth/server-side/creating-a-client) -- official cookie pattern with `getAll`/`setAll`
- [Supabase SSR Docs: Next.js Setup](https://supabase.com/docs/guides/auth/server-side/nextjs) -- official Next.js middleware and client patterns
- [Supabase SSR Docs: Advanced Guide](https://supabase.com/docs/guides/auth/server-side/advanced-guide) -- getClaims vs getUser, CDN caching
- [Supabase API Reference: getClaims()](https://supabase.com/docs/reference/javascript/auth-getclaims) -- JWT verification method
- [GitHub: @supabase/ssr CHANGELOG.md](https://github.com/supabase/ssr/blob/main/CHANGELOG.md) -- version history 0.7.0 to 0.10.2
- [GitHub: @supabase/ssr Releases](https://github.com/supabase/ssr/releases) -- release notes
- [GitHub Issue #39947: SSR guides use getUser instead of getClaims](https://github.com/supabase/supabase/issues/39947) -- closed, docs updated to recommend getClaims
- [GitHub Issue #40985: Clarify getClaims vs getUser](https://github.com/supabase/supabase/issues/40985) -- open, ongoing docs improvement
- [GitHub Discussion #27037: @supabase/ssr v1.0 roadmap](https://github.com/orgs/supabase/discussions/27037) -- API stability confirmation
- [Supabase Docs: JWT Signing Keys](https://supabase.com/docs/guides/auth/signing-keys) -- asymmetric key migration
- [Supabase Docs: API Keys](https://supabase.com/docs/guides/api/api-keys) -- publishable vs anon key
- [Next.js 16 Upgrade Guide](https://nextjs.org/docs/app/guides/upgrading/version-16) -- middleware-to-proxy breaking change
