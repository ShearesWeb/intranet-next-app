import { createClient } from "@/lib/supabase/server";
import { fetchUserInfo } from "@/lib/auth/fetch-user-info";
import { checkCcaAuthorization } from "@/lib/cca/cca-chair-access";
import { ApiError } from "@/lib/api/errors";
import type { PositionType, UserAppointment } from "@/types/user";
import type { SupabaseClient } from "@supabase/supabase-js";

export const NON_RANKABLE_POSITION_TYPES_FILTER = "(lead,vice,resident)";
const NON_APPLICANT_POSITION_TYPES = new Set(["lead", "vice", "resident"]);
export const STAGED_RANK_OFFSET = 1000;

export type RankingAccessPosition = {
	id: UserAppointment["position_id"];
	cca_id: UserAppointment["cca_id"];
	name: UserAppointment["position_name"];
	position_type: PositionType;
};

type PositionAvailabilityRow = {
	position_id: number;
	cca_id: number;
	position_name: string;
	position_type: PositionType;
	capacity: number;
	available_capacity: number;
	cca_name: string;
};

type PreferenceRow = {
	position_id: number;
	user_id: number;
	rank: number;
};

type DirectoryRow = {
	id: number;
	name: string;
	email: string;
	room: string;
};

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function resolvePositionWithAccess(
	supabase: SupabaseClient,
	positionIdStr: string,
) {
	const positionId = parseInt(positionIdStr, 10);
	if (isNaN(positionId)) throw new ApiError(400, "Invalid position ID");

	const { data: position, error: positionError } = await supabase
		.from("cca_positions")
		.select("id, position_type, ccas!inner(id, name, cca_type)")
		.eq("id", positionId)
		.single();

	if (positionError || !position) throw new ApiError(404, "Position not found");

	if (NON_APPLICANT_POSITION_TYPES.has((position.position_type || "").toLowerCase())) {
		throw new ApiError(403, "This position cannot be ranked");
	}

	const cca = Array.isArray(position.ccas) ? position.ccas[0] : position.ccas;
	const requestingUser = await fetchUserInfo();
	const accessResult = await checkCcaAuthorization({
		requestingUser,
		cca,
		require: "chair",
		supabase,
	});

	if (!accessResult.ok) throw new ApiError(accessResult.status, accessResult.error);

	return { positionId, position, cca, requestingUser };
}

// ---------------------------------------------------------------------------
// GET positions for chair
// ---------------------------------------------------------------------------

