import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	createClient: vi.fn(),
	fetchUserId: vi.fn(),
	getCoreServiceDisabledApiResponse: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
	createClient: mocks.createClient,
}));

vi.mock("@/lib/auth/fetch-user-info", () => ({
	fetchUserId: mocks.fetchUserId,
}));

vi.mock("@/lib/feature-flags", () => ({
	getCoreServiceDisabledApiResponse: mocks.getCoreServiceDisabledApiResponse,
}));

function buildSupabaseStub(rpc: ReturnType<typeof vi.fn>) {
	return { from: vi.fn(), rpc };
}

describe("rankings route", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.getCoreServiceDisabledApiResponse.mockReturnValue(null);
	});

	it("returns 401 when fetchUserId cannot identify the caller", async () => {
		const rpc = vi.fn();
		mocks.createClient.mockResolvedValue(buildSupabaseStub(rpc));
		mocks.fetchUserId.mockResolvedValue(null);

		const { POST } = await import("./route");
		const response = await POST(
			new Request("http://localhost/api/user/rankings", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ rankings: [{ position_id: 4, ranking: 1 }] }),
			}),
		);

		expect(response.status).toBe(401);
		expect(await response.json()).toEqual({ data: null, error: "Unauthorized" });
	});

	it("replaces the whole list in a single set_preferred_positions call", async () => {
		const rpc = vi.fn().mockResolvedValue({ error: null });
		mocks.createClient.mockResolvedValue(buildSupabaseStub(rpc));
		mocks.fetchUserId.mockResolvedValue(55);

		const { POST } = await import("./route");
		const response = await POST(
			new Request("http://localhost/api/user/rankings", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					rankings: [
						{ position_id: 7, ranking: 2 },
						{ position_id: 4, ranking: 1 },
					],
				}),
			}),
		);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ data: { success: true }, error: null });

		// One RPC, not the old 2N staged writes. Rank comes from array order, so
		// the payload must be sorted by the requested ranking.
		expect(rpc).toHaveBeenCalledTimes(1);
		expect(rpc).toHaveBeenCalledWith("set_preferred_positions", {
			p_position_ids: [4, 7],
		});
	});

	it("clears the list when given an empty array", async () => {
		const rpc = vi.fn().mockResolvedValue({ error: null });
		mocks.createClient.mockResolvedValue(buildSupabaseStub(rpc));
		mocks.fetchUserId.mockResolvedValue(55);

		const { POST } = await import("./route");
		const response = await POST(
			new Request("http://localhost/api/user/rankings", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ rankings: [] }),
			}),
		);

		expect(response.status).toBe(200);
		expect(rpc).toHaveBeenCalledWith("set_preferred_positions", { p_position_ids: [] });
	});

	it("rejects a repeated position rather than letting the RPC do it", async () => {
		const rpc = vi.fn().mockResolvedValue({ error: null });
		mocks.createClient.mockResolvedValue(buildSupabaseStub(rpc));
		mocks.fetchUserId.mockResolvedValue(55);

		const { POST } = await import("./route");
		const response = await POST(
			new Request("http://localhost/api/user/rankings", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					rankings: [
						{ position_id: 4, ranking: 1 },
						{ position_id: 4, ranking: 2 },
					],
				}),
			}),
		);

		expect(response.status).toBe(400);
		expect(rpc).not.toHaveBeenCalled();
	});

	it("returns 500 when the RPC fails", async () => {
		const rpc = vi.fn().mockResolvedValue({ error: { message: "rpc failed" } });
		mocks.createClient.mockResolvedValue(buildSupabaseStub(rpc));
		mocks.fetchUserId.mockResolvedValue(55);

		const { POST } = await import("./route");
		const response = await POST(
			new Request("http://localhost/api/user/rankings", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ rankings: [{ position_id: 4, ranking: 1 }] }),
			}),
		);

		expect(response.status).toBe(500);
		expect(await response.json()).toEqual({ data: null, error: "Failed to save rankings" });
	});
});
