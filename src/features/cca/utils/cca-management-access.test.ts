import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	checkCcaAuthorization: vi.fn(),
}));

vi.mock("@/features/cca/utils/cca-chair-access", () => ({
	checkCcaAuthorization: mocks.checkCcaAuthorization,
}));

type MaybeSingleResult = {
	data: unknown;
	error: unknown;
};

function createSupabaseMock(result: MaybeSingleResult) {
	const maybeSingle = vi.fn().mockResolvedValue(result);
	const eq = vi.fn().mockReturnValue({ maybeSingle });
	const select = vi.fn().mockReturnValue({ eq });

	return {
		supabase: {
			from: vi.fn(() => ({ select })),
		},
		select,
		eq,
		maybeSingle,
	};
}

describe("getManagedCcaAccess", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.checkCcaAuthorization.mockReturnValue({
			ok: true,
			data: {
				hasChairAccess: false,
				authorizedCcaIds: [],
				userId: 1,
			},
		});
	});

	it("denies member-management access when the user only has managed ranking positions", async () => {
		const { supabase } = createSupabaseMock({
			data: {
				cca_id: 12,
				cca_name: "Debate Society",
				positions: [{ position_id: 7 }],
			},
			error: null,
		});

		const { getManagedCcaAccess } = await import("./cca-management-access");
		const result = await getManagedCcaAccess({
			supabase: supabase as never,
			requestingUser: { id: 1, appointments: [] },
			cca: { id: 12, name: "Debate Society", cca_type: "culture" },
			accessLevel: "manage_members",
		});

		expect(result).toEqual({
			ok: false,
			status: 403,
			error: "You are not authorized to manage this CCA",
		});
	});

	it("allows ranking access when the user has managed ranking positions", async () => {
		const { supabase } = createSupabaseMock({
			data: {
				cca_id: 12,
				cca_name: "Debate Society",
				positions: [{ position_id: 7 }, { position_id: 8 }],
			},
			error: null,
		});

		const { getManagedCcaAccess } = await import("./cca-management-access");
		const result = await getManagedCcaAccess({
			supabase: supabase as never,
			requestingUser: { id: 1, appointments: [] },
			cca: { id: 12, name: "Debate Society", cca_type: "culture" },
			accessLevel: "rank_members",
		});

		expect(result).toEqual({
			ok: true,
			data: {
				hasChairAccess: false,
				hasManagedRankingAccess: true,
				managedPositionIds: [7, 8],
				managedCca: {
					cca_id: 12,
					cca_name: "Debate Society",
					positions: [{ position_id: 7 }, { position_id: 8 }],
				},
			},
		});
	});
});
