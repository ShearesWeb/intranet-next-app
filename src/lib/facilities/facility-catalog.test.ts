import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ createClient: vi.fn() }));

vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));

function insertStub(result: { data: unknown; error: unknown }) {
	const single = vi.fn().mockResolvedValue(result);
	const select = vi.fn(() => ({ single }));
	const insert = vi.fn(() => ({ select }));
	return { from: vi.fn(() => ({ insert })), _insert: insert };
}

function updateStub(result: { data: unknown; error: unknown }) {
	const single = vi.fn().mockResolvedValue(result);
	const select = vi.fn(() => ({ single }));
	const eq = vi.fn(() => ({ select }));
	const update = vi.fn(() => ({ eq }));
	return { from: vi.fn(() => ({ update })), _update: update, _eq: eq };
}

describe("facility-catalog writes", () => {
	beforeEach(() => vi.clearAllMocks());

	it("createFacility rejects reboks before touching the DB", async () => {
		const stub = insertStub({ data: null, error: null });
		mocks.createClient.mockResolvedValue(stub);
		const { createFacility } = await import("./facility-catalog");

		await expect(
			createFacility({ type: "reboks", venue: "X", sub_venue: "Y" }),
		).rejects.toMatchObject({ statusCode: 400 });
		expect(stub.from).not.toHaveBeenCalled();
	});

	it("createFacility inserts an active row and returns it for a non-reboks type", async () => {
		const created = { id: 9, venue: "MPH", sub_venue: "MPH", type: "sheares", active: true };
		const stub = insertStub({ data: created, error: null });
		mocks.createClient.mockResolvedValue(stub);
		const { createFacility } = await import("./facility-catalog");

		const result = await createFacility({ type: "sheares", venue: "MPH", sub_venue: "MPH" });

		expect(result).toEqual(created);
		expect(stub._insert).toHaveBeenCalledWith({
			venue: "MPH",
			sub_venue: "MPH",
			type: "sheares",
			active: true,
		});
	});

	it("createFacility maps a unique (venue, sub_venue) violation to 409", async () => {
		const stub = insertStub({ data: null, error: { code: "23505" } });
		mocks.createClient.mockResolvedValue(stub);
		const { createFacility } = await import("./facility-catalog");

		await expect(createFacility({ type: "nus", venue: "A", sub_venue: "B" })).rejects.toMatchObject(
			{ statusCode: 409 },
		);
	});

	it("updateFacility patches the given fields by id and returns the row", async () => {
		const updated = { id: 3, venue: "Pool", sub_venue: "Lane 1", type: "external", active: false };
		const stub = updateStub({ data: updated, error: null });
		mocks.createClient.mockResolvedValue(stub);
		const { updateFacility } = await import("./facility-catalog");

		const result = await updateFacility(3, { active: false });

		expect(result).toEqual(updated);
		expect(stub._update).toHaveBeenCalledWith({ active: false });
		expect(stub._eq).toHaveBeenCalledWith("id", 3);
	});
});
