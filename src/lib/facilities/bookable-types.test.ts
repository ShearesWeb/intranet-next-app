import { describe, expect, it } from "vitest";
import { bookableFacilityTypes, isBookableFacilityType } from "./bookable-types";

describe("isBookableFacilityType / bookableFacilityTypes", () => {
	it("allows only Sheares facilities", () => {
		expect(isBookableFacilityType("reboks")).toBe(false);
		expect(isBookableFacilityType("sheares")).toBe(true);
		expect(isBookableFacilityType("nus")).toBe(false);
		expect(isBookableFacilityType("external")).toBe(false);
		expect(bookableFacilityTypes()).toEqual(["sheares"]);
	});
});
