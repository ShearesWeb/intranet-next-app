import { createClient } from "@/lib/supabase/server";
import { SubsidyStatus } from "@/types/declarations";
import { unwrapRelation } from "@/lib/supabase/helpers";
import { ApiError } from "@/lib/api/errors";
import type { MemberAssignment } from "@/types/declarations";

type JoinedPosition = {
	id: number;
	name: string;
	position_type: string;
	cca_id?: number;
};

function mapUserSubsidyError(message: string): { status: number; error: string } {
	if (message.includes("Parent subsidy must be approved")) {
		return { status: 409, error: "Cannot add members until the envelope is approved" };
	}
	if (message.startsWith("Invalid transition")) {
		return { status: 409, error: message };
	}
	if (message.includes("Cannot modify hours after approval")) {
		return { status: 409, error: message };
	}
	if (message.includes("No authenticated user")) {
		return { status: 401, error: "Unauthorized" };
	}
	return { status: 400, error: message };
}

export async function getMemberAssignments(
	ccaId: number,
	day: string,
): Promise<{ members: MemberAssignment[] }> {
	const supabase = await createClient();

	const { data: envelopesRaw, error: envelopesError } = await supabase
		.from("cca_subsidies")
		.select(
			`id, position_id, hours, justification, status,
			 cca_positions!inner (id, name, position_type, cca_id)`,
		)
		.eq("cca_positions.cca_id", ccaId)
		.eq("day", day)
		.eq("status", SubsidyStatus.APPROVED);

	if (envelopesError) throw new ApiError(500, envelopesError.message);

	type EnvelopeRow = {
		id: number;
		position_id: number;
		hours: number;
		justification: string | null;
		status: SubsidyStatus;
		cca_positions: JoinedPosition | JoinedPosition[] | null;
	};

	const envelopes = (envelopesRaw || []) as EnvelopeRow[];
	const envelopesByPosition = new Map<
		number,
		{ id: number; hours: number; justification: string | null; position: JoinedPosition | null }
	>();
	envelopes.forEach((envelope) => {
		envelopesByPosition.set(envelope.position_id, {
			id: envelope.id,
			hours: envelope.hours,
			justification: envelope.justification,
			position: unwrapRelation(envelope.cca_positions),
		});
	});

	const { data: appointmentsRaw, error: appointmentsError } = await supabase
		.from("cca_appointments")
		.select(`user_id, position_id, cca_positions!inner (id, name, position_type, cca_id)`)
		.eq("cca_positions.cca_id", ccaId);

	if (appointmentsError) throw new ApiError(500, appointmentsError.message);

	type AppointmentRow = {
		user_id: number;
		position_id: number;
		cca_positions: JoinedPosition | JoinedPosition[] | null;
	};
	const appointments = (appointmentsRaw || []) as AppointmentRow[];

	const subsidyIds = Array.from(envelopesByPosition.values()).map((e) => e.id);
	let userSubs: Array<{
		id: number;
		subsidy_id: number;
		user_id: number;
		hours: number | null;
		comments: string | null;
		status: SubsidyStatus | null;
		rejection_reason: string | null;
	}> = [];

	if (subsidyIds.length > 0) {
		const { data: subsRaw, error: subsError } = await supabase
			.from("cca_user_subsidies")
			.select("id, subsidy_id, user_id, hours, comments, status, rejection_reason")
			.in("subsidy_id", subsidyIds);

		if (subsError) throw new ApiError(500, subsError.message);
		userSubs = (subsRaw || []) as typeof userSubs;
	}

	const userIds = Array.from(new Set(appointments.map((a) => a.user_id)));
	const directoryMap = new Map<number, { id: number; name: string; email: string }>();

	if (userIds.length > 0) {
		const { data: directoryRaw, error: directoryError } = await supabase
			.from("users")
			.select("id, name, email")
			.in("id", userIds);

		if (directoryError) throw new ApiError(500, directoryError.message);
		(directoryRaw || []).forEach((row: { id: number; name: string; email: string }) => {
			directoryMap.set(row.id, row);
		});
	}

	const userSubMap = new Map<string, (typeof userSubs)[number]>();
	userSubs.forEach((sub) => userSubMap.set(`${sub.user_id}-${sub.subsidy_id}`, sub));

	const members: MemberAssignment[] = appointments
		.filter((appt) => envelopesByPosition.has(appt.position_id))
		.map((appt) => {
			const envelope = envelopesByPosition.get(appt.position_id);
			if (!envelope) return null;
			const userSub = userSubMap.get(`${appt.user_id}-${envelope.id}`);
			const directory = directoryMap.get(appt.user_id);
			const position = envelope.position ?? unwrapRelation(appt.cca_positions);

			const overrideHours = userSub?.hours ?? null;
			const effectiveHours = overrideHours ?? envelope.hours;

			return {
				user_id: appt.user_id,
				position_id: appt.position_id,
				user_subsidy_id: userSub?.id ?? null,
				name: directory?.name || `User #${appt.user_id}`,
				email: directory?.email || "",
				role: position?.name || "Member",
				type: position?.position_type || "",
				submitted: !!userSub,
				hours: effectiveHours,
				override_hours: overrideHours,
				approved_hours: envelope.hours,
				comments: userSub?.comments ?? "",
				justification: envelope.justification ?? "",
				status: userSub?.status ?? null,
				rejection_reason: userSub?.rejection_reason ?? null,
			};
		})
		.filter((m): m is MemberAssignment => m !== null);

	return { members };
}

