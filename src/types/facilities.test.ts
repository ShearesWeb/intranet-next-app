import { describe, expect, it } from "vitest";
import { daysUntilBooking, isBookingLocked, MIN_BOOKING_LEAD_DAYS } from "./facilities";

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
