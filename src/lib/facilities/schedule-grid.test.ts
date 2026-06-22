import { describe, expect, it } from "vitest";
import { buildWeek, waveColor, type ScheduleSlot } from "./schedule-grid";

function slot(p: Partial<ScheduleSlot>): ScheduleSlot {
	return {
		id: p.id ?? Math.floor((p.facility_id ?? 1) * 100 + (p.hour ?? 0)),
		facility_id: p.facility_id ?? 1,
		venue: p.venue ?? "Venue",
		sub_venue: p.sub_venue ?? "Court",
		type: p.type ?? "reboks",
		day_of_week: p.day_of_week ?? 1,
		hour: p.hour ?? 19,
		priority: p.priority ?? 0,
		reboks_activity: p.reboks_activity ?? null,
	};
}

describe("waveColor", () => {
	it("ramps red → green by rank and wraps deterministically", () => {
		expect(waveColor(0)).toBe("#ef4444");
		expect(waveColor(3)).toBe("#22c55e");
		expect(waveColor(6)).toBe(waveColor(0)); // wraps
	});
});

describe("buildWeek", () => {
	it("merges adjacent hours of the same slot into one block", () => {
		const week = buildWeek([
			slot({ facility_id: 1, day_of_week: 1, hour: 19, priority: 0 }),
			slot({ facility_id: 1, day_of_week: 1, hour: 20, priority: 0 }),
		]);
		const mon = week.days[1];
		expect(mon.clusters).toHaveLength(1);
		expect(mon.clusters[0]).toMatchObject({ startHour: 19, endHour: 21 });
		expect(mon.clusters[0].waves).toHaveLength(1);
		expect(mon.clusters[0].waves[0].count).toBe(1);
	});

	it("groups 8 concurrent slots of one wave into a single bucket with count 8", () => {
		const slots = Array.from({ length: 8 }, (_, i) =>
			slot({ facility_id: i + 1, sub_venue: `Court ${i + 1}`, day_of_week: 3, hour: 21, priority: 0 }),
		);
		const week = buildWeek(slots);
		const wed = week.days[3];
		expect(wed.clusters).toHaveLength(1);
		expect(wed.clusters[0].total).toBe(8);
		expect(wed.clusters[0].waves).toHaveLength(1);
		expect(wed.clusters[0].waves[0].count).toBe(8);
	});

	it("splits a cluster into per-wave buckets sorted by priority", () => {
		const week = buildWeek([
			slot({ facility_id: 1, day_of_week: 3, hour: 21, priority: 0 }),
			slot({ facility_id: 2, day_of_week: 3, hour: 21, priority: 0 }),
			slot({ facility_id: 3, day_of_week: 3, hour: 21, priority: 2 }),
		]);
		const cluster = week.days[3].clusters[0];
		expect(cluster.waves.map((w) => w.priority)).toEqual([0, 2]);
		expect(cluster.waves.map((w) => w.count)).toEqual([2, 1]);
	});

	it("ranks distinct priorities into 1-based waves with colours", () => {
		const week = buildWeek([
			slot({ facility_id: 1, priority: 2 }),
			slot({ facility_id: 2, priority: 0 }),
		]);
		expect(week.waves).toEqual([
			{ priority: 0, wave: 1, color: "#ef4444" },
			{ priority: 2, wave: 2, color: "#f97316" },
		]);
	});

	it("returns all 7 day columns even when some are empty", () => {
		const week = buildWeek([slot({ day_of_week: 1 })]);
		expect(week.days).toHaveLength(7);
		expect(week.days[0].clusters).toEqual([]);
	});
});
