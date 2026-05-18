import { describe, it, expect } from "vitest";
import {
	HOLIDAY_WEEKS,
	HOLIDAY_WEEK_OPTIONS,
	getEditableWeekIds,
	isWeekEditable,
	getWeekLabel,
	getWeekDay,
	getWeekIdForDay,
} from "./holiday-weeks";

describe("HOLIDAY_WEEKS", () => {
	it("has 12 weeks", () => {
		expect(HOLIDAY_WEEKS).toHaveLength(12);
	});

	it("weeks are in expected id order", () => {
		expect(HOLIDAY_WEEKS.map((w) => w.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
	});

	it("endExclusive of each week equals start of next", () => {
		for (let i = 0; i < HOLIDAY_WEEKS.length - 1; i++) {
			expect(HOLIDAY_WEEKS[i].endExclusive.getTime()).toBe(
				HOLIDAY_WEEKS[i + 1].start.getTime(),
			);
		}
	});

	it("last week endExclusive is exactly 7 days after its start", () => {
		const last = HOLIDAY_WEEKS[HOLIDAY_WEEKS.length - 1];
		const expected = new Date(last.start);
		expected.setDate(expected.getDate() + 7);
		expect(last.endExclusive.getTime()).toBe(expected.getTime());
	});

	it("schedule spans Sun 10 May 2026 to Sun 2 Aug 2026 exclusive", () => {
		const first = HOLIDAY_WEEKS[0];
		const last = HOLIDAY_WEEKS[HOLIDAY_WEEKS.length - 1];
		expect(first.start.toISOString()).toBe(new Date("2026-05-10T00:00:00+08:00").toISOString());
		expect(last.endExclusive.toISOString()).toBe(
			new Date("2026-08-02T00:00:00+08:00").toISOString(),
		);
	});
});

describe("HOLIDAY_WEEK_OPTIONS", () => {
	it("formats label as 'label (range)'", () => {
		expect(HOLIDAY_WEEK_OPTIONS[0].label).toBe("Week 1 (10 May - 16 May)");
		expect(HOLIDAY_WEEK_OPTIONS[1].label).toBe("Week 2 (17 May - 23 May)");
	});

	it("has same length as HOLIDAY_WEEKS", () => {
		expect(HOLIDAY_WEEK_OPTIONS).toHaveLength(HOLIDAY_WEEKS.length);
	});
});

describe("getEditableWeekIds", () => {
	it("returns current week id when inside that week", () => {
		// Week 1: 2026-05-10 (Sun) to 2026-05-17 (Sun, exclusive)
		const duringWeek1 = new Date("2026-05-12T10:00:00+08:00");
		expect(getEditableWeekIds(duringWeek1)).toContain(1);
	});

	it("returns previous week id when within grace period", () => {
		// Week 2 starts 2026-05-17; grace_days=2 → prev week editable until 2026-05-19T23:59:59
		const withinGrace = new Date("2026-05-18T12:00:00+08:00");
		const ids = getEditableWeekIds(withinGrace);
		expect(ids).toContain(2); // current week
		expect(ids).toContain(1); // previous week still within grace
	});

	it("does not return previous week after grace period expires", () => {
		// After 2026-05-19T23:59:59 SG the grace window for Week 1 closes
		const afterGrace = new Date("2026-05-20T00:01:00+08:00");
		const ids = getEditableWeekIds(afterGrace);
		expect(ids).toContain(2); // week 2 still editable
		expect(ids).not.toContain(1); // week 1 no longer editable
	});

	it("returns empty array when outside all defined weeks", () => {
		// Well before the schedule starts
		const outside = new Date("2026-03-01T00:00:00+08:00");
		expect(getEditableWeekIds(outside)).toEqual([]);
	});

	it("returns empty array after the schedule ends", () => {
		// Aug 2 is the exclusive end of the schedule
		const afterEnd = new Date("2026-08-02T00:00:00+08:00");
		expect(getEditableWeekIds(afterEnd)).toEqual([]);
	});
});

describe("isWeekEditable", () => {
	it("returns true for the current week", () => {
		const duringWeek1 = new Date("2026-05-12T10:00:00+08:00");
		expect(isWeekEditable(1, duringWeek1)).toBe(true);
	});

	it("returns false for a future week", () => {
		const duringWeek1 = new Date("2026-05-12T10:00:00+08:00");
		expect(isWeekEditable(2, duringWeek1)).toBe(false);
	});
});

describe("getWeekLabel", () => {
	it("returns formatted label for a known week id", () => {
		expect(getWeekLabel(1)).toBe("Week 1 (10 May - 16 May)");
	});

	it("returns null for an unknown week id", () => {
		expect(getWeekLabel(999)).toBeNull();
	});
});

describe("getWeekDay", () => {
	it("returns the SG-local week-start date for the first configured holiday week (id=1)", () => {
		expect(getWeekDay(1)).toBe("2026-05-10");
	});

	it("returns the SG-local week-start date for a mid-range week (id=6)", () => {
		expect(getWeekDay(6)).toBe("2026-06-14");
	});

	it("returns the SG-local week-start date for the last configured holiday week (id=12)", () => {
		expect(getWeekDay(12)).toBe("2026-07-26");
	});

	it("returns null for an unknown week id", () => {
		expect(getWeekDay(999)).toBeNull();
	});
});

describe("getWeekIdForDay", () => {
	it("returns the week id for the first configured week boundary (2026-05-10 -> id=1)", () => {
		expect(getWeekIdForDay("2026-05-10")).toBe(1);
	});

	it("returns the week id for a mid-range week boundary (2026-06-14 -> id=6)", () => {
		expect(getWeekIdForDay("2026-06-14")).toBe(6);
	});

	it("returns the week id for the last configured week boundary (2026-07-26 -> id=12)", () => {
		expect(getWeekIdForDay("2026-07-26")).toBe(12);
	});

	it("returns null for a date that does not correspond to any configured week", () => {
		expect(getWeekIdForDay("2026-05-13")).toBeNull();
	});

	it("returns null for an unrelated future date", () => {
		expect(getWeekIdForDay("2027-06-15")).toBeNull();
	});
});

describe("getWeekDay / getWeekIdForDay roundtrip", () => {
	it("round-trips every configured week id through day and back", () => {
		HOLIDAY_WEEKS.forEach((week) => {
			const day = getWeekDay(week.id);
			expect(day).not.toBeNull();
			expect(getWeekIdForDay(day!)).toBe(week.id);
		});
	});
});
