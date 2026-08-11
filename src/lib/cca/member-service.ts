import { createClient } from "@/lib/supabase/server";
import { unwrapRelation } from "@/lib/supabase/helpers";
import { ApiError } from "@/lib/api/errors";
import {
	canManageCcaMembers,
	getCcaMemberManagementDisabledMessage,
} from "@/lib/cca/cca-member-management";
import { normalizeTeamStatus, TEAM_STATUS_ORDER } from "@/lib/cca/team-status";
import { getManagedCcaAccess } from "@/lib/cca/cca-management-access";
import { fetchUserInfo } from "@/lib/auth/fetch-user-info";
import type {
	MemberJoinPosition,
	MemberUpdate,
	MemberWithJoins,
	TeamStatus,
} from "@/types/members";

interface TransformedMember {
	user_id: number;
	name: string;
	email: string;
	room: string;
	position_id?: number;
	position_name: string;
	position_type: string;
	points: number;
	appointed_date: string;
	team_status?: string | null;
	commitment_period?: string | null;
}

type CcaRow = { id: number; name: string; cca_kind: string };

/**
 * Kinds for which a team standing means anything.
 *
 * The schema calls `team_status` sports-only but does not enforce it, and this
 * hall has always tracked a standing for culture too. Both kinds share the one
 * `enum.team_status` ladder now; the old per-kind value split is gone.
 */
const TEAM_STATUS_CCA_KINDS = new Set(["sports", "culture"]);

/** Shared: resolve CCA row and verify chair access for member management. */
async function resolveCcaWithAccess(ccaIdStr: string) {
	const supabase = await createClient();
	const requestingUser = await fetchUserInfo();

	if (!requestingUser) throw new ApiError(401, "Unauthorized");

	const ccaId = parseInt(ccaIdStr, 10);
	if (isNaN(ccaId)) throw new ApiError(400, "Invalid CCA ID");

	const { data: ccaData, error: ccaError } = await supabase
		.from("ccas")
		.select("id, name, kind")
		.eq("id", ccaId)
		.single();

	if (ccaError || !ccaData) throw new ApiError(404, "CCA not found");

	// `ccas.kind` is the column; the app carries it as `cca_kind` internally to
	// match the shape `my_profile.appointments` already uses.
	const row: CcaRow = { id: ccaData.id, name: ccaData.name, cca_kind: ccaData.kind };

	return { supabase, requestingUser, ccaData: row };
}

async function requireMemberManagementAccess(ccaIdStr: string) {
	const ctx = await resolveCcaWithAccess(ccaIdStr);

	const authResult = await getManagedCcaAccess({
		supabase: ctx.supabase,
		requestingUser: ctx.requestingUser,
		cca: ctx.ccaData,
		accessLevel: "manage_members",
	});

	if (!authResult.ok) throw new ApiError(authResult.status, authResult.error);

	return ctx;
}

// ---------------------------------------------------------------------------
// GET members
// ---------------------------------------------------------------------------

