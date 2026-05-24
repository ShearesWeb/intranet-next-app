import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import type {
	AppointmentRow,
	RankingPayload,
	RankingRow,
} from "@/types/ranking-api";
import {
	buildRankingsUpsertPayloads,
	mapRankingResponseMembers,
} from "@/lib/ranking/ranking-route";

const routePath = resolve(process.cwd(), "src/app/api/cca/[cca-id]/rankings/route.ts");

describe("mapRankingResponseMembers", () => {
	it("normalizes joined rows and preserves ranking/comment defaults", () => {
		const members: AppointmentRow[] = [
			{
				user_id: 1,
				cut_status: null,
				commitment_period: "full-year",
				public_user_info: [{ name: "Alex" }],
				cca_positions: [{ id: 10, cca_id: 99, name: "Chair", position_type: "lead" }],
			},
			{
				user_id: 2,
				cut_status: "first-cut",
				commitment_period: "semester",
				public_user_info: { name: "Blair" },
				cca_positions: { id: 11, cca_id: 99, name: "Resident", position_type: "resident" },
			},
		];
		const rankings: RankingRow[] = [
			{
				user_id: 1,
				position_id: 10,
				scores: { ranking: 1, attendance: 8, performance: 7, remarks: "steady" },
			},
		];

		const normalized = mapRankingResponseMembers({
			members,
			rankings,
			ccaType: "culture",
			rankablePositionIds: [10, 11],
		});

		expect(normalized).toEqual([
			{
				user_id: 1,
				name: "Alex",
				position_id: 10,
				position: "Chair",
				position_type: "lead",
				cut_status: null,
				commitment_period: "full-year",
				ranking: 1,
				attendance: 8,
				performance: 7,
				helpfulness: 0,
				initiative: 0,
				attitude: 0,
				remarks: "steady",
			},
			{
				user_id: 2,
				name: "Blair",
				position_id: 11,
				position: "Resident",
				position_type: "resident",
				cut_status: "first-cut",
				commitment_period: "semester",
				ranking: 0,
				attendance: 0,
				performance: 0,
				helpfulness: 0,
				initiative: 0,
				attitude: 0,
				remarks: null,
			},
		]);
	});
});

describe("buildRankingsUpsertPayloads", () => {
	it("filters out disallowed positions and rows missing required score inputs", () => {
		const rankings: RankingPayload[] = [
			{
				user_id: 1,
				position_id: 10,
				ranking: 1,
				attendance: 8,
				performance: 7,
				helpfulness: 0,
				initiative: 0,
				attitude: 0,
				remarks: "ready",
			},
			{
				user_id: 2,
				position_id: 99,
				ranking: 2,
				attendance: 10,
				performance: 10,
				helpfulness: 0,
				initiative: 0,
				attitude: 0,
				remarks: "blocked",
			},
			{
				user_id: 3,
				position_id: 11,
				ranking: 3,
				attendance: 0,
				performance: 9,
				helpfulness: 0,
				initiative: 0,
				attitude: 0,
				remarks: "missing attendance",
			},
		];

		const payloads = buildRankingsUpsertPayloads({
			rankings,
			allowedPositionIds: new Set([10, 11]),
			positionTypeById: new Map([
				[10, "lead"],
				[11, "lead"],
			]),
			ccaType: "culture",
		});

		expect(payloads).toEqual([
			{
				user_id: 1,
				position_id: 10,
				scores: { ranking: 1, attendance: 8, performance: 7, remarks: "ready" },
			},
		]);
	});

	it("emits a non-empty rubric for resident positions so the scores CHECK constraint is satisfied", () => {
		const rankings: RankingPayload[] = [
			{
				user_id: 7,
				position_id: 20,
				ranking: 1,
				attendance: 0,
				performance: 0,
				helpfulness: 8,
				initiative: 9,
				attitude: 7,
				remarks: "solid resident",
			},
		];

		const payloads = buildRankingsUpsertPayloads({
			rankings,
			allowedPositionIds: new Set([20]),
			positionTypeById: new Map([[20, "resident"]]),
			ccaType: "resident",
		});

		expect(payloads).toHaveLength(1);
		const [payload] = payloads;
		expect(payload.user_id).toBe(7);
		expect(payload.position_id).toBe(20);
		const scores = payload.scores as Record<string, unknown>;
		expect(scores).toMatchObject({
			ranking: 1,
			helpfulness: 8,
			initiative: 9,
			attitude: 7,
			remarks: "solid resident",
		});
		// CHECK constraint: scores must be a non-empty JSONB object.
		expect(Object.keys(scores).length).toBeGreaterThan(0);
	});
});

describe("rankings route extraction", () => {
	it("no longer declares loadCcaContext inline in the route file", () => {
		const routeSource = readFileSync(routePath, "utf8");

		expect(routeSource).not.toContain("async function loadCcaContext(");
	});
});
