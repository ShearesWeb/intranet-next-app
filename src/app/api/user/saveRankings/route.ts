// src/app/api/user/saveRankings/route.ts
import { NextResponse } from "next/server";
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';

export async function POST(request: Request) {
    try {
        const { email, rankings } = await request.json();
        const supabase = createRouteHandlerClient({ cookies });

        // Get user ID
        const { data: user, error: userError } = await supabase
            .from('public_user_info')
            .select('id')
            .eq('email', email)
            .single();

        if (userError || !user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        // Save rankings
        const preferences = rankings.map((rank: { position_id: number; ranking: number }) => ({
            user_id: user.id,
            position_id: rank.position_id,
            ranking: rank.ranking,
            application_status: 'pending'
        }));

        // Delete existing preferences and insert new ones
        const { error: deleteError } = await supabase
            .from('user_cca_applications')
            .delete()
            .eq('user_id', user.id);

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