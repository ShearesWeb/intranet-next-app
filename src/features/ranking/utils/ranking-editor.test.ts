import { describe, expect, it } from "vitest";
import type { CCAMember, RankingSavePayload } from "@/features/ranking/types/ranking";
import {
	chunkRankingPayloads,
	getChangedRankingPayloads,
	recalculateRankings,
} from "@/features/ranking/utils/ranking-editor";

function createMember(overrides: Partial<CCAMember> = {}): CCAMember {
	const userId = overrides.user_id ?? 1;
	const positionId = overrides.position_id ?? 10;

	return {
		row_key: overrides.row_key ?? `${userId}:${positionId}`,
		user_id: userId,
		name: overrides.name ?? `Member ${userId}`,
		position: overrides.position ?? "Chair",
		position_type: overrides.position_type ?? "lead",
		position_id: positionId,
		ranking: overrides.ranking ?? 0,
		remarks: overrides.remarks ?? "",
		cut_status: overrides.cut_status,
		commitment_period: overrides.commitment_period,
		attendance: overrides.attendance ?? 0,
		performance: overrides.performance ?? 0,
		helpfulness: overrides.helpfulness ?? 0,
		initiative: overrides.initiative ?? 0,
		attitude: overrides.attitude ?? 0,
	};
}

describe("recalculateRankings", () => {
	it("keeps sports members with incomplete attendance below fully scored members", () => {
		const ranked = recalculateRankings(
			[
				createMember({ user_id: 1, name: "Jordan", attendance: 8, position_id: 1 }),
				createMember({ user_id: 2, name: "Taylor", attendance: 0, position_id: 1 }),
				createMember({ user_id: 3, name: "Alex", attendance: 6, position_id: 1 }),
			],
			"sports",
		);

		expect(ranked.map((member) => member.user_id)).toEqual([1, 3, 2]);
		expect(ranked.map((member) => member.ranking)).toEqual([1, 2, 3]);
	});

	it("ranks resident members by helpfulness, initiative, and attitude total", () => {
		const ranked = recalculateRankings(
			[
				createMember({ user_id: 10, name: "Chris", position_type: "resident", helpfulness: 8, initiative: 8, attitude: 7, position_id: 2 }),
				createMember({ user_id: 11, name: "Blair", position_type: "resident", helpfulness: 9, initiative: 9, attitude: 9, position_id: 2 }),
				createMember({ user_id: 12, name: "Devon", position_type: "resident", helpfulness: 10, initiative: 0, attitude: 10, position_id: 2 }),
			],
			"culture",
		);

		expect(ranked.map((member) => member.user_id)).toEqual([11, 10, 12]);
		expect(ranked[0].helpfulness + ranked[0].initiative + ranked[0].attitude).toBe(27);
		expect(ranked[1].helpfulness + ranked[1].initiative + ranked[1].attitude).toBe(23);
	});
});

describe("getChangedRankingPayloads", () => {
	it("only returns rows whose ranking, score, or remarks changed", () => {
		const initialMembers = [
			createMember({ user_id: 1, ranking: 1, attendance: 7, performance: 8, remarks: "steady" }),
			createMember({ user_id: 2, ranking: 2, attendance: 5, performance: 6, remarks: "watch" }),
			createMember({ user_id: 3, ranking: 3, attendance: 4, performance: 5, remarks: "" }),
		];

		const nextMembers = [
			createMember({ user_id: 1, ranking: 1, attendance: 7, performance: 8, remarks: "steady" }),
			createMember({ user_id: 2, ranking: 1, attendance: 8, performance: 6, remarks: "improved" }),
			createMember({ user_id: 3, ranking: 3, attendance: 4, performance: 5, remarks: "" }),
		];

		const changed = getChangedRankingPayloads(nextMembers, initialMembers);

		expect(changed).toEqual<RankingSavePayload[]>([
			{
				user_id: 2,
				position_id: 10,
				ranking: 1,
				attendance: 8,
				performance: 6,
				helpfulness: 0,
				initiative: 0,
				attitude: 0,
				remarks: "improved",
			},
		]);
	});
});

describe("chunkRankingPayloads", () => {
	it("splits payloads when adding another row would exceed the byte limit", () => {
		const payloads: RankingSavePayload[] = [
			{ user_id: 1, position_id: 1, ranking: 1, attendance: 10, performance: 10, helpfulness: 0, initiative: 0, attitude: 0, remarks: "A".repeat(35) },
			{ user_id: 2, position_id: 1, ranking: 2, attendance: 9, performance: 9, helpfulness: 0, initiative: 0, attitude: 0, remarks: "B".repeat(35) },
			{ user_id: 3, position_id: 1, ranking: 3, attendance: 8, performance: 8, helpfulness: 0, initiative: 0, attitude: 0, remarks: "C".repeat(35) },
		];

		const maxBytes = Buffer.byteLength(JSON.stringify(payloads[0])) * 2 + 10;
		const chunks = chunkRankingPayloads(payloads, maxBytes);

		expect(chunks).toHaveLength(2);
		expect(chunks[0].map((payload) => payload.user_id)).toEqual([1, 2]);
		expect(chunks[1].map((payload) => payload.user_id)).toEqual([3]);
	});

	it("throws when a single payload exceeds the byte limit", () => {
		const oversizedPayload: RankingSavePayload = {
			user_id: 99,
			position_id: 5,
			ranking: 1,
			attendance: 10,
			performance: 10,
			helpfulness: 10,
			initiative: 10,
			attitude: 10,
			remarks: "X".repeat(200),
		};

		expect(() => chunkRankingPayloads([oversizedPayload], 50)).toThrow(
			"Ranking for user 99 is too large to save in a single request",
		);
	});
});
