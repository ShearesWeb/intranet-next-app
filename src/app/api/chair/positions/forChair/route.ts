// src/app/api/chair/positions/forChair/route.ts
// API route to get positions available for chair ranking along with applicants' info.
// Reads `cca_position_availability` (replaces deleted `cca_capacity_info`) and stitches
// applicants from `cca_position_preferences` + `authenticated_user_directory`
// (replaces deleted `cca_user_ranking` + `public_user_info`).
// `applied_count` is now derived: count of `cca_position_preferences` rows for the position
// (i.e. the chair-managed market — RLS hides reciprocal user-side ranks).
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { fetchUserInfo } from "@/lib/fetch-user-info";
import { PositionType, UserAppointment } from "@/types/User";
import { checkCcaAuthorization } from "@/features/cca/utils/cca-chair-access";
import { getCoreServiceDisabledApiResponse } from "@/lib/feature-flags";
import { SupabaseClient } from "@supabase/supabase-js";

const NON_APPLICANT_POSITION_TYPES = "(lead,vice,resident)";

export type RankingAccessPosition = {
	id: UserAppointment["position_id"];
	cca_id: UserAppointment["cca_id"];
	name: UserAppointment["position_name"];
	position_type: PositionType;
};

type PositionAvailabilityRow = {
	position_id: number;
	cca_id: number;
	position_name: string;
	position_type: PositionType;
	capacity: number;
	available_capacity: number;
	cca_name: string;
};

type PreferenceRow = {
	position_id: number;
	user_id: number;
	rank: number;
};

type DirectoryRow = {
	id: number;
	name: string;
	email: string;
	room: string;
};

type PositionsResult = { ok: true; data: PositionAvailabilityRow[] } | { ok: false; error: string };

const getPositionsForPhase = async (
	ccaIds: number[],
	supabase: SupabaseClient,
): Promise<PositionsResult> => {
	const { data: allPositions, error: posError } = await supabase
		.from("cca_position_availability")
		.select(
			"position_id, cca_id, position_name, position_type, capacity, available_capacity, cca_name",
		)
		.in("cca_id", ccaIds)
		.gt("available_capacity", 0)
		.not("position_type", "in", NON_APPLICANT_POSITION_TYPES);

	if (posError) {
		return { ok: false, error: posError.message };
	}
	return { ok: true, data: (allPositions ?? []) as PositionAvailabilityRow[] };
};

export async function GET() {
	const disabledResponse = getCoreServiceDisabledApiResponse("ccaApplications");

	if (disabledResponse) {
		return disabledResponse;
	}

	try {
		const headers = {
			"Cache-Control": "no-store, private",
			"Content-Type": "application/json",
		};

		const supabase = await createClient();
		const requestingUser = await fetchUserInfo();
		const accessResult = await checkCcaAuthorization({ requestingUser });

		if (!accessResult.ok) {
			return NextResponse.json({ positions: [] }, { headers });
		}

		const positionsResult = await getPositionsForPhase(
			accessResult.data.authorizedCcaIds,
			supabase,
		);

		if (!positionsResult.ok) {
			console.error("Error fetching position availability:", positionsResult.error);
			return NextResponse.json({ error: "Failed to load positions" }, { status: 500, headers });
		}

		const allPositions = positionsResult.data;

		if (allPositions.length === 0) {
			return NextResponse.json({ positions: [] }, { headers });
		}

		const positionIds = allPositions.map((p) => p.position_id);

		const { data: prefRows, error: prefError } = await supabase
			.from("cca_position_preferences")
			.select("position_id, user_id, rank")
			.in("position_id", positionIds)
			.order("rank", { ascending: true });

		if (prefError) {
			// Don't return `{positions:[]}` with 200 — that hid a missing GRANT
			// on `cca_position_preferences` during testing.
			console.error("Error fetching position preferences:", prefError);
			return NextResponse.json({ error: "Failed to load applicants" }, { status: 500, headers });
		}

		const userIds = Array.from(new Set((prefRows ?? []).map((r) => r.user_id)));
		const { data: dirRows, error: dirError } = userIds.length
			? await supabase
					.from("authenticated_user_directory")
					.select("id, name, email, room")
					.in("id", userIds)
			: { data: [] as DirectoryRow[], error: null };

		if (dirError) {
			console.error("Error fetching user directory:", dirError);
			return NextResponse.json(
				{ error: "Failed to load applicant details" },
				{ status: 500, headers },
			);
		}

		const userById = new Map<number, DirectoryRow>(
			(dirRows ?? []).map((u) => [u.id, u as DirectoryRow]),
		);

		const applicantsByPosition = new Map<
			number,
			Array<{
				id: number;
				name: string;
				email: string;
				room: string;
				ranking: number;
			}>
		>();

		for (const row of (prefRows ?? []) as PreferenceRow[]) {
			const user = userById.get(row.user_id);
			if (!user) continue;
			const arr = applicantsByPosition.get(row.position_id) ?? [];
			arr.push({
				id: user.id,
				name: user.name,
				email: user.email,
				room: user.room,
				ranking: row.rank,
			});
			applicantsByPosition.set(row.position_id, arr);
		}

		// Map the results, preserving the legacy API response shape (`id`, `name`, `applied_count`).
		const result = allPositions.map((position) => {
			const applicants = applicantsByPosition.get(position.position_id) ?? [];
			return {
				id: position.position_id,
				name: position.position_name,
				cca_name: position.cca_name,
				total_capacity: position.capacity,
				available_capacity: position.available_capacity,
				applied_count: applicants.length,
				filled_positions: position.capacity - position.available_capacity,
				position_type: position.position_type,
				applicants,
			};
		});

		return NextResponse.json(
			{
				positions: result,
			},
			{ headers },
		);
	} catch (error) {
		console.error("Error in forChair API:", error);
		return NextResponse.json(
			{ error: "Failed to load positions" },
			{
				status: 500,
				headers: {
					"Cache-Control": "no-store, private",
					"Content-Type": "application/json",
				},
			},
		);
	}
}
