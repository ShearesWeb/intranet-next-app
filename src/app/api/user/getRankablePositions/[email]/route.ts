// src/app/api/user/getRankablePositions/[email]/route.ts
// API route to get the positions a user can rank.
//
// Reads `cca_position_availability` (replaces deleted `cca_capacity_info`) plus
// the requesting user's existing rows in `cca_user_preferences` (replaces deleted
// `user_cca_applications`). The response shape (`id`, `name`, `cca_name`, ...,
// `user_ranking`, `is_selected`) is preserved so `useRankablePositions` does not
// need to change.
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { fetchUserId } from "@/lib/fetch-user-info";
import { getCoreServiceDisabledApiResponse } from "@/lib/feature-flags";

const NON_RANKABLE_POSITION_TYPES = "(lead,vice,resident)";

interface CCAData {
	id: number;
	name: string;
	cca_type: string;
	description: string;
	image_url: string | null;
}

interface PositionAvailabilityRow {
	position_id: number;
	position_name: string;
	position_type: string;
	capacity: number;
	available_capacity: number;
	cca_id: number;
	cca_name: string;
	ccas: CCAData | CCAData[] | null;
}

export async function GET() {
	const disabledResponse = getCoreServiceDisabledApiResponse("ccaApplications");

	if (disabledResponse) {
		return disabledResponse;
	}

	try {
		const supabase = await createClient();

		// Get user ID from cookie
		const userId = await fetchUserId();

		if (!userId) {
			return NextResponse.json(
				{
					error: "Unauthorized",
				},
				{ status: 401 },
			);
		}

		// Get available positions with their joined CCA metadata. The position
		// description lives on `cca_positions` (which the availability view joins
		// through); we fetch it via the embedded `ccas` resource for the cca-level
		// description fallback.
		const { data: availablePositions, error: positionsError } = await supabase
			.from("cca_position_availability")
			.select(
				`
					position_id,
					position_name,
					position_type,
					capacity,
					available_capacity,
					cca_id,
					cca_name,
					ccas!inner (id, name, cca_type, description, image_url)
				`,
			)
			.gt("available_capacity", 0)
			.not("position_type", "in", NON_RANKABLE_POSITION_TYPES)
			.order("position_name", { ascending: true });

		if (positionsError) {
			console.error("Error fetching available positions:", positionsError);
			return NextResponse.json({ error: "Failed to load positions" }, { status: 500 });
		}

		// Get the user's existing preferences from `cca_user_preferences`. The
		// own-row RLS policy ensures this only returns the caller's rows.
		const { data: userPreferences, error: prefError } = await supabase
			.from("cca_user_preferences")
			.select("position_id, rank")
			.eq("user_id", userId);

		if (prefError) {
			// Don't silently render the page as "you have ranked nothing": that's
			// indistinguishable from a real empty state and made a missing GRANT on
			// `cca_user_preferences` invisible for hours during testing.
			console.error("Error fetching user preferences:", prefError);
			return NextResponse.json({ error: "Failed to load your saved preferences" }, { status: 500 });
		}

		const userPreferenceMap = new Map<number, number>(
			(userPreferences ?? []).map((p) => [p.position_id, p.rank]),
		);

		const transformedPositions =
			((availablePositions ?? []) as PositionAvailabilityRow[]).map((position) => {
				let ccaDescription = "No description available";

				const ccaJoin = Array.isArray(position.ccas) ? position.ccas[0] : position.ccas;
				if (ccaJoin) {
					ccaDescription = ccaJoin.description || ccaDescription;
				}

				const userRank = userPreferenceMap.get(position.position_id) ?? null;

				return {
					id: position.position_id,
					name: position.position_name,
					cca_name: position.cca_name || ccaJoin?.name || "Unknown",
					position_type: position.position_type,
					capacity: position.capacity,
					available_capacity: position.available_capacity,
					// `applied_count` no longer exists on the availability view. The
					// chair-side preference count is invisible to a regular user
					// (RLS). We report 0 to preserve the response shape and avoid an
					// extra round-trip; the UI uses this for display only.
					applied_count: 0,
					description: ccaDescription,
					user_ranking: userRank,
					is_selected: userRank !== null,
				};
			}) || [];

		return NextResponse.json({
			positions: transformedPositions,
		});
	} catch (error) {
		console.error("Error fetching rankable positions:", error);
		return NextResponse.json({ error: "Failed to load positions" }, { status: 500 });
	}
}
