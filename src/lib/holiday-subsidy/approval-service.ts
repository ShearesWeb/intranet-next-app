// Service layer for holiday subsidy approval operations.
// and src/app/api/holidaySubsidy/approvals/[ccaId]/route.ts

import { createClient } from "@/lib/supabase/server";
import { SubsidyStatus, SubsidyWithPosition, PositionOption } from "@/types/declarations";
import { getWeekIdForDay } from "@/lib/holiday-subsidy/holiday-weeks";
import { unwrapRelation } from "@/lib/supabase/helpers";
import { ApiError } from "@/lib/api/errors";
import { mapApproveRpcError } from "@/lib/holiday-subsidy/rpc-error-mappers";

// ─── Types for the approvals index route ──────────────────────────

export type ApprovalRow = {
	id: number;
	name: string;
	pendingDeclarations: number;
	pendingWeekly: number;
};

type CcaIdName = {
	id: number;
	name: string;
};

// Envelope row when projected through cca_positions->ccas.
type EnvelopeWithCca = {
	status?: SubsidyStatus;
	cca_positions?:
		| {
				cca_id?: number;
				ccas?: CcaIdName | CcaIdName[] | null;
		  }
		| Array<{
				cca_id?: number;
				ccas?: CcaIdName | CcaIdName[] | null;
		  }>
		| null;
};

// Per-user claim row joined back through cca_subsidies->cca_positions->ccas
type UserSubsidyWithCca = {
	status?: SubsidyStatus;
	cca_subsidies?:
		| {
				cca_positions?:
					| {
							cca_id?: number;
							ccas?: CcaIdName | CcaIdName[] | null;
					  }
					| Array<{
							cca_id?: number;
							ccas?: CcaIdName | CcaIdName[] | null;
					  }>
					| null;
		  }
		| Array<{
				cca_positions?:
					| {
							cca_id?: number;
							ccas?: CcaIdName | CcaIdName[] | null;
					  }
					| Array<{
							cca_id?: number;
							ccas?: CcaIdName | CcaIdName[] | null;
					  }>
					| null;
		  }>
		| null;
};

// ─── Types for the per-CCA approval route ─────────────────────────

// Raw envelope row as returned by Supabase with `cca_positions` joined.
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

type ApprovalUpdate = {
	subsidyId: number;
	status: SubsidyStatus;
	rejectionReason?: string | null;
};

// ─── Helpers ──────────────────────────────────────────────────────

function extractCca(envelope: EnvelopeWithCca): CcaIdName | null {
	const position = unwrapRelation(envelope.cca_positions);
	if (!position) return null;
	const cca = unwrapRelation(position.ccas);
	const id = cca?.id ?? position.cca_id;
	const name = cca?.name;
	if (!id || !name) return null;
	return { id, name };
}

