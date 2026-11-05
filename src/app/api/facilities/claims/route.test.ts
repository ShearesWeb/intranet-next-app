import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
	requireAuth: vi.fn(),
	createClaim: vi.fn(),
	createClaims: vi.fn(),
	deleteClaims: vi.fn(),
	getClaimOwners: vi.fn(),
	canManageFacilities: vi.fn(),
	getClaimsForCcas: vi.fn(),
	canBookForCca: vi.fn(),
	getBookingCcaIds: vi.fn(),
	getFacilityType: vi.fn(),
	getCoreServiceDisabledApiResponse: vi.fn(),
	isWithinBookingWindow: vi.fn(),
	getSingaporeDateKey: vi.fn(),
}));

vi.mock("@/lib/api/auth", () => ({ requireAuth: mocks.requireAuth }));
vi.mock("@/lib/facilities/facility-claims", () => ({
	createClaim: mocks.createClaim,
	createClaims: mocks.createClaims,
	deleteClaims: mocks.deleteClaims,
	getClaimOwners: mocks.getClaimOwners,
	getClaimsForCcas: mocks.getClaimsForCcas,
}));
vi.mock("@/lib/facilities/facility-access", () => ({
	canManageFacilities: mocks.canManageFacilities,
}));
vi.mock("@/lib/facilities/booking-ccas", () => ({
	canBookForCca: mocks.canBookForCca,
	getBookingCcaIds: mocks.getBookingCcaIds,
}));
vi.mock("@/lib/facilities/facility-catalog", () => ({
	getFacilityType: mocks.getFacilityType,
}));
vi.mock("@/lib/feature-flags", () => ({
	getCoreServiceDisabledApiResponse: mocks.getCoreServiceDisabledApiResponse,
}));
vi.mock("@/lib/nus-academic-calendar", () => ({
	isWithinBookingWindow: mocks.isWithinBookingWindow,
	getSingaporeDateKey: mocks.getSingaporeDateKey,
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

describe("GET /api/facilities/claims", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.getCoreServiceDisabledApiResponse.mockReturnValue(null);
		mocks.requireAuth.mockResolvedValue({ id: 42 });
		mocks.getBookingCcaIds.mockResolvedValue([3, 8]);
		mocks.getClaimsForCcas.mockResolvedValue([
			{ id: 1, facility_type: "sheares" },
			{ id: 2, facility_type: "nus" },
			{ id: 3, facility_type: "external" },
		]);
	});

	it("returns only Sheares claims, across every CCA the caller books for", async () => {
		const { GET } = await import("./route");
		const res = await GET();
		expect((await res.json()).data).toEqual([{ id: 1, facility_type: "sheares" }]);
		expect(mocks.getClaimsForCcas).toHaveBeenCalledWith([3, 8]);
	});

	it("returns nothing without querying when the caller cannot book", async () => {
		mocks.getBookingCcaIds.mockResolvedValue([]);
		const { GET } = await import("./route");
		const res = await GET();
		expect((await res.json()).data).toEqual([]);
		expect(mocks.getClaimsForCcas).not.toHaveBeenCalled();
	});
});

