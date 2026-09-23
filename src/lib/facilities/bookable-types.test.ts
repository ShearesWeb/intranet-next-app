import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ isReboksBookingEnabled: vi.fn() }));
vi.mock("@/lib/feature-flags", () => ({
	isReboksBookingEnabled: mocks.isReboksBookingEnabled,
}));

describe("isBookableFacilityType / bookableFacilityTypes", () => {
	beforeEach(() => vi.clearAllMocks());

	it("excludes reboks and keeps the other three when the flag is off", async () => {
		mocks.isReboksBookingEnabled.mockReturnValue(false);
		const { isBookableFacilityType, bookableFacilityTypes } = await import("./bookable-types");

		expect(isBookableFacilityType("reboks")).toBe(false);
		expect(isBookableFacilityType("sheares")).toBe(true);
		expect(isBookableFacilityType("nus")).toBe(true);
		expect(isBookableFacilityType("external")).toBe(true);
		expect(bookableFacilityTypes()).toEqual(["sheares", "nus", "external"]);
	});

	it("passes every type through, in catalog display order, when the flag is on", async () => {
		mocks.isReboksBookingEnabled.mockReturnValue(true);
		const { isBookableFacilityType, bookableFacilityTypes } = await import("./bookable-types");

		expect(isBookableFacilityType("reboks")).toBe(true);
		expect(bookableFacilityTypes()).toEqual(["sheares", "reboks", "nus", "external"]);
	});

	it("never returns an empty array in either flag position", async () => {
		mocks.isReboksBookingEnabled.mockReturnValue(false);
		const { bookableFacilityTypes: bookableOff } = await import("./bookable-types");
		expect(bookableOff().length).toBeGreaterThan(0);

		vi.clearAllMocks();
		mocks.isReboksBookingEnabled.mockReturnValue(true);
		const { bookableFacilityTypes: bookableOn } = await import("./bookable-types");
		expect(bookableOn().length).toBeGreaterThan(0);
	});
});
