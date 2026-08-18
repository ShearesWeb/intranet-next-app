// Server-side business logic for a chair's candidate shortlist.
//
// Backed by `preferred_candidates` alone — the chair's own ranking, written
// whole-list through `set_preferred_candidates`. Residents' applications
// (`preferred_positions`) are deliberately never read here: who applied is
// private to the resident, mirroring how a chair's ranking never surfaces to
// residents. Chairs build their list by searching for candidates directly.
//
// See intranet/docs/api/cca-allocation.md.

import { createClient } from "@/lib/supabase/server";
import { ApiError } from "@/lib/api/errors";
import { canManagePositionServerSide } from "@/lib/cca/cca-chair-access";
import { RANKABLE_POSITION_TYPES } from "@/lib/timed-flags/ranking-periods";
import type { PositionType } from "@/types/user";
import type { SupabaseClient } from "@supabase/supabase-js";

// Chairs rank the same universe residents apply to. Untimed on purpose: chairs
// keep working their shortlists after a period closes.
const CHAIR_RANKABLE_POSITION_TYPES = new Set<string>(RANKABLE_POSITION_TYPES);

type ShortlistRow = {
	position_id: number;
	user_id: number;
	rank: number;
};

type ManagedRow = {
	cca_id: number;
	cca_name: string;
	positions: Array<{
		position_id: number;
		position_name: string;
		position_type: PositionType;
		description: string | null;
	}> | null;
};

type AvailabilityRow = {
	position_id: number;
	cca_id: number;
	capacity: number | null;
	filled: number;
	available: number | null;
};

export interface ChairApplicant {
	id: number;
	name: string;
	email: string;
	room: string;
	ranking: number | null;
}

/**
 * Verify the caller manages the position, using the RPC rather than inferring
 * it. Returns the parsed id so callers do not parse twice.
 */
async function resolveManagedPosition(supabase: SupabaseClient, positionIdStr: string) {
	const positionId = parseInt(positionIdStr, 10);
	if (isNaN(positionId)) throw new ApiError(400, "Invalid position ID");

	const { data: position, error } = await supabase
		.from("cca_positions")
		.select("id, position_type, cca_id")
		.eq("id", positionId)
		.single();

	if (error || !position) throw new ApiError(404, "Position not found");

	if (!CHAIR_RANKABLE_POSITION_TYPES.has((position.position_type || "").toLowerCase())) {
		throw new ApiError(403, "This position cannot be ranked");
	}

	const canManage = await canManagePositionServerSide(supabase, positionId);
	if (!canManage) {
		throw new ApiError(403, "You are not authorized to manage this position");
	}

	return { positionId, position };
}

/**
 * Every position the caller manages, with its applicants and remaining slots.
 *
 * Three round trips regardless of how many CCAs the caller administers:
 * `managed_cca_positions` is already grouped and chain-aware, and RLS on
 * `preferred_candidates` returns nothing for positions outside that chain, so
 * no client-side authorization filtering is needed.
 */
export async function getPositionsForChair() {
	const supabase = await createClient();

	const { data: managedRows, error: managedError } = await supabase
		.from("managed_cca_positions")
		.select("cca_id, cca_name, positions");

	if (managedError) {
		console.error("Error fetching managed_cca_positions:", managedError);
		throw new ApiError(500, "Failed to load managed positions");
	}

	const managed = (managedRows ?? []) as ManagedRow[];
	if (!managed.length) {
		return { positions: [], ccas: [] };
	}

	const rankablePositions = managed.flatMap((row) =>
		(row.positions ?? [])
			.filter((p) => CHAIR_RANKABLE_POSITION_TYPES.has((p.position_type || "").toLowerCase()))
			.map((p) => ({ ...p, cca_id: row.cca_id, cca_name: row.cca_name })),
	);

	if (!rankablePositions.length) {
		return { positions: [], ccas: [] };
	}

	const positionIds = rankablePositions.map((p) => p.position_id);

	const [shortlistResult, availabilityResult] = await Promise.all([
		supabase
			.from("preferred_candidates")
			.select("position_id, user_id, rank")
			.in("position_id", positionIds)
			.order("rank", { ascending: true }),
		supabase
			.from("position_availability")
			.select("position_id, cca_id, capacity, filled, available")
			.in("position_id", positionIds),
	]);

	if (shortlistResult.error) {
		console.error("Error fetching preferred candidates:", shortlistResult.error);
		throw new ApiError(500, "Failed to load candidates");
	}
	if (availabilityResult.error) {
		console.error("Error fetching position availability:", availabilityResult.error);
		throw new ApiError(500, "Failed to load positions");
	}

	const shortlist = (shortlistResult.data ?? []) as ShortlistRow[];

	// `preferred_candidates` is keys and ranks only; every signed-in caller can
	// read `users`, so fetch the display fields in one extra round trip.
	const candidateUserIds = Array.from(new Set(shortlist.map((row) => row.user_id)));
	const userById = new Map<number, { name: string; email: string; room: string }>();
	if (candidateUserIds.length) {
		const { data: userRows, error: usersError } = await supabase
			.from("users")
			.select("id, name, email, room")
			.in("id", candidateUserIds);
		if (usersError) {
			console.error("Error fetching candidate details:", usersError);
			throw new ApiError(500, "Failed to load candidate details");
		}
		for (const row of userRows ?? []) {
			userById.set(row.id, { name: row.name, email: row.email, room: row.room });
		}
	}

	const availabilityByPosition = new Map<number, AvailabilityRow>(
		((availabilityResult.data ?? []) as AvailabilityRow[]).map((row) => [row.position_id, row]),
	);

	const applicantsByPosition = new Map<number, ChairApplicant[]>();
	for (const row of shortlist) {
		const list = applicantsByPosition.get(row.position_id) ?? [];
		const user = userById.get(row.user_id);
		list.push({
			id: row.user_id,
			name: user?.name ?? "Unknown",
			email: user?.email ?? "",
			room: user?.room ?? "N/A",
			ranking: row.rank,
		});
		applicantsByPosition.set(row.position_id, list);
	}

	const positions = rankablePositions.map((position) => {
		const availability = availabilityByPosition.get(position.position_id);

		return {
			id: position.position_id,
			cca_id: position.cca_id,
			name: position.position_name,
			cca_name: position.cca_name,
			capacity: availability?.capacity ?? null,
			available_capacity: availability?.available ?? null,
			position_type: position.position_type,
			// Already in rank order from the shortlist query.
			applicants: applicantsByPosition.get(position.position_id) ?? [],
		};
	});

	const ccaMap = new Map<
		number,
		{ cca_id: number; cca_name: string; positions: typeof positions }
	>();
	for (const pos of positions) {
		const existing = ccaMap.get(pos.cca_id);
		if (existing) {
			existing.positions.push(pos);
		} else {
			ccaMap.set(pos.cca_id, { cca_id: pos.cca_id, cca_name: pos.cca_name, positions: [pos] });
		}
	}

	return { positions, ccas: Array.from(ccaMap.values()) };
}

