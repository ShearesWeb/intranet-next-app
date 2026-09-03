# Testing Patterns

**Analysis Date:** 2026-09-03

## Test Framework

**Runner:**
- Vitest 4.1.4
- Config: `vitest.config.mts` (main), `vitest.integration.config.mts` (integration)
- Two test projects: `unit` (*.test.ts) and `component` (*.test.tsx)

**Assertion Library:**
- Vitest's built-in assertions via `describe`, `it`, `expect`
- No separate assertion library needed

**Run Commands:**
```bash
npm run test                   # Run all unit + component tests (Vitest)
make test                      # Alias: Unit + component (via Makefile)
make test-integration          # Route-handler suite (requires db-up)
npm run test -- src/lib/ranking/cca-ranking-metrics.test.ts  # Single file
npx vitest run                 # Run all tests once (not watch)
npx vitest watch              # Watch mode (re-run on file change)
npx vitest --coverage         # Coverage report
```

## Test File Organization

**Location:**
- Co-located with source code (same directory as implementation)
- Unit tests: `src/**/*.test.ts`
- Component tests: `src/**/*.test.tsx`
- Integration tests: `tests/integration/routes/**/*.test.ts` (separate from src)
- Use `__tests__/` subdirectory only when a directory accumulates many test files

**Naming:**
- File pattern: `[name].test.ts` or `[name].test.tsx`
- Examples:
  - `src/lib/date.test.ts` tests `src/lib/date.ts`
  - `src/types/facilities.test.ts` tests `src/types/facilities.ts`
  - `src/hooks/use-recap-navigation.test.tsx` tests `src/hooks/use-recap-navigation.ts`

**TypeScript Config for Tests:**
- `tsconfig.json` excludes `src/**/*.test.ts` and `src/**/*.test.tsx` from app compilation
- `tsconfig.test.json` includes test files for type-checking test code itself
- Vitest respects the main `tsconfig.json` and its `paths` alias (`@/*` → `./src/*`)

## Test Project Configuration

**Two Vitest Projects (from `vitest.config.mts`):**

```typescript
projects: [
  {
    test: {
      name: "unit",
      environment: "node",
      include: ["src/**/*.test.ts"],  // TypeScript only
    },
  },
  {
    test: {
      name: "component",
      environment: "happy-dom",  // DOM simulation, not jsdom
      include: ["src/**/*.test.tsx"],  // React components
    },
  },
]
```

**Unit Tests** (`node` environment):
- No DOM, no React rendering
- Pure functions, utilities, domain logic
- Example: `src/lib/date.test.ts` → tests date helper functions
- Environment: Node.js (fast, minimal dependencies)

**Component Tests** (`happy-dom` environment):
- Lightweight DOM implementation (happy-dom, not jsdom)
- React component rendering via `createRoot` and `act()`
- Hooks tested in isolation via custom harness
- Example: `src/hooks/use-recap-navigation.test.tsx` → tests React hook behavior

**Integration Tests** (separate config):
- Run real route handlers against Postgres + PostgREST (not mocked)
- Persona system for role-based testing
- Database reseeded before each test
- Located in `tests/integration/routes/**/*.test.ts`

## Test Structure

**Imports (Unit Example):**
```typescript
import { describe, expect, it } from "vitest";
import {
  getRankingMetricKeys,
  getRankingScore,
  hasRequiredRankingInputs,
  isResidentPositionType,
} from "./cca-ranking-metrics";
```

**Imports (Component Example):**
```typescript
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useRecapNavigation } from "@/hooks/use-recap-navigation";
import type { RecapSlide } from "@/types/recap";
```

**Test Suite Organization:**
```typescript
describe("isResidentPositionType", () => {
  it("returns true for resident position variants", () => {
    expect(isResidentPositionType("resident")).toBe(true);
    expect(isResidentPositionType("Resident")).toBe(true);
    expect(isResidentPositionType("re_sident")).toBe(true);
  });

  it("returns false for non-resident position types", () => {
    expect(isResidentPositionType("member")).toBe(false);
    expect(isResidentPositionType(undefined)).toBe(false);
  });
});
```

