// Server-side business logic for a resident's own CCA preference list.
//
// Backed by `preferred_positions` (own-rows-only under RLS) and the
// `set_preferred_positions` RPC. See intranet/docs/api/cca-allocation.md.

import { createClient } from "@/lib/supabase/server";
import { ApiError } from "@/lib/api/errors";
import type { PositionType } from "@/types/user";

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

// PostgREST types embedded to-one joins as object-or-array; collapse to one.
function unwrapJoin<T>(value: T | T[] | null | undefined): T | null {
	if (!value) return null;
	return Array.isArray(value) ? (value[0] ?? null) : value;
}

type SavedPreferenceJoinRow = {
	position_id: number;
	cca_positions: { position_type: PositionType } | { position_type: PositionType }[] | null;
};

/**
 * Positions the caller can rank, enriched with their existing preferences.
 *
 * `allowedTypes` is the union of the ranking periods open right now; the
 * caller resolves it from the timed feature flags. An empty list means every
 * period is closed, so nothing is rankable.
 *
 * `position_availability` is keys and counts only, so names come from
 * `cca_positions` and `ccas`, both of which every signed-in caller can read.
 * Kept as two round trips rather than a PostgREST embed of the view: the join
 * is over a few hundred rows and this does not depend on PostgREST inferring a
 * relationship to a view.
 */
export async function getRankablePositions(
	userId: number,
	allowedTypes: PositionType[],
): Promise<RankablePosition[]> {
	if (allowedTypes.length === 0) return [];

	const supabase = await createClient();

	const [positionsResult, availabilityResult, preferencesResult] = await Promise.all([
		supabase
			.from("cca_positions")
			.select(
				"id, name, position_type, description, capacity, cca_id, ccas!inner(id, name, kind, description, image_url)",
			)
			.in("position_type", allowedTypes)
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
 * Replace the open-period slice of the caller's preference list.
 *
 * `openTypes` is the union of the ranking periods open right now. Every
 * submitted position must belong to one of them; positions saved during a
 * period that has since closed are locked, so they are carried over
 * server-side in their stored order and the submission appends after them.
 * The whole composed list then goes to `set_preferred_positions`, which takes
 * rank from array order, deletes anything absent, and infers the caller from
 * the JWT.
 */
export async function saveRankings(
	userId: number,
	rankings: RankingEntry[],
	openTypes: PositionType[],
): Promise<void> {
	if (openTypes.length === 0) {
		throw new ApiError(403, "Preference submissions are closed right now.");
	}

	const supabase = await createClient();

	const submittedIds = [...rankings]
		.sort((a, b) => a.ranking - b.ranking)
		.map((entry) => entry.position_id);

	if (new Set(submittedIds).size !== submittedIds.length) {
		throw new ApiError(400, "A position may only appear once in your preferences");
	}

	const openTypeSet = new Set<string>(openTypes);

	if (submittedIds.length > 0) {
		const { data: submittedRows, error: submittedError } = await supabase
			.from("cca_positions")
			.select("id, position_type")
			.in("id", submittedIds);

		if (submittedError) {
			console.error("Error validating submitted positions:", submittedError);
			throw new ApiError(500, "Failed to save rankings");
		}

		const typeById = new Map(
			(submittedRows ?? []).map((row) => [row.id as number, row.position_type as string]),
		);
		for (const id of submittedIds) {
			const positionType = typeById.get(id);
			if (!positionType || !openTypeSet.has(positionType)) {
				throw new ApiError(403, "A submitted position is not open for preferences right now.");
			}
		}
	}

	const { data: savedRows, error: savedError } = await supabase
		.from("preferred_positions")
		.select("position_id, cca_positions!inner(position_type)")
		.eq("user_id", userId)
		.order("rank", { ascending: true });

	if (savedError) {
		console.error("Error loading saved preferences:", savedError);
		throw new ApiError(500, "Failed to save rankings");
	}

	const lockedIds = ((savedRows ?? []) as unknown as SavedPreferenceJoinRow[])
		.filter((row) => {
			const position = unwrapJoin(row.cca_positions);
			return position !== null && !openTypeSet.has(position.position_type);
		})
		.map((row) => row.position_id);

	const { error } = await supabase.rpc("set_preferred_positions", {
		p_position_ids: [...lockedIds, ...submittedIds],
	});

	if (error) {
		console.error("Error saving preferences:", error);
		throw new ApiError(500, "Failed to save rankings");
	}
}
