// Service layer for weekly commitment and weekly approval operations.
// and src/app/api/holidaySubsidy/approvals/weekly/[ccaId]/[weekId]/route.ts

import { createClient } from "@/lib/supabase/server";
import { SubsidyStatus } from "@/features/holiday-subsidy/types/declarations";
import { JoinedPositionSummary, WeeklyApprovalSubmission } from "@/features/holiday-subsidy/types/api";
import { getWeekDay, getWeekLabel, isWeekEditable } from "@/features/holiday-subsidy/utils/holiday-weeks";
import { unwrapRelation } from "@/lib/supabase/helpers";
import { ApiError } from "@/lib/api/errors";

// ─── Helpers ──────────────────────────────────────────────────────

type JoinedPosition = {
	id: number;
	name: string;
	position_type: string;
	cca_id?: number;
};

/**
 * Map common trigger errors raised by cca_user_subsidies writes.
 */
function mapUserSubsidyError(message: string): { status: number; error: string } {
	if (message.includes("Parent subsidy must be approved")) {
		return {
			status: 409,
			error: "Cannot add members until the envelope is approved",
		};
	}
	if (message.startsWith("Invalid transition")) {
		return { status: 409, error: message };
	}
	if (message.includes("already approved") || message.includes("cannot upsert")) {
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

/**
 * Map approve_user_subsidy errors to consistent HTTP codes.
 */
function mapApproveRpcError(message: string): { status: number; error: string } {
	if (message.startsWith("Invalid transition")) {
		return { status: 409, error: message };
	}
	if (message.startsWith("Only JCRC")) {
		return { status: 403, error: message };
	}
	if (message.includes("not found") || message.includes("not accessible")) {
		return { status: 404, error: message };
	}
	if (message.includes("only accepts")) {
		return { status: 400, error: message };
	}
	return { status: 400, error: message };
}

// ─── Weekly Commitment (Chair) ───────────────────────────────────

export async function getWeeklyCommitments(ccaId: number, weekIdNum: number) {
	if (!isWeekEditable(weekIdNum)) {
		throw new ApiError(
			403,
			`Weekly declarations are closed for ${getWeekLabel(weekIdNum) || "this week"}.`,
		);
	}

	const day = getWeekDay(weekIdNum);
	if (!day) {
		throw new ApiError(400, "Unknown week");
	}

	const supabase = await createClient();

	// 1. Approved envelopes for this CCA on the given day.
	const { data: envelopesRaw, error: envelopesError } = await supabase
		.from("cca_subsidies")
		.select(
			`id, position_id, hours, justification, status,
			 cca_positions!inner (id, name, position_type, cca_id)`,
		)
		.eq("cca_positions.cca_id", ccaId)
		.eq("day", day)
		.eq("status", SubsidyStatus.APPROVED);

	if (envelopesError) {
		throw new ApiError(500, envelopesError.message);
	}

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

	// 2. Appointments under this CCA (join through positions).
	const { data: appointmentsRaw, error: appointmentsError } = await supabase
		.from("cca_appointments")
		.select(
			`user_id, position_id,
			 cca_positions!inner (id, name, position_type, cca_id)`,
		)
		.eq("cca_positions.cca_id", ccaId);

	if (appointmentsError) {
		throw new ApiError(500, `Failed to fetch appointments: ${appointmentsError.message}`);
	}

	type AppointmentRow = {
		user_id: number;
		position_id: number;
		cca_positions: JoinedPosition | JoinedPosition[] | null;
	};
	const appointments = (appointmentsRaw || []) as AppointmentRow[];

	// 3. Existing per-user subsidy rows under those envelopes.
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

		if (subsError) {
			throw new ApiError(500, subsError.message);
		}

		userSubs = (subsRaw || []) as typeof userSubs;
	}

	// 4. User directory for name/email.
	const userIds = Array.from(new Set(appointments.map((a) => a.user_id)));
	const directoryMap = new Map<number, { id: number; name: string; email: string }>();

	if (userIds.length > 0) {
		const { data: directoryRaw, error: directoryError } = await supabase
			.from("authenticated_user_directory")
			.select("id, name, email")
			.in("id", userIds);

		if (directoryError) {
			throw new ApiError(500, directoryError.message);
		}

		(directoryRaw || []).forEach((row: { id: number; name: string; email: string }) => {
			directoryMap.set(row.id, row);
		});
	}

	// Index user_subs by `${user_id}-${subsidy_id}` for quick lookup.
	const userSubMap = new Map<string, (typeof userSubs)[number]>();
	userSubs.forEach((sub) => userSubMap.set(`${sub.user_id}-${sub.subsidy_id}`, sub));

	const members = appointments
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
				id: appt.user_id,
				user_id: appt.user_id,
				position_id: appt.position_id,
				user_subsidy_id: userSub?.id ?? null,
				name: directory?.name || `User #${appt.user_id}`,
				email: directory?.email || "",
				role: position?.name || "Member",
				type: position?.position_type || "",
				has_approved_subsidy: true,
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
		.filter((member): member is NonNullable<typeof member> => member !== null);

	return { members };
}

export async function saveWeeklyCommitments(
	ccaId: number,
	weekIdNum: number,
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
	const day = getWeekDay(weekIdNum);
	if (!day) {
		throw new ApiError(400, "Unknown week");
	}

	if (declarations.length === 0 && deletions.length === 0) {
		throw new ApiError(400, "No changes provided");
	}

	for (const decl of declarations) {
		if (!decl || typeof decl.user_id !== "number" || typeof decl.position_id !== "number") {
			throw new ApiError(400, "Each declaration must include user_id and position_id");
		}
	}

	for (const del of deletions) {
		if (!del || typeof del.user_id !== "number" || typeof del.position_id !== "number") {
			throw new ApiError(400, "Each deletion must include user_id and position_id");
		}
	}

	const supabase = await createClient();

	// Resolve approved envelopes for this CCA + day.
	const { data: envelopesRaw, error: envelopesError } = await supabase
		.from("cca_subsidies")
		.select(`id, position_id, status, cca_positions!inner (cca_id)`)
		.eq("cca_positions.cca_id", ccaId)
		.eq("day", day)
		.eq("status", SubsidyStatus.APPROVED);

	if (envelopesError) {
		throw new ApiError(500, envelopesError.message);
	}

	type EnvelopeRow = { id: number; position_id: number; status: SubsidyStatus };
	const envelopes = (envelopesRaw || []) as EnvelopeRow[];
	const envelopeByPosition = new Map(envelopes.map((e) => [e.position_id, e]));

	// Validate user/position pairs are CCA appointments.
	const { data: appointmentsRaw, error: appointmentsError } = await supabase
		.from("cca_appointments")
		.select(`user_id, position_id, cca_positions!inner (cca_id)`)
		.eq("cca_positions.cca_id", ccaId);

	if (appointmentsError) {
		throw new ApiError(500, "Failed to validate members for this CCA");
	}

	const validPairs = new Set(
		(appointmentsRaw || []).map(
			(appt: { user_id: number; position_id: number }) => `${appt.user_id}-${appt.position_id}`,
		),
	);

	const invalidDeclarations = declarations.filter(
		(decl) => !validPairs.has(`${decl.user_id}-${decl.position_id}`),
	);
	const invalidDeletions = deletions.filter(
		(del) => !validPairs.has(`${del.user_id}-${del.position_id}`),
	);

	if (invalidDeclarations.length > 0 || invalidDeletions.length > 0) {
		throw new ApiError(400, "One or more selections are invalid for this CCA");
	}

	// upsert_user_subsidy per declaration.
	for (const decl of declarations) {
		const envelope = envelopeByPosition.get(decl.position_id);
		if (!envelope) {
			throw new ApiError(
				409,
				"Cannot save member commitment: no approved subsidy envelope exists for this position and week.",
			);
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

	// Deletions: scoped to the envelopes resolved above.
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

	const savedCount = declarations.length;
	const deletedCount = deletions.length;

	return {
		success: true,
		message: `Saved ${savedCount} member commitment(s)${deletedCount ? `, deleted ${deletedCount}` : ""}`,
	};
}

// ─── Weekly Approvals (JCRC) ─────────────────────────────────────

export async function getWeeklyApprovals(ccaId: number, weekIdNum: number) {
	const day = getWeekDay(weekIdNum);
	if (!day) {
		throw new ApiError(400, "Unknown week");
	}

	const supabase = await createClient();

	const { data: submissions, error: submissionsError } = await supabase
		.from("cca_user_subsidies")
		.select(
			`
			id,
			subsidy_id,
			user_id,
			hours,
			comments,
			status,
			rejection_reason,
			cca_subsidies!inner (
				id,
				position_id,
				day,
				hours,
				justification,
				cca_positions!inner (
					id,
					name,
					position_type,
					cca_id
				)
			)
		`,
		)
		.eq("cca_subsidies.cca_positions.cca_id", ccaId)
		.eq("cca_subsidies.day", day);

	if (submissionsError) {
		throw new ApiError(500, submissionsError.message);
	}

	const userIds = Array.from(
		new Set(
			((submissions as unknown as WeeklyApprovalSubmission[]) || []).map((sub) => sub.user_id),
		),
	);

	const directoryMap = new Map<number, { id: number; name: string; email: string }>();
	if (userIds.length > 0) {
		const { data: directoryRaw, error: directoryError } = await supabase
			.from("authenticated_user_directory")
			.select("id, name, email")
			.in("id", userIds);

		if (directoryError) {
			throw new ApiError(500, directoryError.message);
		}

		(directoryRaw || []).forEach((row: { id: number; name: string; email: string }) => {
			directoryMap.set(row.id, row);
		});
	}

	const submissionsData =
		((submissions as unknown as WeeklyApprovalSubmission[]) || []).map((sub) => {
			const envelope = unwrapRelation(sub.cca_subsidies);
			const position = envelope
				? unwrapRelation<JoinedPositionSummary>(envelope.cca_positions)
				: null;
			const directory = directoryMap.get(sub.user_id);
			const effectiveHours = sub.hours ?? envelope?.hours ?? 0;

			return {
				id: sub.id,
				user_subsidy_id: sub.id,
				subsidy_id: sub.subsidy_id,
				user_id: sub.user_id,
				position_id: envelope?.position_id ?? 0,
				name: directory?.name || `User #${sub.user_id}`,
				email: directory?.email || "",
				role: position?.name || "Member",
				type: position?.position_type || "",
				hours: effectiveHours,
				comments: sub.comments || "",
				justification: envelope?.justification || "",
				status: sub.status || SubsidyStatus.PENDING,
				rejection_reason: sub.rejection_reason ?? null,
			};
		}) || [];

	return { submissions: submissionsData };
}

export async function batchApproveWeekly(
	updates: Array<{
		userSubsidyId: number;
		status: "approved" | "rejected";
		rejectionReason?: string | null;
	}>,
) {
	if (!Array.isArray(updates) || updates.length === 0) {
		throw new ApiError(400, "No updates provided");
	}

	for (const update of updates) {
		if (
			!update ||
			typeof update.userSubsidyId !== "number" ||
			(update.status !== "approved" && update.status !== "rejected")
		) {
			throw new ApiError(400, "Invalid update payload");
		}
	}

	const supabase = await createClient();

	const results = await Promise.allSettled(
		updates.map((update) =>
			supabase
				.rpc("approve_user_subsidy", {
					p_user_subsidy_id: update.userSubsidyId,
					p_decision: update.status,
					p_reason: update.rejectionReason ?? null,
				})
				.single(),
		),
	);

	const failures: Array<{ userSubsidyId: number; status: number; error: string }> = [];
	let successCount = 0;

	results.forEach((result, idx) => {
		const update = updates[idx];
		if (result.status === "fulfilled") {
			const { error: rpcError } = result.value;
			if (rpcError) {
				const mapped = mapApproveRpcError(rpcError.message);
				failures.push({ userSubsidyId: update.userSubsidyId, ...mapped });
			} else {
				successCount += 1;
			}
		} else {
			const message =
				result.reason instanceof Error
					? result.reason.message
					: String(result.reason || "Unknown error");
			const mapped = mapApproveRpcError(message);
			failures.push({ userSubsidyId: update.userSubsidyId, ...mapped });
		}
	});

	if (failures.length > 0) {
		const statusOrder = [403, 409, 404, 400, 500];
		const status = statusOrder.find((code) => failures.some((f) => f.status === code)) ?? 400;
		throw Object.assign(
			new ApiError(
				status,
				failures.map((f) => `user_subsidy ${f.userSubsidyId}: ${f.error}`).join("; "),
			),
			{ failures },
		);
	}

	return {
		message: `Successfully updated ${successCount} submission(s)`,
		updated: successCount,
	};
}
