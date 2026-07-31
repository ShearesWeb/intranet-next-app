import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { ApiError } from "@/lib/api/errors";

const mocks = vi.hoisted(() => ({
	requireJcrcAccess: vi.fn(),
	listPendingApprovals: vi.fn(),
	listUpcomingConfirmed: vi.fn(),
	approveClaim: vi.fn(),
	rejectAllClaims: vi.fn(),
	revokeBooking: vi.fn(),
	getCoreServiceDisabledApiResponse: vi.fn(),
}));

vi.mock("@/lib/api/auth", () => ({ requireJcrcAccess: mocks.requireJcrcAccess }));
vi.mock("@/lib/facilities/facility-approvals", () => ({
	listPendingApprovals: mocks.listPendingApprovals,
	listUpcomingConfirmed: mocks.listUpcomingConfirmed,
	approveClaim: mocks.approveClaim,
	rejectAllClaims: mocks.rejectAllClaims,
	revokeBooking: mocks.revokeBooking,
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
	});

	it("GET returns pending + confirmed lists", async () => {
		mocks.listPendingApprovals.mockResolvedValue([{ booking: { id: 1 } }]);
		mocks.listUpcomingConfirmed.mockResolvedValue([{ booking: { id: 2 } }]);
		const { GET } = await import("./route");
		const res = await GET();
		expect(res.status).toBe(200);
		const json = await res.json();
		expect(json.data.pending).toHaveLength(1);
		expect(json.data.confirmed).toHaveLength(1);
	});

	it("GET 403s for non-JCRC callers", async () => {
		mocks.requireJcrcAccess.mockRejectedValue(new ApiError(403, "Unauthorized"));
		const { GET } = await import("./route");
		expect((await GET()).status).toBe(403);
	});

	it("POST approve requires winning_claim_id", async () => {
		const { POST } = await import("./route");
		const res = await POST(post({ action: "approve", booking_id: 1 }));
		expect(res.status).toBe(400);
		expect(mocks.approveClaim).not.toHaveBeenCalled();
	});

	it("POST approve forwards booking, claim and user ids", async () => {
		const { POST } = await import("./route");
		const res = await POST(post({ action: "approve", booking_id: 1, winning_claim_id: 5 }));
		expect(res.status).toBe(200);
		expect(mocks.approveClaim).toHaveBeenCalledWith(1, 5, 7);
	});

	it("POST reject rejects all claims on the booking", async () => {
		const { POST } = await import("./route");
		const res = await POST(post({ action: "reject", booking_id: 1 }));
		expect(res.status).toBe(200);
		expect(mocks.rejectAllClaims).toHaveBeenCalledWith(1, 7);
	});

	it("POST revoke revokes the confirmed booking", async () => {
		const { POST } = await import("./route");
		const res = await POST(post({ action: "revoke", booking_id: 1 }));
		expect(res.status).toBe(200);
		expect(mocks.revokeBooking).toHaveBeenCalledWith(1, 7);
	});

	it("POST rejects unknown actions", async () => {
		const { POST } = await import("./route");
		const res = await POST(post({ action: "smite", booking_id: 1 }));
		expect(res.status).toBe(400);
	});
});
