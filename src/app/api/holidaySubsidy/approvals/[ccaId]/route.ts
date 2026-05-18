import { NextResponse } from "next/server";
import { fetchUserInfo } from "@/lib/fetch-user-info";
import { createClient } from "@/utils/supabase/server";
import { getCoreServiceDisabledApiResponse } from "@/lib/feature-flags";
import {
	SubsidyStatus,
	SubsidyWithPosition,
	PositionOption,
} from "@/features/holiday-subsidy/types/declarations";
import { getWeekIdForDay } from "@/features/holiday-subsidy/utils/holiday-weeks";

type Params = {
	params: Promise<{
		ccaId: string;
	}>;
};

// Raw envelope row as returned by Supabase with `cca_positions` joined.
// PostgREST may serialize a !inner relation as either an object or a
// single-element array depending on schema-cache state; accept both.
type EnvelopeFromApi = {
	id: number;
	position_id: number;
	day: string;
	hours: number;
	justification: string | null;
	status: SubsidyStatus;
	rejection_reason: string | null;
	cca_positions?:
		| (PositionOption & { cca_id: number })
		| Array<PositionOption & { cca_id: number }>
		| null;
};

async function assertJcrcAccess() {
	const user = await fetchUserInfo();

	if (!user || !user.is_jcrc) {
		return {
			authorized: false as const,
			response: NextResponse.json({ error: "Unauthorized" }, { status: 403 }),
		};
	}

	return { authorized: true as const };
}

async function loadCcaName(ccaId: number, supabase: Awaited<ReturnType<typeof createClient>>) {
	const { data, error } = await supabase.from("ccas").select("name").eq("id", ccaId).single();

	if (error || !data) {
		return { name: null, error: "CCA not found" };
	}

	return { name: data.name as string };
}

function unwrapRelation<T>(value: T | T[] | null | undefined): T | null {
	if (Array.isArray(value)) return value[0] ?? null;
	return value ?? null;
}

function projectEnvelope(row: EnvelopeFromApi): SubsidyWithPosition | null {
	const weekId = getWeekIdForDay(row.day);
	if (weekId === null) return null;
	const position = unwrapRelation(row.cca_positions);
	return {
		id: row.id,
		position_id: row.position_id,
		day: row.day,
		weekId,
		hours: row.hours,
		justification: row.justification,
		status: row.status,
		rejection_reason: row.rejection_reason,
		cca_positions: position
			? {
					id: position.id,
					name: position.name,
					position_type: position.position_type,
					cca_id: position.cca_id,
				}
			: null,
	};
}

async function fetchCcaData(ccaId: number, supabase: Awaited<ReturnType<typeof createClient>>) {
	const [{ data: positions, error: positionsError }, { data: subsidies, error: subsidiesError }] =
		await Promise.all([
			supabase.from("cca_positions").select("id, name, position_type").eq("cca_id", ccaId),
			supabase
				.from("cca_subsidies")
				.select(
					`id, position_id, day, hours, justification, status, rejection_reason,
                cca_positions!inner(id, name, position_type, cca_id)`,
				)
				.eq("cca_positions.cca_id", ccaId),
		]);

	if (positionsError) {
		throw new Error(positionsError.message);
	}

	if (subsidiesError) {
		throw new Error(subsidiesError.message);
	}

	const projected = ((subsidies as unknown as EnvelopeFromApi[] | null) || [])
		.map((row) => projectEnvelope(row))
		.filter((row): row is SubsidyWithPosition => row !== null);

	return {
		positions: positions || [],
		subsidies: projected,
	};
}

type ApprovalUpdate = {
	subsidyId: number;
	status: SubsidyStatus;
	rejectionReason?: string | null;
};

function validateUpdates(updates: ApprovalUpdate[]): asserts updates is ApprovalUpdate[] {
	if (!Array.isArray(updates) || updates.length === 0) {
		throw new Error("No updates provided");
	}

	for (const update of updates) {
		if (
			!update ||
			typeof update.subsidyId !== "number" ||
			!Object.values(SubsidyStatus).includes(update.status)
		) {
			throw new Error("Invalid update payload");
		}
		// approve_subsidy rejects 'pending'; fail fast.
		if (update.status === SubsidyStatus.PENDING) {
			throw new Error("approve_subsidy only accepts approved/rejected");
		}
	}
}

