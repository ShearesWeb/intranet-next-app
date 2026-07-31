import { describe, expect, it } from "vitest";
import { getCandidateCoverage } from "./candidate-coverage";

describe("getCandidateCoverage", () => {
	it("returns full tier with null percent when no open slots", () => {
		expect(getCandidateCoverage(5, 0)).toEqual({ tier: "full", percent: null, target: 0 });
	});

	it("returns critical tier below 100% of open slots", () => {
		expect(getCandidateCoverage(2, 3)).toEqual({ tier: "critical", percent: 66, target: 6 });
	});

	it("returns critical tier at zero candidates", () => {
		expect(getCandidateCoverage(0, 4)).toEqual({ tier: "critical", percent: 0, target: 8 });
	});

	it("returns low tier at exactly 100%", () => {
		expect(getCandidateCoverage(3, 3)).toEqual({ tier: "low", percent: 100, target: 6 });
	});

	it("returns low tier between 100% and 150%", () => {
		expect(getCandidateCoverage(4, 3)).toEqual({ tier: "low", percent: 133, target: 6 });
	});

	it("returns good tier at exactly 150%", () => {
		expect(getCandidateCoverage(3, 2)).toEqual({ tier: "good", percent: 150, target: 4 });
	});

	it("returns target tier at exactly 200%", () => {
		expect(getCandidateCoverage(6, 3)).toEqual({ tier: "target", percent: 200, target: 6 });
	});

	it("returns target tier above 200%", () => {
		expect(getCandidateCoverage(10, 3)).toEqual({ tier: "target", percent: 333, target: 6 });
	});

	it("does not round a just-below-threshold percent up across the tier boundary", () => {
		// 149.5% would round to 150 but must stay in the low tier.
		expect(getCandidateCoverage(299, 200)).toEqual({ tier: "low", percent: 149, target: 400 });
	});
});
