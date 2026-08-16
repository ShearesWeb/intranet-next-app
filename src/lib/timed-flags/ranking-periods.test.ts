import { describe, expect, it } from "vitest";
import {
	buildRankingPeriodStates,
	openPositionTypes,
	RANKING_PERIOD_FLAG_NAMES,
} from "@/lib/timed-flags/ranking-periods";
import type { TimedFlagRow } from "@/lib/timed-flags/window";

const NOW = Date.parse("2026-08-16T12:00:00Z");
const HOUR = 3_600_000;

function iso(ms: number): string {
	return new Date(ms).toISOString();
}

function flagRow(name: string, overrides: Partial<TimedFlagRow> = {}): TimedFlagRow {
	return { name, enabled: true, starts_at: null, expires_at: iso(NOW + HOUR), ...overrides };
}

describe("buildRankingPeriodStates", () => {
	it("treats absent flag rows as closed periods", () => {
		const periods = buildRankingPeriodStates([], NOW);
		expect(periods).toHaveLength(2);
		expect(periods.every((p) => !p.active)).toBe(true);
		expect(openPositionTypes(periods)).toEqual([]);
	});

	it("opens maincomm and blockcomm together under the maincomm flag", () => {
		const periods = buildRankingPeriodStates([flagRow("maincomm-ranking-period")], NOW);
		expect(openPositionTypes(periods).sort()).toEqual(["blockcomm", "maincomm"]);
	});

	it("opens only subcomm under the subcomm flag", () => {
		const periods = buildRankingPeriodStates([flagRow("subcomm-ranking-period")], NOW);
		expect(openPositionTypes(periods)).toEqual(["subcomm"]);
	});

	it("marks an enabled future window as upcoming, not active", () => {
		const periods = buildRankingPeriodStates(
			[flagRow("subcomm-ranking-period", { starts_at: iso(NOW + HOUR) })],
			NOW,
		);
		const subcomm = periods.find((p) => p.key === "subcomm");
		expect(subcomm?.active).toBe(false);
		expect(subcomm?.upcoming).toBe(true);
	});

	it("covers every registered flag name", () => {
		expect(RANKING_PERIOD_FLAG_NAMES.sort()).toEqual([
			"maincomm-ranking-period",
			"subcomm-ranking-period",
		]);
	});
});
