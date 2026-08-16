// Registry of time-windowed CCA ranking periods.
//
// Each period maps one `feature_flags` row to the position types a resident
// may rank while its window is open. Extend by adding an entry; everything
// downstream (routes, wizard, saved-preferences page) derives from this map.
// Pure module: safe to import from both server and client code.

import { evaluateWindow, missingFlagRow, type TimedFlagRow, type TimedFlagState } from "./window";
import type { PositionType } from "@/types/user";

export const RANKING_PERIODS = {
	maincomm: {
		flag: "maincomm-ranking-period",
		label: "Maincomm & Blockcomm",
		positionTypes: ["maincomm", "blockcomm"] as readonly PositionType[],
	},
	subcomm: {
		flag: "subcomm-ranking-period",
		label: "Subcomm",
		positionTypes: ["subcomm"] as readonly PositionType[],
	},
} as const;

export type RankingPeriodKey = keyof typeof RANKING_PERIODS;

export const RANKING_PERIOD_KEYS = Object.keys(RANKING_PERIODS) as RankingPeriodKey[];

export const RANKING_PERIOD_FLAG_NAMES = RANKING_PERIOD_KEYS.map(
	(key) => RANKING_PERIODS[key].flag,
);

/** Every position type covered by some ranking period; the rankable universe. */
export const RANKABLE_POSITION_TYPES: PositionType[] = [
	...new Set(RANKING_PERIOD_KEYS.flatMap((key) => RANKING_PERIODS[key].positionTypes)),
];

export interface RankingPeriodState {
	key: RankingPeriodKey;
	label: string;
	active: boolean;
	startsAt: string | null;
	expiresAt: string | null;
	/** True when the flag is enabled with a start still in the future. */
	upcoming: boolean;
	positionTypes: PositionType[];
}

export function periodStateFrom(
	key: RankingPeriodKey,
	flagState: TimedFlagState | undefined,
	nowMs: number,
): RankingPeriodState {
	const period = RANKING_PERIODS[key];
	const state = flagState ?? evaluateWindow(missingFlagRow(period.flag), nowMs);
	const startMs = state.startsAt === null ? null : Date.parse(state.startsAt);
	return {
		key,
		label: period.label,
		active: state.active,
		startsAt: state.startsAt,
		expiresAt: state.expiresAt,
		upcoming: state.enabled && !state.active && startMs !== null && startMs > nowMs,
		positionTypes: [...period.positionTypes],
	};
}

export function buildRankingPeriodStates(
	rows: TimedFlagRow[],
	nowMs: number,
): RankingPeriodState[] {
	const byName = new Map(rows.map((row) => [row.name, row]));
	return RANKING_PERIOD_KEYS.map((key) => {
		const row = byName.get(RANKING_PERIODS[key].flag) ?? missingFlagRow(RANKING_PERIODS[key].flag);
		return periodStateFrom(key, evaluateWindow(row, nowMs), nowMs);
	});
}

/** Position types a resident may rank right now: the union of open periods. */
export function openPositionTypes(periods: RankingPeriodState[]): PositionType[] {
	return periods.filter((p) => p.active).flatMap((p) => p.positionTypes);
}
