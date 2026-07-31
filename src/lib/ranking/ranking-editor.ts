import type { CommitmentPeriod, CutStatus } from "@/types/members";
import type { RankingResponseMember } from "@/types/ranking-api";
import type { CCAMember, PositionGroup, RankingSavePayload } from "@/types/ranking";
import { MAX_SAVE_PAYLOAD_BYTES, POSITION_TYPE_ORDER } from "@/lib/ranking/constants";
import {
	getRankingScore,
	hasRequiredRankingInputs,
	isResidentPositionType,
} from "@/lib/ranking/cca-ranking-metrics";
import { formatCommitmentPeriod } from "@/lib/cca/member-helpers";

const textEncoder = new TextEncoder();

export { MAX_SAVE_PAYLOAD_BYTES, isResidentPositionType };

export type { PositionGroup, RankingResponseMember };

export function cloneMembers(items: CCAMember[]): CCAMember[] {
	return items.map((member) => ({ ...member }));
}

function rankMembersWithinPosition(members: CCAMember[], ccaType: string): CCAMember[] {
	const sorted = [...members].sort((a, b) => {
		const aHasInputs = hasRequiredRankingInputs(a, { ccaType, positionType: a.position_type });
		const bHasInputs = hasRequiredRankingInputs(b, { ccaType, positionType: b.position_type });

		if (aHasInputs !== bHasInputs) return aHasInputs ? -1 : 1;

		const aScore = getRankingScore(a, { ccaType, positionType: a.position_type });
		const bScore = getRankingScore(b, { ccaType, positionType: b.position_type });
		if (aScore !== bScore) return bScore - aScore;

		return a.name.localeCompare(b.name);
	});

	return sorted.map((member, index) => ({
		...member,
		ranking: index + 1,
	}));
}

export function recalculateRankings(items: CCAMember[], ccaType: string): CCAMember[] {
	const grouped = new Map<number, CCAMember[]>();

	items.forEach((member) => {
		const existing = grouped.get(member.position_id) || [];
		existing.push(member);
		grouped.set(member.position_id, existing);
	});

	const ranked: CCAMember[] = [];
	grouped.forEach((positionMembers) => {
		ranked.push(...rankMembersWithinPosition(positionMembers, ccaType));
	});

	return ranked;
}

function buildComparisonSnapshot(items: CCAMember[]) {
	return JSON.stringify(
		[...items]
			.sort(
				(a, b) => a.position_id - b.position_id || a.ranking - b.ranking || a.user_id - b.user_id,
			)
			.map((member) => ({
				row_key: member.row_key,
				user_id: member.user_id,
				position_id: member.position_id,
				ranking: member.ranking,
				attendance: member.attendance,
				performance: member.performance,
				helpfulness: member.helpfulness,
				initiative: member.initiative,
				attitude: member.attitude,
				remarks: member.remarks || "",
			})),
	);
}

const toRankingSavePayload = (member: CCAMember): RankingSavePayload => ({
	user_id: member.user_id,
	position_id: member.position_id,
	ranking: member.ranking,
	attendance: member.attendance,
	performance: member.performance,
	helpfulness: member.helpfulness,
	initiative: member.initiative,
	attitude: member.attitude,
	remarks: member.remarks,
});

function buildMemberComparisonSnapshot(member: CCAMember) {
	return JSON.stringify({
		user_id: member.user_id,
		position_id: member.position_id,
		ranking: member.ranking,
		attendance: member.attendance,
		performance: member.performance,
		helpfulness: member.helpfulness,
		initiative: member.initiative,
		attitude: member.attitude,
		remarks: member.remarks || "",
	});
}

export function getChangedRankingPayloads(members: CCAMember[], initialMembers: CCAMember[]) {
	const initialSnapshots = new Map(
		initialMembers.map((member) => [member.row_key, buildMemberComparisonSnapshot(member)]),
	);

	return [...members]
		.sort((a, b) => a.position_id - b.position_id || a.ranking - b.ranking || a.user_id - b.user_id)
		.filter(
			(member) => initialSnapshots.get(member.row_key) !== buildMemberComparisonSnapshot(member),
		)
		.map(toRankingSavePayload);
}

export function chunkRankingPayloads(
	payloads: RankingSavePayload[],
	maxBytes: number = MAX_SAVE_PAYLOAD_BYTES,
) {
	const chunks: RankingSavePayload[][] = [];
	let currentChunk: RankingSavePayload[] = [];
	let currentChunkSize = 2;

	payloads.forEach((payload) => {
		const payloadSize = textEncoder.encode(JSON.stringify(payload)).length;
		if (payloadSize > maxBytes) {
			throw new Error(
				`Ranking for user ${payload.user_id} is too large to save in a single request`,
			);
		}

		const nextChunkSize = currentChunkSize + (currentChunk.length > 0 ? 1 : 0) + payloadSize;
		if (currentChunk.length > 0 && nextChunkSize > maxBytes) {
			chunks.push(currentChunk);
			currentChunk = [payload];
			currentChunkSize = 2 + payloadSize;
			return;
		}

		currentChunk.push(payload);
		currentChunkSize = nextChunkSize;
	});

	if (currentChunk.length > 0) {
		chunks.push(currentChunk);
	}

	return chunks;
}

export { formatCommitmentPeriod };

export function mapRankingsApiMemberToEditorMember(member: RankingResponseMember): CCAMember {
	return {
		row_key: `${member.user_id}:${member.position_id}`,
		user_id: member.user_id,
		name: member.name,
		position: member.position,
		position_type: member.position_type || "",
		position_id: member.position_id,
		cut_status: member.cut_status as CutStatus | null,
		commitment_period: member.commitment_period as CommitmentPeriod | null,
		ranking: member.ranking ?? 0,
		attendance: member.attendance ?? 0,
		performance: member.performance ?? 0,
		helpfulness: member.helpfulness ?? 0,
		initiative: member.initiative ?? 0,
		attitude: member.attitude ?? 0,
		remarks: member.remarks ?? "",
	};
}

export function buildPositionGroups(members: CCAMember[]): PositionGroup[] {
	const groups = new Map<number, PositionGroup>();

	members.forEach((member) => {
		const existing = groups.get(member.position_id);
		if (!existing) {
			groups.set(member.position_id, {
				position_id: member.position_id,
				position: member.position,
				position_type: member.position_type,
				members: [member],
			});
			return;
		}

		existing.members.push(member);
	});

	return Array.from(groups.values())
		.map((group) => ({
			...group,
			members: [...group.members].sort(
				(a, b) => a.ranking - b.ranking || a.name.localeCompare(b.name),
			),
		}))
		.sort((a, b) => {
			const orderA = POSITION_TYPE_ORDER[(a.position_type || "").toLowerCase()] ?? 99;
			const orderB = POSITION_TYPE_ORDER[(b.position_type || "").toLowerCase()] ?? 99;
			if (orderA !== orderB) return orderA - orderB;
			return a.position.localeCompare(b.position);
		});
}

export function getUnrankedCount(members: CCAMember[], ccaType: string): number {
	return members.filter(
		(member) => !hasRequiredRankingInputs(member, { ccaType, positionType: member.position_type }),
	).length;
}

export function getHasChanges(members: CCAMember[], initialMembers: CCAMember[]): boolean {
	return buildComparisonSnapshot(members) !== buildComparisonSnapshot(initialMembers);
}