/**
 * Map approve_subsidy trigger errors to actionable HTTP status codes.
 *
 * The triggers `internal.validate_cca_subsidy_transition_before_update` and
 * `internal.cascade_cca_subsidy_rejection_after_update` raise structured
 * messages; the JCRC-vs-chair gate is also enforced at the trigger layer.
 * Anything we can't pattern-match defaults to 400 — these are domain
 * violations, not 500s.
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

export async function GET(_request: Request, { params }: Params) {
	const disabledResponse = getCoreServiceDisabledApiResponse("holidaySubsidy");

	if (disabledResponse) {
		return disabledResponse;
	}

	try {
		const authResult = await assertJcrcAccess();

		if (!authResult.authorized) {
			return authResult.response;
		}

		const { ccaId: ccaIdParam } = await params;
		const ccaId = Number(ccaIdParam);

		if (!ccaId) {
			return NextResponse.json({ error: "Invalid CCA" }, { status: 400 });
		}

		const supabase = await createClient();
		const { name, error } = await loadCcaName(ccaId, supabase);

		if (!name) {
			return NextResponse.json({ error: error || "CCA not found" }, { status: 404 });
		}

		const { positions, subsidies } = await fetchCcaData(ccaId, supabase);

		return NextResponse.json({ ccaName: name, positions, subsidies });
	} catch (error) {
		console.error("Error fetching subsidy approvals:", error);
		return NextResponse.json({ error: "Failed to load subsidy approvals" }, { status: 500 });
	}
}

export async function PATCH(request: Request, { params }: Params) {
	const disabledResponse = getCoreServiceDisabledApiResponse("holidaySubsidy");

	if (disabledResponse) {
		return disabledResponse;
	}

	try {
		const authResult = await assertJcrcAccess();

		if (!authResult.authorized) {
			return authResult.response;
		}

		const { ccaId: ccaIdParam } = await params;
		const ccaId = Number(ccaIdParam);

		if (!ccaId) {
			return NextResponse.json({ error: "Invalid CCA" }, { status: 400 });
		}

		const body = await request.json();
		const updates = (body?.updates || []) as ApprovalUpdate[];

		try {
			validateUpdates(updates);
		} catch (err) {
			return NextResponse.json(
				{ error: err instanceof Error ? err.message : "Invalid request" },
				{ status: 400 },
			);
		}

		const supabase = await createClient();

		// Pre-flight: ensure every subsidyId is reachable via the URL ccaId.
		// RLS would not stop a JCRC actor from approving an envelope outside
		// this CCA, but the route's contract is "this CCA's approvals".
		const { data: belongsRows, error: belongsError } = await supabase
			.from("cca_subsidies")
			.select("id, cca_positions!inner(cca_id)")
			.in(
				"id",
				updates.map((u) => u.subsidyId),
			)
			.eq("cca_positions.cca_id", ccaId);

		if (belongsError) {
			throw new Error(belongsError.message);
		}

		const foundIds = new Set((belongsRows || []).map((row: { id: number }) => row.id));
		const missingIds = updates.map((u) => u.subsidyId).filter((id) => !foundIds.has(id));
		if (missingIds.length > 0) {
			return NextResponse.json(
				{ error: "One or more subsidies do not belong to this CCA" },
				{ status: 400 },
			);
		}

		const results = await Promise.allSettled(
			updates.map((update) =>
				supabase
					.rpc("approve_subsidy", {
						p_subsidy_id: update.subsidyId,
						p_decision: update.status,
						p_reason: update.rejectionReason ?? null,
					})
					.single(),
			),
		);

		const failures: Array<{ subsidyId: number; status: number; error: string }> = [];
		const successes: EnvelopeFromApi[] = [];

		results.forEach((result, idx) => {
			const update = updates[idx];
			if (result.status === "fulfilled") {
				const { data, error: rpcError } = result.value;
				if (rpcError) {
					const mapped = mapApproveRpcError(rpcError.message);
					failures.push({ subsidyId: update.subsidyId, ...mapped });
				} else if (data) {
					successes.push(data as EnvelopeFromApi);
				}
			} else {
				const message =
					result.reason instanceof Error
						? result.reason.message
						: String(result.reason || "Unknown error");
				const mapped = mapApproveRpcError(message);
				failures.push({ subsidyId: update.subsidyId, ...mapped });
			}
		});

		if (failures.length > 0) {
			// Worst-case status wins (403 > 409 > 404 > 400) — pick the
			// largest unique code as the response status; surface per-row detail.
			const statusOrder = [403, 409, 404, 400, 500];
			const status = statusOrder.find((code) => failures.some((f) => f.status === code)) ?? 400;
			return NextResponse.json(
				{
					error: failures.map((f) => `subsidy ${f.subsidyId}: ${f.error}`).join("; "),
					failures,
				},
				{ status },
			);
		}

		// Re-query is unnecessary — approve_subsidy returns the row. Re-join
		// the position so the wire shape matches GET.
		const ids = successes.map((row) => row.id);
		const { data: rejoined, error: rejoinError } = await supabase
			.from("cca_subsidies")
			.select(
				`id, position_id, day, hours, justification, status, rejection_reason,
                cca_positions!inner(id, name, position_type, cca_id)`,
			)
			.in("id", ids);

		if (rejoinError) {
			throw new Error(rejoinError.message);
		}

		const projected = ((rejoined as unknown as EnvelopeFromApi[] | null) || [])
			.map((row) => projectEnvelope(row))
			.filter((row): row is SubsidyWithPosition => row !== null);

		return NextResponse.json({ updated: projected });
	} catch (error) {
		console.error("Error updating subsidy approvals:", error);
		return NextResponse.json({ error: "Failed to update approvals" }, { status: 500 });
	}
}
