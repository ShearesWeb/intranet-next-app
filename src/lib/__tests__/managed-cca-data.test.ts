import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthenticatedUser } from "@/types/User";

const mocks = vi.hoisted(() => ({
	createClient: vi.fn(),
	isChairPositionType: vi.fn(),
}));

vi.mock("@/utils/supabase/server", () => ({
	createClient: mocks.createClient,
}));

vi.mock("@/lib/cca-chair-access", () => ({
	isChairPositionType: mocks.isChairPositionType,
}));

type ManagedRowFixture = {
	cca_id: number;
	cca_name: string;
	positions: Array<{
		position_id: number;
		position_name: string;
		position_type: string;
		description: string | null;
		access_depth: number;
	}>;
};

type CcaMetaFixture = {
	id: number;
	name: string;
	cca_type: string;
	description: string | null;
};

function createSupabaseMock({
	managedRows = [],
	ccaRows = [],
}: {
	managedRows?: ManagedRowFixture[];
	ccaRows?: CcaMetaFixture[];
} = {}) {
	const managedSelect = vi.fn().mockResolvedValue({ data: managedRows, error: null });
	const ccaIn = vi.fn().mockResolvedValue({ data: ccaRows, error: null });
	const ccaSelect = vi.fn().mockReturnValue({ in: ccaIn });

	const supabase = {
		from: vi.fn((table: string) => {
			if (table === "managed_cca_positions") {
				return { select: managedSelect };
			}

			if (table === "ccas") {
				return { select: ccaSelect };
			}

			throw new Error(`Unexpected table: ${table}`);
		}),
	};

	return { supabase, managedSelect, ccaSelect, ccaIn };
}

function createUser(appointments: AuthenticatedUser["appointments"] = []): AuthenticatedUser {
	return {
		id: 1,
		name: "Alex Chair",
		display_name: "Alex Chair",
		room: "A101",
		email: "alex@example.com",
		points: 12,
		profile_photo_url: null,
		is_admin: false,
		is_jcrc: true,
		is_culture_sports_admin: false,
		appointments,
	};
}

describe("getManagedCcaData", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.isChairPositionType.mockImplementation(
			(positionType?: string | null) => positionType === "lead" || positionType === "vice",
		);
	});

	it("returns an empty array when there are no chair appointments and no managed rows", async () => {
		const { supabase, managedSelect, ccaSelect } = createSupabaseMock();

		const { getManagedCcaData } = await import("../managed-cca-data");
		const result = await getManagedCcaData(supabase as never, createUser());

		expect(result).toEqual([]);
		expect(managedSelect).toHaveBeenCalledWith("*");
		expect(ccaSelect).not.toHaveBeenCalled();
	});

	it("returns transformed rows with the expected flattened shape", async () => {
		const { supabase } = createSupabaseMock({
			managedRows: [
				{
					cca_id: 10,
					cca_name: "Debate Society",
					positions: [
						{
							position_id: 7,
							position_name: "Secretary",
							position_type: "member",
							description: "Handles records",
							access_depth: 2,
						},
					],
				},
			],
			ccaRows: [
				{
					id: 10,
					name: "Debate Society",
					cca_type: "culture",
					description: "Public speaking club",
				},
			],
		});

		const { getManagedCcaData } = await import("../managed-cca-data");
		const result = await getManagedCcaData(supabase as never, createUser());

		expect(result).toEqual([
			{
				cca_id: 10,
				cca_name: "Debate Society",
				positions: [
					{
						position_id: 7,
						position_name: "Secretary",
						position_type: "member",
						description: "Handles records",
						access_depth: 2,
					},
				],
				id: 10,
				name: "Debate Society",
				role: "Secretary",
				position_type: "member",
				cca_type: "culture",
				description: "Public speaking club",
				points: 0,
				can_manage_members: true,
				can_rank_members: true,
			},
		]);
	});

	it("sorts the resulting CCAs alphabetically by name", async () => {
		const { supabase } = createSupabaseMock({
			managedRows: [
				{
					cca_id: 2,
					cca_name: "Zulu Club",
					positions: [
						{
							position_id: 2,
							position_name: "Member Lead",
							position_type: "member",
							description: null,
							access_depth: 1,
						},
					],
				},
				{
					cca_id: 1,
					cca_name: "Alpha Club",
					positions: [
						{
							position_id: 1,
							position_name: "Member Lead",
							position_type: "member",
							description: null,
							access_depth: 1,
						},
					],
				},
			],
			ccaRows: [
				{ id: 1, name: "Alpha Club", cca_type: "culture", description: null },
				{ id: 2, name: "Zulu Club", cca_type: "sports", description: null },
			],
		});

		const { getManagedCcaData } = await import("../managed-cca-data");
		const result = await getManagedCcaData(supabase as never, createUser());

		expect(result.map((row) => row.name)).toEqual(["Alpha Club", "Zulu Club"]);
	});

	it("merges chair appointments with managed rows from the view", async () => {
		const { supabase } = createSupabaseMock({
			managedRows: [
				{
					cca_id: 20,
					cca_name: "Robotics",
					positions: [
						{
							position_id: 11,
							position_name: "Treasurer",
							position_type: "member",
							description: null,
							access_depth: 3,
						},
					],
				},
			],
			ccaRows: [
				{ id: 20, name: "Robotics", cca_type: "culture", description: "Build bots" },
				{ id: 30, name: "Basketball", cca_type: "sports", description: "Play ball" },
			],
		});

		const user = createUser([
			{
				cca_id: 30,
				cca_name: "Basketball",
				position_id: 3,
				position_name: "Chair",
				position_type: "lead",
				points: 5,
				is_admin: false,
			},
		]);

		const { getManagedCcaData } = await import("../managed-cca-data");
		const result = await getManagedCcaData(supabase as never, user);

		expect(result.map((row) => row.cca_id)).toEqual([30, 20]);
		expect(result.find((row) => row.cca_id === 30)).toMatchObject({
			name: "Basketball",
			role: "Chair",
			position_type: "lead",
			positions: [],
			can_manage_members: true,
			can_rank_members: false,
		});
		expect(result.find((row) => row.cca_id === 20)).toMatchObject({
			name: "Robotics",
			role: "Treasurer",
			can_manage_members: true,
			can_rank_members: true,
		});
	});
});
