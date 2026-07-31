import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { ApiError } from "@/lib/api/errors";

const mocks = vi.hoisted(() => ({
	requireAuth: vi.fn(),
	requireJcrcAccess: vi.fn(),
	listFacilities: vi.fn(),
	createFacility: vi.fn(),
	updateFacility: vi.fn(),
	getCoreServiceDisabledApiResponse: vi.fn(),
}));

vi.mock("@/lib/api/auth", () => ({
	requireAuth: mocks.requireAuth,
	requireJcrcAccess: mocks.requireJcrcAccess,
}));
vi.mock("@/lib/facilities/facility-catalog", () => ({
	listFacilities: mocks.listFacilities,
	createFacility: mocks.createFacility,
	updateFacility: mocks.updateFacility,
}));
vi.mock("@/lib/feature-flags", () => ({
	getCoreServiceDisabledApiResponse: mocks.getCoreServiceDisabledApiResponse,
}));

function postReq(body: unknown) {
	return new NextRequest("http://localhost/api/facilities/catalog", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});
}
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
	});

	it("POST returns 403 for non-JCRC callers", async () => {
		mocks.requireJcrcAccess.mockRejectedValue(new ApiError(403, "Unauthorized"));
		const { POST } = await import("./route");
		const res = await POST(postReq({ type: "sheares", venue: "MPH", sub_venue: "MPH" }));
		expect(res.status).toBe(403);
		expect(mocks.createFacility).not.toHaveBeenCalled();
	});

	it("POST returns 400 when required fields are missing", async () => {
		mocks.requireJcrcAccess.mockResolvedValue({ is_jcrc: true });
		const { POST } = await import("./route");
		const res = await POST(postReq({ type: "sheares" }));
		expect(res.status).toBe(400);
		expect(mocks.createFacility).not.toHaveBeenCalled();
	});

	it("POST creates a facility and returns 201", async () => {
		mocks.requireJcrcAccess.mockResolvedValue({ is_jcrc: true });
		const created = { id: 9, venue: "MPH", sub_venue: "MPH", type: "sheares", active: true };
		mocks.createFacility.mockResolvedValue(created);
		const { POST } = await import("./route");
		const res = await POST(postReq({ type: "sheares", venue: "MPH", sub_venue: "MPH" }));
		expect(res.status).toBe(201);
		expect(await res.json()).toEqual({ data: created, error: null });
		expect(mocks.createFacility).toHaveBeenCalledWith({
			type: "sheares",
			venue: "MPH",
			sub_venue: "MPH",
		});
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
		const updated = { id: 3, venue: "Pool", sub_venue: "Lane 1", type: "external", active: false };
		mocks.updateFacility.mockResolvedValue(updated);
		const { PATCH } = await import("./route");
		const res = await PATCH(patchReq({ id: 3, active: false }));
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ data: updated, error: null });
		expect(mocks.updateFacility).toHaveBeenCalledWith(3, { active: false });
	});
});
