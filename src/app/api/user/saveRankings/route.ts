// src/app/api/user/saveRankings/route.ts
// API route to save the requesting user's CCA preference ranking.
//
// Writes to `cca_user_preferences` via the `upsert_cca_user_preference` RPC.
// The RPC derives `user_id` from `internal.auth_user_id()`, so the API only
// passes `{ p_position_id, p_rank }` — the caller cannot write another user's
// preferences.
//
// `cca_user_preferences.UNIQUE (user_id, rank)` is `DEFERRABLE INITIALLY DEFERRED`.
// Since each Supabase JS RPC commits in its own transaction, we use the same
// staged-rank workaround as the chair-side bulk save: stage all rows at
// rank + 1000 first, then write the real rank in a second pass.
//
// We also prune any preference rows the caller had previously written whose
// position_ids aren't in the new payload, so this endpoint stays a replace-all.
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { fetchUserId } from "@/lib/fetch-user-info";
import { getCoreServiceDisabledApiResponse } from "@/lib/feature-flags";

const STAGED_RANK_OFFSET = 1000;

export async function POST(request: Request) {
	const disabledResponse = getCoreServiceDisabledApiResponse("ccaApplications");

	if (disabledResponse) {
		return disabledResponse;
	}

	try {
		const { rankings } = await request.json();
		const supabase = await createClient();

		const userId = await fetchUserId();

		if (!userId) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		if (!Array.isArray(rankings)) {
			return NextResponse.json({ error: "Missing or invalid rankings array" }, { status: 400 });
		}

		const typedRankings = rankings as Array<{ position_id: number; ranking: number }>;
		const positionIds = typedRankings.map((r) => r.position_id);

		// Prune previously-saved rows that aren't in the new ranking payload.
		if (positionIds.length > 0) {
			const { error: pruneError } = await supabase
				.from("cca_user_preferences")
				.delete()
				.eq("user_id", userId)
				.not("position_id", "in", `(${positionIds.join(",")})`);

			if (pruneError) {
				console.error("Error pruning stale user preferences:", pruneError);
				return NextResponse.json({ error: "Failed to save rankings" }, { status: 500 });
			}
		} else {
			const { error: clearError } = await supabase
				.from("cca_user_preferences")
				.delete()
				.eq("user_id", userId);

			if (clearError) {
				console.error("Error clearing user preferences:", clearError);
				return NextResponse.json({ error: "Failed to save rankings" }, { status: 500 });
			}

			return NextResponse.json({ success: true });
		}

		// Staged-rank pass: avoid (user_id, rank) UNIQUE collisions when two
		// existing rows swap positions in the new order.
		for (const r of typedRankings) {
			const { error: stageError } = await supabase.rpc("upsert_cca_user_preference", {
				p_position_id: r.position_id,
				p_rank: r.ranking + STAGED_RANK_OFFSET,
			});
			if (stageError) {
				console.error("Error staging user preference rank:", stageError);
				return NextResponse.json({ error: "Failed to save rankings" }, { status: 500 });
			}
		}

		for (const r of typedRankings) {
			const { error: finalError } = await supabase.rpc("upsert_cca_user_preference", {
				p_position_id: r.position_id,
				p_rank: r.ranking,
			});
			if (finalError) {
				console.error("Error finalizing user preference rank:", finalError);
				return NextResponse.json({ error: "Failed to save rankings" }, { status: 500 });
			}
		}

		return NextResponse.json({ success: true });
	} catch (error) {
		console.error("Error saving rankings:", error);
		return NextResponse.json({ error: "Failed to save rankings" }, { status: 500 });
	}
}
