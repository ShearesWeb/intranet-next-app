// src/app/api/user/getRankablePositions/[email]/route.ts
import { NextResponse } from "next/server";
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ email: string }> }
) {
    try {
        const { email } = await params;
        const supabase = createRouteHandlerClient({ cookies });

        // Get user ID first
        const { data: user, error: userError } = await supabase
            .from('public_users')  // Use unrestricted table
            .select('id')
            .eq('email', email)
            .single();

        if (userError || !user) {
            return NextResponse.json({ positions: [] });
        }

        // Get positions where user was ranked by chairs (ignore user's own rankings for now)
        const { data: applications, error } = await supabase
            .from('user_cca_applications')
            .select(`
        position_id,
        ranking,
        cca_positions!inner (
          id,
          name,
          description,
          capacity,
          position_type,
          ccas!inner (
            name
          )
        )
      `)
            .eq('user_id', user.id)
            .not('ranking', 'is', null); // Only positions where user was ranked by chairs

        if (error) {
            console.error('Error fetching applications:', error);
            return NextResponse.json({ positions: [] });
        }

        // ✅ NEW: Get existing user rankings separately
        const { data: userRankings, error: rankError } = await supabase
            .from('cca_user_ranking')
            .select('position_id, ranking')
            .eq('user_id', user.id);

        if (rankError) {
            console.error('Error fetching user rankings:', rankError);
        }

        // ✅ NEW: Create a map for quick lookup of user rankings
        const userRankingMap = new Map(
            userRankings?.map(r => [r.position_id, r.ranking]) || []
        );

        // Transform data - include user's existing rankings
        const transformedPositions = applications?.map((app: any) => {
            const position = app.cca_positions;
            const cca = position.ccas;

            return {
                id: position.id,
                name: position.name,
                cca_name: cca.name,
                position_type: position.position_type,
                capacity: position.capacity,
                description: position.description,
                user_ranking: userRankingMap.get(position.id) || null, // ✅ NEW: User's own ranking
                is_selected: userRankingMap.has(position.id) // ✅ NEW: Whether user has ranked this before
            };
        }) || [];

        return NextResponse.json({ positions: transformedPositions });
    } catch (error) {
        console.error("Error fetching rankable positions:", error);
        return NextResponse.json({ positions: [] });
    }
}
