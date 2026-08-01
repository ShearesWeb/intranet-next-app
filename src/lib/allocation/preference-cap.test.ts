import { describe, expect, it } from "vitest";
import { MAX_PREFERENCES, canAddPreference, getPreferenceUsage } from "./preference-cap";

describe("getPreferenceUsage", () => {
	it("returns empty tier at zero selections", () => {
		expect(getPreferenceUsage(0)).toEqual({
			count: 0,
			max: 6,
			remaining: 6,
			percent: 0,
			tier: "empty",
			atCap: false,
		});
	});

	it("returns critical tier for one or two selections", () => {
		expect(getPreferenceUsage(1).tier).toBe("critical");
		expect(getPreferenceUsage(2).tier).toBe("critical");
	});

	it("returns low tier for three or four selections", () => {
		expect(getPreferenceUsage(3).tier).toBe("low");
		expect(getPreferenceUsage(4).tier).toBe("low");
	});

	it("returns good tier one short of the cap", () => {
		expect(getPreferenceUsage(5)).toEqual({
			count: 5,
			max: 6,
			remaining: 1,
			percent: 83,
			tier: "good",
			atCap: false,
		});
	});

	it("returns full tier at the cap", () => {
		expect(getPreferenceUsage(6)).toEqual({
			count: 6,
			max: 6,
			remaining: 0,
			percent: 100,
			tier: "full",
			atCap: true,
		});
	});

	it("clamps percent and remaining when the count exceeds the cap", () => {
		expect(getPreferenceUsage(9)).toEqual({
			count: 9,
			max: 6,
			remaining: 0,
			percent: 100,
			tier: "full",
			atCap: true,
		});
	});

	it("clamps negative counts to zero", () => {
		expect(getPreferenceUsage(-3)).toEqual({
			count: 0,
			max: 6,
			remaining: 6,
			percent: 0,
			tier: "empty",
			atCap: false,
		});
	});

	it("truncates fractional counts", () => {
		expect(getPreferenceUsage(2.9).count).toBe(2);
	});
});

describe("canAddPreference", () => {
	it("allows adding below the cap", () => {
		expect(canAddPreference(0)).toBe(true);
		expect(canAddPreference(MAX_PREFERENCES - 1)).toBe(true);
	});

	it("blocks adding at or above the cap", () => {
		expect(canAddPreference(MAX_PREFERENCES)).toBe(false);
		expect(canAddPreference(MAX_PREFERENCES + 2)).toBe(false);
	});
});
