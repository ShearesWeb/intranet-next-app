// Server-side reads of the `feature_flags` table. RLS grants SELECT to every
// role, so the anon-key client can read it for any caller.

import { createClient } from "@/lib/supabase/server";
import { ApiError } from "@/lib/api/errors";
import { missingFlagRow, type TimedFlagRow } from "./window";
import {
	buildRankingPeriodStates,
	RANKING_PERIOD_FLAG_NAMES,
	type RankingPeriodState,
} from "./ranking-periods";

/** Rows for the requested flags, in request order; absent flags come back disabled. */
export async function getTimedFlagRows(names: string[]): Promise<TimedFlagRow[]> {
	if (names.length === 0) return [];

	const supabase = await createClient();
	const { data, error } = await supabase
		.from("feature_flags")
		.select("name, enabled, starts_at, expires_at")
		.in("name", names);

	if (error) {
		console.error("Error fetching feature flags:", error);
		throw new ApiError(500, "Failed to load feature flags");
	}

	const byName = new Map((data ?? []).map((row) => [row.name, row as TimedFlagRow]));
	return names.map((name) => byName.get(name) ?? missingFlagRow(name));
}

/** Ranking periods evaluated against the server clock — the authoritative view. */
export async function getRankingPeriodStates(): Promise<RankingPeriodState[]> {
	const rows = await getTimedFlagRows(RANKING_PERIOD_FLAG_NAMES);
	return buildRankingPeriodStates(rows, Date.now());
}
