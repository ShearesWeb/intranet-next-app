import {
	getRankingMetricKeys,
	getRankingScore,
	hasRequiredRankingInputs,
	isResidentPositionType,
} from "./cca-ranking-metrics";

describe("isResidentPositionType", () => {
	it("returns true for resident position variants", () => {
		expect(isResidentPositionType("resident")).toBe(true);
		expect(isResidentPositionType("Resident")).toBe(true);
		expect(isResidentPositionType("re_sident")).toBe(true);
	});

	it("returns false for non-resident position types", () => {
		expect(isResidentPositionType("member")).toBe(false);
		expect(isResidentPositionType(undefined)).toBe(false);
	});
});

describe("getRankingMetricKeys", () => {
	it("returns only attendance for sports members", () => {
		expect(getRankingMetricKeys({ ccaKind: "sports", positionType: "member" })).toEqual([
			"attendance",
		]);
	});

	it("returns attendance and performance for culture leads", () => {
		expect(getRankingMetricKeys({ ccaKind: "culture", positionType: "lead" })).toEqual([
			"attendance",
			"performance",
		]);
	});

	it("returns behavioral metrics for resident positions", () => {
		expect(getRankingMetricKeys({ ccaKind: "committee", positionType: "resident" })).toEqual([
			"helpfulness",
			"initiative",
			"attitude",
		]);
	});
});

describe("hasRequiredRankingInputs", () => {
	it("requires all configured metrics for sports and culture rows", () => {
		expect(
			hasRequiredRankingInputs({ attendance: 6 }, { ccaKind: "sports", positionType: "member" }),
		).toBe(true);

		expect(
			hasRequiredRankingInputs(
				{ attendance: 6, performance: 0 },
				{ ccaKind: "culture", positionType: "lead" },
			),
		).toBe(false);
	});

	it("requires all behavioral metrics for resident rows", () => {
		expect(
			hasRequiredRankingInputs(
				{ helpfulness: 4, initiative: 5, attitude: 6 },
				{ ccaKind: "committee", positionType: "resident" },
			),
		).toBe(true);

		expect(
			hasRequiredRankingInputs(
				{ helpfulness: 4, initiative: 5, attitude: 0 },
				{ ccaKind: "committee", positionType: "resident" },
			),
		).toBe(false);
	});
});

describe("getRankingScore", () => {
	it("sums the active metrics for each ranking mode", () => {
		expect(getRankingScore({ attendance: 6 }, { ccaKind: "sports", positionType: "member" })).toBe(
			6,
		);
		expect(
			getRankingScore(
				{ attendance: 6, performance: 4 },
				{ ccaKind: "culture", positionType: "lead" },
			),
		).toBe(10);
		expect(
			getRankingScore(
				{ helpfulness: 4, initiative: 5, attitude: 6 },
				{ ccaKind: "committee", positionType: "resident" },
			),
		).toBe(15);
	});
});
