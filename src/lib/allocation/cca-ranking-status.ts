import { getCandidateCoverage } from "@/lib/allocation/candidate-coverage";
import type { CcaPositionGroup } from "@/types/applicants";

export type CcaRankingStatus = "no-candidates" | "incomplete" | "below-goal" | "ranked";

/**
 * Derive a chair-preferences status for one CCA from its positions:
 * - `no-candidates` — no ranked candidate and no applicant on any position yet
 * - `incomplete`    — an applicant is still outside the ranking, or coverage
 *                     is under 100% of open slots
 * - `below-goal`    — every applicant is ranked but coverage is under the
 *                     200% goal
 * - `ranked`        — every applicant is ranked and the 200% goal is met (or
 *                     no slots are open)
 */
export function deriveCcaRankingStatus(group: CcaPositionGroup): CcaRankingStatus {
	const ranked = group.positions.flatMap((p) => p.applicants);
	const unranked = group.positions.flatMap((p) => p.unranked_applicants);
	if (ranked.length === 0 && unranked.length === 0) return "no-candidates";
	if (unranked.length > 0) return "incomplete";

	const openSlots = group.positions.reduce((sum, p) => sum + p.available_capacity, 0);
	switch (getCandidateCoverage(ranked.length, openSlots).tier) {
		case "critical":
			return "incomplete";
		case "low":
		case "good":
			return "below-goal";
		default:
			return "ranked";
	}
}

export const CCA_RANKING_STATUS_LABELS: Record<CcaRankingStatus, string> = {
	"no-candidates": "Empty",
	incomplete: "Incomplete",
	"below-goal": "Adequate",
	ranked: "Ranked",
};