export async function getPositionsForChair() {
	const supabase = await createClient();
	const requestingUser = await fetchUserInfo();

	if (!requestingUser) {
		return { positions: [], ccas: [] };
	}

	// Use managed_cca_positions view to get ALL positions accessible via the
	// reporting chain — not just CCAs where user holds lead/vice.
	const { data: managedRows, error: managedError } = await supabase
		.from("managed_cca_positions")
		.select("cca_id, cca_name, positions");

	if (managedError) {
		console.error("Error fetching managed_cca_positions:", managedError);
		throw new ApiError(500, "Failed to load managed positions");
	}

	// Extract all position IDs the user can manage
	const managedPositionIds: number[] = [];
	const ccaIdSet = new Set<number>();
	for (const row of managedRows ?? []) {
		ccaIdSet.add(row.cca_id);
		const positions = (row.positions ?? []) as Array<{ position_id: number }>;
		for (const p of positions) {
			managedPositionIds.push(p.position_id);
		}
	}

	// Also include CCAs from JWT lead/vice appointments (belt-and-suspenders)
	const accessResult = await checkCcaAuthorization({ requestingUser });
	if (accessResult.ok) {
		for (const ccaId of accessResult.data.authorizedCcaIds) {
			ccaIdSet.add(ccaId);
		}
	}

	const authorizedCcaIds = Array.from(ccaIdSet);
	if (authorizedCcaIds.length === 0) {
		return { positions: [], ccas: [] };
	}

	const { data: allPositions, error: posError } = await supabase
		.from("cca_position_availability")
		.select(
			"position_id, cca_id, position_name, position_type, capacity, available_capacity, cca_name",
		)
		.in("cca_id", authorizedCcaIds)
		.gt("available_capacity", 0)
		.not("position_type", "in", NON_RANKABLE_POSITION_TYPES_FILTER);

	if (posError) {
		console.error("Error fetching position availability:", posError);
		throw new ApiError(500, "Failed to load positions");
	}

	const allTypedPositions = (allPositions ?? []) as PositionAvailabilityRow[];

	// For reporting-chain users, filter down to only positions they actually manage.
	// Lead/vice holders see everything in their CCA; reporting-chain users see only
	// the positions under them.
	const leadViceCcaIds = new Set(
		accessResult.ok ? accessResult.data.authorizedCcaIds : [],
	);
	const managedPositionIdSet = new Set(managedPositionIds);

	const typedPositions = allTypedPositions.filter((p) =>
		leadViceCcaIds.has(p.cca_id) || managedPositionIdSet.has(p.position_id),
	);

	if (typedPositions.length === 0) {
		return { positions: [], ccas: [] };
	}

	const positionIds = typedPositions.map((p) => p.position_id);

	const { data: prefRows, error: prefError } = await supabase
		.from("cca_position_preferences")
		.select("position_id, user_id, rank")
		.in("position_id", positionIds)
		.order("rank", { ascending: true });

	if (prefError) {
		console.error("Error fetching position preferences:", prefError);
		throw new ApiError(500, "Failed to load applicants");
	}

	const userIds = Array.from(new Set((prefRows ?? []).map((r) => r.user_id)));
	const { data: dirRows, error: dirError } = userIds.length
		? await supabase
				.from("authenticated_user_directory")
				.select("id, name, email, room")
				.in("id", userIds)
		: { data: [] as DirectoryRow[], error: null };

	if (dirError) {
		console.error("Error fetching user directory:", dirError);
		throw new ApiError(500, "Failed to load applicant details");
	}

	const userById = new Map<number, DirectoryRow>(
		(dirRows ?? []).map((u) => [u.id, u as DirectoryRow]),
	);

	const applicantsByPosition = new Map<
		number,
		Array<{ id: number; name: string; email: string; room: string; ranking: number }>
	>();

	for (const row of (prefRows ?? []) as PreferenceRow[]) {
		const user = userById.get(row.user_id);
		if (!user) continue;
		const arr = applicantsByPosition.get(row.position_id) ?? [];
		arr.push({
			id: user.id,
			name: user.name,
			email: user.email,
			room: user.room,
			ranking: row.rank,
		});
		applicantsByPosition.set(row.position_id, arr);
	}

	const positions = typedPositions.map((position) => {
		const applicants = applicantsByPosition.get(position.position_id) ?? [];
		return {
			id: position.position_id,
			cca_id: position.cca_id,
			name: position.position_name,
			cca_name: position.cca_name,
			capacity: position.capacity,
			available_capacity: position.available_capacity,
			applied_count: applicants.length,
			position_type: position.position_type,
			applicants,
		};
	});

	// Group by CCA for the multi-CCA management UI
	const ccaMap = new Map<number, { cca_id: number; cca_name: string; positions: typeof positions }>();
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

// ---------------------------------------------------------------------------
// POST add applicant
// ---------------------------------------------------------------------------

export async function addApplicant(positionIdStr: string, body: { user_id: number }) {
	const supabase = await createClient();
	const { positionId } = await resolvePositionWithAccess(supabase, positionIdStr);

	if (!body.user_id) throw new ApiError(400, "Missing user_id");

	// Check if applicant already exists
	const { data: existingApplicant } = await supabase
		.from("cca_position_preferences")
		.select("rank")
		.eq("position_id", positionId)
		.eq("user_id", body.user_id)
		.maybeSingle();

	if (existingApplicant) {
		throw new ApiError(400, "Applicant already exists for this position");
	}

	// Determine next rank
	const { data: currentApplicants, error: countError } = await supabase
		.from("cca_position_preferences")
		.select("rank")
		.eq("position_id", positionId)
		.order("rank", { ascending: false })
		.limit(1);

	if (countError) {
		console.error("Error counting current applicants:", countError);
		throw new ApiError(500, "Failed to determine ranking");
	}

	const nextRanking =
		currentApplicants && currentApplicants.length > 0
			? (currentApplicants[0].rank || 0) + 1
			: 1;

	const { error: rpcError } = await supabase.rpc("upsert_cca_position_preference", {
		p_position_id: positionId,
		p_user_id: body.user_id,
		p_rank: nextRanking,
	});

	if (rpcError) {
		console.error("Error adding applicant via upsert_cca_position_preference:", rpcError);
		throw new ApiError(500, rpcError.message);
	}

	return { ranking: nextRanking, message: `Applicant added with ranking ${nextRanking}` };
}

// ---------------------------------------------------------------------------
// DELETE remove applicant
// ---------------------------------------------------------------------------

export async function removeApplicant(positionIdStr: string, body: { user_id: number }) {
	const supabase = await createClient();
	const { positionId } = await resolvePositionWithAccess(supabase, positionIdStr);

	if (!body.user_id) throw new ApiError(400, "Missing user_id");

	const { error } = await supabase
		.from("cca_position_preferences")
		.delete()
		.eq("position_id", positionId)
		.eq("user_id", body.user_id);

	if (error) {
		console.error("Error removing applicant:", error);
		throw new ApiError(500, error.message);
	}
}

// ---------------------------------------------------------------------------
// POST save rankings for position
// ---------------------------------------------------------------------------

export async function savePositionRankings(
	positionIdStr: string,
	body: { rankings: Array<{ user_id: number; ranking: number }> },
) {
	const supabase = await createClient();
	const { positionId } = await resolvePositionWithAccess(supabase, positionIdStr);

	if (!body.rankings || !Array.isArray(body.rankings)) {
		throw new ApiError(400, "Missing or invalid rankings array");
	}

	const rankingUserIds = body.rankings.map((r) => r.user_id);

	// Prune removed applicants
	if (rankingUserIds.length > 0) {
		const { error: deleteError } = await supabase
			.from("cca_position_preferences")
			.delete()
			.eq("position_id", positionId)
			.not("user_id", "in", `(${rankingUserIds.join(",")})`);

		if (deleteError) {
			console.error("Error pruning removed applicants:", deleteError);
			throw new ApiError(500, "Failed to clear removed applicants");
		}
	} else {
		const { error: deleteError } = await supabase
			.from("cca_position_preferences")
			.delete()
			.eq("position_id", positionId);

		if (deleteError) {
			console.error("Error clearing position preferences:", deleteError);
			throw new ApiError(500, "Failed to clear existing rankings");
		}
	}

	// Staged-rank workaround for DEFERRABLE INITIALLY DEFERRED unique constraint.
	// Pass 1: stage to high temporary rank; Pass 2: apply real rank.
	for (const r of body.rankings) {
		const { error: stageError } = await supabase.rpc("upsert_cca_position_preference", {
			p_position_id: positionId,
			p_user_id: r.user_id,
			p_rank: r.ranking + STAGED_RANK_OFFSET,
		});
		if (stageError) {
			console.error("Error staging preference rank:", stageError);
			throw new ApiError(500, "Failed to stage rankings");
		}
	}

	for (const r of body.rankings) {
		const { error: finalError } = await supabase.rpc("upsert_cca_position_preference", {
			p_position_id: positionId,
			p_user_id: r.user_id,
			p_rank: r.ranking,
		});
		if (finalError) {
			console.error("Error finalizing preference rank:", finalError);
			throw new ApiError(500, "Failed to save new rankings");
		}
	}

	return {
		message: `Updated rankings for ${body.rankings.length} applicants`,
		updated_count: body.rankings.length,
	};
}
