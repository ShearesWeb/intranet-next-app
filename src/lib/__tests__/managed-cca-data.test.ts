import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthenticatedUser } from "@/types/user";

const mocks = vi.hoisted(() => ({
	createClient: vi.fn(),
	isChairPositionType: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
	createClient: mocks.createClient,
}));

vi.mock("@/lib/cca/cca-chair-access", () => ({
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

type AppointmentFixture = {
	user_id: number;
	position_id: number;
	cut_status: string | null;
	cca_positions: { cca_id: number; position_type: string | null };
};

type EvaluationFixture = {
	user_id: number;
	position_id: number;
	scores: unknown;
};

function createSupabaseMock({
	managedRows = [],
	ccaRows = [],
	appointmentRows = [],
	evaluationRows = [],
}: {
	managedRows?: ManagedRowFixture[];
	ccaRows?: CcaMetaFixture[];
	appointmentRows?: AppointmentFixture[];
	evaluationRows?: EvaluationFixture[];
} = {}) {
	const managedSelect = vi.fn().mockResolvedValue({ data: managedRows, error: null });
	const ccaIn = vi.fn().mockResolvedValue({ data: ccaRows, error: null });
	const ccaSelect = vi.fn().mockReturnValue({ in: ccaIn });
	const appointmentsIn = vi.fn().mockResolvedValue({ data: appointmentRows, error: null });
	const appointmentsSelect = vi.fn().mockReturnValue({ in: appointmentsIn });
	const evaluationsIn = vi.fn().mockResolvedValue({ data: evaluationRows, error: null });
	const evaluationsSelect = vi.fn().mockReturnValue({ in: evaluationsIn });

	const supabase = {
		from: vi.fn((table: string) => {
			if (table === "managed_cca_positions") {
				return { select: managedSelect };
			}

			if (table === "ccas") {
				return { select: ccaSelect };
			}

			if (table === "cca_appointments") {
				return { select: appointmentsSelect };
			}

			if (table === "cca_appointment_evaluations") {
				return { select: evaluationsSelect };
			}

			throw new Error(`Unexpected table: ${table}`);
		}),
	};

	return { supabase, managedSelect, ccaSelect, ccaIn, appointmentsIn, evaluationsIn };
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
				can_manage_members: false,
				can_rank_members: true,
				ranking_progress: { ranked: 0, total: 0 },
			},
		]);
	});

	it("computes ranking progress from appointments and evaluations", async () => {
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
							description: null,
							access_depth: 2,
						},
					],
				},
			],
			ccaRows: [{ id: 10, name: "Debate Society", cca_type: "culture", description: null }],
			appointmentRows: [
				{
					user_id: 1,
					position_id: 7,
					cut_status: null,
					cca_positions: { cca_id: 10, position_type: "member" },
				},
				{
					user_id: 2,
					position_id: 7,
					cut_status: null,
					cca_positions: { cca_id: 10, position_type: "member" },
				},
			],
			evaluationRows: [
				{ user_id: 1, position_id: 7, scores: { attendance: 8, performance: 7 } },
				{ user_id: 2, position_id: 7, scores: { attendance: 8 } },
			],
		});

		const { getManagedCcaData } = await import("../managed-cca-data");
		const result = await getManagedCcaData(supabase as never, createUser());

		expect(result[0].ranking_progress).toEqual({ ranked: 1, total: 2 });
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
				commitment_period: "full-year",
				cut_status: null,
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
			can_manage_members: false,
			can_rank_members: true,
		});
	});
});
