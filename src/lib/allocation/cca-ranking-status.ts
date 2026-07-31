import type { CcaPositionGroup } from "@/types/applicants";

export type CcaRankingStatus = "ranked" | "needs-ranking" | "no-applicants";

/**
 * Derive a chair-preferences status for one CCA from its positions:
 * - `no-applicants`  — no applicant on any position yet
 * - `needs-ranking`  — at least one applicant has no saved rank (`ranking == null`)
 * - `ranked`         — applicants exist and all have a saved rank
 */
export function deriveCcaRankingStatus(group: CcaPositionGroup): CcaRankingStatus {
	const applicants = group.positions.flatMap((p) => p.applicants);
	if (applicants.length === 0) return "no-applicants";
	const anyUnranked = applicants.some((a) => a.ranking == null);
	return anyUnranked ? "needs-ranking" : "ranked";
}

export const CCA_RANKING_STATUS_LABELS: Record<CcaRankingStatus, string> = {
	ranked: "Ranked",
	"needs-ranking": "Needs ranking",
	"no-applicants": "No candidates",
};
