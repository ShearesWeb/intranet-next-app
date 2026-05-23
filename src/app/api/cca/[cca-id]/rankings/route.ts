// src/app/api/cca/[cca-id]/rankings/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
	buildRankingsUpsertPayloads,
	loadCcaContext,
	loadManagedRankingAccess,
	mapRankingResponseMembers,
} from "@/features/ranking/utils/ranking-route";
import { fetchUserInfo } from "@/lib/auth/fetch-user-info";
import { getCoreServiceDisabledApiResponse } from "@/lib/feature-flags";
import type {
	AppointmentRow,
	RankingAccessPosition,
	RankingPayload,
	RankingRow,
} from "@/features/ranking/types/ranking-api";

export async function GET(
	_request: Request,
	{ params }: { params: Promise<{ "cca-id": string }> },
) {
	const { "cca-id": ccaIdParam } = await params;
	const ccaId = Number(ccaIdParam);
	const supabase = await createClient();
	const requestingUser = await fetchUserInfo();
	const { cca, ccaError, positionsError } = await loadCcaContext(supabase, ccaId);

	if (ccaError || !cca) {
		return NextResponse.json({ error: "CCA not found" }, { status: 404 });
	}

	if (positionsError) {
		return NextResponse.json({ error: "Failed to load positions" }, { status: 500 });
	}

	const accessResult = await loadManagedRankingAccess({
		supabase,
		requestingUser,
		cca,
	});

	if (!accessResult.ok) {
		return NextResponse.json({ error: accessResult.error }, { status: accessResult.status });
	}

	const rankablePositionIds = accessResult.allowedPositionIds;
	const disabledResponse = getCoreServiceDisabledApiResponse("memberRanking", {
		isJcrc: requestingUser?.is_jcrc,
	});

	if (disabledResponse) {
		return disabledResponse;
	}

	let membersQuery = supabase
		.from("cca_appointments")
		.select(
			`
			user_id,
			cut_status,
			commitment_period,
			public_user_info!inner(name),
			cca_positions!inner(id, name, position_type)
		`,
		)
		.eq("cca_positions.cca_id", ccaId);

	membersQuery = membersQuery.in("position_id", rankablePositionIds);

	const { data: members, error: membersError } = await membersQuery;

	if (membersError) {
		console.error("Error fetching rankings:", membersError);
		return NextResponse.json({ error: "Failed to fetch rankings." }, { status: 500 });
	}

	if (!members || members.length === 0) {
		return NextResponse.json({ members: [], cca_type: cca.cca_type, cca_name: cca.name });
	}

	const positionIds = ((members || []) as AppointmentRow[])
		.map((member) => {
			const position = Array.isArray(member.cca_positions)
				? member.cca_positions[0]
				: member.cca_positions;
			return position?.id;
		})
		.filter((id: number | undefined): id is number => typeof id === "number");

	const userIds = ((members || []) as AppointmentRow[])
		.map((member) => member.user_id)
		.filter((id: number | undefined): id is number => typeof id === "number");

	const { data: rankings, error: rankingsError } = await supabase
		.from("cca_appointment_evaluations")
		.select("user_id, position_id, scores")
		.in("position_id", positionIds)
		.in("user_id", userIds);

	if (rankingsError) {
		console.error("Error fetching rankings:", rankingsError);
		return NextResponse.json({ error: "Failed to fetch rankings." }, { status: 500 });
	}

	const scopedMembers = mapRankingResponseMembers({
		members: (members || []) as AppointmentRow[],
		rankings: rankings as RankingRow[] | null | undefined,
		ccaType: cca.cca_type,
		rankablePositionIds,
	});

	return NextResponse.json({
		members: scopedMembers,
		cca_type: cca.cca_type,
		cca_name: accessResult.managedCca?.cca_name || cca.name,
	});
}

// POST handler to save (upsert) member rankings
export async function POST(
	request: Request,
	{ params }: { params: Promise<{ "cca-id": string }> },
) {
	const { "cca-id": ccaIdParam } = await params;
	const ccaId = Number(ccaIdParam);
	const rankings = (await request.json()) as RankingPayload[];
	const supabase = await createClient();
	const requestingUser = await fetchUserInfo();
	const { cca, ccaError, positions, positionsError } = await loadCcaContext(supabase, ccaId);

	if (ccaError || !cca) {
		return NextResponse.json({ error: "CCA not found" }, { status: 404 });
	}

	if (positionsError) {
		return NextResponse.json({ error: "Failed to load positions" }, { status: 500 });
	}

	const accessResult = await loadManagedRankingAccess({
		supabase,
		requestingUser,
		cca,
	});

	if (!accessResult.ok) {
		return NextResponse.json({ error: accessResult.error }, { status: accessResult.status });
	}

	const allowedPositionIds = new Set(accessResult.allowedPositionIds);
	const disabledResponse = getCoreServiceDisabledApiResponse("memberRanking", {
		isJcrc: requestingUser?.is_jcrc,
	});

	if (disabledResponse) {
		return disabledResponse;
	}

	const positionTypeById = new Map<number, string | null>(
		((positions || []) as RankingAccessPosition[]).map((position) => [
			position.id,
			position.position_type || null,
		]),
	);

	const rankingsToUpsert = buildRankingsUpsertPayloads({
		rankings,
		allowedPositionIds,
		positionTypeById,
		ccaType: cca.cca_type,
	});

	if (rankingsToUpsert.length === 0) {
		return NextResponse.json({ success: true, message: "No valid rankings to save" });
	}

	const { error } = await supabase
		.from("cca_appointment_evaluations")
		.upsert(rankingsToUpsert, { onConflict: "user_id, position_id" });

	if (error) {
		console.error("Error saving rankings:", error);
		return NextResponse.json({ error: "Failed to save rankings." }, { status: 500 });
	}

	return NextResponse.json({ success: true });
}
