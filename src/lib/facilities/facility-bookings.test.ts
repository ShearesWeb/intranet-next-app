import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ createClient: vi.fn() }));

vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));

describe("expandWeekly", () => {
	it("returns only dates in range whose weekday matches", async () => {
		const { expandWeekly } = await import("./facility-bookings");
		const dates = expandWeekly("2026-06-01", "2026-06-21", 1); // Mondays
		expect(dates.length).toBeGreaterThan(0);
		for (const d of dates) {
			expect(new Date(d + "T00:00:00").getDay()).toBe(1);
			expect(d >= "2026-06-01" && d <= "2026-06-21").toBe(true);
		}
	});
});

describe("ensureBookingsForWindow", () => {
	beforeEach(() => vi.clearAllMocks());

	function stub(schedules: unknown[], createdIds: { id: number }[]) {
		const upsert = vi.fn(() => ({ select: vi.fn().mockResolvedValue({ data: createdIds, error: null }) }));
		const neq = vi.fn().mockResolvedValue({ data: schedules, error: null });
		const select = vi.fn(() => ({ neq }));
		const client = {
			from: vi.fn((table: string) =>
				table === "booking_schedules" ? { select } : { upsert },
			),
			_upsert: upsert,
			_neq: neq,
		};
		return client;
	}

	it("excludes REBOKS by filtering the schedule query on facilities.type", async () => {
		const client = stub([], []);
		mocks.createClient.mockResolvedValue(client);
		const { ensureBookingsForWindow } = await import("./facility-bookings");

		await ensureBookingsForWindow("2026-06-01", "2026-06-21");

		expect(client._neq).toHaveBeenCalledWith("facilities.type", "reboks");
	});

	it("materialises one row per matching date and returns the created count", async () => {
		const client = stub(
			[{ facility_id: 7, day_of_week: 1, hour: 19 }],
			[{ id: 1 }, { id: 2 }, { id: 3 }],
		);
		mocks.createClient.mockResolvedValue(client);
		const { ensureBookingsForWindow, expandWeekly } = await import("./facility-bookings");

		const result = await ensureBookingsForWindow("2026-06-01", "2026-06-21");

		const expectedDates = expandWeekly("2026-06-01", "2026-06-21", 1);
		const [rows, opts] = client._upsert.mock.calls[0];
		expect(rows).toEqual(
			expectedDates.map((booked_date) => ({ facility_id: 7, booked_date, hour: 19 })),
		);
		expect(opts).toMatchObject({ onConflict: "facility_id,booked_date,hour", ignoreDuplicates: true });
		expect(result.created).toBe(3);
	});

	it("does not upsert when there are no non-REBOKS schedules", async () => {
		const client = stub([], []);
		mocks.createClient.mockResolvedValue(client);
		const { ensureBookingsForWindow } = await import("./facility-bookings");

		const result = await ensureBookingsForWindow("2026-06-01", "2026-06-21");

		expect(client._upsert).not.toHaveBeenCalled();
		expect(result.created).toBe(0);
	});
});
