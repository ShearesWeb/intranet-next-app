// src/features/ranking/services/user-ranking-service.ts
// Server-side business logic for user CCA preference rankings.
//
// Extracted from the route handlers to keep them thin. All functions
// expect an already-authenticated caller and throw on Supabase errors.

import { createClient } from "@/lib/supabase/server";
import { ApiError } from "@/lib/api/errors";
import { STAGED_RANK_OFFSET, NON_RANKABLE_POSITION_TYPES_FILTER } from "@/lib/cca/position-service";

// ── Types ──────────────────────────────────────────────────────────

interface CCAData {
	id: number;
	name: string;
	cca_type: string;
	description: string;
	image_url: string | null;
}

interface PositionAvailabilityRow {
	position_id: number;
	position_name: string;
	position_type: string;
	capacity: number;
	available_capacity: number;
	cca_id: number;
	cca_name: string;
	ccas: CCAData | CCAData[] | null;
}

export interface RankablePosition {
	id: number;
	name: string;
	cca_name: string;
	position_type: string;
	capacity: number;
	available_capacity: number;
	applied_count: number;
	description: string;
	user_ranking: number | null;
	is_selected: boolean;
}

export interface RankingEntry {
	position_id: number;
	ranking: number;
}

// ── Queries ────────────────────────────────────────────────────────

/**
 * Fetch positions the user can rank, enriched with their existing preferences.
 */
export async function getRankablePositions(userId: number): Promise<RankablePosition[]> {
	const supabase = await createClient();

	const { data: availablePositions, error: positionsError } = await supabase
		.from("cca_position_availability")
		.select(
			`
				position_id,
				position_name,
				position_type,
				capacity,
				available_capacity,
				cca_id,
				cca_name,
				ccas!inner (id, name, cca_type, description, image_url)
			`,
		)
		.gt("available_capacity", 0)
		.not("position_type", "in", NON_RANKABLE_POSITION_TYPES_FILTER)
		.order("position_name", { ascending: true });

	if (positionsError) {
		console.error("Error fetching available positions:", positionsError);
		throw new ApiError(500, "Failed to load positions");
	}

	const { data: userPreferences, error: prefError } = await supabase
		.from("cca_user_preferences")
		.select("position_id, rank")
		.eq("user_id", userId);

	if (prefError) {
		console.error("Error fetching user preferences:", prefError);
		throw new ApiError(500, "Failed to load your saved preferences");
	}

	const userPreferenceMap = new Map<number, number>(
		(userPreferences ?? []).map((p) => [p.position_id, p.rank]),
	);

	return ((availablePositions ?? []) as PositionAvailabilityRow[]).map((position) => {
		let ccaDescription = "No description available";
		const ccaJoin = Array.isArray(position.ccas) ? position.ccas[0] : position.ccas;
		if (ccaJoin) {
			ccaDescription = ccaJoin.description || ccaDescription;
		}

		const userRank = userPreferenceMap.get(position.position_id) ?? null;

		return {
			id: position.position_id,
			name: position.position_name,
			cca_name: position.cca_name || ccaJoin?.name || "Unknown",
			position_type: position.position_type,
			capacity: position.capacity,
			available_capacity: position.available_capacity,
			applied_count: 0,
			description: ccaDescription,
			user_ranking: userRank,
			is_selected: userRank !== null,
		};
	});
}

// ── Mutations ──────────────────────────────────────────────────────

/**
 * Replace all of the caller's CCA preference rankings.
 *
 * Uses the staged-rank pattern to avoid UNIQUE (user_id, rank) collisions
 * when rows swap positions in the new order.
 */
export async function saveRankings(userId: number, rankings: RankingEntry[]): Promise<void> {
	const supabase = await createClient();
	const positionIds = rankings.map((r) => r.position_id);

	// Prune previously-saved rows that aren't in the new payload.
	if (positionIds.length > 0) {
		const { error: pruneError } = await supabase
			.from("cca_user_preferences")
			.delete()
			.eq("user_id", userId)
			.not("position_id", "in", `(${positionIds.join(",")})`);

		if (pruneError) {
			console.error("Error pruning stale user preferences:", pruneError);
			throw new ApiError(500, "Failed to save rankings");
		}
	} else {
		const { error: clearError } = await supabase
			.from("cca_user_preferences")
			.delete()
			.eq("user_id", userId);

		if (clearError) {
			console.error("Error clearing user preferences:", clearError);
			throw new ApiError(500, "Failed to save rankings");
		}
		return;
	}

	// Staged-rank pass: avoid (user_id, rank) UNIQUE collisions.
	for (const r of rankings) {
		const { error: stageError } = await supabase.rpc("upsert_cca_user_preference", {
			p_position_id: r.position_id,
			p_rank: r.ranking + STAGED_RANK_OFFSET,
		});
		if (stageError) {
			console.error("Error staging user preference rank:", stageError);
			throw new ApiError(500, "Failed to save rankings");
		}
	}

	// Final-rank pass: write the real rank values.
	for (const r of rankings) {
		const { error: finalError } = await supabase.rpc("upsert_cca_user_preference", {
			p_position_id: r.position_id,
			p_rank: r.ranking,
		});
		if (finalError) {
			console.error("Error finalizing user preference rank:", finalError);
			throw new ApiError(500, "Failed to save rankings");
		}
	}
}
