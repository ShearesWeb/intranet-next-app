import { describe, expect, it } from "vitest";
import { daysUntilBooking } from "./facilities";

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
