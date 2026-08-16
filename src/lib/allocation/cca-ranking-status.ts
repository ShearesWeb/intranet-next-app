import { getCandidateCoverage } from "@/lib/allocation/candidate-coverage";
import type { CcaPositionGroup } from "@/types/applicants";

export type CcaRankingStatus = "no-candidates" | "incomplete" | "below-goal" | "ranked";

/**
 * Derive a chair-preferences status for one CCA from its positions:
 * - `no-candidates` — no candidate on any position yet
 * - `incomplete`    — an unranked candidate exists, or coverage is under 100%
 *                     of open slots
 * - `below-goal`    — everyone is ranked but coverage is under the 200% goal
 * - `ranked`        — everyone is ranked and the 200% goal is met (or no
 *                     slots are open)
 */
export function deriveCcaRankingStatus(group: CcaPositionGroup): CcaRankingStatus {
	const applicants = group.positions.flatMap((p) => p.applicants);
	if (applicants.length === 0) return "no-candidates";
	if (applicants.some((a) => a.ranking == null)) return "incomplete";

	const openSlots = group.positions.reduce((sum, p) => sum + p.available_capacity, 0);
	switch (getCandidateCoverage(applicants.length, openSlots).tier) {
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
