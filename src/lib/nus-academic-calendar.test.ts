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
	const weekLabels = (iso: string) => getBookingWeeks(new Date(iso)).map((week) => week.label);

	it("offers four weeks starting from this one mid-term", () => {
		expect(weekLabels("2026-10-07T04:00:00Z")).toEqual(["Week 8", "Week 9", "Week 10", "Week 11"]);
	});

	it("carries on from teaching into reading week and exams", () => {
		expect(weekLabels("2026-11-04T04:00:00Z")).toEqual([
			"Week 12",
			"Week 13",
			"Reading Week",
			"Exam Week 1",
		]);
	});

	it("stops at the end of the semester", () => {
		expect(weekLabels("2026-11-25T04:00:00Z")).toEqual(["Exam Week 1", "Exam Week 2"]);
	});

	it("opens the next semester four weeks before it starts", () => {
		expect(weekLabels("2026-12-20T04:00:00Z")).toEqual([]);
		expect(weekLabels("2026-12-21T04:00:00Z")).toEqual(["Week 1"]);
	});

	it("includes recess week", () => {
		expect(weekLabels("2026-09-16T04:00:00Z")).toEqual([
			"Week 6",
			"Recess Week",
			"Week 7",
			"Week 8",
		]);
		expect(weekLabels("2026-09-23T04:00:00Z")).toEqual([
			"Recess Week",
			"Week 7",
			"Week 8",
			"Week 9",
		]);
	});

	it("is empty in the vacation", () => {
		expect(weekLabels("2026-12-15T04:00:00Z")).toEqual([]);
	});

	it("uses the Singapore date near midnight", () => {
		// 16:30 UTC on Sunday 8 Nov is already Monday 9 Nov in Singapore.
		expect(getBookingWeeks(new Date("2026-11-08T16:30:00Z"))[0].label).toBe("Week 13");
	});

	it("accepts dates in an offered week only", () => {
		const now = new Date("2026-10-07T04:00:00Z");
		expect(isWithinBookingWindow("2026-10-05", now)).toBe(true);
		expect(isWithinBookingWindow("2026-11-01", now)).toBe(true);
		expect(isWithinBookingWindow("2026-11-02", now)).toBe(false);
		expect(isWithinBookingWindow("2026-09-23", new Date("2026-09-16T04:00:00Z"))).toBe(true);
		expect(isWithinBookingWindow("2026-12-15", new Date("2026-12-01T04:00:00Z"))).toBe(false);
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
			label: "Week 8",
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

	it("includes the Semester 1 recess week", () => {
		expect(getNusWeekForDate("2026-09-23")?.label).toBe("Recess Week");
		expect(getNusWeekForDate("2026-09-28")?.label).toBe("Week 7");
	});

	it("includes the Semester 2 recess week", () => {
		expect(getNusWeekForDate("2027-02-24")?.label).toBe("Recess Week");
		expect(getNusWeekForDate("2027-03-01")?.label).toBe("Week 7");
	});

	it("covers reading week and exams up to the end of each semester", () => {
		expect(getNusWeekForDate("2026-11-16")?.label).toBe("Reading Week");
		expect(getNusWeekForDate("2026-11-23")?.label).toBe("Exam Week 1");
		expect(getNusWeekForDate("2026-12-05")?.label).toBe("Exam Week 2");
		expect(getNusWeekForDate("2026-12-07")).toBeNull();
		expect(getNusWeekForDate("2027-04-19")?.label).toBe("Reading Week");
		expect(getNusWeekForDate("2027-04-26")?.label).toBe("Exam Week 1");
		expect(getNusWeekForDate("2027-05-08")?.label).toBe("Exam Week 2");
		expect(getNusWeekForDate("2027-05-10")).toBeNull();
	});

	it("uses Singapore time to determine the current week", () => {
		const instant = new Date("2026-10-04T16:30:00.000Z");

		expect(getSingaporeDateKey(instant)).toBe("2026-10-05");
		expect(getCurrentNusWeek(instant)?.label).toBe("Week 8");
	});

	it("adds days without depending on the machine timezone", () => {
		expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
	});
});
