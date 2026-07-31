import { describe, expect, it } from "vitest";
import { buildWeek, mergeContiguous, type ScheduleSlot } from "./schedule-grid";

function slot(p: Partial<ScheduleSlot>): ScheduleSlot {
	return {
		id: p.id ?? Math.floor((p.facility_id ?? 1) * 100 + (p.hour ?? 0)),
		facility_id: p.facility_id ?? 1,
		venue: p.venue ?? "Venue",
		sub_venue: p.sub_venue ?? "Court",
		type: p.type ?? "reboks",
		day_of_week: p.day_of_week ?? 1,
		hour: p.hour ?? 19,
		start_date: p.start_date ?? null,
		end_date: p.end_date ?? null,
	};
}

describe("buildWeek", () => {
	it("merges adjacent hours of the same slot into one block", () => {
		const week = buildWeek([
			slot({ facility_id: 1, day_of_week: 1, hour: 19 }),
			slot({ facility_id: 1, day_of_week: 1, hour: 20 }),
		]);
		const mon = week.days[1];
		expect(mon.clusters).toHaveLength(1);
		expect(mon.clusters[0]).toMatchObject({ startHour: 19, endHour: 21, total: 1 });
	});

	it("counts 8 concurrent slots in one cluster", () => {
		const slots = Array.from({ length: 8 }, (_, i) =>
			slot({
				facility_id: i + 1,
				sub_venue: `Court ${i + 1}`,
				day_of_week: 3,
				hour: 21,
			}),
		);
		const week = buildWeek(slots);
		const wed = week.days[3];
		expect(wed.clusters).toHaveLength(1);
		expect(wed.clusters[0].total).toBe(8);
	});

	it("returns all 7 day columns even when some are empty", () => {
		const week = buildWeek([slot({ day_of_week: 1 })]);
		expect(week.days).toHaveLength(7);
		expect(week.days[0].clusters).toEqual([]);
	});
});

describe("mergeContiguous", () => {
	it("merges a facility's contiguous hours into one window carrying all row ids", () => {
		const windows = mergeContiguous([
			slot({ id: 11, facility_id: 1, hour: 19 }),
			slot({ id: 12, facility_id: 1, hour: 20 }),
			slot({ id: 13, facility_id: 1, hour: 21 }),
		]);
		expect(windows).toHaveLength(1);
		expect(windows[0]).toMatchObject({ startHour: 19, endHour: 22 });
		expect(windows[0].hours).toEqual([19, 20, 21]);
		expect(windows[0].ids.sort()).toEqual([11, 12, 13]);
	});

	it("splits non-contiguous hours into separate windows", () => {
		const windows = mergeContiguous([
			slot({ id: 1, facility_id: 1, hour: 19 }),
			slot({ id: 2, facility_id: 1, hour: 20 }),
			slot({ id: 3, facility_id: 1, hour: 22 }),
		]);
		expect(windows.map((w) => [w.startHour, w.endHour])).toEqual([
			[19, 21],
			[22, 23],
		]);
	});

	it("keeps different facilities in separate windows", () => {
		const windows = mergeContiguous([
			slot({ id: 1, facility_id: 1, hour: 19 }),
			slot({ id: 2, facility_id: 2, hour: 19 }),
		]);
		expect(windows).toHaveLength(2);
	});

	it("keeps slots with different date bounds in separate windows", () => {
		const windows = mergeContiguous([
			slot({ id: 1, hour: 19, start_date: "2026-08-01", end_date: "2026-09-30" }),
			slot({ id: 2, hour: 20 }), // unbounded — must not merge with the bounded 19h row
		]);
		expect(windows).toHaveLength(2);
		const bounded = windows.find((w) => w.start_date === "2026-08-01");
		expect(bounded?.end_date).toBe("2026-09-30");
	});
});
