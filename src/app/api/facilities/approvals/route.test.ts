import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { ApiError } from "@/lib/api/errors";

const mocks = vi.hoisted(() => ({
	requireJcrcAccess: vi.fn(),
	getSlots: vi.fn(),
	listPendingApprovals: vi.fn(),
	listUpcomingConfirmed: vi.fn(),
	resolveSlot: vi.fn(),
	rejectClaims: vi.fn(),
	deleteClaims: vi.fn(),
	getClaimOwners: vi.fn(),
	getCoreServiceDisabledApiResponse: vi.fn(),
}));

vi.mock("@/lib/api/auth", () => ({ requireJcrcAccess: mocks.requireJcrcAccess }));
vi.mock("@/lib/facilities/facility-slots", () => ({ getSlots: mocks.getSlots }));
vi.mock("@/lib/facilities/facility-approvals", () => ({
	listPendingApprovals: mocks.listPendingApprovals,
	listUpcomingConfirmed: mocks.listUpcomingConfirmed,
	resolveSlot: mocks.resolveSlot,
	rejectClaims: mocks.rejectClaims,
}));
vi.mock("@/lib/facilities/facility-claims", () => ({
	deleteClaims: mocks.deleteClaims,
	getClaimOwners: mocks.getClaimOwners,
}));
vi.mock("@/lib/feature-flags", () => ({
	getCoreServiceDisabledApiResponse: mocks.getCoreServiceDisabledApiResponse,
}));

function post(body: unknown) {
	return new NextRequest("http://localhost/api/facilities/approvals", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});
}

describe("approvals route", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.getCoreServiceDisabledApiResponse.mockReturnValue(null);
		mocks.requireJcrcAccess.mockResolvedValue({ id: 7, is_jcrc: true });
		mocks.getClaimOwners.mockImplementation(async (ids: number[]) =>
			ids.map((id) => ({ id, cca_id: 3, facility_id: 1, facility_type: "sheares" })),
		);
	});

	it("GET builds both lists from one fetch of Sheares slots", async () => {
		const sheares = { facility_id: 1, type: "sheares" };
		mocks.getSlots.mockResolvedValue([sheares, { facility_id: 2, type: "nus" }]);
		mocks.listPendingApprovals.mockResolvedValue([{ slot: sheares }]);
		mocks.listUpcomingConfirmed.mockResolvedValue([{ slot: sheares, claim_id: 9 }]);
		const { GET } = await import("./route");
		const res = await GET();
		expect(res.status).toBe(200);
		const json = await res.json();
		expect(json.data.pending).toHaveLength(1);
		expect(json.data.confirmed).toHaveLength(1);
		expect(mocks.getSlots).toHaveBeenCalledTimes(1);
		expect(mocks.listPendingApprovals).toHaveBeenCalledWith([sheares]);
		expect(mocks.listUpcomingConfirmed).toHaveBeenCalledWith([sheares]);
	});

	it("GET 403s for non-JCRC callers", async () => {
		mocks.requireJcrcAccess.mockRejectedValue(new ApiError(403, "Unauthorized"));
		const { GET } = await import("./route");
		expect((await GET()).status).toBe(403);
	});

	// Slots are computed and have no id, so every action is keyed by claim.
	it("POST approve requires claim_id", async () => {
		const { POST } = await import("./route");
		const res = await POST(post({ action: "approve" }));
		expect(res.status).toBe(400);
		expect(mocks.resolveSlot).not.toHaveBeenCalled();
	});

	it("POST approve forwards the winner and its competitors", async () => {
		const { POST } = await import("./route");
		const res = await POST(post({ action: "approve", claim_id: 5, competing_claim_ids: [5, 6] }));
		expect(res.status).toBe(200);
		expect(mocks.resolveSlot).toHaveBeenCalledWith([5], [5, 6]);
	});

	it("POST approve takes a whole multi-hour request", async () => {
		const { POST } = await import("./route");
		const res = await POST(
			post({ action: "approve", claim_ids: [5, 6, 7], competing_claim_ids: [8] }),
		);
		expect(res.status).toBe(200);
		expect(mocks.resolveSlot).toHaveBeenCalledWith([5, 6, 7], [8]);
	});

	it("POST reject clears every claim named", async () => {
		const { POST } = await import("./route");
		const res = await POST(post({ action: "reject", claim_ids: [5, 6] }));
		expect(res.status).toBe(200);
		expect(mocks.rejectClaims).toHaveBeenCalledWith([5, 6]);
	});

	it("POST reject accepts a single claim_id", async () => {
		const { POST } = await import("./route");
		const res = await POST(post({ action: "reject", claim_id: 5 }));
		expect(res.status).toBe(200);
		expect(mocks.rejectClaims).toHaveBeenCalledWith([5]);
	});

	it("POST revoke deletes the approved claim", async () => {
		const { POST } = await import("./route");
		const res = await POST(post({ action: "revoke", claim_id: 9 }));
		expect(res.status).toBe(200);
		expect(mocks.deleteClaims).toHaveBeenCalledWith([9]);
	});

	it("POST revoke takes a whole multi-hour booking", async () => {
		const { POST } = await import("./route");
		const res = await POST(post({ action: "revoke", claim_ids: [9, 10] }));
		expect(res.status).toBe(200);
		expect(mocks.deleteClaims).toHaveBeenCalledWith([9, 10]);
	});

	it("POST rejects unknown actions", async () => {
		const { POST } = await import("./route");
		const res = await POST(post({ action: "smite", claim_id: 1 }));
		expect(res.status).toBe(400);
	});

	it("POST rejects management of a non-Sheares claim", async () => {
		mocks.getClaimOwners.mockResolvedValue([
			{ id: 9, cca_id: 3, facility_id: 1, facility_type: "reboks" },
		]);
		const { POST } = await import("./route");
		const res = await POST(post({ action: "revoke", claim_id: 9 }));
		expect(res.status).toBe(403);
		expect(mocks.deleteClaims).not.toHaveBeenCalled();
	});
});
