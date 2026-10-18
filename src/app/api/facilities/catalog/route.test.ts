import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { ApiError } from "@/lib/api/errors";

const mocks = vi.hoisted(() => ({
	requireAuth: vi.fn(),
	requireJcrcAccess: vi.fn(),
	listFacilities: vi.fn(),
	getFacilityType: vi.fn(),
	updateFacility: vi.fn(),
	getCoreServiceDisabledApiResponse: vi.fn(),
}));

vi.mock("@/lib/api/auth", () => ({
	requireAuth: mocks.requireAuth,
	requireJcrcAccess: mocks.requireJcrcAccess,
}));
vi.mock("@/lib/facilities/facility-catalog", () => ({
	listFacilities: mocks.listFacilities,
	getFacilityType: mocks.getFacilityType,
	updateFacility: mocks.updateFacility,
}));
vi.mock("@/lib/feature-flags", () => ({
	getCoreServiceDisabledApiResponse: mocks.getCoreServiceDisabledApiResponse,
}));

function patchReq(body: unknown) {
	return new NextRequest("http://localhost/api/facilities/catalog", {
		method: "PATCH",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});
}

describe("catalog route writes", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.getCoreServiceDisabledApiResponse.mockReturnValue(null);
		mocks.getFacilityType.mockResolvedValue("sheares");
	});

	it("PATCH returns 403 for non-JCRC callers", async () => {
		mocks.requireJcrcAccess.mockRejectedValue(new ApiError(403, "Unauthorized"));
		const { PATCH } = await import("./route");
		const res = await PATCH(patchReq({ id: 3, venue: "Pool" }));
		expect(res.status).toBe(403);
		expect(mocks.updateFacility).not.toHaveBeenCalled();
	});

	it("PATCH returns 400 without an id", async () => {
		mocks.requireJcrcAccess.mockResolvedValue({ is_jcrc: true });
		const { PATCH } = await import("./route");
		const res = await PATCH(patchReq({ active: false }));
		expect(res.status).toBe(400);
		expect(mocks.updateFacility).not.toHaveBeenCalled();
	});

	it("PATCH updates a facility and returns 200", async () => {
		mocks.requireJcrcAccess.mockResolvedValue({ is_jcrc: true });
		const updated = { id: 3, venue: "Comm Hall", sub_venue: "Comm Hall", type: "sheares" };
		mocks.updateFacility.mockResolvedValue(updated);
		const { PATCH } = await import("./route");
		const res = await PATCH(patchReq({ id: 3, active: false }));
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ data: updated, error: null });
		expect(mocks.updateFacility).toHaveBeenCalledWith(3, { active: false });
	});

	it("PATCH rejects a non-Sheares facility", async () => {
		mocks.requireJcrcAccess.mockResolvedValue({ is_jcrc: true });
		mocks.getFacilityType.mockResolvedValue("external");
		const { PATCH } = await import("./route");
		const res = await PATCH(patchReq({ id: 3, venue: "Pool" }));
		expect(res.status).toBe(403);
		expect(mocks.updateFacility).not.toHaveBeenCalled();
	});
});
