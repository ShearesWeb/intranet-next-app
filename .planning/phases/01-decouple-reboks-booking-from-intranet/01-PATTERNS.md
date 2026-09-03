# Phase 1: Decouple REBOKS booking from intranet - Pattern Map

**Mapped:** 2026-09-04
**Files analyzed:** 15 production files (13 from CONTEXT.md D-14/13 list + `src/app/api/facilities/schedules/route.ts` comment-only + `src/types/facilities.ts`), 9 test files (per RESEARCH.md Test File Inventory), 1 likely-new integration test case
**Analogs found:** 15 / 15 (this is a modify-in-place refactor — every "new" file is itself the analog for its own future state; RESEARCH.md already extracted verbatim current-state excerpts for the three lib functions and the claims route, which this file does not duplicate verbatim — see cross-references)

**Read-only note:** No source files were modified in producing this map. RESEARCH.md (§Patterns 1-3, §Code Examples) already contains verified, line-cited excerpts of the *current* state of the three lib functions and the claims route — this file cross-references those rather than re-quoting them, and adds the excerpts RESEARCH.md did not cover: the test-file mock/assert idiom, the integration `createFacility()` helper, and `src/types/facilities.ts`'s existing constant/type-guard style.

## File Classification

| File | Role | Data Flow | Closest Analog | Match Quality |
|------|------|-----------|-----------------|---------------|
| `src/types/facilities.ts` (add `BOOKABLE_FACILITY_TYPES` + `isBookableFacilityType`) | model/utility | transform | itself — `FACILITY_TYPE_CONFIG` const + existing type-guard-less style in same file | exact (self-modification) |
| `src/lib/facilities/facility-slots.ts` (`getSlots`) | service | CRUD (read) | itself — RESEARCH.md Pattern 2 has verbatim current body | exact |
| `src/lib/facilities/facility-catalog.ts` (`listFacilities`) | service | CRUD (read) | itself — RESEARCH.md Pattern 1 has verbatim current body | exact |
| `src/lib/facilities/facility-claims.ts` (`getClaimsForCca`) | service | CRUD (read) | itself — RESEARCH.md Pattern 3 has verbatim current body | exact |
| `src/app/api/facilities/claims/route.ts` (POST) | route/controller | request-response | itself — RESEARCH.md §Code Examples D-10 has verbatim current block | exact |
| `src/app/api/facilities/catalog/route.ts` | route/controller | request-response | `src/app/api/facilities/slots/route.ts` (identical `VALID_TYPES` ternary, RESEARCH.md Pitfall 3) | exact |
| `src/app/api/facilities/slots/route.ts` | route/controller | request-response | `src/app/api/facilities/catalog/route.ts` (sibling route, same file this phase touches) | exact |
| `src/app/dashboard/facilities/page.tsx` / `admin/page.tsx` / `guide/page.tsx` | component (page) | request-response | siblings within `src/app/dashboard/facilities/` | exact |
| `src/components/facilities/day-detail-panel.tsx` / `schedule-slot-dialog.tsx` / `facility-type-badges.tsx` | component | request-response | siblings within `src/components/facilities/` | exact |
| `src/lib/facilities/facility-picker.ts` | utility | transform | itself — `TYPE_ORDER` const, see below | exact |
| `src/types/facilities.test.ts` | test | — | itself | exact |
| `src/app/api/facilities/slots/route.test.ts` | test | request-response | `src/app/api/facilities/claims/route.test.ts` (same mock/describe idiom) | exact |
| `src/app/api/facilities/claims/route.test.ts` (new `describe` block replacing the horizon-gate block) | test | request-response | the horizon-gate `describe` block being replaced, lines 98-137 of the same file (see below) | exact |
| `tests/integration/routes/facilities.test.ts` (new REBOKS case + `createFacility(type)` param) | test (integration) | CRUD | the existing `createFacility()` helper + any `it(...)` case in the same file | exact |

## Pattern Assignments

### `src/types/facilities.ts` — add `BOOKABLE_FACILITY_TYPES` / `isBookableFacilityType` (D-03)

**Analog:** same file, existing `FacilityType` + `FACILITY_TYPE_CONFIG` declarations (lines 1-20, read this session).

**Current style to match:**
```typescript
// src/types/facilities.ts:1
export type FacilityType = "sheares" | "reboks" | "nus" | "external";
...
// src/types/facilities.ts:15-20
export const FACILITY_TYPE_CONFIG: Record<FacilityType, { label: string; color: string }> = {
	sheares: { label: "Sheares", color: "#e97316" },
	reboks: { label: "Reboks", color: "#3b82f6" },
	nus: { label: "NUS", color: "#8b5cf6" },
	external: { label: "External", color: "#10b981" },
};
```

