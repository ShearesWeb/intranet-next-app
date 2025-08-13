// src\app\api\chair\positions\saveRankings\route.ts
import { NextResponse } from "next/server";
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';

export async function POST(request: Request) {
    try {
        const { chair_email, rankings } = await request.json();
        const supabase = createRouteHandlerClient({ cookies });

        // Verify chair permissions
        const { data: chair, error: chairError } = await supabase
            .from('users')
            .select('id')
            .eq('email', chair_email)
            .single();

        if (chairError || !chair) {
            return NextResponse.json({ error: 'Chair not found' }, { status: 404 });
        }

        // Check if chair has lead/vice appointment
        const { data: chairAppointments } = await supabase
            .from('cca_appointments')
            .select(`
                cca_positions!inner (
                position_type
                )
            `)
            .eq('user_id', chair.id)
            .in('cca_positions.position_type', ['lead', 'vice']);

        if (!chairAppointments || chairAppointments.length === 0) {
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