/** The position's current shortlist, in rank order. */
async function currentShortlist(supabase: SupabaseClient, positionId: number): Promise<number[]> {
	const { data, error } = await supabase
		.from("preferred_candidates")
		.select("user_id, rank")
		.eq("position_id", positionId)
		.order("rank", { ascending: true });

	if (error) {
		console.error("Error reading shortlist:", error);
		throw new ApiError(500, "Failed to load current shortlist");
	}

	return (data ?? []).map((row) => row.user_id);
}

async function writeShortlist(
	supabase: SupabaseClient,
	positionId: number,
	userIds: number[],
): Promise<void> {
	const { error } = await supabase.rpc("set_preferred_candidates", {
		p_position_id: positionId,
		p_user_ids: userIds,
	});

	if (error) {
		console.error("Error writing shortlist:", error);
		throw new ApiError(500, error.message);
	}
}

/**
 * Append a candidate to the end of the shortlist.
 *
 * `set_preferred_candidates` replaces the whole list, so this is a
 * read-modify-write rather than a single-row insert.
 */
export async function addApplicant(positionIdStr: string, body: { user_id: number }) {
	const supabase = await createClient();
	const { positionId } = await resolveManagedPosition(supabase, positionIdStr);

	if (!body.user_id) throw new ApiError(400, "Missing user_id");

	const existing = await currentShortlist(supabase, positionId);
	if (existing.includes(body.user_id)) {
		throw new ApiError(400, "Applicant already exists for this position");
	}

	const next = [...existing, body.user_id];
	await writeShortlist(supabase, positionId, next);

	return { ranking: next.length, message: `Applicant added with ranking ${next.length}` };
}

export async function removeApplicant(positionIdStr: string, body: { user_id: number }) {
	const supabase = await createClient();
	const { positionId } = await resolveManagedPosition(supabase, positionIdStr);

	if (!body.user_id) throw new ApiError(400, "Missing user_id");

	const existing = await currentShortlist(supabase, positionId);
	await writeShortlist(
		supabase,
		positionId,
		existing.filter((id) => id !== body.user_id),
	);
}

/**
 * Replace the position's whole candidate ranking.
 *
 * Rank comes from array order, so this is one call. The previous implementation
 * pruned removed applicants, then issued N staging RPCs at rank+1000, then N
 * more at the real rank, purely to avoid a transient duplicate rank.
 */
export async function savePositionRankings(
	positionIdStr: string,
	body: { rankings: Array<{ user_id: number; ranking: number }> },
) {
	const supabase = await createClient();
	const { positionId } = await resolveManagedPosition(supabase, positionIdStr);

	if (!body.rankings || !Array.isArray(body.rankings)) {
		throw new ApiError(400, "Missing or invalid rankings array");
	}

	const orderedUserIds = [...body.rankings]
		.sort((a, b) => a.ranking - b.ranking)
		.map((entry) => entry.user_id);

	if (new Set(orderedUserIds).size !== orderedUserIds.length) {
		throw new ApiError(400, "A candidate may only appear once in the shortlist");
	}

	await writeShortlist(supabase, positionId, orderedUserIds);

	return {
		message: `Updated rankings for ${orderedUserIds.length} applicants`,
		updated_count: orderedUserIds.length,
	};
}
