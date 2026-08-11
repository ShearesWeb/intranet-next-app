import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ createClient: vi.fn() }));

vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));

function updateStub(result: { data: unknown; error: unknown }) {
	const single = vi.fn().mockResolvedValue(result);
	const select = vi.fn(() => ({ single }));
	const eq = vi.fn(() => ({ select }));
	const update = vi.fn(() => ({ eq }));
	return { from: vi.fn(() => ({ update })), _update: update, _eq: eq };
}

describe("facility-catalog writes", () => {
	beforeEach(() => vi.clearAllMocks());

	it("updateFacility patches the given fields by id and returns the row", async () => {
		const updated = { id: 3, venue: "Pool", sub_venue: "Lane 1", type: "external" };
		const stub = updateStub({ data: updated, error: null });
		mocks.createClient.mockResolvedValue(stub);
		const { updateFacility } = await import("./facility-catalog");

		const result = await updateFacility(3, { venue: "Pool" });

		expect(result).toEqual(updated);
		expect(stub._update).toHaveBeenCalledWith({ venue: "Pool" });
		expect(stub._eq).toHaveBeenCalledWith("id", 3);
	});
});
