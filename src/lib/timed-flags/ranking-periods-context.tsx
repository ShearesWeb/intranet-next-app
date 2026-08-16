"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useTimedFlags } from "@/hooks/use-timed-flags";
import {
	periodStateFrom,
	RANKING_PERIOD_FLAG_NAMES,
	RANKING_PERIOD_KEYS,
	RANKING_PERIODS,
	openPositionTypes,
	type RankingPeriodState,
} from "./ranking-periods";
import type { PositionType } from "@/types/user";

export interface RankingPeriodsValue {
	/** Null until the first flag fetch lands. */
	periods: RankingPeriodState[] | null;
	openTypes: PositionType[];
	anyOpen: boolean;
	loading: boolean;
	error: string | null;
}

const RankingPeriodsContext = createContext<RankingPeriodsValue>({
	periods: null,
	openTypes: [],
	anyOpen: false,
	loading: true,
	error: null,
});

export function RankingPeriodsProvider({ children }: { children: ReactNode }) {
	const { states, loading, error } = useTimedFlags(RANKING_PERIOD_FLAG_NAMES);

	const value = useMemo<RankingPeriodsValue>(() => {
		if (states === null) {
			return { periods: null, openTypes: [], anyOpen: false, loading, error };
		}
		const nowMs = Date.now();
		const periods = RANKING_PERIOD_KEYS.map((key) =>
			periodStateFrom(key, states[RANKING_PERIODS[key].flag], nowMs),
		);
		const openTypes = openPositionTypes(periods);
		return { periods, openTypes, anyOpen: openTypes.length > 0, loading: false, error };
	}, [states, loading, error]);

	return <RankingPeriodsContext.Provider value={value}>{children}</RankingPeriodsContext.Provider>;
}

export function useRankingPeriods(): RankingPeriodsValue {
	return useContext(RankingPeriodsContext);
}
