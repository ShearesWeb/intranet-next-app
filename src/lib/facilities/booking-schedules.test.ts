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

describe("booking-schedules writes", () => {
	beforeEach(() => vi.clearAllMocks());

	it("createSchedule passes priority + reboks_activity through", async () => {
		const row = {
			id: 1,
			facility_id: 2,
			day_of_week: 1,
			hour: 19,
			priority: 1,
			reboks_activity: "Tennis",
		};
		const stub = insertStub({ data: row, error: null });
		mocks.createClient.mockResolvedValue(stub);
		const { createSchedule } = await import("./booking-schedules");

		const result = await createSchedule({
			facilityId: 2,
			dayOfWeek: 1,
			hour: 19,
			priority: 1,
			reboksActivity: "Tennis",
		});

		expect(result).toEqual(row);
		expect(stub._insert).toHaveBeenCalledWith({
			facility_id: 2,
			day_of_week: 1,
			hour: 19,
			priority: 1,
			reboks_activity: "Tennis",
		});
	});

	it("createSchedule defaults priority to 100 and activity to null", async () => {
		const stub = insertStub({ data: {}, error: null });
		mocks.createClient.mockResolvedValue(stub);
		const { createSchedule } = await import("./booking-schedules");

		await createSchedule({ facilityId: 5, dayOfWeek: 3, hour: 21 });

		expect(stub._insert).toHaveBeenCalledWith({
			facility_id: 5,
			day_of_week: 3,
			hour: 21,
			priority: 100,
			reboks_activity: null,
		});
	});

	it("createSchedule maps a unique (facility, day, hour) clash to 409", async () => {
		const stub = insertStub({ data: null, error: { code: "23505" } });
		mocks.createClient.mockResolvedValue(stub);
		const { createSchedule } = await import("./booking-schedules");

		await expect(
			createSchedule({ facilityId: 2, dayOfWeek: 1, hour: 19 }),
		).rejects.toMatchObject({ statusCode: 409 });
	});

	it("updateSchedule patches priority/activity by id", async () => {
		const row = {
			id: 7,
			facility_id: 2,
			day_of_week: 1,
			hour: 19,
			priority: 2,
			reboks_activity: "Squash",
		};
		const stub = updateStub({ data: row, error: null });
		mocks.createClient.mockResolvedValue(stub);
		const { updateSchedule } = await import("./booking-schedules");

		const result = await updateSchedule(7, { priority: 2, reboks_activity: "Squash" });

		expect(result).toEqual(row);
		expect(stub._update).toHaveBeenCalledWith({ priority: 2, reboks_activity: "Squash" });
		expect(stub._eq).toHaveBeenCalledWith("id", 7);
	});
});
