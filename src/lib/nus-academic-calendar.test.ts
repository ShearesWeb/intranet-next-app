import { describe, expect, it } from "vitest";
import {
	addDays,
	getBookingWeeks,
	getCurrentNusWeek,
	getMondayOf,
	getNusWeekForDate,
	getSingaporeDateKey,
	getSingaporeHour,
	isWithinBookingWindow,
} from "@/lib/nus-academic-calendar";

describe("booking window", () => {
	const weekNumbers = (iso: string) =>
		getBookingWeeks(new Date(iso)).map((week) => week.weekNumber);

	it("offers four weeks starting from this one mid-term", () => {
		expect(weekNumbers("2026-10-07T04:00:00Z")).toEqual([8, 9, 10, 11]);
	});

	it("stops at the end of teaching", () => {
		expect(weekNumbers("2026-11-04T04:00:00Z")).toEqual([12, 13]);
	});

	it("skips recess week but keeps the teaching weeks after it", () => {
		expect(weekNumbers("2026-09-16T04:00:00Z")).toEqual([6, 7, 8]);
	});

	it("opens next week's bookings during recess", () => {
		expect(weekNumbers("2026-09-23T04:00:00Z")).toEqual([7, 8, 9]);
	});

	it("is empty in the vacation", () => {
		expect(weekNumbers("2026-12-15T04:00:00Z")).toEqual([]);
	});

	it("uses the Singapore date near midnight", () => {
		// 16:30 UTC on Sunday 8 Nov is already Monday 9 Nov in Singapore.
		expect(getBookingWeeks(new Date("2026-11-08T16:30:00Z"))[0].weekNumber).toBe(13);
	});

	it("accepts dates in an offered week only", () => {
		const now = new Date("2026-10-07T04:00:00Z");
		expect(isWithinBookingWindow("2026-10-05", now)).toBe(true);
		expect(isWithinBookingWindow("2026-11-01", now)).toBe(true);
		expect(isWithinBookingWindow("2026-11-02", now)).toBe(false);
		expect(isWithinBookingWindow("2026-09-23", new Date("2026-09-16T04:00:00Z"))).toBe(false);
	});

	it("finds the Monday of a week", () => {
		expect(getMondayOf("2026-11-04")).toBe("2026-11-02");
		expect(getMondayOf("2026-11-02")).toBe("2026-11-02");
		expect(getMondayOf("2026-11-08")).toBe("2026-11-02");
	});

	it("reads the hour in Singapore", () => {
		expect(getSingaporeHour(new Date("2026-11-04T06:00:00Z"))).toBe(14);
		expect(getSingaporeHour(new Date("2026-11-04T16:30:00Z"))).toBe(0);
	});
});

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
