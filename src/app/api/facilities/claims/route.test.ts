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

describe("POST /api/facilities/claims — lead-time gate", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.getCoreServiceDisabledApiResponse.mockReturnValue(null);
		mocks.requireAuth.mockResolvedValue({ id: 42 });
		mocks.isChairOfCca.mockReturnValue(true);
		// A hall venue by default, so the REBOKS horizon never applies here. Left
		// unset these tests would flip to 403 whenever the suite ran within five
		// days of a month end.
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
});

describe("POST /api/facilities/claims — REBOKS horizon gate", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.getCoreServiceDisabledApiResponse.mockReturnValue(null);
		mocks.requireAuth.mockResolvedValue({ id: 42, is_jcrc: false });
		mocks.isChairOfCca.mockReturnValue(true);
		mocks.createClaim.mockResolvedValue({ id: 1 });
	});

	/** First of the month after next — always past the horizon, whatever day it is. */
	function beyondHorizon(): string {
		// Constructed via Date so December rolls the year instead of yielding month 14.
		const next = new Date(new Date().getFullYear(), new Date().getMonth() + 2, 1);
		return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-01`;
	}

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
		// JCRC skips the lookup entirely rather than querying and then ignoring it.
		expect(mocks.getFacilityType).not.toHaveBeenCalled();
	});
});
