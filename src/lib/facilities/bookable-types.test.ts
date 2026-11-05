import { describe, expect, it } from "vitest";
import { isBookableFacilityType } from "./bookable-types";

describe("isBookableFacilityType", () => {
	it("allows only Sheares facilities", () => {
		expect(isBookableFacilityType("reboks")).toBe(false);
		expect(isBookableFacilityType("sheares")).toBe(true);
		expect(isBookableFacilityType("nus")).toBe(false);
		expect(isBookableFacilityType("external")).toBe(false);
	});
});
