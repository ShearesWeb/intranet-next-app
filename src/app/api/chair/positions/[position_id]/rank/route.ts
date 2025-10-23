// src\app\api\chair\positions\[position_id]\rank\route.ts
// API route to save rankings for applicants as a chairperson
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { fetchUserId } from "@/lib/fetch-user-info";
import { checkCCAChairAuthorization } from "@/lib/lead-auth-service";

export async function POST(request: Request, { params }: { params: Promise<{ position_id: string }> }) {
    try {
        const { position_id } = await params;
        const supabase = await createClient();

        // Verify authentication and get user ID
        const requestingUserId = await fetchUserId();

        if (!requestingUserId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const positionId = parseInt(position_id, 10);
        if (!positionId) {
            return NextResponse.json({ error: 'Invalid position_id' }, { status: 400 });
        }

        const { rankings } = await request.json();
        if (!rankings || !Array.isArray(rankings)) {
            return NextResponse.json({ error: 'Missing or invalid rankings array' }, { status: 400 });
        }

        // Step 1: Get the CCA that this position belongs to
        const { data: targetPosition } = await supabase
            .from('cca_positions')
            .select('cca_id')
            .eq('id', positionId)
            .single();

        if (!targetPosition) {
            return NextResponse.json({ error: 'Position not found' }, { status: 404 });
        }

        // Step 2: Check if user has chair/head/vice appointment for ANY position in the same CCA
        const authResult = await checkCCAChairAuthorization(requestingUserId, targetPosition.cca_id, supabase);
        if (!authResult.authorized) {
            return NextResponse.json({
                error: 'Unauthorized: Not a lead/vice for this CCA'
            }, { status: 403 });
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
