import { getManagedCcaAccess } from "@/features/cca/utils/cca-management-access";
import { normalizeCutStatusForCca } from "@/features/cca/utils/cca-cut-status";
import {
	buildRankingComments,
	extractRankingCommentFields,
} from "@/features/ranking/utils/cca-ranking-comments";
import {
	getRankingMetricKeys,
	hasRequiredRankingInputs,
	isResidentPositionType,
} from "@/features/ranking/utils/cca-ranking-metrics";
import type {
	AppointmentRow,
	ManagedRankingAccessRow,
	RankingPayload,
	RankingResponseMember,
	RankingRow,
} from "@/features/ranking/types/ranking-api";
import { fetchUserInfo } from "@/lib/auth/fetch-user-info";
import { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

type RankingContextRow = {
	id: number;
	name?: string | null;
	cca_type?: string | null;
};

export async function loadCcaContext(supabase: SupabaseServerClient, ccaId: number) {
	const [{ data: cca, error: ccaError }, { data: positions, error: positionsError }] =
		await Promise.all([
			supabase.from("ccas").select("id, name, cca_type").eq("id", ccaId).single(),
			supabase.from("cca_positions").select("id, name, position_type, cca_id").eq("cca_id", ccaId),
		]);

	return { cca, ccaError, positions, positionsError };
}

export async function loadManagedRankingAccess({
	supabase,
	requestingUser,
	cca,
}: {
	supabase: SupabaseServerClient;
	requestingUser: Awaited<ReturnType<typeof fetchUserInfo>>;
	cca: RankingContextRow;
}) {
	if (!requestingUser) {
		return { ok: false as const, status: 401, error: "Unauthorized" };
	}

	const managedAccessResult = await getManagedCcaAccess({
		supabase,
		requestingUser,
		cca,
		accessLevel: "rank_members",
	});

	if (!managedAccessResult.ok) {
		return managedAccessResult;
	}

	const { managedPositionIds, managedCca } = managedAccessResult.data;

	if (managedPositionIds.length === 0) {
		return {
			ok: false as const,
			status: 403,
			error: "You are not authorized to view rankings for this CCA",
		};
	}

	return {
		ok: true as const,
		allowedPositionIds: managedPositionIds,
		managedCca: managedCca as ManagedRankingAccessRow | null,
	};
}

export function mapRankingResponseMembers({
	members,
	rankings,
	ccaType,
	rankablePositionIds,
}: {
	members: AppointmentRow[];
	rankings: RankingRow[] | null | undefined;
	ccaType?: string | null;
	rankablePositionIds: number[];
}): RankingResponseMember[] {
	const normalizedMembers = members.map((member) => {
		const position = Array.isArray(member.cca_positions)
			? member.cca_positions[0]
			: member.cca_positions;
		const userInfo = Array.isArray(member.public_user_info)
			? member.public_user_info[0]
			: member.public_user_info;

		return {
			...member,
			cca_positions: position,
			public_user_info: userInfo,
		};
	});

	const rankingsMap = new Map<
		string,
		{
			ranking?: number | null;
			attendance?: number | null;
			performance?: number | null;
			helpfulness?: number | null;
			initiative?: number | null;
			attitude?: number | null;
			remarks?: string | null;
		}
	>();

	rankings?.forEach((row) => {
		const parsedScores = extractRankingCommentFields(row.scores);
		const rankingValue =
			row.scores && typeof row.scores === "object" && !Array.isArray(row.scores)
				? (() => {
						const raw = (row.scores as Record<string, unknown>).ranking;
						return typeof raw === "number" && Number.isFinite(raw) ? raw : null;
					})()
				: null;
		rankingsMap.set(`${row.user_id}:${row.position_id}`, {
			ranking: rankingValue,
			attendance: parsedScores.attendance,
			performance: parsedScores.performance,
			helpfulness: parsedScores.helpfulness,
			initiative: parsedScores.initiative,
			attitude: parsedScores.attitude,
			remarks: parsedScores.remarks,
		});
	});

	const scopedMembers = normalizedMembers
		.map((member) => {
			const positionId = member.cca_positions?.id;
			const rankingKey = `${member.user_id}:${positionId}`;
			const ranking = rankingsMap.get(rankingKey);
			const memberName = member.public_user_info?.name;
			const positionName = member.cca_positions?.name;
			const positionType = member.cca_positions?.position_type || "";

			if (typeof positionId !== "number" || !memberName || !positionName) {
				return null;
			}

			return {
				user_id: member.user_id,
				name: memberName,
				position_id: positionId,
				position: positionName,
				position_type: positionType,
				cut_status: normalizeCutStatusForCca(member.cut_status, ccaType),
				commitment_period: member.commitment_period,
				ranking: ranking?.ranking ?? 0,
				attendance: ranking?.attendance ?? 0,
				performance: ranking?.performance ?? 0,
				helpfulness: ranking?.helpfulness ?? 0,
				initiative: ranking?.initiative ?? 0,
				attitude: ranking?.attitude ?? 0,
				remarks: ranking?.remarks ?? null,
			};
		})
		.filter((member): member is RankingResponseMember => member !== null)
		.filter((member) => {
			if (!rankablePositionIds.includes(member.position_id)) return false;

			if (ccaType === "sports" && member.position_type === "member") {
				return member.cut_status !== null;
			}

			return true;
		});

	scopedMembers.sort((a, b) => {
		const aRanking = a.ranking || Number.MAX_SAFE_INTEGER;
		const bRanking = b.ranking || Number.MAX_SAFE_INTEGER;
		if (aRanking !== bRanking) return aRanking - bRanking;
		return a.name.localeCompare(b.name);
	});

	return scopedMembers;
}

export function buildRankingsUpsertPayloads({
	rankings,
	allowedPositionIds,
	positionTypeById,
	ccaType,
}: {
	rankings: RankingPayload[];
	allowedPositionIds: Set<number>;
	positionTypeById: Map<number, string | null>;
	ccaType?: string | null;
}) {
	return rankings
		.filter((ranking) => allowedPositionIds.has(ranking.position_id))
		.filter((ranking) => {
			const positionType = positionTypeById.get(ranking.position_id);

			return hasRequiredRankingInputs(
				{
					attendance: ranking.attendance,
					performance: ranking.performance,
					helpfulness: ranking.helpfulness,
					initiative: ranking.initiative,
					attitude: ranking.attitude,
				},
				{
					ccaType,
					positionType,
				},
			);
		})
		.map((ranking) => {
			const positionType = positionTypeById.get(ranking.position_id);
			const rankingMetricKeys = getRankingMetricKeys({
				ccaType,
				positionType,
			});
			const normalizedPerformance =
				ccaType !== "sports"
					? ranking.performance
					: ranking.performance > 0
						? ranking.performance
						: ranking.attendance;
			const rubric = isResidentPositionType(positionType)
				? buildRankingComments({
						helpfulness: ranking.helpfulness,
						initiative: ranking.initiative,
						attitude: ranking.attitude,
						remarks: ranking.remarks,
					})
				: buildRankingComments({
						attendance: ranking.attendance,
						performance: rankingMetricKeys.includes("performance")
							? ranking.performance
							: normalizedPerformance,
						remarks: ranking.remarks,
					});

			return {
				user_id: ranking.user_id,
				position_id: ranking.position_id,
				scores: { ranking: ranking.ranking, ...rubric },
			};
		});
}