export async function saveMemberAssignments(
	ccaId: number,
	day: string,
	declarations: Array<{
		user_id: number;
		position_id: number;
		hours?: number | null;
		comments?: string | null;
	}>,
	deletions: Array<{
		user_id: number;
		position_id: number;
	}>,
) {
	if (declarations.length === 0 && deletions.length === 0) {
		throw new ApiError(400, "No changes provided");
	}

	const supabase = await createClient();

	const { data: envelopesRaw, error: envelopesError } = await supabase
		.from("cca_subsidies")
		.select(`id, position_id, status, cca_positions!inner (cca_id)`)
		.eq("cca_positions.cca_id", ccaId)
		.eq("day", day)
		.eq("status", SubsidyStatus.APPROVED);

	if (envelopesError) throw new ApiError(500, envelopesError.message);

	type EnvelopeRow = { id: number; position_id: number; status: SubsidyStatus };
	const envelopes = (envelopesRaw || []) as EnvelopeRow[];
	const envelopeByPosition = new Map(envelopes.map((e) => [e.position_id, e]));

	const { data: appointmentsRaw, error: appointmentsError } = await supabase
		.from("cca_appointments")
		.select(`user_id, position_id, cca_positions!inner (cca_id)`)
		.eq("cca_positions.cca_id", ccaId);

	if (appointmentsError) throw new ApiError(500, "Failed to validate members");

	const validPairs = new Set(
		(appointmentsRaw || []).map(
			(appt: { user_id: number; position_id: number }) => `${appt.user_id}-${appt.position_id}`,
		),
	);

	const invalidDecls = declarations.filter((d) => !validPairs.has(`${d.user_id}-${d.position_id}`));
	const invalidDels = deletions.filter((d) => !validPairs.has(`${d.user_id}-${d.position_id}`));

	if (invalidDecls.length > 0 || invalidDels.length > 0) {
		throw new ApiError(400, "One or more selections are invalid for this CCA");
	}

	for (const decl of declarations) {
		const envelope = envelopeByPosition.get(decl.position_id);
		if (!envelope) {
			throw new ApiError(409, "No approved envelope exists for this position and date.");
		}

		const { error: rpcError } = await supabase.rpc("upsert_user_subsidy", {
			p_subsidy_id: envelope.id,
			p_user_id: decl.user_id,
			p_hours: decl.hours ?? null,
			p_comments: decl.comments ?? null,
		});

		if (rpcError) {
			const mapped = mapUserSubsidyError(rpcError.message);
			throw new ApiError(mapped.status, mapped.error);
		}
	}

	for (const del of deletions) {
		const envelope = envelopeByPosition.get(del.position_id);
		if (!envelope) continue;

		const { error: deleteError } = await supabase
			.from("cca_user_subsidies")
			.delete()
			.eq("subsidy_id", envelope.id)
			.eq("user_id", del.user_id);

		if (deleteError) {
			const mapped = mapUserSubsidyError(deleteError.message);
			throw new ApiError(mapped.status, mapped.error);
		}
	}

	return {
		saved: declarations.length,
		deleted: deletions.length,
	};
}
