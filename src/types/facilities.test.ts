import { describe, expect, it } from "vitest";
import {
	bookingHorizonEnd,
	daysUntilBooking,
	horizonOpensOn,
	isBeyondBookingHorizon,
	isBookingLocked,
	isHorizonRestricted,
	MIN_BOOKING_LEAD_DAYS,
} from "./facilities";

const NOW = new Date("2026-07-31T14:30:00");

describe("daysUntilBooking", () => {
	it("counts whole days ignoring the time of day", () => {
		expect(daysUntilBooking("2026-07-31", NOW)).toBe(0);
		expect(daysUntilBooking("2026-08-01", NOW)).toBe(1);
		expect(daysUntilBooking("2026-08-03", NOW)).toBe(3);
	});

	it("goes negative for past dates", () => {
		expect(daysUntilBooking("2026-07-29", NOW)).toBe(-2);
	});
});

describe("isBookingLocked", () => {
	it("locks anything closer than the lead window", () => {
		expect(isBookingLocked("2026-07-31", NOW)).toBe(true);
		expect(isBookingLocked("2026-08-01", NOW)).toBe(true);
		expect(isBookingLocked("2026-08-02", NOW)).toBe(true);
	});

	it("allows the first day at the lead boundary and beyond", () => {
		expect(MIN_BOOKING_LEAD_DAYS).toBe(3);
		expect(isBookingLocked("2026-08-03", NOW)).toBe(false);
		expect(isBookingLocked("2026-09-01", NOW)).toBe(false);
	});
});

describe("bookingHorizonEnd", () => {
	it("returns the last day of the current month", () => {
		expect(bookingHorizonEnd(new Date("2026-08-20T05:00:00Z"))).toBe("2026-08-31");
		expect(bookingHorizonEnd(new Date("2026-09-01T05:00:00Z"))).toBe("2026-09-30");
	});

	it("handles February in a leap year and a common year", () => {
		expect(bookingHorizonEnd(new Date("2028-02-10T00:00:00Z"))).toBe("2028-02-29");
		expect(bookingHorizonEnd(new Date("2026-02-10T00:00:00Z"))).toBe("2026-02-28");
	});

	it("reads the month in Singapore, not UTC", () => {
		// 31 Aug 17:00 UTC is already 1 Sep in Singapore, so the horizon has moved.
		// Getting this wrong would keep September shut for the first eight hours
		// of the very day it is meant to open.
		expect(bookingHorizonEnd(new Date("2026-08-31T17:00:00Z"))).toBe("2026-09-30");
		expect(bookingHorizonEnd(new Date("2026-08-31T15:00:00Z"))).toBe("2026-08-31");
	});
});

describe("isBeyondBookingHorizon", () => {
	const now = new Date("2026-08-20T05:00:00Z");

	it("admits dates up to and including the month end", () => {
		expect(isBeyondBookingHorizon("2026-08-20", now)).toBe(false);
		expect(isBeyondBookingHorizon("2026-08-31", now)).toBe(false);
	});

	it("rejects the first day of next month and later", () => {
		expect(isBeyondBookingHorizon("2026-09-01", now)).toBe(true);
		expect(isBeyondBookingHorizon("2026-12-25", now)).toBe(true);
	});
});

describe("isHorizonRestricted", () => {
	const now = new Date("2026-08-20T05:00:00Z");

	it("withholds only reboks past the horizon", () => {
		expect(isHorizonRestricted("reboks", "2026-09-01", now)).toBe(true);
		expect(isHorizonRestricted("reboks", "2026-08-31", now)).toBe(false);
	});

	it("leaves every other type bookable in any month", () => {
		expect(isHorizonRestricted("sheares", "2026-09-01", now)).toBe(false);
		expect(isHorizonRestricted("nus", "2026-12-25", now)).toBe(false);
		expect(isHorizonRestricted("external", "2026-12-25", now)).toBe(false);
	});
});

describe("horizonOpensOn", () => {
	it("points at the first of the withheld day's own month", () => {
		expect(horizonOpensOn("2026-09-25")).toBe("2026-09-01");
		expect(horizonOpensOn("2027-01-03")).toBe("2027-01-01");
	});
});
