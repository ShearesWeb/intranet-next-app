import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
	requireAuth: vi.fn(),
	createClaim: vi.fn(),
	getClaimsForCca: vi.fn(),
	isChairOfCca: vi.fn(),
	getChairCcaIds: vi.fn(),
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
