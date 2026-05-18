import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { SubsidyStatus } from "@/features/holiday-subsidy/types/declarations";
import { PositionSubsidyRecord, PositionWithSubsidies } from "@/features/holiday-subsidy/types/api";
import { fetchUserInfo } from "@/lib/fetch-user-info";
import { checkCcaAuthorization } from "@/features/cca/utils/cca-chair-access";
import { getCoreServiceDisabledApiResponse } from "@/lib/feature-flags";
import { getWeekDay, getWeekIdForDay } from "@/features/holiday-subsidy/utils/holiday-weeks";

type Params = {
	params: Promise<{
		ccaId: string;
	}>;
};

async function authorizeChair(ccaId: number) {
	const user = await fetchUserInfo();

	if (!user) {
		return { authorized: false, status: 401, message: "Unauthorized" };
	}

	const authResult = await checkCcaAuthorization({
		requestingUser: user,
		cca: { id: ccaId, name: null, cca_type: null },
		require: "chair",
	});

	if (!authResult.ok) {
		return { authorized: false, status: authResult.status, message: authResult.error };
	}

	return { authorized: true, status: 200 };
}

/**
 * Map an upsert_subsidy / cca_subsidies row to a wire-format SubsidyRow.
 * Returns `null` when the row's `day` cannot be mapped back to a configured
 * holiday week id — caller drops these (out-of-config / legacy rows).
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
 * Translate a Postgres error from upsert_subsidy / direct ops into an HTTP status code + message.
 *
 * Trigger-surfaced errors (`internal.validate_cca_subsidy_transition_before_update`,
 * `enforce_parent_approved_before_iud`, `upsert_subsidy`'s own RAISEs) all
 * arrive as `error.message` strings. Pattern-match to surface the most
 * actionable status code; default to 400 because all known cases are
 * business-rule violations, not server failures.
 */
function mapSubsidyRpcError(message: string): { status: number; error: string } {
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

export async function GET(_request: Request, { params }: Params) {
	const disabledResponse = getCoreServiceDisabledApiResponse("holidaySubsidy");

	if (disabledResponse) {
		return disabledResponse;
	}

	try {
		const supabase = await createClient();

		const { ccaId: ccaIdStr } = await params;
		const ccaId = parseInt(ccaIdStr, 10);

		if (isNaN(ccaId)) {
			return NextResponse.json({ error: "Invalid CCA ID" }, { status: 400 });
		}

		const authResult = await authorizeChair(ccaId);

		if (!authResult.authorized) {
			return NextResponse.json({ error: authResult.message }, { status: authResult.status });
		}

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
			return NextResponse.json({ error: positionError.message }, { status: 500 });
		}

		// Flatten cca_subsidies onto a wire envelope shape + project day→weekId.
		// Drop rows whose `day` doesn't map to any configured week (e.g. legacy
		// dates not in holiday-weeks.json); the UI cannot render them anyway.
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

		return NextResponse.json({ positions, subsidies });
	} catch (error) {
		console.error("Error fetching subsidy declarations:", error);
		return NextResponse.json({ error: "Failed to load subsidy declarations" }, { status: 500 });
	}
}

export async function POST(request: Request, { params }: Params) {
	const disabledResponse = getCoreServiceDisabledApiResponse("holidaySubsidy");

	if (disabledResponse) {
		return disabledResponse;
	}

	try {
		const supabase = await createClient();

		const { ccaId: ccaIdStr } = await params;
		const ccaId = parseInt(ccaIdStr, 10);

		if (isNaN(ccaId)) {
			return NextResponse.json({ error: "Invalid CCA ID" }, { status: 400 });
		}

		const authResult = await authorizeChair(ccaId);

		if (!authResult.authorized) {
			return NextResponse.json({ error: authResult.message }, { status: authResult.status });
		}

		const body = await request.json();
		const { positionId, weekId, hours, justification } = body || {};

		if (!positionId || !weekId || hours === undefined || hours === null) {
			return NextResponse.json(
				{ error: "Position, week, and hours are required" },
				{ status: 400 },
			);
		}

		const day = getWeekDay(Number(weekId));
		if (!day) {
			return NextResponse.json({ error: "Unknown week" }, { status: 400 });
		}

		// upsert_subsidy is SECURITY INVOKER; RLS enforces chain-of-managers,
		// FK enforces position existence, and the RPC's own RAISE handles the
		// approved-envelope case.
		const { data, error: rpcError } = await supabase
			.rpc("upsert_subsidy", {
				p_position_id: Number(positionId),
				p_day: day,
				p_hours: Number(hours),
				p_justification: justification ?? null,
			})
			.single();

		if (rpcError) {
			const mapped = mapSubsidyRpcError(rpcError.message);
			return NextResponse.json({ error: mapped.error }, { status: mapped.status });
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

		return NextResponse.json({ subsidy: projected });
	} catch (error) {
		console.error("Error creating subsidy declaration:", error);
		return NextResponse.json({ error: "Failed to submit declaration" }, { status: 500 });
	}
}

export async function PATCH(request: Request, { params }: Params) {
	// upsert_subsidy handles both INSERT and UPDATE branches (and the
	// rejected→pending resubmit). PATCH is functionally identical to POST,
	// so delegate to keep one source of truth for the RPC contract.
	return POST(request, { params });
}

export async function DELETE(request: Request, { params }: Params) {
	const disabledResponse = getCoreServiceDisabledApiResponse("holidaySubsidy");

	if (disabledResponse) {
		return disabledResponse;
	}

	try {
		const supabase = await createClient();

		const { ccaId: ccaIdStr } = await params;
		const ccaId = parseInt(ccaIdStr, 10);

		if (isNaN(ccaId)) {
			return NextResponse.json({ error: "Invalid CCA ID" }, { status: 400 });
		}

		const authResult = await authorizeChair(ccaId);

		if (!authResult.authorized) {
			return NextResponse.json({ error: authResult.message }, { status: authResult.status });
		}

		const body = await request.json();
		const { subsidyId } = body || {};

		if (!subsidyId) {
			return NextResponse.json({ error: "Subsidy ID is required" }, { status: 400 });
		}

		// Confirm the envelope belongs to this CCA AND is still pending.
		// RLS lets a chair delete any envelope they manage including approved
		// ones; product policy is that only pending may be deleted via UI.
		const { data: existing, error: fetchError } = await supabase
			.from("cca_subsidies")
			.select("id, status, cca_positions!inner(cca_id)")
			.eq("id", subsidyId)
			.single();

		if (fetchError || !existing) {
			return NextResponse.json({ error: "Subsidy declaration not found" }, { status: 404 });
		}

		if ((existing as { status: SubsidyStatus }).status !== SubsidyStatus.PENDING) {
			return NextResponse.json(
				{ error: "Only pending declarations can be deleted" },
				{ status: 400 },
			);
		}

		const { error: deleteError } = await supabase
			.from("cca_subsidies")
			.delete()
			.eq("id", subsidyId);

		if (deleteError) {
			return NextResponse.json({ error: deleteError.message }, { status: 500 });
		}

		return NextResponse.json({ success: true });
	} catch (error) {
		console.error("Error deleting subsidy declaration:", error);
		return NextResponse.json({ error: "Failed to delete declaration" }, { status: 500 });
	}
}