export async function getMembers(ccaIdStr: string) {
	const { supabase, ccaData } = await requireMemberManagementAccess(ccaIdStr);

	const { data: memberPositionId } = await supabase
		.from("cca_positions")
		.select("id")
		.eq("cca_id", ccaData.id)
		.eq("position_type", "member")
		.single();

	const { data: allPositions } = await supabase
		.from("cca_positions")
		.select("id, name, position_type")
		.eq("cca_id", ccaData.id)
		.order("name");

	// Filter on the denormalized `cca_appointments.cca_id` rather than through the
	// embedded position. A trigger keeps it true and a composite FK makes drift
	// impossible, so this is exact and saves filtering through the join.
	const { data: ccaMembers, error: membersError } = await supabase
		.from("cca_appointments")
		.select(
			`
			user_id,
			points,
			created_at,
			team_status,
			commitment_period,
			users!inner(id, name, email, room),
			cca_positions!inner(id, name, position_type, cca_id)
		`,
		)
		.eq("cca_id", ccaData.id);

	if (membersError) {
		console.error("Error fetching CCA members:", membersError);
		throw new ApiError(500, "Failed to fetch members");
	}

	const transformedMembers: TransformedMember[] = [];

	(ccaMembers ?? []).forEach((member: MemberWithJoins) => {
		const userData = unwrapRelation(member.users);
		const positionData = unwrapRelation<MemberJoinPosition>(member.cca_positions);

		if (userData && positionData) {
			transformedMembers.push({
				user_id: member.user_id,
				name: userData.name,
				email: userData.email,
				room: userData.room,
				position_id: positionData.id,
				position_name: positionData.name,
				position_type: positionData.position_type,
				points: member.points || 0,
				appointed_date: member.created_at,
				team_status: normalizeTeamStatus(member.team_status),
				commitment_period: member.commitment_period,
			});
		}
	});

	const groupedMembers = {
		lead: transformedMembers
			.filter((m) => m.position_type === "lead")
			.sort((a, b) => a.position_name.localeCompare(b.position_name)),
		vice: transformedMembers
			.filter((m) => m.position_type === "vice")
			.sort((a, b) => a.position_name.localeCompare(b.position_name)),
		maincomm: transformedMembers
			.filter((m) => ["maincomm", "blockcomm"].includes(m.position_type))
			.sort((a, b) => a.position_name.localeCompare(b.position_name)),
		subcomm: transformedMembers
			.filter((m) => m.position_type === "subcomm")
			.sort((a, b) => a.position_name.localeCompare(b.position_name)),
		teamManager: transformedMembers
			.filter((m) => m.position_type === "team-manager")
			.sort((a, b) => a.position_name.localeCompare(b.position_name)),
		varsity: transformedMembers
			.filter((m) => m.team_status === "varsity")
			.sort((a, b) => a.name.localeCompare(b.name)),
		mainTeam: transformedMembers
			.filter((m) => m.team_status === "main-team")
			.sort((a, b) => a.name.localeCompare(b.name)),
		reserve: transformedMembers
			.filter((m) => m.team_status === "reserve")
			.sort((a, b) => a.name.localeCompare(b.name)),
		shortlisted: transformedMembers
			.filter((m) => m.team_status === "shortlisted")
			.sort((a, b) => a.name.localeCompare(b.name)),
		members: transformedMembers
			.filter((m) => m.position_type === "member" && (!m.team_status || m.team_status === "none"))
			.sort((a, b) => a.name.localeCompare(b.name)),
	};

	return {
		cca: { id: ccaData.id, name: ccaData.name, cca_kind: ccaData.cca_kind },
		groupedMembers,
		member_position_id: memberPositionId?.id,
		all_positions: allPositions,
		total_members: transformedMembers.length,
		permissions: {
			canManageMembers: canManageCcaMembers(ccaData.cca_kind),
			ccaKind: ccaData.cca_kind,
			managementMessage: getCcaMemberManagementDisabledMessage(ccaData.cca_kind),
		},
	};
}

// ---------------------------------------------------------------------------
// POST add member
// ---------------------------------------------------------------------------

export async function addMember(
	ccaIdStr: string,
	body: { user_id: number; position_id?: number; commitment_period?: string },
) {
	const { supabase, ccaData } = await requireMemberManagementAccess(ccaIdStr);

	if (!canManageCcaMembers(ccaData.cca_kind)) {
		throw new ApiError(403, getCcaMemberManagementDisabledMessage(ccaData.cca_kind));
	}

	let targetPositionId = body.position_id;

	if (!targetPositionId) {
		let { data: memberPosition } = await supabase
			.from("cca_positions")
			.select("id")
			.eq("cca_id", ccaData.id)
			.eq("position_type", "member")
			.single();

		if (!memberPosition) {
			const { data: newPosition, error: createError } = await supabase
				.from("cca_positions")
				.insert({ cca_id: ccaData.id, position_type: "member", name: "Member" })
				.select("id")
				.single();

			if (createError) {
				console.error("Error creating member position:", createError);
				throw new ApiError(500, "Failed to create member position");
			}
			memberPosition = newPosition;
		}
		targetPositionId = memberPosition!.id;
	}

	// Check for duplicate
	const { data: existingAppointment } = await supabase
		.from("cca_appointments")
		.select("user_id, position_id")
		.eq("user_id", body.user_id)
		.eq("position_id", targetPositionId)
		.single();

	if (existingAppointment) {
		throw new ApiError(400, "User is already appointed to this position");
	}

	// Validate position belongs to CCA and check capacity
	const { data: positionInfo, error: positionInfoError } = await supabase
		.from("cca_positions")
		.select("id, cca_id, capacity")
		.eq("id", targetPositionId)
		.single();

	if (positionInfoError || !positionInfo) throw new ApiError(404, "Position not found");
	if (positionInfo.cca_id !== ccaData.id) {
		throw new ApiError(400, "Position does not belong to this CCA");
	}

	if (positionInfo.capacity > 0) {
		const { count } = await supabase
			.from("cca_appointments")
			.select("*", { count: "exact", head: true })
			.eq("position_id", targetPositionId);

		if ((count || 0) >= positionInfo.capacity) {
			throw new ApiError(
				400,
				`Position capacity (${positionInfo.capacity}) would be exceeded. Current appointments: ${count || 0}.`,
			);
		}
	}

	const appointmentInsert: {
		user_id: number;
		position_id: number;
		points: number;
		commitment_period?: string;
	} = {
		user_id: body.user_id,
		position_id: targetPositionId!,
		points: 0,
	};
	if (body.commitment_period !== undefined) {
		appointmentInsert.commitment_period = body.commitment_period;
	}

	const { error: appointmentError } = await supabase
		.from("cca_appointments")
		.insert(appointmentInsert);

	if (appointmentError) {
		console.error("Error adding member:", appointmentError);
		throw new ApiError(500, "Failed to add member");
	}

	return { position_id: targetPositionId };
}

