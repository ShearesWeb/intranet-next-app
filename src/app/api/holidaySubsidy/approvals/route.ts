import { NextResponse } from "next/server";

import { getCoreServiceDisabledApiResponse } from "@/lib/feature-flags";
import { fetchUserInfo } from "@/lib/fetch-user-info";
import { createClient } from "@/utils/supabase/server";
import { SubsidyStatus } from "@/features/holiday-subsidy/types/declarations";

type ApprovalRow = {
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
// Supabase PostgREST returns the relation as an object or an array depending
// on the FK arity in the schema cache; types here accept either.
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
// because cca_user_subsidies has no direct cca/position FK (only subsidy_id).
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

function unwrapRelation<T>(value: T | T[] | null | undefined): T | null {
	if (Array.isArray(value)) return value[0] ?? null;
	return value ?? null;
}

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
		throw new Error(error.message);
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
	// cca_user_subsidies has no direct cca/position FK — walk through
	// cca_subsidies -> cca_positions -> ccas. One extra join hop vs legacy.
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
		throw new Error(error.message);
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
		throw new Error(error.message);
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

export async function GET() {
	const disabledResponse = getCoreServiceDisabledApiResponse("holidaySubsidy");

	if (disabledResponse) {
		return disabledResponse;
	}

	try {
		const user = await fetchUserInfo();

		// This endpoint is the JCRC dashboard counter view. RLS would let
		// chairs see their own envelopes too, but the UI shape (counters
		// across all CCAs) is misleading for a chair — gate at the route.
		if (!user || !user.is_jcrc) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
		}

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

		// Add weekly commitments — a CCA may have weekly claims via an
		// already-approved envelope, even if there's no pending envelope
		// of its own, so make sure those CCAs surface too.
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

		// Convert to sorted array
		const ccas = Array.from(ccaMap.values()).sort((a, b) => a.name.localeCompare(b.name));

		return NextResponse.json({ ccas });
	} catch (error) {
		console.error("Error loading subsidy approvals:", error);
		return NextResponse.json({ error: "Failed to load subsidy approvals" }, { status: 500 });
	}
}