**Pattern to add** (place directly below the `FacilityType` export, per RESEARCH.md §Code Examples D-03 — exact code already specified there, do not re-derive):
```typescript
export const BOOKABLE_FACILITY_TYPES: FacilityType[] = ["sheares", "nus", "external"];

export function isBookableFacilityType(type: FacilityType): boolean {
	return BOOKABLE_FACILITY_TYPES.includes(type);
}
```
No existing type-guard function exists in this file to mirror (`FacilityType` has no prior `isXxx` helper) — the shape above (a `const` array + a one-line `Array.includes` predicate) matches the file's existing const-then-derived-helper ordering convention (config objects declared immediately after their union type).

Three call sites this constant/guard replaces (all confirmed exact current lines, RESEARCH.md §Anti-Patterns and §Code Examples D-03):
- `src/components/facilities/facility-type-badges.tsx:6` — `const TYPES: FacilityType[] = ["sheares", "reboks", "nus", "external"];`
- `src/lib/facilities/facility-picker.ts:3` — `const TYPE_ORDER: FacilityType[] = ["sheares", "reboks", "nus", "external"];`
- `src/app/dashboard/facilities/admin/page.tsx:24` — `const MANAGED_TYPES: FacilityType[] = ["sheares", "nus", "external"];`

---

### `src/lib/facilities/facility-slots.ts`, `facility-catalog.ts`, `facility-claims.ts` — the three D-01 exclusion points

**Do not re-derive these** — RESEARCH.md already contains the exact current bodies and exact diffs, verified against source this session:
- Pattern 1 (direct-table `.neq()`): RESEARCH.md lines 165-187, target `listFacilities` in `facility-catalog.ts:7-22`
- Pattern 2 (`.neq()` chained on `.rpc()`, plus documented JS-filter fallback): RESEARCH.md lines 189-226, target `getSlots` in `facility-slots.ts:22-45`
- Pattern 3 (JS-filter after embedded-join map): RESEARCH.md lines 228-257, target `getClaimsForCca` in `facility-claims.ts:50-66`

All three follow the same shape: read from Supabase → filter (query-level or JS-level) → map/return, with the existing `console.error(...)` + `throw new ApiError(500, "...")` error-handling idiom already present at each call site — reuse it unchanged, do not introduce a new error path for the exclusion itself (exclusion is not an error condition).

---

### `src/app/api/facilities/claims/route.ts` — POST bookable-type check (D-10)

**Do not re-derive** — RESEARCH.md §Code Examples "D-10" (lines 344-370) has the exact current horizon-check block (lines 65-75 of the route) and the exact replacement using `getFacilityType()` + `apiError()`.

**Error response pattern to copy** (`apiError` signature, confirmed via the replacement block):
```typescript
return apiError("This venue is not bookable on the intranet", 400);
```
matches the existing `apiError(message: string, status: number)` call convention already used elsewhere in the same route (`apiError()`/`ApiError` from `@/lib/api/response` and `@/lib/api/errors` per CONTEXT.md "Reusable Assets").

---

### `src/app/api/facilities/catalog/route.ts` and `src/app/api/facilities/slots/route.ts` — `VALID_TYPES` drop (D-11) and JCRC-branch delete (D-08)

**Analog:** each route for the other — both use the identical ternary:
```typescript
// structurally identical in both files, RESEARCH.md Pitfall 3
VALID_TYPES.includes(typeParam as FacilityType) ? typeParam : undefined
```
[VERIFIED: src/app/api/facilities/catalog/route.ts:18-21 and src/app/api/facilities/slots/route.ts:44-46 — cited in RESEARCH.md Pitfall 3]

Edit is deleting `"reboks"` from the `VALID_TYPES` array literal in each file — no branch logic changes (RESEARCH.md confirms this is a no-op beyond the literal). `slots/route.ts` additionally drops the `user.is_jcrc ? slots : slots.filter(...)` branch (D-08) — no analog needed, it is a straight deletion collapsing to `getSlots()` → optional type filter → response.

---

### UI files — `src/app/dashboard/facilities/{page,admin/page,guide/page}.tsx`, `src/components/facilities/{day-detail-panel,schedule-slot-dialog,facility-type-badges}.tsx`, `src/lib/facilities/facility-picker.ts`

These are deletions of dead code (D-07, D-13), not new patterns to copy — each file is its own analog. The one shared idiom across `admin/page.tsx` and `schedule-slot-dialog.tsx` is the redundant filter being removed:
```typescript
.filter((f) => f.type !== "reboks")
```
which becomes unnecessary once the lib layer excludes REBOKS at the source (D-01) — this is the "anti-pattern in miniature" RESEARCH.md flags (§Anti-Patterns to Avoid, line 261): do not reintroduce an equivalent UI-layer filter anywhere else in `src/app/dashboard/` or `src/components/`.

