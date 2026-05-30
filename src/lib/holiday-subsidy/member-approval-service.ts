import { createClient } from "@/lib/supabase/server";
import { SubsidyStatus } from "@/types/declarations";
import { unwrapRelation } from "@/lib/supabase/helpers";
import { ApiError } from "@/lib/api/errors";
import { mapApproveRpcError } from "@/lib/holiday-subsidy/rpc-error-mappers";

type JoinedPosition = {
	id: number;
	name: string;
	position_type: string;
	cca_id?: number;
};

export interface MemberApprovalRow {
	id: number;
	user_subsidy_id: number;
	user_id: number;
	name: string;
	email: string;
	role: string;
	type: string;
	hours: number;
	comments: string;
	status: SubsidyStatus;
	rejection_reason: string | null;
	cca_name: string;
	position_name: string;
}

export async function getMemberApprovals(
	ccaId: number,
	day: string,
): Promise<{ members: MemberApprovalRow[] }> {
	const supabase = await createClient();

	const { data: envelopesRaw, error: envelopesError } = await supabase
		.from("cca_subsidies")
		.select(
			`id, position_id, hours, status,
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
		status: SubsidyStatus;
		cca_positions: JoinedPosition | JoinedPosition[] | null;
	};

	const envelopes = (envelopesRaw || []) as EnvelopeRow[];
	if (envelopes.length === 0) return { members: [] };

	const subsidyIds = envelopes.map((e) => e.id);
	const envelopeMap = new Map(
		envelopes.map((e) => [e.id, { ...e, position: unwrapRelation(e.cca_positions) }]),
	);

	const { data: subsRaw, error: subsError } = await supabase
		.from("cca_user_subsidies")
		.select("id, subsidy_id, user_id, hours, comments, status, rejection_reason")
		.in("subsidy_id", subsidyIds);

	if (subsError) throw new ApiError(500, subsError.message);

	type UserSubRow = {
		id: number;
		subsidy_id: number;
		user_id: number;
		hours: number | null;
		comments: string | null;
		status: SubsidyStatus;
		rejection_reason: string | null;
	};

	const userSubs = (subsRaw || []) as UserSubRow[];
	if (userSubs.length === 0) return { members: [] };

	const userIds = Array.from(new Set(userSubs.map((s) => s.user_id)));
	const { data: directoryRaw, error: directoryError } = await supabase
		.from("authenticated_user_directory")
		.select("id, name, email")
		.in("id", userIds);

	if (directoryError) throw new ApiError(500, directoryError.message);

	const directoryMap = new Map(
		(directoryRaw || []).map((r: { id: number; name: string; email: string }) => [r.id, r]),
	);

	const { data: ccaRaw } = await supabase.from("ccas").select("name").eq("id", ccaId).single();
	const ccaName = (ccaRaw?.name as string) || "Unknown CCA";

	const members: MemberApprovalRow[] = userSubs.map((sub) => {
		const envelope = envelopeMap.get(sub.subsidy_id);
		const position = envelope?.position;
		const directory = directoryMap.get(sub.user_id);
		return {
			id: sub.id,
			user_subsidy_id: sub.id,
			user_id: sub.user_id,
			name: directory?.name || `User #${sub.user_id}`,
			email: directory?.email || "",
			role: position?.name || "Member",
			type: position?.position_type || "",
			hours: sub.hours ?? envelope?.hours ?? 0,
			comments: sub.comments ?? "",
			status: sub.status,
			rejection_reason: sub.rejection_reason,
			cca_name: ccaName,
			position_name: position?.name || "",
		};
	});

	return { members };
}

export async function batchApproveMemberSubsidies(
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
