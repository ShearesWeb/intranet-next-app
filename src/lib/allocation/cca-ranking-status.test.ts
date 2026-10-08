import { describe, expect, it } from "vitest";
import { deriveCcaRankingStatus } from "@/lib/allocation/cca-ranking-status";
import type { Applicant, CcaPositionGroup, Position } from "@/types/applicants";

function applicant(id: number, ranking: number): Applicant {
	return { id, name: `A${id}`, email: `a${id}@x.io`, room: "01-1", ranking };
}

function position(id: number, applicants: Applicant[], capacity: number): Position {
	return {
		id,
		cca_id: 1,
		name: `P${id}`,
		cca_name: "CCA",
		capacity,
		available_capacity: capacity,
		position_type: "member",
		applicants,
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

	it("returns incomplete when coverage is under 100%", () => {
		const g = group([position(1, [applicant(1, 1), applicant(2, 2)], 8)]);
		expect(deriveCcaRankingStatus(g)).toBe("incomplete");
	});

	it("returns below-goal at exactly 100% coverage", () => {
		const g = group([position(1, [applicant(1, 1), applicant(2, 2), applicant(3, 3)], 3)]);
		expect(deriveCcaRankingStatus(g)).toBe("below-goal");
	});

	it("returns below-goal under the 200% goal", () => {
		const g = group([position(1, [applicant(1, 1), applicant(2, 2), applicant(3, 3)], 2)]);
		expect(deriveCcaRankingStatus(g)).toBe("below-goal");
	});

	it("aggregates coverage across positions", () => {
		const g = group([position(1, [applicant(1, 1)], 1), position(2, [applicant(2, 1)], 1)]);
		expect(deriveCcaRankingStatus(g)).toBe("below-goal");
	});

	it("returns ranked when the 200% goal is met", () => {
		const g = group([
			position(1, [applicant(1, 1), applicant(2, 2), applicant(3, 3), applicant(4, 4)], 2),
		]);
		expect(deriveCcaRankingStatus(g)).toBe("ranked");
	});

	it("returns ranked when no capacity is configured", () => {
		const g = group([position(1, [applicant(1, 1), applicant(2, 2)], 0)]);
		expect(deriveCcaRankingStatus(g)).toBe("ranked");
	});

	it.each([20, 4, 0])("keeps coverage status when remaining seats drop to %i", (available) => {
		const p = position(
			1,
			Array.from({ length: 20 }, (_, i) => applicant(i + 1, i + 1)),
			20,
		);
		p.available_capacity = available;
		expect(deriveCcaRankingStatus(group([p]))).toBe("below-goal");
	});
});