// ---------------------------------------------------------------------------
// DELETE remove member
// ---------------------------------------------------------------------------

export async function removeMember(
	ccaIdStr: string,
	body: { user_id: number; position_id?: number },
) {
	const { supabase, ccaData } = await requireMemberManagementAccess(ccaIdStr);

	if (!canManageCcaMembers(ccaData.cca_kind)) {
		throw new ApiError(403, getCcaMemberManagementDisabledMessage(ccaData.cca_kind));
	}

	let targetPositionId = body.position_id;

	if (!targetPositionId) {
		const { data: memberPosition } = await supabase
			.from("cca_positions")
			.select("id")
			.eq("cca_id", ccaData.id)
			.eq("position_type", "member")
			.single();

		if (!memberPosition) throw new ApiError(404, "Member position not found");
		targetPositionId = memberPosition.id;
	}

	const { error: removeError } = await supabase
		.from("cca_appointments")
		.delete()
		.eq("user_id", body.user_id)
		.eq("position_id", targetPositionId);

	if (removeError) {
		console.error("Error removing member:", removeError);
		throw new ApiError(500, "Failed to remove member");
	}
}

// ---------------------------------------------------------------------------
// PATCH update member
// ---------------------------------------------------------------------------

export async function updateMember(
	ccaIdStr: string,
	body: {
		user_id: number;
		position_id?: number;
		team_status?: string | null;
		commitment_period?: string;
	},
) {
	const { supabase, ccaData } = await requireMemberManagementAccess(ccaIdStr);

	if (
		!canManageCcaMembers(ccaData.cca_kind) &&
		(body.team_status !== undefined || body.commitment_period !== undefined)
	) {
		throw new ApiError(403, getCcaMemberManagementDisabledMessage(ccaData.cca_kind));
	}

	const normalizedTeamStatus =
		typeof body.team_status === "string" ? normalizeTeamStatus(body.team_status) : body.team_status;

	if (body.team_status !== undefined && body.team_status !== null) {
		if (typeof body.team_status !== "string" || normalizedTeamStatus === null) {
			throw new ApiError(400, "Invalid team status");
		}

		if (!TEAM_STATUS_CCA_KINDS.has(ccaData.cca_kind) && normalizedTeamStatus !== "none") {
			throw new ApiError(400, "Team status is not applicable to this CCA");
		}

		if (!TEAM_STATUS_ORDER.includes(normalizedTeamStatus as TeamStatus)) {
			throw new ApiError(400, "Invalid team status");
		}
	}

	const updates: MemberUpdate = {};
	if (body.team_status !== undefined)
		updates.team_status = normalizedTeamStatus as MemberUpdate["team_status"];
	if (body.commitment_period !== undefined)
		updates.commitment_period = body.commitment_period as MemberUpdate["commitment_period"];

	if (Object.keys(updates).length === 0) return;

	if (
		(body.team_status !== undefined || body.commitment_period !== undefined) &&
		!body.position_id
	) {
		throw new ApiError(400, "position_id is required for member updates");
	}

	const { data: updatedRows, error } = await supabase
		.from("cca_appointments")
		.update(updates)
		.select("user_id, position_id")
		.eq("user_id", body.user_id)
		.eq("position_id", body.position_id!);

	if (error) {
		console.error("Error updating member:", error);
		throw new ApiError(500, "Failed to update member");
	}

	if (!updatedRows || updatedRows.length === 0) {
		throw new ApiError(404, "No matching member appointment found for update");
	}
}

// ---------------------------------------------------------------------------
// GET search users
// ---------------------------------------------------------------------------

export async function searchUsers(ccaIdStr: string, query: string | null) {
	if (!query || query.trim().length < 2) {
		throw new ApiError(400, "Query must be at least 2 characters.");
	}

	const trimmedQuery = query.trim();
	const { supabase } = await requireMemberManagementAccess(ccaIdStr);

	const { data, error } = await supabase
		.from("users")
		.select("id, name, email, room")
		.or(`name.ilike.%${trimmedQuery}%,email.ilike.%${trimmedQuery}%,room.ilike.%${trimmedQuery}%`)
		.order("name")
		.limit(10);

	if (error) {
		console.error("Member search error:", error);
		throw new ApiError(500, "Database query failed.");
	}

	return (data ?? []).map((user) => ({
		id: user.id,
		name: user.name,
		email: user.email,
		room: user.room,
	}));
}
