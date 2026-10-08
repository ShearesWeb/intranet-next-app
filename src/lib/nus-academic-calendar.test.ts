import { describe, expect, it } from "vitest";
import {
	addDays,
	getCurrentNusWeek,
	getNusWeekForDate,
	getSingaporeDateKey,
} from "@/lib/nus-academic-calendar";

describe("NUS academic calendar", () => {
	it("returns Semester 1 Week 8 with a Monday-to-Sunday range", () => {
		expect(getNusWeekForDate("2026-10-08")).toEqual({
			weekNumber: 8,
			start: "2026-10-05",
			end: "2026-10-11",
			dates: [
				"2026-10-05",
				"2026-10-06",
				"2026-10-07",
				"2026-10-08",
				"2026-10-09",
				"2026-10-10",
				"2026-10-11",
			],
		});
	});

	it("skips the Semester 1 recess week", () => {
		expect(getNusWeekForDate("2026-09-23")).toBeNull();
		expect(getNusWeekForDate("2026-09-28")?.weekNumber).toBe(7);
	});

	it("skips the Semester 2 recess week", () => {
		expect(getNusWeekForDate("2027-02-24")).toBeNull();
		expect(getNusWeekForDate("2027-03-01")?.weekNumber).toBe(7);
	});

	it("uses Singapore time to determine the current week", () => {
		const instant = new Date("2026-10-04T16:30:00.000Z");

		expect(getSingaporeDateKey(instant)).toBe("2026-10-05");
		expect(getCurrentNusWeek(instant)?.weekNumber).toBe(8);
	});

	it("adds days without depending on the machine timezone", () => {
		expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
	});
});
