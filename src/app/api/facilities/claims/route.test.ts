import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
	requireAuth: vi.fn(),
	createClaim: vi.fn(),
	getClaimsForCca: vi.fn(),
	isChairOfCca: vi.fn(),
	getChairCcaIds: vi.fn(),
	getFacilityType: vi.fn(),
	getCoreServiceDisabledApiResponse: vi.fn(),
	getCurrentNusWeek: vi.fn(),
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
vi.mock("@/lib/nus-academic-calendar", () => ({
	getCurrentNusWeek: mocks.getCurrentNusWeek,
}));

function post(body: unknown) {
	return new NextRequest("http://localhost/api/facilities/claims", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});
}

function futureDate(daysAhead: number): string {
	const d = new Date();
	d.setDate(d.getDate() + daysAhead);
	const m = String(d.getMonth() + 1).padStart(2, "0");
	const day = String(d.getDate()).padStart(2, "0");
	return `${d.getFullYear()}-${m}-${day}`;
}

describe("GET /api/facilities/claims — Sheares-only history", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.getCoreServiceDisabledApiResponse.mockReturnValue(null);
		mocks.requireAuth.mockResolvedValue({ id: 42 });
		mocks.isChairOfCca.mockReturnValue(true);
		mocks.getClaimsForCca.mockResolvedValue([
			{ id: 1, facility_type: "sheares" },
			{ id: 2, facility_type: "nus" },
			{ id: 3, facility_type: "external" },
		]);
	});

	it("returns only Sheares claims", async () => {
		const { GET } = await import("./route");
		const req = new NextRequest("http://localhost/api/facilities/claims?ccaId=3");
		const res = await GET(req);
		expect((await res.json()).data).toEqual([{ id: 1, facility_type: "sheares" }]);
	});
});

describe("POST /api/facilities/claims — lead-time gate", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.getCoreServiceDisabledApiResponse.mockReturnValue(null);
		mocks.requireAuth.mockResolvedValue({ id: 42 });
		mocks.isChairOfCca.mockReturnValue(true);
		mocks.getCurrentNusWeek.mockReturnValue({
			start: futureDate(0),
			end: futureDate(6),
		});
		// A Sheares venue by default so these tests exercise the lead-time rules.
		mocks.getFacilityType.mockResolvedValue("sheares");
	});

	// The claim carries its own slot now, so the route no longer looks a booking
	// up first — the date it gates on arrives in the body.
	it("403s when the slot is within the 3-day lock window", async () => {
		const { POST } = await import("./route");
		const res = await POST(post({ facility_id: 2, date: futureDate(1), hour: 18, cca_id: 3 }));
		expect(res.status).toBe(403);
		expect(mocks.createClaim).not.toHaveBeenCalled();
	});

	it("400s when the slot coordinates are incomplete", async () => {
		const { POST } = await import("./route");
		const res = await POST(post({ facility_id: 2, cca_id: 3 }));
		expect(res.status).toBe(400);
		expect(mocks.createClaim).not.toHaveBeenCalled();
	});

	it("400s on an out-of-range hour", async () => {
		const { POST } = await import("./route");
		const res = await POST(post({ facility_id: 2, date: futureDate(5), hour: 24, cca_id: 3 }));
		expect(res.status).toBe(400);
		expect(mocks.createClaim).not.toHaveBeenCalled();
	});

	it("403s when the caller does not manage the CCA", async () => {
		mocks.isChairOfCca.mockReturnValue(false);
		const { POST } = await import("./route");
		const res = await POST(post({ facility_id: 2, date: futureDate(5), hour: 18, cca_id: 3 }));
		expect(res.status).toBe(403);
		expect(mocks.createClaim).not.toHaveBeenCalled();
	});

	it("creates the claim when the slot is at least 3 days out", async () => {
		mocks.createClaim.mockResolvedValue({ id: 1 });
		const { POST } = await import("./route");
		const res = await POST(post({ facility_id: 2, date: futureDate(5), hour: 18, cca_id: 3 }));
		expect(res.status).toBe(201);
		expect(mocks.createClaim).toHaveBeenCalledWith(2, futureDate(5), 18, 3, 42);
	});

	it("rejects a slot outside the current NUS teaching week", async () => {
		const { POST } = await import("./route");
		const res = await POST(post({ facility_id: 2, date: futureDate(7), hour: 18, cca_id: 3 }));

		expect(res.status).toBe(403);
		expect(mocks.createClaim).not.toHaveBeenCalled();
	});
});

describe("POST /api/facilities/claims — Sheares-only gate", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.getCoreServiceDisabledApiResponse.mockReturnValue(null);
		mocks.requireAuth.mockResolvedValue({ id: 42, is_jcrc: false });
		mocks.isChairOfCca.mockReturnValue(true);
		mocks.getCurrentNusWeek.mockReturnValue({
			start: futureDate(0),
			end: futureDate(6),
		});
		mocks.createClaim.mockResolvedValue({ id: 1 });
	});

	it("allows a Sheares facility", async () => {
		mocks.getFacilityType.mockResolvedValue("sheares");
		const { POST } = await import("./route");
		const res = await POST(post({ facility_id: 8, date: futureDate(5), hour: 19, cca_id: 3 }));
		expect(res.status).toBe(201);
	});

	it.each(["reboks", "nus", "external"])("rejects a %s facility", async (type) => {
		mocks.getFacilityType.mockResolvedValue(type);
		const { POST } = await import("./route");
		const res = await POST(post({ facility_id: 7, date: futureDate(5), hour: 19, cca_id: 3 }));
		expect(res.status).toBe(403);
		expect(mocks.createClaim).not.toHaveBeenCalled();
	});

	it("does not exempt JCRC from the facility-type restriction", async () => {
		mocks.requireAuth.mockResolvedValue({ id: 42, is_jcrc: true });
		mocks.getFacilityType.mockResolvedValue("reboks");
		const { POST } = await import("./route");
		const res = await POST(post({ facility_id: 7, date: futureDate(5), hour: 19, cca_id: 3 }));
		expect(res.status).toBe(403);
		expect(mocks.getFacilityType).toHaveBeenCalledWith(7);
	});
});