**Patterns:**
- One `describe()` per function or feature
- Descriptive test names: "returns X when Y" or "does Z for case A"
- Arrange-Act-Assert structure (though often collapsed into Assert-only for simple cases)
- One logical assertion per `it()` block (though multiple `expect()` calls within one test are acceptable)

## Unit Testing Pattern

**Basic Unit Test (Pure Functions):**
```typescript
describe("formatDateKey", () => {
  it("zero-pads date keys", () => {
    expect(formatDateKey(2026, 0, 5)).toBe("2026-01-05");
    expect(formatDateKey(2026, 11, 31)).toBe("2026-12-31");
  });
});
```

**Edge Cases and Boundaries:**
- Test boundary conditions (first/last values, empty inputs)
- Test negative cases (null, undefined, invalid inputs)
- Example from `src/types/facilities.test.ts`:
  ```typescript
  describe("bookingHorizonEnd", () => {
    it("handles February in a leap year and a common year", () => {
      expect(bookingHorizonEnd(new Date("2028-02-10T00:00:00Z"))).toBe("2028-02-29");
      expect(bookingHorizonEnd(new Date("2026-02-10T00:00:00Z"))).toBe("2026-02-28");
    });
  });
  ```

## Component Testing Pattern

**Hook Testing Setup:**
```typescript
const renderHook = (slides: RecapSlide[], open: boolean) => {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root: Root = createRoot(container);
  const result: { current: ReturnType<typeof useRecapNavigation> | null } = { current: null };

  function Harness() {
    result.current = useRecapNavigation(slides, open);
    return null;
  }

  act(() => {
    root.render(<Harness />);
  });

  return {
    result,
    unmount: () => {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
};
```

**Hook Testing Usage:**
```typescript
it("paginate(1) does not move past the last slide", () => {
  const slides = makeSlides(3);
  const { result, unmount } = renderHook(slides, true);

  act(() => {
    result.current?.paginate(1);
  }); // 0 -> 1
  act(() => {
    result.current?.paginate(1);
  }); // 1 -> 2
  act(() => {
    result.current?.paginate(1);
  }); // 2 -> stays at 2

  expect(result.current?.currentSlide).toBe(2);
  unmount();
});
```

**React Component Act Pattern:**
- Use `act()` from React for state updates and re-renders
- Wrap `root.render()`, `root.unmount()`, and state-changing hook calls in `act()`
- Prevents warnings about "not wrapped in act(...)"
- Example: `act(() => { result.current?.setCurrentSlide(3); })`

**Setup/Teardown:**
```typescript
beforeEach(() => {
  vi.clearAllMocks();
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
});
```

## Integration Testing Pattern

**Setup (from `tests/integration/helpers.ts`):**
```typescript
export function asPersona(key: PersonaKey): void {
  setPersona(key);
}

export async function readJson<T = unknown>(res: Response): Promise<Response> {
  const json = await res.json();
  return { status: res.status, data: json.data, error: json.error };
}

export function routeParams<T extends Record<string, string>>(p: T): { params: Promise<T> } {
  return { params: Promise.resolve(p) };
}
```

**Route Handler Testing:**
```typescript
describe("GET /api/user", () => {
  it("returns the authenticated user (declan)", async () => {
    asPersona("declan");
    const { GET } = await import("@/app/api/user/route");
    const { status, data, error } = await readJson<{ email: string; is_chair: boolean }>(
      await GET()
    );

    expect(status).toBe(200);
    expect(error).toBeNull();
    expect(data.email).toBe("declanho.sg@gmail.com");
  });

  it("401s for an anonymous caller", async () => {
    asPersona("anonymous");
    const { GET } = await import("@/app/api/user/route");
    const { status, error } = await readJson(await GET());

    expect(status).toBe(401);
    expect(error).toBe("Unauthorized");
  });
});
```

