// src/app/api/chair/positions/[position_id]/rank/route.ts
// API route to bulk-save a chair's applicant rankings for one position.
//
// Writes to `cca_position_preferences` via the `upsert_cca_position_preference` RPC.
// The table has `UNIQUE (position_id, rank) DEFERRABLE INITIALLY DEFERRED`, but
// Supabase JS commits each RPC in its own transaction, so a naive reorder where
// two rows swap ranks would transiently violate the UNIQUE constraint mid-batch.
//
// Mitigation: stage every kept row to a high temporary rank (+1000) first, then
// apply the real rank in a second pass. The temporary rank cannot collide with
// any real applicant rank (no chair will rank >1000 applicants for one position),
// and the staging pass clears the slot for the real rank.
//
// A follow-up SECURITY INVOKER RPC `replace_cca_position_preferences(p_position_id,
// p_rows JSONB)` doing the swap inside one transaction with `SET CONSTRAINTS ALL
// DEFERRED` would be a single-round-trip atomic alternative (see plan 04 §7 Q2).
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { fetchUserInfo } from "@/lib/fetch-user-info";
import { checkCcaAuthorization } from "@/features/cca/utils/cca-chair-access";
import { getCoreServiceDisabledApiResponse } from "@/lib/feature-flags";

const NON_APPLICANT_POSITION_TYPES = new Set(["lead", "vice", "resident"]);
const STAGED_RANK_OFFSET = 1000;

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
		const { rankings } = await request.json();
		if (!rankings || !Array.isArray(rankings)) {
			return NextResponse.json({ error: "Missing or invalid rankings array" }, { status: 400 });
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

		const typedRankings = rankings as Array<{ user_id: number; ranking: number }>;
		const rankingUserIds = typedRankings.map((r) => r.user_id);

		// Drop any rows whose user_ids are no longer in the chair's list.
		// (Equivalent to the legacy clear-and-replace's removal step.) We avoid
		// a global DELETE so existing rows about to be re-ranked aren't churned.
		if (rankingUserIds.length > 0) {
			const { error: deleteError } = await supabase
				.from("cca_position_preferences")
				.delete()
				.eq("position_id", positionId)
				.not("user_id", "in", `(${rankingUserIds.join(",")})`);

			if (deleteError) {
				console.error("Error pruning removed applicants:", deleteError);
				return NextResponse.json({ error: "Failed to clear removed applicants" }, { status: 500 });
			}
		} else {
			// No applicants to keep: clear all rows for this position.
			const { error: deleteError } = await supabase
				.from("cca_position_preferences")
				.delete()
				.eq("position_id", positionId);

			if (deleteError) {
				console.error("Error clearing position preferences:", deleteError);
				return NextResponse.json({ error: "Failed to clear existing rankings" }, { status: 500 });
			}
		}

		// Staged-rank workaround for the DEFERRABLE INITIALLY DEFERRED unique
		// constraint when each RPC is its own transaction. First pass writes
		// rank + STAGED_RANK_OFFSET, second pass writes the real rank.
		for (const r of typedRankings) {
			const { error: stageError } = await supabase.rpc("upsert_cca_position_preference", {
				p_position_id: positionId,
				p_user_id: r.user_id,
				p_rank: r.ranking + STAGED_RANK_OFFSET,
			});
			if (stageError) {
				console.error("Error staging preference rank:", stageError);
				return NextResponse.json({ error: "Failed to stage rankings" }, { status: 500 });
			}
		}

		for (const r of typedRankings) {
			const { error: finalError } = await supabase.rpc("upsert_cca_position_preference", {
				p_position_id: positionId,
				p_user_id: r.user_id,
				p_rank: r.ranking,
			});
			if (finalError) {
				console.error("Error finalizing preference rank:", finalError);
				return NextResponse.json({ error: "Failed to save new rankings" }, { status: 500 });
			}
		}

		return NextResponse.json({
			success: true,
			message: `Updated rankings for ${typedRankings.length} applicants`,
			updated_count: typedRankings.length,
		});
	} catch (error: unknown) {
		console.error("Error updating rankings:", error);
		return NextResponse.json({ error: "Server error" }, { status: 500 });
	}
}
