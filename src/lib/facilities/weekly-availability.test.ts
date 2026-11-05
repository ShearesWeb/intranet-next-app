import { describe, expect, it } from "vitest";
import { columnOfHour } from "@/lib/facilities/booking-grid";
import {
	cellsFromWeekGrid,
	emptyWeekGrid,
	isFacilityHidden,
	summarizeRow,
	summarizeWeek,
	weekGridFromSchedules,
} from "@/lib/facilities/weekly-availability";
import { FacilitySchedule } from "@/types/facilities";

const TODAY = "2026-11-04";

function row(dayOfWeek: number, hour: number, endDate: string | null = null): FacilitySchedule {
	return {
		id: dayOfWeek * 100 + hour,
		facility_id: 1,
		day_of_week: dayOfWeek,
		hour,
		start_date: null,
		end_date: endDate,
	};
}

describe("isFacilityHidden", () => {
	it("is hidden only when it has hours and all are end-dated in the past", () => {
		expect(isFacilityHidden([row(1, 18, "2026-11-03"), row(1, 19, "2026-11-03")], TODAY)).toBe(
			true,
		);
		expect(isFacilityHidden([row(1, 18, "2026-11-03"), row(1, 19)], TODAY)).toBe(false);
		expect(isFacilityHidden([row(1, 18, TODAY)], TODAY)).toBe(false);
		expect(isFacilityHidden([], TODAY)).toBe(false);
	});
});

describe("weekGridFromSchedules", () => {
	it("puts Monday first and Sunday last", () => {
		const grid = weekGridFromSchedules([row(1, 18), row(0, 8)], TODAY);
		expect(grid[0][columnOfHour(18)]).toBe(true);
		expect(grid[6][columnOfHour(8)]).toBe(true);
	});

	it("keeps a hidden venue's hours so reopening restores them", () => {
		const grid = weekGridFromSchedules([row(1, 18, "2026-11-03")], TODAY);
		expect(grid[0][columnOfHour(18)]).toBe(true);
	});

	it("drops a single expired row on a venue that is still open", () => {
		const grid = weekGridFromSchedules([row(1, 18, "2026-11-03"), row(1, 19)], TODAY);
		expect(grid[0][columnOfHour(18)]).toBe(false);
		expect(grid[0][columnOfHour(19)]).toBe(true);
	});

	it("ignores hours outside the booking day", () => {
		const grid = weekGridFromSchedules([row(1, 4)], TODAY);
		expect(grid.flat().some(Boolean)).toBe(false);
	});
});

describe("cellsFromWeekGrid", () => {
	it("round-trips through the DB weekday numbering", () => {
		const grid = weekGridFromSchedules([row(1, 18), row(0, 1), row(6, 23)], TODAY);
		expect(cellsFromWeekGrid(grid)).toEqual(
			expect.arrayContaining([
				{ day: 1, hour: 18 },
				{ day: 0, hour: 1 },
				{ day: 6, hour: 23 },
			]),
		);
		expect(cellsFromWeekGrid(grid)).toHaveLength(3);
	});
});

describe("summaries", () => {
	it("describes a row's open spans", () => {
		const grid = emptyWeekGrid();
		grid[0][columnOfHour(16)] = true;
		grid[0][columnOfHour(17)] = true;
		grid[0][columnOfHour(23)] = true;
		grid[0][columnOfHour(0)] = true;
		grid[0][columnOfHour(1)] = true;
		expect(summarizeRow(grid[0])).toBe("4–6 PM, 11 PM – 2 AM");
		expect(summarizeRow(grid[1])).toBe("");
	});

	it("collapses identical days", () => {
		const grid = emptyWeekGrid();
		for (let day = 0; day < 5; day++) grid[day][columnOfHour(18)] = true;
		grid[5][columnOfHour(8)] = true;
		expect(summarizeWeek(grid)).toBe("Mon–Fri 6–7 PM · Sat 8–9 AM");
	});

	it("says when nothing is set", () => {
		expect(summarizeWeek(emptyWeekGrid())).toBe("No hours set");
	});
});