---

### Test files — mock/assert idiom for route tests

**Analog:** `src/app/api/facilities/claims/route.test.ts` (full file read this session).

**Mock setup pattern** (lines 4-27):
```typescript
const mocks = vi.hoisted(() => ({
	requireAuth: vi.fn(),
	createClaim: vi.fn(),
	getClaimsForCca: vi.fn(),
	isChairOfCca: vi.fn(),
	getChairCcaIds: vi.fn(),
	getFacilityType: vi.fn(),
	getCoreServiceDisabledApiResponse: vi.fn(),
}));

vi.mock("@/lib/api/auth", () => ({ requireAuth: mocks.requireAuth }));
vi.mock("@/lib/facilities/facility-claims", () => ({
	createClaim: mocks.createClaim,
	getClaimsForCca: mocks.getClaimsForCca,
}));
vi.mock("@/lib/facilities/facility-access", () => ({
	isChairOfCca: mocks.isChairOfCca,
	getChairCcaIds: mocks.getChairCcaIds,
}));
vi.mock("@/lib/facilities/facility-catalog", () => ({
	getFacilityType: mocks.getFacilityType,
}));
vi.mock("@/lib/feature-flags", () => ({
	getCoreServiceDisabledApiResponse: mocks.getCoreServiceDisabledApiResponse,
}));
```

**Request-builder helper pattern** (lines 29-34):
```typescript
function post(body: unknown) {
	return new NextRequest("http://localhost/api/facilities/claims", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});
}
```

**Existing horizon-gate `describe` block to delete and replace** (lines 98-137, quoted in full — this is the exact block the new `"POST /api/facilities/claims — bookable-type gate"` describe block replaces):
```typescript
describe("POST /api/facilities/claims — REBOKS horizon gate", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.getCoreServiceDisabledApiResponse.mockReturnValue(null);
		mocks.requireAuth.mockResolvedValue({ id: 42, is_jcrc: false });
		mocks.isChairOfCca.mockReturnValue(true);
		mocks.createClaim.mockResolvedValue({ id: 1 });
	});

	it("403s a chair booking reboks past the current month", async () => {
		mocks.getFacilityType.mockResolvedValue("reboks");
		const { POST } = await import("./route");
		const res = await POST(post({ facility_id: 7, date: beyondHorizon(), hour: 19, cca_id: 3 }));
		expect(res.status).toBe(403);
		expect(mocks.createClaim).not.toHaveBeenCalled();
	});

	it("lets a hall venue through in the same future month", async () => {
		mocks.getFacilityType.mockResolvedValue("sheares");
		const { POST } = await import("./route");
		const res = await POST(post({ facility_id: 8, date: beyondHorizon(), hour: 19, cca_id: 3 }));
		expect(res.status).toBe(201);
	});

	it("exempts JCRC, who book the next month's courts in advance", async () => {
		mocks.requireAuth.mockResolvedValue({ id: 42, is_jcrc: true });
		mocks.getFacilityType.mockResolvedValue("reboks");
		const { POST } = await import("./route");
		const res = await POST(post({ facility_id: 7, date: beyondHorizon(), hour: 19, cca_id: 3 }));
		expect(res.status).toBe(201);
		expect(mocks.getFacilityType).not.toHaveBeenCalled();
	});
});
```
[VERIFIED: src/app/api/facilities/claims/route.test.ts:98-137 — read in full this session]

**Replacement shape** (new describe block, following the same mock/assert idiom, per D-10's code example and RESEARCH.md's Test File Inventory row for this file): a `describe("POST /api/facilities/claims — bookable-type gate", ...)` with the same `beforeEach` shape, asserting `mocks.getFacilityType.mockResolvedValue("reboks")` → `res.status === 400` (or 403, planner's call per A2) and `mocks.getFacilityType.mockResolvedValue("sheares")` → `res.status === 201`. Confirm with planner whether the JCRC-exemption `it` block is dropped entirely (RESEARCH.md flags this as needing planner confirmation — D-10's code example drops the `is_jcrc` branch since "bookable-type is not a JCRC exemption").

`src/app/api/facilities/slots/route.test.ts` follows the identical `vi.hoisted` + `vi.mock` + `describe`/`it` idiom (RESEARCH.md Test File Inventory row) — its `describe("GET /api/facilities/slots — REBOKS horizon", ...)` block (4 `it`s) is deleted the same way, testing the JCRC-exemption branch (D-08) rather than the claims horizon check.

---

### `tests/integration/routes/facilities.test.ts` — new REBOKS integration case

