import { describe, expect, it } from "vitest";
import { deriveCcaRankingStatus } from "@/lib/allocation/cca-ranking-status";
import type { Applicant, CcaPositionGroup, Position } from "@/types/applicants";

function applicant(id: number, ranking: number | null): Applicant {
	return { id, name: `A${id}`, email: `a${id}@x.io`, room: "01-1", ranking };
}

function position(id: number, applicants: Applicant[]): Position {
	return {
		id,
		cca_id: 1,
		name: `P${id}`,
		cca_name: "CCA",
		capacity: 10,
		available_capacity: 10 - applicants.length,
		applied_count: applicants.length,
		position_type: "member",
		applicants,
	};
}

function group(positions: Position[]): CcaPositionGroup {
	return { cca_id: 1, cca_name: "CCA", positions };
}

describe("deriveCcaRankingStatus", () => {
	it("returns no-applicants when every position is empty", () => {
		expect(deriveCcaRankingStatus(group([position(1, []), position(2, [])]))).toBe("no-applicants");
	});

	it("returns needs-ranking when any applicant has a null ranking", () => {
		const g = group([position(1, [applicant(1, 1), applicant(2, null)])]);
		expect(deriveCcaRankingStatus(g)).toBe("needs-ranking");
	});

	it("returns needs-ranking when the unranked applicant is in a different position", () => {
		const g = group([position(1, [applicant(1, 1)]), position(2, [applicant(2, null)])]);
		expect(deriveCcaRankingStatus(g)).toBe("needs-ranking");
	});

	it("returns ranked when all applicants have a saved rank", () => {
		const g = group([position(1, [applicant(1, 1), applicant(2, 2)])]);
		expect(deriveCcaRankingStatus(g)).toBe("ranked");
	});
});
