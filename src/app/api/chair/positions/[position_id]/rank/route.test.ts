import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	createClient: vi.fn(),
	fetchUserInfo: vi.fn(),
	checkCcaAuthorization: vi.fn(),
	getCoreServiceDisabledApiResponse: vi.fn(),
}));

vi.mock("@/utils/supabase/server", () => ({
	createClient: mocks.createClient,
}));

vi.mock("@/lib/fetch-user-info", () => ({
	fetchUserInfo: mocks.fetchUserInfo,
}));

vi.mock("@/features/cca/utils/cca-chair-access", () => ({
	checkCcaAuthorization: mocks.checkCcaAuthorization,
}));

vi.mock("@/lib/feature-flags", () => ({
	getCoreServiceDisabledApiResponse: mocks.getCoreServiceDisabledApiResponse,
}));

function buildSupabaseStub(rpc: ReturnType<typeof vi.fn>) {
	const positionRow = {
		id: 99,
		position_type: "member",
		ccas: { id: 7, name: "Test CCA", cca_type: "resident" },
	};

	const positionSelect = {
		eq: vi.fn().mockReturnThis(),
		single: vi.fn().mockResolvedValue({ data: positionRow, error: null }),
	};

	const deleteEqBuilder = {
		eq: vi.fn().mockReturnThis(),
		not: vi.fn().mockResolvedValue({ error: null }),
	};
	// Awaiting `.eq()` directly (the no-applicants branch) should also resolve.
	(deleteEqBuilder.eq as unknown as { then?: unknown }).then = (
		onFulfilled: (v: unknown) => unknown,
	) => Promise.resolve({ error: null }).then(onFulfilled);

	const deleteBuilder = {
		eq: vi.fn(() => deleteEqBuilder),
	};

	return {
		from: vi.fn((table: string) => {
			if (table === "cca_positions") {
				return { select: vi.fn(() => positionSelect) };
			}
			if (table === "cca_position_preferences") {
				return { delete: () => deleteBuilder };
			}
			throw new Error(`unexpected table: ${table}`);
		}),
		rpc,
	};
}

describe("chair rank route", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.getCoreServiceDisabledApiResponse.mockReturnValue(null);
		mocks.fetchUserInfo.mockResolvedValue({ id: 1, appointments: [] });
		mocks.checkCcaAuthorization.mockResolvedValue({
			ok: true,
			data: { userId: 1, hasChairAccess: true, authorizedCcaIds: [7] },
		});
	});

	it("calls upsert_cca_position_preference with the chair-side RPC payload shape per ranking, twice (stage + final)", async () => {
		const rpc = vi.fn().mockResolvedValue({ error: null });
		mocks.createClient.mockResolvedValue(buildSupabaseStub(rpc));

		const { POST } = await import("./route");
		const response = await POST(
			new Request("http://localhost/api/chair/positions/99/rank", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					rankings: [
						{ user_id: 10, ranking: 1 },
						{ user_id: 20, ranking: 2 },
					],
				}),
			}),
			{ params: Promise.resolve({ position_id: "99" }) },
		);

		expect(response.status).toBe(200);

		// 2 staging + 2 final = 4 total
		expect(rpc).toHaveBeenCalledTimes(4);
		for (const call of rpc.mock.calls) {
			expect(call[0]).toBe("upsert_cca_position_preference");
			expect(Object.keys(call[1]).sort()).toEqual(["p_position_id", "p_rank", "p_user_id"].sort());
		}

		// Final-pass writes carry the real rank values.
		const finalCalls = rpc.mock.calls.slice(2);
		expect(finalCalls[0][1]).toEqual({ p_position_id: 99, p_user_id: 10, p_rank: 1 });
		expect(finalCalls[1][1]).toEqual({ p_position_id: 99, p_user_id: 20, p_rank: 2 });
	});

	it("returns 400 when rankings is not an array", async () => {
		const rpc = vi.fn();
		mocks.createClient.mockResolvedValue(buildSupabaseStub(rpc));

		const { POST } = await import("./route");
		const response = await POST(
			new Request("http://localhost/api/chair/positions/99/rank", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ rankings: "not-an-array" }),
			}),
			{ params: Promise.resolve({ position_id: "99" }) },
		);

		expect(response.status).toBe(400);
		expect(rpc).not.toHaveBeenCalled();
	});
});
