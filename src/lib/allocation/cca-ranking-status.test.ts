import { describe, expect, it } from "vitest";
import { deriveCcaRankingStatus } from "@/lib/allocation/cca-ranking-status";
import type { Applicant, CcaPositionGroup, Position } from "@/types/applicants";

function applicant(id: number, ranking: number | null): Applicant {
	return { id, name: `A${id}`, email: `a${id}@x.io`, room: "01-1", ranking, applied: true };
}

function position(
	id: number,
	applicants: Applicant[],
	openSlots: number,
	unrankedApplicants: Applicant[] = [],
): Position {
	return {
		id,
		cca_id: 1,
		name: `P${id}`,
		cca_name: "CCA",
		capacity: 10,
		available_capacity: openSlots,
		applied_count: applicants.length + unrankedApplicants.length,
		position_type: "member",
		applicants,
		unranked_applicants: unrankedApplicants,
	};
}

function group(positions: Position[]): CcaPositionGroup {
	return { cca_id: 1, cca_name: "CCA", positions };
}

describe("deriveCcaRankingStatus", () => {
	it("returns no-candidates when every position is empty", () => {
		expect(deriveCcaRankingStatus(group([position(1, [], 5), position(2, [], 5)]))).toBe(
			"no-candidates",
		);
	});

	it("returns incomplete when an applicant sits outside the ranking", () => {
		const g = group([position(1, [applicant(1, 1)], 1, [applicant(2, null)])]);
		expect(deriveCcaRankingStatus(g)).toBe("incomplete");
	});

	it("returns incomplete when the unranked applicant is in a different position", () => {
		const g = group([position(1, [applicant(1, 1)], 1), position(2, [], 1, [applicant(2, null)])]);
		expect(deriveCcaRankingStatus(g)).toBe("incomplete");
	});

	it("returns incomplete when only unranked applicants exist", () => {
		const g = group([position(1, [], 1, [applicant(1, null)])]);
		expect(deriveCcaRankingStatus(g)).toBe("incomplete");
	});

	it("returns incomplete when all are ranked but coverage is under 100%", () => {
		const g = group([position(1, [applicant(1, 1), applicant(2, 2)], 8)]);
		expect(deriveCcaRankingStatus(g)).toBe("incomplete");
	});

	it("returns below-goal when all are ranked at exactly 100% coverage", () => {
		const g = group([position(1, [applicant(1, 1), applicant(2, 2), applicant(3, 3)], 3)]);
		expect(deriveCcaRankingStatus(g)).toBe("below-goal");
	});

	it("returns below-goal when all are ranked but under the 200% goal", () => {
		const g = group([position(1, [applicant(1, 1), applicant(2, 2), applicant(3, 3)], 2)]);
		expect(deriveCcaRankingStatus(g)).toBe("below-goal");
	});

	it("aggregates coverage across positions", () => {
		const g = group([position(1, [applicant(1, 1)], 1), position(2, [applicant(2, 1)], 1)]);
		expect(deriveCcaRankingStatus(g)).toBe("below-goal");
	});

	it("returns ranked when all are ranked and the 200% goal is met", () => {
		const g = group([
			position(1, [applicant(1, 1), applicant(2, 2), applicant(3, 3), applicant(4, 4)], 2),
		]);
		expect(deriveCcaRankingStatus(g)).toBe("ranked");
	});

	it("returns ranked when all are ranked and no slots are open", () => {
		const g = group([position(1, [applicant(1, 1), applicant(2, 2)], 0)]);
		expect(deriveCcaRankingStatus(g)).toBe("ranked");
	});
});
