import { describe, expect, it } from "vitest";
import { computeRankingProgress } from "./ranking-progress";

const member = (
	ccaId: number,
	userId: number,
	positionId: number,
	overrides: Partial<{ position_type: string | null; cut_status: string | null }> = {},
) => ({
	cca_id: ccaId,
	user_id: userId,
	position_id: positionId,
	position_type: overrides.position_type ?? "member",
	cut_status: overrides.cut_status ?? null,
});

const evaluation = (userId: number, positionId: number, scores: unknown) => ({
	user_id: userId,
	position_id: positionId,
	scores,
});

describe("computeRankingProgress", () => {
	it("counts a committee member ranked only when attendance and performance are scored", () => {
		const progress = computeRankingProgress({
			members: [member(1, 10, 100), member(1, 11, 100)],
			evaluations: [
				evaluation(10, 100, { attendance: 8, performance: 7 }),
				evaluation(11, 100, { attendance: 8 }),
			],
			ccaTypeById: new Map([[1, "committee"]]),
		});
		expect(progress.get(1)).toEqual({ ranked: 1, total: 2 });
	});

	it("counts a sports member ranked from attendance alone", () => {
		const progress = computeRankingProgress({
			members: [member(2, 10, 200, { cut_status: "final-cut" })],
			evaluations: [evaluation(10, 200, { attendance: 5 })],
			ccaTypeById: new Map([[2, "sports"]]),
		});
		expect(progress.get(2)).toEqual({ ranked: 1, total: 1 });
	});

	it("excludes sports member-position members without a cut status", () => {
		const progress = computeRankingProgress({
			members: [
				member(2, 10, 200, { cut_status: null }),
				member(2, 11, 200, { cut_status: "final-cut" }),
			],
			evaluations: [],
			ccaTypeById: new Map([[2, "sports"]]),
		});
		expect(progress.get(2)).toEqual({ ranked: 0, total: 1 });
	});

	it("treats members without an evaluation row as unranked", () => {
		const progress = computeRankingProgress({
			members: [member(1, 10, 100)],
			evaluations: [],
			ccaTypeById: new Map([[1, "committee"]]),
		});
		expect(progress.get(1)).toEqual({ ranked: 0, total: 1 });
	});

	it("requires all three behavioral metrics for resident positions", () => {
		const progress = computeRankingProgress({
			members: [
				member(3, 10, 300, { position_type: "resident" }),
				member(3, 11, 300, { position_type: "resident" }),
			],
			evaluations: [
				evaluation(10, 300, { helpfulness: 5, initiative: 6, attitude: 7 }),
				evaluation(11, 300, { helpfulness: 5, initiative: 6 }),
			],
			ccaTypeById: new Map([[3, "committee"]]),
		});
		expect(progress.get(3)).toEqual({ ranked: 1, total: 2 });
	});

	it("groups progress per CCA and omits CCAs with no members", () => {
		const progress = computeRankingProgress({
			members: [member(1, 10, 100)],
			evaluations: [evaluation(10, 100, { attendance: 8, performance: 7 })],
			ccaTypeById: new Map([
				[1, "committee"],
				[9, "committee"],
			]),
		});
		expect(progress.get(1)).toEqual({ ranked: 1, total: 1 });
		expect(progress.has(9)).toBe(false);
	});
});
