import { extractRankingCommentFields } from "@/lib/ranking/cca-ranking-comments";
import { hasRequiredRankingInputs } from "@/lib/ranking/cca-ranking-metrics";

export type ProgressMemberRow = {
	cca_id: number;
	user_id: number;
	position_id: number;
	position_type: string | null;
	cut_status: string | null;
};

export type ProgressEvaluationRow = {
	user_id: number;
	position_id: number;
	scores: unknown;
};

export type RankingProgress = {
	ranked: number;
	total: number;
};

/**
 * Per-CCA ranked/total member counts, mirroring the rank-members editor:
 * sports member-position members without a cut status are not rankable, and
 * "ranked" means every required score input for the position is filled.
 */
export function computeRankingProgress({
	members,
	evaluations,
	ccaTypeById,
}: {
	members: ProgressMemberRow[];
	evaluations: ProgressEvaluationRow[];
	ccaTypeById: Map<number, string | null>;
}): Map<number, RankingProgress> {
	const scoresByMember = new Map<string, unknown>(
		evaluations.map((row) => [`${row.user_id}:${row.position_id}`, row.scores]),
	);

	const progressByCca = new Map<number, RankingProgress>();

	for (const memberRow of members) {
		const ccaType = ccaTypeById.get(memberRow.cca_id) ?? null;

		if (
			ccaType === "sports" &&
			memberRow.position_type === "member" &&
			memberRow.cut_status === null
		) {
			continue;
		}

		const scores = scoresByMember.get(`${memberRow.user_id}:${memberRow.position_id}`);
		const ranked = hasRequiredRankingInputs(extractRankingCommentFields(scores), {
			ccaType,
			positionType: memberRow.position_type,
		});

		const progress = progressByCca.get(memberRow.cca_id) ?? { ranked: 0, total: 0 };
		progress.total += 1;
		if (ranked) progress.ranked += 1;
		progressByCca.set(memberRow.cca_id, progress);
	}

	return progressByCca;
}
