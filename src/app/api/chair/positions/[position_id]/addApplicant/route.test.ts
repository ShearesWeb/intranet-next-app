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

function buildSupabaseStub({
	rpc,
	existingApplicant,
	currentMaxRank,
}: {
	rpc: ReturnType<typeof vi.fn>;
	existingApplicant?: { rank: number } | null;
	currentMaxRank?: number;
}) {
	const positionRow = {
		id: 99,
		position_type: "member",
		ccas: { id: 7, name: "Test CCA", cca_type: "resident" },
	};

	const positionSelect = {
		eq: vi.fn().mockReturnThis(),
		single: vi.fn().mockResolvedValue({ data: positionRow, error: null }),
	};

	const prefExistenceSelect = {
		eq: vi.fn().mockReturnThis(),
		maybeSingle: vi.fn().mockResolvedValue({ data: existingApplicant ?? null, error: null }),
	};

	const prefMaxSelect = {
		eq: vi.fn().mockReturnThis(),
		order: vi.fn().mockReturnThis(),
		limit: vi.fn().mockResolvedValue({
			data: currentMaxRank !== undefined ? [{ rank: currentMaxRank }] : [],
			error: null,
		}),
	};

	let prefCallIndex = 0;

	return {
		from: vi.fn((table: string) => {
			if (table === "cca_positions") {
				return { select: vi.fn(() => positionSelect) };
			}
			if (table === "cca_position_preferences") {
				const builder = {
					select: vi.fn(() => {
						const target = prefCallIndex === 0 ? prefExistenceSelect : prefMaxSelect;
						prefCallIndex += 1;
						return target;
					}),
				};
				return builder;
			}
			throw new Error(`unexpected table: ${table}`);
		}),
		rpc,
	};
}

describe("chair addApplicant route", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.getCoreServiceDisabledApiResponse.mockReturnValue(null);
		mocks.fetchUserInfo.mockResolvedValue({ id: 1, appointments: [] });
		mocks.checkCcaAuthorization.mockResolvedValue({
			ok: true,
			data: { userId: 1, hasChairAccess: true, authorizedCcaIds: [7] },
		});
	});

	it("calls upsert_cca_position_preference with the chair-side RPC payload shape", async () => {
		const rpc = vi.fn().mockResolvedValue({ error: null });
		mocks.createClient.mockResolvedValue(
			buildSupabaseStub({ rpc, existingApplicant: null, currentMaxRank: 3 }),
		);

		const { POST } = await import("./route");
		const response = await POST(
			new Request("http://localhost/api/chair/positions/99/addApplicant", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ user_id: 42 }),
			}),
			{ params: Promise.resolve({ position_id: "99" }) },
		);

		expect(response.status).toBe(200);
		expect(rpc).toHaveBeenCalledTimes(1);
		expect(rpc).toHaveBeenCalledWith("upsert_cca_position_preference", {
			p_position_id: 99,
			p_user_id: 42,
			p_rank: 4,
		});
	});

	it("uses rank 1 when there are no existing applicants", async () => {
		const rpc = vi.fn().mockResolvedValue({ error: null });
		mocks.createClient.mockResolvedValue(buildSupabaseStub({ rpc, existingApplicant: null }));

		const { POST } = await import("./route");
		const response = await POST(
			new Request("http://localhost/api/chair/positions/99/addApplicant", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ user_id: 42 }),
			}),
			{ params: Promise.resolve({ position_id: "99" }) },
		);

		expect(response.status).toBe(200);
		expect(rpc).toHaveBeenCalledWith("upsert_cca_position_preference", {
			p_position_id: 99,
			p_user_id: 42,
			p_rank: 1,
		});
	});

	it("returns 400 when applicant already exists for this position", async () => {
		const rpc = vi.fn();
		mocks.createClient.mockResolvedValue(
			buildSupabaseStub({ rpc, existingApplicant: { rank: 2 } }),
		);

		const { POST } = await import("./route");
		const response = await POST(
			new Request("http://localhost/api/chair/positions/99/addApplicant", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ user_id: 42 }),
			}),
			{ params: Promise.resolve({ position_id: "99" }) },
		);

		expect(response.status).toBe(400);
		expect(rpc).not.toHaveBeenCalled();
	});
});
