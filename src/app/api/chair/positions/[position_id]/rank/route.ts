// src\app\api\chair\positions\[position_id]\rank\route.ts

import { NextResponse } from "next/server";
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export async function POST(request: Request, { params }: { params: Promise<{ position_id: string }> }) {
    try {
        const { position_id } = await params;
        const supabase = createRouteHandlerClient({ cookies });

        // Verify authentication
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
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

        // Get user data
        const { data: userData } = await supabase
            .from('public_users')
            .select('id')
            .eq('email', user.email)
            .single();

        if (!userData) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        // ✅ CORRECTED AUTHORIZATION LOGIC
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
        const { data: userAppointments } = await supabase
            .from('cca_appointments')
            .select(`
                cca_positions!inner (
                cca_id,
                position_type
                )
            `)
            .eq('user_id', userData.id)
            .eq('cca_positions.cca_id', targetPosition.cca_id)
            .in('cca_positions.position_type', ['lead', 'vice'])
            .not('position_id', 'is', null);

        if (!userAppointments || userAppointments.length === 0) {
            return NextResponse.json({
                error: 'Unauthorized: Not a lead/vice for this CCA'
            }, { status: 403 });
        }

        // Update rankings for all applicants
        const updatePromises = rankings.map(async (ranking: { user_id: number; ranking: number }) => {
            const { error } = await supabase
                .from('user_cca_applications')
                .update({ ranking: ranking.ranking })
                .eq('user_id', ranking.user_id)
                .eq('position_id', positionId);

            if (error) {
                console.error(`Error updating ranking for user ${ranking.user_id}:`, error);
                throw error;
            }
        });

        await Promise.all(updatePromises);

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

