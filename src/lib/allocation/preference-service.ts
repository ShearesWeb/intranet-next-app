// Server-side business logic for a resident's own CCA preference list.
//
// Backed by `preferred_positions` (own-rows-only under RLS) and the
// `set_preferred_positions` RPC. See intranet/docs/api/cca-allocation.md.

import { createClient } from "@/lib/supabase/server";
import { ApiError } from "@/lib/api/errors";
import type { PositionType } from "@/types/user";

/** Positions nobody applies to: leadership seats and the auto-managed resident rows. */
const NON_APPLICANT_POSITION_TYPES = ["lead", "vice", "resident"] as const;

export const NON_RANKABLE_POSITION_TYPES_FILTER = `(${NON_APPLICANT_POSITION_TYPES.join(",")})`;

type CcaRow = {
	id: number;
	name: string;
	kind: string;
	description: string | null;
	image_url: string | null;
};

type PositionRow = {
	id: number;
	name: string;
	position_type: PositionType;
	description: string | null;
	capacity: number | null;
	cca_id: number;
	ccas: CcaRow | CcaRow[] | null;
};

type AvailabilityRow = {
	position_id: number;
	capacity: number | null;
	filled: number;
	available: number | null;
};

export interface RankablePosition {
	id: number;
	name: string;
	cca_name: string;
	position_type: string;
	capacity: number | null;
	available_capacity: number | null;
	description: string;
	user_ranking: number | null;
	is_selected: boolean;
}

export interface RankingEntry {
	position_id: number;
	ranking: number;
}

function unwrapCca(value: PositionRow["ccas"]): CcaRow | null {
	if (!value) return null;
	return Array.isArray(value) ? (value[0] ?? null) : value;
}

/**
 * Positions the caller can rank, enriched with their existing preferences.
 *
 * `position_availability` is keys and counts only, so names come from
 * `cca_positions` and `ccas`, both of which every signed-in caller can read.
 * Kept as two round trips rather than a PostgREST embed of the view: the join
 * is over a few hundred rows and this does not depend on PostgREST inferring a
 * relationship to a view.
 */
export async function getRankablePositions(userId: number): Promise<RankablePosition[]> {
	const supabase = await createClient();

	const [positionsResult, availabilityResult, preferencesResult] = await Promise.all([
		supabase
			.from("cca_positions")
			.select(
				"id, name, position_type, description, capacity, cca_id, ccas!inner(id, name, kind, description, image_url)",
			)
			.not("position_type", "in", NON_RANKABLE_POSITION_TYPES_FILTER)
			.order("name", { ascending: true }),
		supabase.from("position_availability").select("position_id, capacity, filled, available"),
		supabase.from("preferred_positions").select("position_id, rank").eq("user_id", userId),
	]);

	if (positionsResult.error) {
		console.error("Error fetching positions:", positionsResult.error);
		throw new ApiError(500, "Failed to load positions");
	}
	if (availabilityResult.error) {
		console.error("Error fetching position availability:", availabilityResult.error);
		throw new ApiError(500, "Failed to load positions");
	}
	if (preferencesResult.error) {
		console.error("Error fetching preferences:", preferencesResult.error);
		throw new ApiError(500, "Failed to load your saved preferences");
	}

	const availabilityByPosition = new Map<number, AvailabilityRow>(
		((availabilityResult.data ?? []) as AvailabilityRow[]).map((row) => [row.position_id, row]),
	);
	const rankByPosition = new Map<number, number>(
		(preferencesResult.data ?? []).map((p) => [p.position_id, p.rank]),
	);

	return ((positionsResult.data ?? []) as unknown as PositionRow[])
		.filter((position) => {
			const availability = availabilityByPosition.get(position.id);
			// Null capacity means uncapped, which is always open.
			return !availability || availability.available === null || availability.available > 0;
		})
		.map((position) => {
			const cca = unwrapCca(position.ccas);
			const availability = availabilityByPosition.get(position.id);
			const userRank = rankByPosition.get(position.id) ?? null;

			return {
				id: position.id,
				name: position.name,
				cca_name: cca?.name || "Unknown",
				position_type: position.position_type,
				capacity: availability?.capacity ?? position.capacity,
				available_capacity: availability?.available ?? null,
				description: position.description || cca?.description || "No description available",
				user_ranking: userRank,
				is_selected: userRank !== null,
			};
		});
}

/**
 * Replace the caller's whole preference list.
 *
 * `set_preferred_positions` takes rank from array order, deletes anything
 * absent, and clears the list on an empty array. That replaces the old
 * delete-then-stage-then-finalise dance, which issued 2N sequential RPCs with a
 * +1000 rank offset to dodge a deferred unique constraint. The caller is
 * inferred from the JWT, so there is no user argument.
 */
export async function saveRankings(_userId: number, rankings: RankingEntry[]): Promise<void> {
	const supabase = await createClient();

	const orderedPositionIds = [...rankings]
		.sort((a, b) => a.ranking - b.ranking)
		.map((entry) => entry.position_id);

	if (new Set(orderedPositionIds).size !== orderedPositionIds.length) {
		throw new ApiError(400, "A position may only appear once in your preferences");
	}

	const { error } = await supabase.rpc("set_preferred_positions", {
		p_position_ids: orderedPositionIds,
	});

	if (error) {
		console.error("Error saving preferences:", error);
		throw new ApiError(500, "Failed to save rankings");
	}
}