function extractCcaFromUserSubsidy(row: UserSubsidyWithCca): CcaIdName | null {
	const subsidy = unwrapRelation(row.cca_subsidies);
	if (!subsidy) return null;
	const position = unwrapRelation(subsidy.cca_positions);
	if (!position) return null;
	const cca = unwrapRelation(position.ccas);
	const id = cca?.id ?? position.cca_id;
	const name = cca?.name;
	if (!id || !name) return null;
	return { id, name };
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

// ─── Approvals Index (all CCAs with pending counts) ───────────────

async function fetchPendingEnvelopes(
	supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<ApprovalRow[]> {
	const { data, error } = await supabase
		.from("cca_subsidies")
		.select(
			`status,
			cca_positions!inner (
				cca_id,
				ccas!inner (
					id,
					name
				)
			)`,
		)
		.eq("status", SubsidyStatus.PENDING);

	if (error) {
		throw new ApiError(500, error.message);
	}

	const map = new Map<number, ApprovalRow>();

	(data as EnvelopeWithCca[] | null | undefined)?.forEach((row) => {
		const cca = extractCca(row);
		if (!cca) return;

		const existing = map.get(cca.id);
		if (existing) {
			existing.pendingDeclarations += 1;
		} else {
			map.set(cca.id, {
				id: cca.id,
				name: cca.name,
				pendingDeclarations: 1,
				pendingWeekly: 0,
			});
		}
	});

	return Array.from(map.values());
}

async function fetchPendingWeeklyCommitments(
	supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<Map<number, { id: number; name: string; count: number }>> {
	const { data, error } = await supabase
		.from("cca_user_subsidies")
		.select(
			`status,
			cca_subsidies!inner (
				cca_positions!inner (
					cca_id,
					ccas!inner (
						id,
						name
					)
				)
			)`,
		)
		.eq("status", SubsidyStatus.PENDING);

	if (error) {
		throw new ApiError(500, error.message);
	}

	const map = new Map<number, { id: number; name: string; count: number }>();

	(data as UserSubsidyWithCca[] | null | undefined)?.forEach((row) => {
		const cca = extractCcaFromUserSubsidy(row);
		if (!cca) return;

		const existing = map.get(cca.id);
		if (existing) {
			existing.count += 1;
		} else {
			map.set(cca.id, { id: cca.id, name: cca.name, count: 1 });
		}
	});

	return map;
}

async function fetchCcasWithAnyEnvelope(
	supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<ApprovalRow[]> {
	const { data, error } = await supabase.from("cca_subsidies").select(
		`cca_positions!inner (
			cca_id,
			ccas!inner (
				id,
				name
			)
		)`,
	);

	if (error) {
		throw new ApiError(500, error.message);
	}

	const map = new Map<number, ApprovalRow>();

	(data as EnvelopeWithCca[] | null | undefined)?.forEach((row) => {
		const cca = extractCca(row);
		if (!cca) return;

		if (!map.has(cca.id)) {
			map.set(cca.id, {
				id: cca.id,
				name: cca.name,
				pendingDeclarations: 0,
				pendingWeekly: 0,
			});
		}
	});

	return Array.from(map.values());
}

export async function getApprovalsIndex() {
	const supabase = await createClient();

	const [subsidyCcas, declarations, weeklyMap] = await Promise.all([
		fetchCcasWithAnyEnvelope(supabase),
		fetchPendingEnvelopes(supabase),
		fetchPendingWeeklyCommitments(supabase),
	]);

	const ccaMap = new Map<number, ApprovalRow>();

	// Seed CCAs that have any subsidy entry (any status)
	subsidyCcas.forEach((cca) => {
		ccaMap.set(cca.id, {
			id: cca.id,
			name: cca.name,
			pendingDeclarations: 0,
			pendingWeekly: 0,
		});
	});

	// Add declarations
	declarations.forEach((decl) => {
		const existing = ccaMap.get(decl.id);
		if (existing) {
			existing.pendingDeclarations = decl.pendingDeclarations;
		} else {
			ccaMap.set(decl.id, {
				id: decl.id,
				name: decl.name,
				pendingDeclarations: decl.pendingDeclarations,
				pendingWeekly: 0,
			});
		}
	});

	// Add weekly commitments
	weeklyMap.forEach((weekly, ccaId) => {
		const existing = ccaMap.get(ccaId);
		if (existing) {
			existing.pendingWeekly = weekly.count;
		} else {
			ccaMap.set(ccaId, {
				id: weekly.id,
				name: weekly.name,
				pendingDeclarations: 0,
				pendingWeekly: weekly.count,
			});
		}
	});

	const ccas = Array.from(ccaMap.values()).sort((a, b) => a.name.localeCompare(b.name));
	return { ccas };
}

// ─── Per-CCA approval details ────────────────────────────────────

async function loadCcaName(ccaId: number, supabase: Awaited<ReturnType<typeof createClient>>) {
	const { data, error } = await supabase.from("ccas").select("name").eq("id", ccaId).single();

	if (error || !data) {
		throw new ApiError(404, "CCA not found");
	}

	return data.name as string;
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
		throw new ApiError(500, positionsError.message);
	}

	if (subsidiesError) {
		throw new ApiError(500, subsidiesError.message);
	}

	const projected = ((subsidies as unknown as EnvelopeFromApi[] | null) || [])
		.map((row) => projectEnvelope(row))
		.filter((row): row is SubsidyWithPosition => row !== null);

	return {
		positions: positions || [],
		subsidies: projected,
	};
}

export async function getApprovalDetails(ccaId: number) {
	const supabase = await createClient();
	const ccaName = await loadCcaName(ccaId, supabase);
	const { positions, subsidies } = await fetchCcaData(ccaId, supabase);
	return { ccaName, positions, subsidies };
}

// ─── Batch approve/reject ────────────────────────────────────────

function validateUpdates(updates: ApprovalUpdate[]): asserts updates is ApprovalUpdate[] {
	if (!Array.isArray(updates) || updates.length === 0) {
		throw new ApiError(400, "No updates provided");
	}

	for (const update of updates) {
		if (
			!update ||
			typeof update.subsidyId !== "number" ||
			!Object.values(SubsidyStatus).includes(update.status)
		) {
			throw new ApiError(400, "Invalid update payload");
		}
		// approve_subsidy rejects 'pending'; fail fast.
		if (update.status === SubsidyStatus.PENDING) {
			throw new ApiError(400, "approve_subsidy only accepts approved/rejected");
		}
	}
}

export async function batchApprove(ccaId: number, updates: ApprovalUpdate[]) {
	validateUpdates(updates);

	const supabase = await createClient();

	// Pre-flight: ensure every subsidyId is reachable via the URL ccaId.
	const { data: belongsRows, error: belongsError } = await supabase
		.from("cca_subsidies")
		.select("id, cca_positions!inner(cca_id)")
		.in(
			"id",
			updates.map((u) => u.subsidyId),
		)
		.eq("cca_positions.cca_id", ccaId);

	if (belongsError) {
		throw new ApiError(500, belongsError.message);
	}

	const foundIds = new Set((belongsRows || []).map((row: { id: number }) => row.id));
	const missingIds = updates.map((u) => u.subsidyId).filter((id) => !foundIds.has(id));
	if (missingIds.length > 0) {
		throw new ApiError(400, "One or more subsidies do not belong to this CCA");
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
		// Worst-case status wins (403 > 409 > 404 > 400)
		const statusOrder = [403, 409, 404, 400, 500];
		const status = statusOrder.find((code) => failures.some((f) => f.status === code)) ?? 400;
		throw Object.assign(
			new ApiError(status, failures.map((f) => `subsidy ${f.subsidyId}: ${f.error}`).join("; ")),
			{ failures },
		);
	}

	// Re-join the position so the wire shape matches GET.
	const ids = successes.map((row) => row.id);
	const { data: rejoined, error: rejoinError } = await supabase
		.from("cca_subsidies")
		.select(
			`id, position_id, day, hours, justification, status, rejection_reason,
			cca_positions!inner(id, name, position_type, cca_id)`,
		)
		.in("id", ids);

	if (rejoinError) {
		throw new ApiError(500, rejoinError.message);
	}

	const projected = ((rejoined as unknown as EnvelopeFromApi[] | null) || [])
		.map((row) => projectEnvelope(row))
		.filter((row): row is SubsidyWithPosition => row !== null);

	return { updated: projected };
}
