// src/app/api/user/saveRankings/route.ts
// API route to save CCA rankings for a user
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { fetchUserId } from "@/lib/fetch-user-info";

export async function POST(request: Request) {
    try {
        const { rankings } = await request.json();
        const supabase = await createClient();

        // Get user ID from cookie
        const userId = await fetchUserId();

        if (!userId) {
            return NextResponse.json({
                error: 'Unauthorized'
            }, { status: 401 });
        }

        // Save rankings
        const preferences = rankings.map((rank: { position_id: number; ranking: number }) => ({
            user_id: userId,
            position_id: rank.position_id,
            ranking: rank.ranking,
            application_status: 'pending'
        }));

        // Delete existing preferences and insert new ones
        const { error: deleteError } = await supabase
            .from('user_cca_applications')
            .delete()
            .eq('user_id', userId);

        if (deleteError) {
            console.error('Error deleting existing preferences:', deleteError);
        }

        const { error: insertError } = await supabase
            .from('user_cca_applications')
            .insert(preferences);

        if (insertError) {
            console.error('Error inserting preferences:', insertError);
            return NextResponse.json({ error: 'Failed to save rankings' }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error saving rankings:", error);
        return NextResponse.json({ error: 'Failed to save rankings' }, { status: 500 });
    }
}