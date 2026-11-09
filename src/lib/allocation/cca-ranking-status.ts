import { getCandidateCoverage } from "@/lib/allocation/candidate-coverage";
import type { CcaPositionGroup } from "@/types/applicants";

export type CcaRankingStatus = "no-candidates" | "incomplete" | "below-goal" | "ranked";

/**
 * Derive a chair-preferences status for one CCA from the chair's own ranked
 * lists (applications are private and never visible here):
 * - `no-candidates` — no candidate ranked on any position yet
 * - `incomplete`    — coverage is under 100% of total capacity
 * - `below-goal`    — coverage is at least 100% but under the 200% goal
 * - `ranked`        — the 200% goal is met (or no capacity is configured)
 */
export function deriveCcaRankingStatus(group: CcaPositionGroup): CcaRankingStatus {
	const ranked = group.positions.flatMap((p) => p.applicants);
	if (ranked.length === 0) return "no-candidates";

	const capacity = group.positions.reduce((sum, p) => sum + p.capacity, 0);
	switch (getCandidateCoverage(ranked.length, capacity).tier) {
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
