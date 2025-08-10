// src\app\api\chair\positions\[position_id]\removeApplicant\route.ts

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

        const { user_id } = await request.json();
        if (!user_id) {
            return NextResponse.json({ error: 'Missing user_id' }, { status: 400 });
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

        // Check if user has lead/vice appointment for this CCA
        const { data: targetPosition } = await supabase
            .from('cca_positions')
            .select('cca_id')
            .eq('id', positionId)
            .single();

        if (!targetPosition) {
            return NextResponse.json({ error: 'Position not found' }, { status: 404 });
        }

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

        const { error } = await supabase
            .from('user_cca_applications')
            .delete()
            .eq('user_id', user_id)
            .eq('position_id', positionId);

        if (error) {
            console.error("Error removing applicant:", error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        console.error("Unexpected error:", error);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
