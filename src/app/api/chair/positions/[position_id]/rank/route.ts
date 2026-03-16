// src\app\api\chair\positions\[position_id]\rank\route.ts
// API route to save rankings for applicants as a chairperson
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { fetchUserInfo } from "@/lib/fetch-user-info";
import { checkCcaAuthorization } from "@/lib/cca-rankings-access";

const NON_APPLICANT_POSITION_TYPES = new Set(["lead", "vice", "resident"]);

export async function POST(request: Request, { params }: { params: Promise<{ position_id: string }> }) {
    try {
        const { position_id } = await params;
        const supabase = await createClient();

        const requestingUser = await fetchUserInfo();

        const positionId = parseInt(position_id, 10);
        const { rankings } = await request.json();
        if (!rankings || !Array.isArray(rankings)) {
            return NextResponse.json({ error: 'Missing or invalid rankings array' }, { status: 400 });
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
        const accessResult = checkCcaAuthorization({
            requestingUser,
            cca,
            require: "chair",
        });

        if (!accessResult.ok) {
            return NextResponse.json({ error: accessResult.error }, { status: accessResult.status });
        }

        // Delete existing rankings for this position to avoid conflicts
        const { error: deleteError } = await supabase
            .from('cca_user_ranking')
            .delete()
            .eq('position_id', positionId);

        if (deleteError) {
            console.error('Error deleting existing rankings:', deleteError);
            return NextResponse.json({ error: 'Failed to clear existing rankings' }, { status: 500 });
        }

        // Insert new rankings
        const rankingRecords = rankings.map((ranking: { user_id: number; ranking: number }) => ({
            user_id: ranking.user_id,
            position_id: positionId,
            ranking: ranking.ranking
        }));

        const { error: insertError } = await supabase
            .from('cca_user_ranking')
            .insert(rankingRecords);

        if (insertError) {
            console.error('Error inserting new rankings:', insertError);
            return NextResponse.json({ error: 'Failed to save new rankings' }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            message: `Updated rankings for ${rankings.length} applicants`,
            updated_count: rankings.length
        });

    } catch (error: unknown) {
        console.error("Error updating rankings:", error);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
