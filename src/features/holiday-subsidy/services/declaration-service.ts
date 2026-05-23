// Service layer for holiday subsidy declaration operations.

import { createClient } from "@/lib/supabase/server";
import { SubsidyStatus } from "@/features/holiday-subsidy/types/declarations";
import { PositionSubsidyRecord, PositionWithSubsidies } from "@/features/holiday-subsidy/types/api";
import { getWeekDay, getWeekIdForDay } from "@/features/holiday-subsidy/utils/holiday-weeks";
import { ApiError } from "@/lib/api/errors";

/**
 * Map an upsert_subsidy / cca_subsidies row to a wire-format SubsidyRow.
 * Returns `null` when the row's `day` cannot be mapped back to a configured
 * holiday week id -- caller drops these (out-of-config / legacy rows).
 */
function projectSubsidyRow(row: {
	id: number;
	position_id: number;
	day: string;
	hours: number;
	justification: string | null;
	status: SubsidyStatus;
	rejection_reason?: string | null;
}) {
	const weekId = getWeekIdForDay(row.day);
	if (weekId === null) return null;
	return {
		id: row.id,
		position_id: row.position_id,
		day: row.day,
		weekId,
		hours: row.hours,
		justification: row.justification,
		status: row.status,
		rejection_reason: row.rejection_reason ?? null,
	};
}

/**
 * Translate a Postgres error from upsert_subsidy / direct ops into an
 * ApiError with the most actionable status code. Trigger-surfaced errors
 * (`internal.validate_cca_subsidy_transition_before_update`,
 * `enforce_parent_approved_before_iud`, `upsert_subsidy`'s own RAISEs) all
 * arrive as `error.message` strings. Default to 400 because all known cases
 * are business-rule violations, not server failures.
 */
export function mapSubsidyRpcError(message: string): { status: number; error: string } {
	if (message.includes("No authenticated user")) {
		return { status: 401, error: "Unauthorized" };
	}
	if (message.includes("already approved") || message.includes("cannot upsert")) {
		return { status: 409, error: message };
	}
	if (message.startsWith("Invalid transition")) {
		return { status: 409, error: message };
	}
	if (message.startsWith("Only JCRC")) {
		return { status: 403, error: message };
	}
	return { status: 400, error: message };
}

export async function getDeclarations(ccaId: number) {
	const supabase = await createClient();

	const { data: positionsWithSubsidies, error: positionError } = await supabase
		.from("cca_positions")
		.select(
			`
			id,
			name,
			position_type,
			cca_id,
			cca_subsidies (
				id,
				position_id,
				day,
				hours,
				justification,
				status,
				rejection_reason
			)
		`,
		)
		.eq("cca_id", ccaId);

	if (positionError) {
		throw new ApiError(500, positionError.message);
	}

	const rawPositions = (positionsWithSubsidies || []) as PositionWithSubsidies[];

	const subsidies = rawPositions
		.flatMap((position) => position.cca_subsidies || [])
		.map((subsidy: PositionSubsidyRecord) => projectSubsidyRow(subsidy))
		.filter((row): row is NonNullable<ReturnType<typeof projectSubsidyRow>> => row !== null);

	const positions = rawPositions.map((position) => ({
		id: position.id,
		name: position.name,
		position_type: position.position_type,
		cca_id: position.cca_id,
	}));

	return { positions, subsidies };
}

export async function upsertDeclaration(params: {
	positionId: number;
	weekId: number;
	hours: number;
	justification?: string | null;
}) {
	const { positionId, weekId, hours, justification } = params;

	const day = getWeekDay(weekId);
	if (!day) {
		throw new ApiError(400, "Unknown week");
	}

	const supabase = await createClient();

	// upsert_subsidy is SECURITY INVOKER; RLS enforces chain-of-managers,
	// FK enforces position existence, and the RPC's own RAISE handles the
	// approved-envelope case.
	const { data, error: rpcError } = await supabase
		.rpc("upsert_subsidy", {
			p_position_id: positionId,
			p_day: day,
			p_hours: hours,
			p_justification: justification ?? null,
		})
		.single();

	if (rpcError) {
		const mapped = mapSubsidyRpcError(rpcError.message);
		throw new ApiError(mapped.status, mapped.error);
	}

	const projected = projectSubsidyRow(
		data as {
			id: number;
			position_id: number;
			day: string;
			hours: number;
			justification: string | null;
			status: SubsidyStatus;
			rejection_reason?: string | null;
		},
	);

	return { subsidy: projected };
}

export async function deleteDeclaration(params: { ccaId: number; subsidyId: number }) {
	const { subsidyId } = params;
	const supabase = await createClient();

	// Confirm the envelope belongs to this CCA AND is still pending.
	// RLS lets a chair delete any envelope they manage including approved
	// ones; product policy is that only pending may be deleted via UI.
	const { data: existing, error: fetchError } = await supabase
		.from("cca_subsidies")
		.select("id, status, cca_positions!inner(cca_id)")
		.eq("id", subsidyId)
		.single();

	if (fetchError || !existing) {
		throw new ApiError(404, "Subsidy declaration not found");
	}

	if ((existing as { status: SubsidyStatus }).status !== SubsidyStatus.PENDING) {
		throw new ApiError(400, "Only pending declarations can be deleted");
	}

	const { error: deleteError } = await supabase
		.from("cca_subsidies")
		.delete()
		.eq("id", subsidyId);

	if (deleteError) {
		throw new ApiError(500, deleteError.message);
	}

	return { success: true };
}
