// src\app\api\chair\positions\saveRankings\route.ts
import { NextResponse } from "next/server";
import { cache } from 'react';
import { createClient } from "@/utils/supabase/server";
import { fetchUserId } from "@/lib/fetch-user-info";
import { getUserAuthorizedCCAs } from "@/lib/lead-auth-service";

const getCachedChairAuthorization = cache(async (userId: number, supabase: any) => {
    return await getUserAuthorizedCCAs(userId, supabase);
});

export async function POST(request: Request) {
    try {
        const userId = await fetchUserId();

        if (!userId) {
            return NextResponse.json({
                error: 'Unauthorized'
            }, { status: 401 });
        }

        const { rankings } = await request.json();

        if (!rankings || !Array.isArray(rankings)) {
            return NextResponse.json({ error: 'Invalid request data' }, { status: 400 });
        }

        const supabase = await createClient();

        const authResult = await getCachedChairAuthorization(userId, supabase);

        if (!authResult.authorized) {
            return NextResponse.json({ error: 'Unauthorized: Not a lead/vice' }, { status: 403 });
        }

        // Update rankings in user_cca_applications table
        const updates = rankings.map(async (ranking: { user_id: number; ranking: number; position_id: number }) => {
            const { error } = await supabase
                .from('user_cca_applications')
                .update({ ranking: ranking.ranking })
                .eq('user_id', ranking.user_id)
                .eq('position_id', ranking.position_id);

            return error;
        });

        const results = await Promise.all(updates);
        const hasErrors = results.some(error => error !== null);

        if (hasErrors) {
            console.error('Error updating rankings:', results.filter(r => r !== null));
            return NextResponse.json({ error: 'Failed to save some rankings' }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error saving rankings:", error);
        return NextResponse.json({ error: 'Failed to save rankings' }, { status: 500 });
    }
}
