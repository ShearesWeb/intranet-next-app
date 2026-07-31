import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
	requireAuth: vi.fn(),
	deleteClaim: vi.fn(),
	getClaim: vi.fn(),
	isChairOfCca: vi.fn(),
	canManageFacilities: vi.fn(),
	getCoreServiceDisabledApiResponse: vi.fn(),
}));

vi.mock("@/lib/api/auth", () => ({ requireAuth: mocks.requireAuth }));
vi.mock("@/lib/facilities/facility-claims", () => ({
	deleteClaim: mocks.deleteClaim,
	getClaim: mocks.getClaim,
}));
vi.mock("@/lib/facilities/facility-access", () => ({
	isChairOfCca: mocks.isChairOfCca,
	canManageFacilities: mocks.canManageFacilities,
}));
vi.mock("@/lib/feature-flags", () => ({
	getCoreServiceDisabledApiResponse: mocks.getCoreServiceDisabledApiResponse,
}));

function del() {
	return new NextRequest("http://localhost/api/facilities/claims/5", { method: "DELETE" });
}

function params() {
	return { params: Promise.resolve({ id: "5" }) };
}

function futureDate(daysAhead: number): string {
	const d = new Date();
	d.setDate(d.getDate() + daysAhead);
	const m = String(d.getMonth() + 1).padStart(2, "0");
	const day = String(d.getDate()).padStart(2, "0");
	return `${d.getFullYear()}-${m}-${day}`;
}

describe("DELETE /api/facilities/claims/[id] — withdrawal is never time-locked", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.getCoreServiceDisabledApiResponse.mockReturnValue(null);
		mocks.requireAuth.mockResolvedValue({ id: 42 });
		mocks.isChairOfCca.mockReturnValue(true);
	});

	it("lets a chair withdraw inside the 3-day window", async () => {
		mocks.canManageFacilities.mockReturnValue(false);
		mocks.getClaim.mockResolvedValue({
			id: 5,
			cca_id: 3,
			booking_id: 9,
			booked_date: futureDate(1),
		});
		const { DELETE } = await import("./route");
		const res = await DELETE(del(), params());
		expect(res.status).toBe(200);
		expect(mocks.deleteClaim).toHaveBeenCalledWith(5);
	});

	it("lets JCRC cancel a claim inside the window", async () => {
		mocks.isChairOfCca.mockReturnValue(false);
		mocks.canManageFacilities.mockReturnValue(true);
		mocks.getClaim.mockResolvedValue({
			id: 5,
			cca_id: 3,
			booking_id: 9,
			booked_date: futureDate(1),
		});
		const { DELETE } = await import("./route");
		const res = await DELETE(del(), params());
		expect(res.status).toBe(200);
		expect(mocks.deleteClaim).toHaveBeenCalledWith(5);
	});

	it("lets a chair withdraw outside the window", async () => {
		mocks.canManageFacilities.mockReturnValue(false);
		mocks.getClaim.mockResolvedValue({
			id: 5,
			cca_id: 3,
			booking_id: 9,
			booked_date: futureDate(7),
		});
		const { DELETE } = await import("./route");
		const res = await DELETE(del(), params());
		expect(res.status).toBe(200);
		expect(mocks.deleteClaim).toHaveBeenCalledWith(5);
	});
});
