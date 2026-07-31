import { describe, expect, it } from "vitest";
import {
	formatDateKey,
	formatDisplayDate,
	getDaysInMonth,
	getFirstDayOfMonth,
	getMonthLabel,
	getMonthRange,
} from "./date";

describe("date helpers", () => {
	it("counts days, handling leap years", () => {
		expect(getDaysInMonth(2026, 0)).toBe(31);
		expect(getDaysInMonth(2026, 1)).toBe(28);
		expect(getDaysInMonth(2028, 1)).toBe(29);
	});

	it("returns the weekday of the 1st", () => {
		// 1 July 2026 is a Wednesday
		expect(getFirstDayOfMonth(2026, 6)).toBe(3);
	});

	it("zero-pads date keys", () => {
		expect(formatDateKey(2026, 0, 5)).toBe("2026-01-05");
		expect(formatDateKey(2026, 11, 31)).toBe("2026-12-31");
	});

	it("labels a month", () => {
		expect(getMonthLabel(2026, 6)).toBe("July 2026");
	});

	it("computes month ranges", () => {
		expect(getMonthRange(2026, 6)).toEqual({ start: "2026-07-01", end: "2026-07-31" });
		expect(getMonthRange(2028, 1)).toEqual({ start: "2028-02-01", end: "2028-02-29" });
	});

	it("formats display dates with default and custom options", () => {
		expect(formatDisplayDate("2026-07-04")).toBe("Saturday, July 4");
		expect(formatDisplayDate("2026-07-04", { year: "numeric" })).toBe("Saturday, July 4, 2026");
		expect(
			formatDisplayDate("2026-07-04", { weekday: "short", month: "short", day: "numeric" }),
		).toBe("Sat, Jul 4");
	});
});
