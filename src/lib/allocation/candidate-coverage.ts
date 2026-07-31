/** Chairs are advised to rank this multiple of a position's open slots. */
export const COVERAGE_TARGET_MULTIPLIER = 2;

export type CoverageTier = "critical" | "low" | "good" | "target" | "full";

export interface CandidateCoverage {
	tier: CoverageTier;
	/** Whole-percent coverage of open slots; null when the position has no open slots. */
	percent: number | null;
	/** Recommended number of ranked candidates (200% of open slots). */
	target: number;
}

/**
 * Coverage of a position's candidate list vs its open slots.
 * Tiers: <100% critical, >=100% low, >=150% good, >=200% target.
 */
export function getCandidateCoverage(candidateCount: number, openSlots: number): CandidateCoverage {
	if (openSlots <= 0) return { tier: "full", percent: null, target: 0 };

	const ratio = candidateCount / openSlots;
	// Floor so the shown percent never crosses a tier boundary the raw ratio didn't.
	const percent = Math.floor(ratio * 100);
	const target = openSlots * COVERAGE_TARGET_MULTIPLIER;

	if (percent < 100) return { tier: "critical", percent, target };
	if (percent < 150) return { tier: "low", percent, target };
	if (percent < 200) return { tier: "good", percent, target };
	return { tier: "target", percent, target };
}
