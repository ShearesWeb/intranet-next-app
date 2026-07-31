import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
	requireAuth: vi.fn(),
	createClaim: vi.fn(),
	getClaimsForCca: vi.fn(),
	getBooking: vi.fn(),
	isChairOfCca: vi.fn(),
	getChairCcaIds: vi.fn(),
	getCoreServiceDisabledApiResponse: vi.fn(),
}));

vi.mock("@/lib/api/auth", () => ({ requireAuth: mocks.requireAuth }));
vi.mock("@/lib/facilities/facility-claims", () => ({
	createClaim: mocks.createClaim,
	getClaimsForCca: mocks.getClaimsForCca,
}));
vi.mock("@/lib/facilities/facility-bookings", () => ({ getBooking: mocks.getBooking }));
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

	it("403s when the slot is within the 3-day lock window", async () => {
		mocks.getBooking.mockResolvedValue({
			id: 9,
			booked_date: futureDate(1),
			status: "available",
		});
		const { POST } = await import("./route");
		const res = await POST(post({ booking_id: 9, cca_id: 3 }));
		expect(res.status).toBe(403);
		expect(mocks.createClaim).not.toHaveBeenCalled();
	});

	it("404s when the booking does not exist", async () => {
		mocks.getBooking.mockResolvedValue(null);
		const { POST } = await import("./route");
		const res = await POST(post({ booking_id: 9, cca_id: 3 }));
		expect(res.status).toBe(404);
		expect(mocks.createClaim).not.toHaveBeenCalled();
	});

	it("creates the claim when the slot is at least 3 days out", async () => {
		mocks.getBooking.mockResolvedValue({
			id: 9,
			booked_date: futureDate(5),
			status: "available",
		});
		mocks.createClaim.mockResolvedValue({ id: 1 });
		const { POST } = await import("./route");
		const res = await POST(post({ booking_id: 9, cca_id: 3 }));
		expect(res.status).toBe(201);
		expect(mocks.createClaim).toHaveBeenCalledWith(9, 3, 42);
	});
});
