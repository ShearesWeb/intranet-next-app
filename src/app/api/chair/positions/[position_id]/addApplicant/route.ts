// src/app/api/chair/positions/[position_id]/addApplicant/route.ts
// API route to add an applicant to a chair's rank list.
// Writes a row in `cca_position_preferences` via the `upsert_cca_position_preference` RPC.
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { fetchUserInfo } from "@/lib/fetch-user-info";
import { checkCcaAuthorization } from "@/features/cca/utils/cca-chair-access";
import { getCoreServiceDisabledApiResponse } from "@/lib/feature-flags";

const NON_APPLICANT_POSITION_TYPES = new Set(["lead", "vice", "resident"]);

export async function POST(
	request: Request,
	{ params }: { params: Promise<{ position_id: string }> },
) {
	const disabledResponse = getCoreServiceDisabledApiResponse("ccaApplications");

	if (disabledResponse) {
		return disabledResponse;
	}

	try {
		const { position_id } = await params;
		const supabase = await createClient();

		const requestingUser = await fetchUserInfo();

		const positionId = parseInt(position_id, 10);
		const { user_id } = await request.json();
		if (!user_id) {
			return NextResponse.json({ error: "Missing user_id" }, { status: 400 });
		}

		const { data: position, error: positionError } = await supabase
			.from("cca_positions")
			.select("id, position_type, ccas!inner(id, name, cca_type)")
			.eq("id", positionId)
			.single();

		if (positionError || !position) {
			return NextResponse.json({ error: "Position not found" }, { status: 404 });
		}

		if (NON_APPLICANT_POSITION_TYPES.has((position.position_type || "").toLowerCase())) {
			return NextResponse.json({ error: "This position cannot be ranked" }, { status: 403 });
		}

		const cca = Array.isArray(position.ccas) ? position.ccas[0] : position.ccas;
		const accessResult = await checkCcaAuthorization({
			requestingUser,
			cca,
			require: "chair",
			supabase,
		});

		if (!accessResult.ok) {
			return NextResponse.json({ error: accessResult.error }, { status: accessResult.status });
		}

		// Check if applicant already exists for this position
		const { data: existingApplicant } = await supabase
			.from("cca_position_preferences")
			.select("rank")
			.eq("position_id", positionId)
			.eq("user_id", user_id)
			.maybeSingle();

		if (existingApplicant) {
			return NextResponse.json(
				{ error: "Applicant already exists for this position" },
				{ status: 400 },
			);
		}

		// Get current highest rank to derive the next-rank slot
		const { data: currentApplicants, error: countError } = await supabase
			.from("cca_position_preferences")
			.select("rank")
			.eq("position_id", positionId)
			.order("rank", { ascending: false })
			.limit(1);

		if (countError) {
			console.error("Error counting current applicants:", countError);
			return NextResponse.json({ error: "Failed to determine ranking" }, { status: 500 });
		}

		// Next rank = highest existing + 1, or 1 if no rows
		const nextRanking =
			currentApplicants && currentApplicants.length > 0
				? (currentApplicants[0].rank || 0) + 1
				: 1;

		const { error: rpcError } = await supabase.rpc("upsert_cca_position_preference", {
			p_position_id: positionId,
			p_user_id: user_id,
			p_rank: nextRanking,
		});

		if (rpcError) {
			console.error("Error adding applicant via upsert_cca_position_preference:", rpcError);
			return NextResponse.json({ error: rpcError.message }, { status: 500 });
		}

		return NextResponse.json({
			success: true,
			ranking: nextRanking,
			message: `Applicant added with ranking ${nextRanking}`,
		});
	} catch (error: unknown) {
		console.error("Unexpected error:", error);
		return NextResponse.json({ error: "Server error" }, { status: 500 });
	}
}
