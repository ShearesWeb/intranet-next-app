import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	createClient: vi.fn(),
	fetchUserId: vi.fn(),
	getCoreServiceDisabledApiResponse: vi.fn(),
}));

vi.mock("@/utils/supabase/server", () => ({
	createClient: mocks.createClient,
}));

vi.mock("@/lib/fetch-user-info", () => ({
	fetchUserId: mocks.fetchUserId,
}));

vi.mock("@/lib/feature-flags", () => ({
	getCoreServiceDisabledApiResponse: mocks.getCoreServiceDisabledApiResponse,
}));

function buildSupabaseStub(rpc: ReturnType<typeof vi.fn>) {
	// Chained delete().eq().not() and delete().eq() builder. Each call to
	// `.from()` returns a new builder so we can inspect the chain.
	const deleteBuilder = {
		eq: vi.fn(),
		not: vi.fn(),
	};
	deleteBuilder.eq.mockReturnValue(deleteBuilder);
	deleteBuilder.not.mockResolvedValue({ error: null });

	// Resolve delete().eq() (the no-positions branch) by giving `.eq` a
	// thenable shape via `.then`. We just expose the final resolution through
	// a Promise.resolve when awaited.
	const fromBuilder = {
		delete: () => deleteBuilder,
	};

	return {
		from: vi.fn(() => fromBuilder),
		rpc,
		_deleteBuilder: deleteBuilder,
	};
}

describe("saveRankings route", () => {
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
			new Request("http://localhost/api/user/saveRankings", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ rankings: [{ position_id: 4, ranking: 1 }] }),
			}),
		);

		expect(response.status).toBe(401);
		expect(await response.json()).toEqual({ error: "Unauthorized" });
	});

	it("calls upsert_cca_user_preference with the user-side RPC payload shape per ranking", async () => {
		const rpc = vi.fn().mockResolvedValue({ error: null });
		const stub = buildSupabaseStub(rpc);
		mocks.createClient.mockResolvedValue(stub);
		mocks.fetchUserId.mockResolvedValue(55);

		const { POST } = await import("./route");
		const response = await POST(
			new Request("http://localhost/api/user/saveRankings", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					rankings: [
						{ position_id: 4, ranking: 1 },
						{ position_id: 7, ranking: 2 },
					],
				}),
			}),
		);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ success: true });

		// 2 staging calls + 2 final calls = 4 total
		expect(rpc).toHaveBeenCalledTimes(4);
		// Every call must use the user-side RPC name and payload shape.
		for (const call of rpc.mock.calls) {
			expect(call[0]).toBe("upsert_cca_user_preference");
			expect(Object.keys(call[1]).sort()).toEqual(["p_position_id", "p_rank"]);
			expect(call[1]).not.toHaveProperty("p_user_id");
		}
		// Final-pass writes must use the real rank.
		const finalCalls = rpc.mock.calls.slice(2);
		expect(finalCalls[0][1]).toEqual({ p_position_id: 4, p_rank: 1 });
		expect(finalCalls[1][1]).toEqual({ p_position_id: 7, p_rank: 2 });
	});

	it("returns 500 when the staging RPC fails", async () => {
		const rpc = vi.fn().mockResolvedValue({ error: { message: "rpc failed" } });
		const stub = buildSupabaseStub(rpc);
		mocks.createClient.mockResolvedValue(stub);
		mocks.fetchUserId.mockResolvedValue(55);

		const { POST } = await import("./route");
		const response = await POST(
			new Request("http://localhost/api/user/saveRankings", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ rankings: [{ position_id: 4, ranking: 1 }] }),
			}),
		);

		expect(response.status).toBe(500);
		expect(await response.json()).toEqual({ error: "Failed to save rankings" });
	});
});