**Key Points:**
- Route handlers imported dynamically within tests (ensures fresh module state)
- `asPersona()` sets the JWT context for the test
- Handlers called directly: `await GET()` (no HTTP simulation, direct function call)
- Response parsed with `readJson()` helper to extract status, data, error
- No browser automation needed; handlers run server-side

**Persona System:**
- Defined in `tests/fixtures/personas.ts`
- Seeded into Postgres via `tests/fixtures/seed.sql`
- Personas: `aria` (resident), `declan` (sports chair), `sage` (admin + JCRC + CSA), `anonymous` (no JWT)
- Called in tests: `asPersona("declan")` sets JWT claims for that user
- RLS and Postgres policies evaluate for real (not mocked)

**Database Setup:**
- Docker + Liquibase + plain Postgres (not Supabase)
- Schema from `vendor/intranet` submodule (private)
- PostgREST sidecar for API emulation
- Database reseeded before every test to ensure clean state
- Connection: `pgPool` from `tests/integration/setup.ts`

**Manual QA via Persona Login:**
- Command: `make e2e-login PERSONA=declan`
- Prints a one-time Supabase magic-link
- Open in your own browser (no browser automation needed)
- Simulates real session and RLS enforcement
- For quick testing of the full auth flow

## Mocking

**Vitest Mocking:**
- Via `vi` from vitest: `vi.mock()`, `vi.spyOn()`, `vi.clearAllMocks()`
- Clear all mocks in `beforeEach()` to prevent test pollution
- Example:
  ```typescript
  beforeEach(() => {
    vi.clearAllMocks();
  });
  ```

**What to Mock:**
- External HTTP calls (if not running integration tests)
- Browser APIs (`localStorage`, `sessionStorage`, `fetch`)
- Timers (via `vi.useFakeTimers()` + `vi.advanceTimersByTime()`)
- Never mock the code under test

**What NOT to Mock:**
- Database (integration tests run against real Postgres)
- Supabase client (integration tests use PostgREST-backed mock client)
- Pure domain logic (test directly)
- Example: `src/lib/ranking/` functions are pure and unmocked

**Supabase Client Mocking (Integration):**
- `@/lib/supabase/server`'s `createClient()` returns a PostgREST-backed client
- Persona JWT injected as Bearer token
- RLS policies evaluate for real
- No need to mock individual Supabase methods

## Fixtures and Factories

**Test Data Generators:**
```typescript
const makeSlides = (n: number): RecapSlide[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `slide-${i}`,
    eyebrow: "Eyebrow",
    title: `Slide ${i}`,
    description: "desc",
    accent: "from-blue-500",
    kind: "copy" as const,
    statValue: "10",
  }));
```

**Usage in Tests:**
```typescript
it("paginate(1) does not move past the last slide", () => {
  const slides = makeSlides(3);
  const { result, unmount } = renderHook(slides, true);
  // ... test logic
});
```

**Seed Data (Integration):**
- Location: `tests/fixtures/seed.sql`
- Generated from `tests/fixtures/personas.ts` via `npx tsx tests/fixtures/generate.ts`
- Applied to Postgres before each integration test run
- Contains: Personas, sample CCAs, sample members, baseline rank data

**CCA ID Resolution:**
```typescript
export async function ccaIdByName(name: string): Promise<number> {
  const r = await pgPool.query("SELECT id FROM ccas WHERE name = $1", [name]);
  if (!r.rows[0]) throw new Error(`No CCA named "${name}"`);
  return r.rows[0].id as number;
}
```

## Coverage

**Requirements:**
- No strict coverage mandate enforced by CI
- Coverage data collected but not gated
- Aim for high coverage on domain logic (`src/lib/`) and low coverage on UI layer (acceptable for components)

**View Coverage:**
```bash
npx vitest run --coverage
```

**Coverage Report:**
- Generated in `coverage/` directory (console + HTML)
- Focus on untested code paths in business logic, not UI implementation details

## Test Types