describe("POST /api/facilities/claims — validation", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.getCoreServiceDisabledApiResponse.mockReturnValue(null);
		mocks.requireAuth.mockResolvedValue({ id: 42 });
		mocks.canBookForCca.mockReturnValue(true);
		mocks.isWithinBookingWindow.mockReturnValue(true);
		mocks.getSingaporeDateKey.mockReturnValue(futureDate(0));
		mocks.getFacilityType.mockResolvedValue("sheares");
	});

	it("creates a same-day claim", async () => {
		mocks.createClaim.mockResolvedValue({ id: 1 });
		const { POST } = await import("./route");
		const res = await POST(post({ facility_id: 2, date: futureDate(0), hour: 18, cca_id: 3 }));
		expect(res.status).toBe(201);
		expect(mocks.createClaim).toHaveBeenCalledWith(2, futureDate(0), 18, 3, 42);
	});

	it("rejects a claim for a past slot", async () => {
		mocks.isWithinBookingWindow.mockReturnValue(true);
		const { POST } = await import("./route");
		const res = await POST(post({ facility_id: 2, date: futureDate(-1), hour: 18, cca_id: 3 }));
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

	it("403s when the caller may not book for the CCA", async () => {
		mocks.canBookForCca.mockReturnValue(false);
		const { POST } = await import("./route");
		const res = await POST(post({ facility_id: 2, date: futureDate(5), hour: 18, cca_id: 3 }));
		expect(res.status).toBe(403);
		expect(mocks.createClaim).not.toHaveBeenCalled();
	});

	it("creates a future claim within the booking window", async () => {
		mocks.createClaim.mockResolvedValue({ id: 1 });
		const { POST } = await import("./route");
		const res = await POST(post({ facility_id: 2, date: futureDate(5), hour: 18, cca_id: 3 }));
		expect(res.status).toBe(201);
		expect(mocks.createClaim).toHaveBeenCalledWith(2, futureDate(5), 18, 3, 42);
	});

	it("creates every hour of a multi-hour request in one call", async () => {
		mocks.createClaims.mockResolvedValue([{ id: 1 }, { id: 2 }]);
		const { POST } = await import("./route");
		const res = await POST(
			post({ facility_id: 2, date: futureDate(5), hours: [18, 19, 19], cca_id: 3 }),
		);
		expect(res.status).toBe(201);
		expect(mocks.createClaims).toHaveBeenCalledWith(2, futureDate(5), [18, 19], 3, 42);
		expect(mocks.createClaim).not.toHaveBeenCalled();
	});

	it("400s when any hour of a request is out of range", async () => {
		const { POST } = await import("./route");
		const res = await POST(
			post({ facility_id: 2, date: futureDate(5), hours: [18, 24], cca_id: 3 }),
		);
		expect(res.status).toBe(400);
		expect(mocks.createClaims).not.toHaveBeenCalled();
	});

	it("rejects a slot outside the booking window", async () => {
		mocks.isWithinBookingWindow.mockReturnValue(false);
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
		mocks.canBookForCca.mockReturnValue(true);
		mocks.isWithinBookingWindow.mockReturnValue(true);
		mocks.getSingaporeDateKey.mockReturnValue(futureDate(0));
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

describe("DELETE /api/facilities/claims — withdraw a whole request", () => {
	function del(body: unknown) {
		return new NextRequest("http://localhost/api/facilities/claims", {
			method: "DELETE",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body),
		});
	}

	beforeEach(() => {
		vi.clearAllMocks();
		mocks.getCoreServiceDisabledApiResponse.mockReturnValue(null);
		mocks.requireAuth.mockResolvedValue({ id: 42 });
		mocks.canManageFacilities.mockReturnValue(false);
		mocks.getBookingCcaIds.mockResolvedValue([3]);
		mocks.getClaimOwners.mockResolvedValue([
			{ id: 1, cca_id: 3, facility_id: 2 },
			{ id: 2, cca_id: 3, facility_id: 2 },
		]);
	});

	it("deletes every named claim the chair owns", async () => {
		const { DELETE } = await import("./route");
		const res = await DELETE(del({ claim_ids: [1, 2] }));
		expect(res.status).toBe(200);
		expect(mocks.deleteClaims).toHaveBeenCalledWith([1, 2]);
	});

	it("403s if any claim belongs to a CCA the caller may not book for", async () => {
		mocks.getClaimOwners.mockResolvedValue([
			{ id: 1, cca_id: 3, facility_id: 2 },
			{ id: 2, cca_id: 9, facility_id: 2 },
		]);
		const { DELETE } = await import("./route");
		const res = await DELETE(del({ claim_ids: [1, 2] }));
		expect(res.status).toBe(403);
		expect(mocks.deleteClaims).not.toHaveBeenCalled();
	});

	it("404s when a claim no longer exists", async () => {
		mocks.getClaimOwners.mockResolvedValue([{ id: 1, cca_id: 3, facility_id: 2 }]);
		const { DELETE } = await import("./route");
		const res = await DELETE(del({ claim_ids: [1, 2] }));
		expect(res.status).toBe(404);
		expect(mocks.deleteClaims).not.toHaveBeenCalled();
	});

	it("400s without claim_ids", async () => {
		const { DELETE } = await import("./route");
		const res = await DELETE(del({}));
		expect(res.status).toBe(400);
	});
});