**Analog:** the file's own `createFacility()` helper and `publishSlot()` helper (lines 1-40, read this session).

**Current helper** (lines 14-21):
```typescript
let facilitySeq = 0;
async function createFacility(): Promise<number> {
	const r = await pgPool.query(
		`INSERT INTO facilities (type, venue, sub_venue) VALUES ('nus', 'UTown', $1) RETURNING id`,
		[`Dance Studio ${Date.now()}-${facilitySeq++}`],
	);
	return r.rows[0].id as number;
}
```
[VERIFIED: tests/integration/routes/facilities.test.ts:14-21 — read this session]

Per RESEARCH.md Pitfall 2 / Wave 0 gap, this needs a `type` parameter (default `'nus'` to avoid touching every existing call site) so a new test can do `createFacility('reboks')`. The new test case follows the file's existing pattern: `asPersona(...)` → call the route handler directly (`import("@/app/api/facilities/.../route")`) → `readJson(await GET(...))` / `POST(...)` → assert on status/body, mirroring `publishSlot()`'s handler-import idiom (lines 33-40):
```typescript
async function publishSlot(facilityId: number, slotDate: string, hour = 18): Promise<void> {
	asPersona("sage");
	const { POST } = await import("@/app/api/facilities/schedules/route");
	const { status } = await readJson(
		await POST(
			jsonRequest("/api/facilities/schedules", "POST", {
				facility_id: facilityId,
				day_of_week: new Date(slotDate + "T00:00:00").getDay(),
				hour,
				start_date: slotDate,
				end_date: slotDate,
			}),
		),
	);
	// ... status assertion follows in the source, not re-quoted here
}
```
[VERIFIED: tests/integration/routes/facilities.test.ts:22-40 — read this session]

New test should: (1) `createFacility('reboks')`, (2) `publishSlot(id, date)`, (3) assert the facility is absent from `GET /api/facilities/catalog` and `GET /api/facilities/slots` JSON responses, (4) assert `POST /api/facilities/claims` against it returns the D-10 4xx — exactly as RESEARCH.md Pitfall 2 specifies.

---

## Shared Patterns

### Error response envelope
**Source:** `@/lib/api/response` (`apiError`) and `@/lib/api/errors` (`ApiError`), reused unchanged by D-10.
**Apply to:** `src/app/api/facilities/claims/route.ts` D-10 check — call `apiError(message, status)` exactly as the existing horizon-check block already does (RESEARCH.md §Code Examples D-10), do not introduce a new error-response shape.

### Type-from-DB-not-request-body
**Source:** `getFacilityType(facilityId)` in `src/lib/facilities/facility-catalog.ts:27-46` (doc comment quoted in RESEARCH.md §Anti-Patterns).
**Apply to:** D-10's bookable-type check — reuse `getFacilityType()` unchanged; never read a `type` field off the claims POST body.

### Query-level exclusion over JS-level filtering, with documented fallback
**Source:** RESEARCH.md Patterns 1-3.
**Apply to:** All three D-01 lib functions — push `.neq("type","reboks")` into the Supabase query where the column is directly queryable (`facility-catalog.ts`, `facility-slots.ts`); fall back to a post-map JS `.filter()` only where the column is reachable solely through an embedded join (`facility-claims.ts`) or if the RPC-level filter doesn't behave as documented against the local PostgREST sidecar.

### Shared exclusion-list constant, not repeated literals
**Source:** `src/types/facilities.ts` (new `BOOKABLE_FACILITY_TYPES` / `isBookableFacilityType`).
**Apply to:** `facility-type-badges.tsx`, `facility-picker.ts`, `admin/page.tsx` — replace each file's independently-hardcoded array with the shared constant/guard (D-03).

## No Analog Found

None. Every file in scope is a modify-in-place edit to an existing file; the only genuinely new content (the D-03 constant/guard, the D-10 error branch, the new integration test case) has a direct, verbatim-quotable analog either in the same file (RESEARCH.md's verified current-state excerpts) or in a sibling file using the identical idiom (test mock setup, route ternaries).

## Metadata

**Analog search scope:** `src/types/`, `src/lib/facilities/`, `src/app/api/facilities/`, `src/app/dashboard/facilities/`, `src/components/facilities/`, `tests/integration/routes/`, plus the 9 test files enumerated in RESEARCH.md's Test File Inventory.
**Files scanned:** 15 production + 9 test files (all previously read/verified in RESEARCH.md's research session) + 2 additional files read directly in this session (`src/app/api/facilities/claims/route.test.ts` full horizon-gate block, `tests/integration/routes/facilities.test.ts` header/helpers, `src/types/facilities.ts` head).
**Pattern extraction date:** 2026-09-04
