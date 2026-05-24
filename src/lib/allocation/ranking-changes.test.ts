import { describe, it, expect } from "vitest";
import { detectRankingSelectionChanges, buildRankingsPayload } from "./ranking-changes";

describe("detectRankingSelectionChanges", () => {
	it("returns false when selected ids and ranking order are unchanged", () => {
		const ids = new Set([1, 2, 3]);
		expect(detectRankingSelectionChanges(ids, new Set([1, 2, 3]), [1, 2, 3], [1, 2, 3])).toBe(
			false,
		);
	});

	it("returns true when selected ids differ in size", () => {
		expect(
			detectRankingSelectionChanges(new Set([1, 2]), new Set([1, 2, 3]), [1, 2], [1, 2, 3]),
		).toBe(true);
	});

	it("returns true when selected ids differ in content (same size)", () => {
		expect(detectRankingSelectionChanges(new Set([1, 4]), new Set([1, 2]), [1, 4], [1, 2])).toBe(
			true,
		);
	});

	it("returns true when ranking order changed but ids are unchanged", () => {
		const ids = new Set([1, 2, 3]);
		expect(detectRankingSelectionChanges(ids, new Set([1, 2, 3]), [1, 3, 2], [1, 2, 3])).toBe(true);
	});
});

describe("buildRankingsPayload", () => {
	it("maps positions to { position_id, ranking } with 1-based index", () => {
		const positions = [{ id: 10 }, { id: 20 }, { id: 30 }];
		expect(buildRankingsPayload(positions)).toEqual([
			{ position_id: 10, ranking: 1 },
			{ position_id: 20, ranking: 2 },
			{ position_id: 30, ranking: 3 },
		]);
	});

	it("returns empty array for empty input", () => {
		expect(buildRankingsPayload([])).toEqual([]);
	});
});
