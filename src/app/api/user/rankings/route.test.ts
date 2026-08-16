import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/errors";

const mocks = vi.hoisted(() => ({
	fetchUserId: vi.fn(),
	getCoreServiceDisabledApiResponse: vi.fn(),
	saveRankings: vi.fn(),
	getRankingPeriodStates: vi.fn(),
}));

vi.mock("@/lib/auth/fetch-user-info", () => ({
	fetchUserId: mocks.fetchUserId,
}));

vi.mock("@/lib/feature-flags", () => ({
	getCoreServiceDisabledApiResponse: mocks.getCoreServiceDisabledApiResponse,
}));

vi.mock("@/lib/allocation/preference-service", () => ({
	saveRankings: mocks.saveRankings,
}));

vi.mock("@/lib/timed-flags/service", () => ({
	getRankingPeriodStates: mocks.getRankingPeriodStates,
}));

function subcommOpenPeriods() {
	return [
		{
			key: "maincomm",
			label: "Maincomm & Blockcomm",
			active: false,
			startsAt: null,
			expiresAt: null,
			upcoming: false,
			positionTypes: ["maincomm", "blockcomm"],
		},
		{
			key: "subcomm",
			label: "Subcomm",
			active: true,
			startsAt: null,
			expiresAt: "2026-09-01T00:00:00Z",
			upcoming: false,
			positionTypes: ["subcomm"],
		},
	];
}

function postRequest(body: unknown) {
	return new Request("http://localhost/api/user/rankings", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});
}

describe("rankings route", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.getCoreServiceDisabledApiResponse.mockReturnValue(null);
		mocks.getRankingPeriodStates.mockResolvedValue(subcommOpenPeriods());
	});

	it("returns 401 when fetchUserId cannot identify the caller", async () => {
		mocks.fetchUserId.mockResolvedValue(null);

		const { POST } = await import("./route");
		const response = await POST(postRequest({ rankings: [{ position_id: 4, ranking: 1 }] }));

		expect(response.status).toBe(401);
		expect(await response.json()).toEqual({ data: null, error: "Unauthorized" });
		expect(mocks.saveRankings).not.toHaveBeenCalled();
	});

	it("400s on a malformed body without touching the service", async () => {
		mocks.fetchUserId.mockResolvedValue(55);

		const { POST } = await import("./route");
		const response = await POST(postRequest({ rankings: "nope" }));

		expect(response.status).toBe(400);
		expect(mocks.saveRankings).not.toHaveBeenCalled();
	});

	it("resolves the open periods server-side and hands their types to the service", async () => {
		mocks.fetchUserId.mockResolvedValue(55);
		mocks.saveRankings.mockResolvedValue(undefined);

		const { POST } = await import("./route");
		const rankings = [
			{ position_id: 7, ranking: 2 },
			{ position_id: 4, ranking: 1 },
		];
		const response = await POST(postRequest({ rankings }));

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ data: { success: true }, error: null });
		expect(mocks.saveRankings).toHaveBeenCalledWith(55, rankings, ["subcomm"]);
	});

	it("passes an empty type list when every period is closed", async () => {
		mocks.fetchUserId.mockResolvedValue(55);
		mocks.getRankingPeriodStates.mockResolvedValue(
			subcommOpenPeriods().map((p) => ({ ...p, active: false })),
		);
		mocks.saveRankings.mockRejectedValue(
			new ApiError(403, "Preference submissions are closed right now."),
		);

		const { POST } = await import("./route");
		const response = await POST(postRequest({ rankings: [] }));

		expect(response.status).toBe(403);
		expect(mocks.saveRankings).toHaveBeenCalledWith(55, [], []);
	});

	it("surfaces service failures through the error envelope", async () => {
		mocks.fetchUserId.mockResolvedValue(55);
		mocks.saveRankings.mockRejectedValue(new ApiError(500, "Failed to save rankings"));

		const { POST } = await import("./route");
		const response = await POST(postRequest({ rankings: [{ position_id: 4, ranking: 1 }] }));

		expect(response.status).toBe(500);
		expect(await response.json()).toEqual({ data: null, error: "Failed to save rankings" });
	});
});
