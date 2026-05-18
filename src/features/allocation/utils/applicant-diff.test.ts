import { describe, it, expect } from "vitest";
import { diffApplicantsForSave } from "./applicant-diff";

function makePosition(id: number, applicantIds: number[]) {
	return { id, applicants: applicantIds.map((aid) => ({ id: aid })) };
}

describe("diffApplicantsForSave", () => {
	it("returns empty toAdd/toRemove when applicants unchanged, rankings reflect order", () => {
		const position = makePosition(1, [10, 20, 30]);
		const result = diffApplicantsForSave(position, { 1: [10, 20, 30] });
		expect(result.toAdd).toEqual([]);
		expect(result.toRemove).toEqual([]);
		expect(result.rankings).toEqual([
			{ user_id: 10, ranking: 1 },
			{ user_id: 20, ranking: 2 },
			{ user_id: 30, ranking: 3 },
		]);
	});

	it("includes new applicants in toAdd", () => {
		const position = makePosition(1, [10, 20, 30]);
		const { toAdd, toRemove } = diffApplicantsForSave(position, { 1: [10, 20] });
		expect(toAdd).toEqual([30]);
		expect(toRemove).toEqual([]);
	});

	it("includes removed applicants in toRemove", () => {
		const position = makePosition(1, [10]);
		const { toAdd, toRemove } = diffApplicantsForSave(position, { 1: [10, 20] });
		expect(toAdd).toEqual([]);
		expect(toRemove).toEqual([20]);
	});

	it("rankings reflect current applicant order regardless of original order", () => {
		const position = makePosition(1, [30, 10]);
		const { rankings } = diffApplicantsForSave(position, { 1: [10, 20, 30] });
		expect(rankings).toEqual([
			{ user_id: 30, ranking: 1 },
			{ user_id: 10, ranking: 2 },
		]);
	});

	it("treats missing position id in originalOrders as empty original list", () => {
		const position = makePosition(99, [5, 6]);
		const { toAdd, toRemove } = diffApplicantsForSave(position, {});
		expect(toAdd).toEqual([5, 6]);
		expect(toRemove).toEqual([]);
	});
});