**Unit Tests:**
- Scope: Individual functions, utilities, domain logic
- Environment: Node.js (no DOM, no React)
- Files: `src/lib/**/*.test.ts`, `src/types/**/*.test.ts`
- Speed: Fast (milliseconds)
- Examples:
  - `src/lib/date.test.ts` — date helpers
  - `src/lib/ranking/cca-ranking-metrics.test.ts` — ranking score calculations
  - `src/types/facilities.test.ts` — facility booking rules

**Component Tests:**
- Scope: React hooks and component logic
- Environment: happy-dom (lightweight DOM)
- Files: `src/hooks/**/*.test.tsx`, `src/lib/**/*.test.tsx` (context providers)
- Speed: Fast (milliseconds)
- Examples:
  - `src/hooks/use-recap-navigation.test.tsx` — hook state management
  - `src/lib/auth/__tests__/auth-context.test.tsx` — context provider

**Integration Tests:**
- Scope: Real route handlers against real Postgres + PostgREST
- Environment: Node.js with Postgres connection
- Files: `tests/integration/routes/**/*.test.ts`
- Speed: Slower (seconds, database I/O)
- Run: `make test-integration` (requires `make db-up` first)
- Examples:
  - `tests/integration/routes/user.test.ts` — GET /api/user with different personas
  - `tests/integration/routes/rankings.test.ts` — ranking CRUD with chair access checks
  - `tests/integration/routes/facilities.test.ts` — facility booking workflows

**E2E Tests:**
- Manual QA via persona login (no automated Playwright suite yet)
- Command: `make e2e-login PERSONA=declan` → opens browser magic-link
- For testing full flows that span multiple pages and real auth

## Common Patterns

**Async Testing in Unit Tests:**
```typescript
describe("fetchUserFromBackend", () => {
  it("returns user data on success", async () => {
    // Test setup
    const result = await fetchUserFromBackend();
    // Assertions
    expect(result).toBeDefined();
  });
});
```

**Error Testing:**
```typescript
it("throws ApiError(401) for unauthenticated request", async () => {
  asPersona("anonymous");
  const { GET } = await import("@/app/api/user/route");
  
  try {
    await GET();
  } catch (e) {
    expect(e).toBeInstanceOf(ApiError);
    expect((e as ApiError).statusCode).toBe(401);
  }
});
```

**Feature Flag Testing (Integration):**
```typescript
it("enables feature when flag is set", async () => {
  await setFeatureFlag("memberRanking", { enabled: true });
  
  asPersona("declan");
  const { GET } = await import("@/app/api/feature-status/route");
  const { data } = await readJson(await GET());
  
  expect(data.memberRanking).toBe(true);
});
```

**Database State Assertions (Integration):**
```typescript
it("persists ranking to database", async () => {
  asPersona("declan");
  const ccaId = await ccaIdByName("Basketball");
  const { POST } = await import("@/app/api/cca/[ccaId]/rankings/route");
  
  await POST(
    jsonRequest("", "POST", { rankings: [...] }),
    routeParams({ "cca-id": String(ccaId) })
  );
  
  const result = await pgPool.query("SELECT * FROM rankings WHERE cca_id = $1", [ccaId]);
  expect(result.rows).toHaveLength(1);
});
```

## Running Tests Locally

**One-Time Setup:**
```bash
git submodule update --init --recursive  # Fetch vendor/intranet
make db-up                               # Start Postgres + seed
```

**Run Tests:**
```bash
make check        # format-check + typecheck + unit + component
make test         # Unit + component only
make test-integration  # Integration only (needs db-up)
```

**Single Test File:**
```bash
npx vitest run src/lib/ranking/cca-ranking-metrics.test.ts
npx vitest watch src/lib/ranking/cca-ranking-metrics.test.ts
```

**Debugging:**
- Add `console.log()` to test or source code
- Add `debugger;` statement and run with Node debugger
- Use `npx vitest --inspect-brk` to debug with Chrome DevTools

**Cleanup:**
```bash
make db-down  # Stop Postgres
```

---

*Testing analysis: 2026-09-03*
