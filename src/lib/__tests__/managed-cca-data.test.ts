import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	createClient: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
	createClient: mocks.createClient,
}));

type ManagedRowFixture = {
	cca_id: number;
	cca_name: string;
	positions: Array<{
		position_id: number;
		position_name: string;
		position_type: string;
		description: string | null;
	}>;
};

type CcaMetaFixture = {
	id: number;
	name: string;
	kind: string;
	description: string | null;
};

/**
 * `managed_cca_positions` is queried with a bare select; `ccas` is queried with
 * `.in("id", …)`. Route on table name rather than call order.
 */
function createSupabaseMock({
	managedRows = [],
	ccaRows = [],
	managedError = null,
}: {
	managedRows?: ManagedRowFixture[];
	ccaRows?: CcaMetaFixture[];
	managedError?: unknown;
} = {}) {
	const from = vi.fn((table: string) => {
		if (table === "managed_cca_positions") {
			return {
				select: vi.fn().mockResolvedValue({ data: managedRows, error: managedError }),
			};
		}
		if (table === "ccas") {
			return {
				select: vi.fn().mockReturnValue({
					in: vi.fn().mockResolvedValue({ data: ccaRows, error: null }),
				}),
			};
		}
		throw new Error(`unexpected table: ${table}`);
	});

	return { supabase: { from }, from };
}

const { getManagedCcaData } = await import("@/lib/managed-cca-data");

describe("getManagedCcaData", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("returns an empty array when the caller manages nothing", async () => {
		const { supabase, from } = createSupabaseMock({ managedRows: [] });

		const result = await getManagedCcaData(supabase as never);

		expect(result).toEqual([]);
		// No point querying `ccas` when there are no managed rows to enrich.
		expect(from).toHaveBeenCalledTimes(1);
	});

	it("returns transformed rows with the expected flattened shape", async () => {
		const { supabase } = createSupabaseMock({
			managedRows: [
				{
					cca_id: 7,
					cca_name: "Volleyball",
					positions: [
						{
							position_id: 70,
							position_name: "Captain",
							position_type: "lead",
							description: "Runs the team",
						},
					],
				},
			],
			ccaRows: [{ id: 7, name: "Volleyball", kind: "sports", description: "Spikes" }],
		});

		const result = await getManagedCcaData(supabase as never);

		expect(result).toHaveLength(1);
		expect(result[0]).toMatchObject({
			cca_id: 7,
			id: 7,
			name: "Volleyball",
			cca_kind: "sports",
			description: "Spikes",
			role: "Captain",
			position_type: "lead",
			can_manage_members: true,
		});
		expect(result[0].positions).toHaveLength(1);
	});

	it("includes a CCA the caller manages into but holds no appointment in", async () => {
		// reporting_position_id may cross CCAs, so the view is the authority and
		// the caller's own appointments are irrelevant here.
		const { supabase } = createSupabaseMock({
			managedRows: [
				{
					cca_id: 12,
					cca_name: "Basketball",
					positions: [
						{
							position_id: 120,
							position_name: "Captain",
							position_type: "lead",
							description: null,
						},
					],
				},
			],
			ccaRows: [{ id: 12, name: "Basketball", kind: "sports", description: null }],
		});

		const result = await getManagedCcaData(supabase as never);

		expect(result.map((r) => r.cca_id)).toEqual([12]);
	});

	it("falls back to the view's cca_name when metadata is missing", async () => {
		const { supabase } = createSupabaseMock({
			managedRows: [{ cca_id: 3, cca_name: "Choir", positions: [] }],
			ccaRows: [],
		});

		const result = await getManagedCcaData(supabase as never);

		expect(result[0].name).toBe("Choir");
		expect(result[0].cca_kind).toBe("committee");
		expect(result[0].can_manage_members).toBe(false);
	});

	it("sorts the resulting CCAs alphabetically by name", async () => {
		const { supabase } = createSupabaseMock({
			managedRows: [
				{ cca_id: 1, cca_name: "Zumba", positions: [] },
				{ cca_id: 2, cca_name: "Archery", positions: [] },
				{ cca_id: 3, cca_name: "Muay Thai", positions: [] },
			],
			ccaRows: [
				{ id: 1, name: "Zumba", kind: "sports", description: null },
				{ id: 2, name: "Archery", kind: "sports", description: null },
				{ id: 3, name: "Muay Thai", kind: "sports", description: null },
			],
		});

		const result = await getManagedCcaData(supabase as never);

		expect(result.map((r) => r.name)).toEqual(["Archery", "Muay Thai", "Zumba"]);
	});

	it("propagates a view error rather than silently returning nothing", async () => {
		const { supabase } = createSupabaseMock({ managedError: { message: "boom" } });

		await expect(getManagedCcaData(supabase as never)).rejects.toBeTruthy();
	});
});
