// src\app\api\chair\positions\[position_id]\addApplicant\route.ts

import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { cookies } from 'next/headers';

export async function POST(request: Request, { params }: { params: Promise<{ position_id: string }> }) {
    try {
        const { position_id } = await params;
        const supabase = await createClient();

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
            .from('public_user_info')
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

        // Check if applicant already exists
        const { data: existingApplicant } = await supabase
            .from('cca_user_ranking')
            .select('id')
            .eq('user_id', user_id)
            .eq('position_id', positionId)
            .single();

        if (existingApplicant) {
            return NextResponse.json({ error: 'Applicant already exists for this position' }, { status: 400 });
        }

        // Get current number of applicants to determine next rank
        const { data: currentApplicants, error: countError } = await supabase
            .from('cca_user_ranking')
            .select('ranking')
            .eq('position_id', positionId)
            .order('ranking', { ascending: false })
            .limit(1);

        if (countError) {
            console.error("Error counting current applicants:", countError);
            return NextResponse.json({ error: 'Failed to determine ranking' }, { status: 500 });
        }

        // Calculate next ranking: highest current rank + 1, or 1 if no applicants
        const nextRanking = currentApplicants.length > 0
            ? (currentApplicants[0].ranking || 0) + 1
            : 1;

        // Insert new applicant with calculated ranking
        const { error } = await supabase
            .from('cca_user_ranking')
            .insert({
                user_id: user_id,
                position_id: positionId,
                ranking: nextRanking
            });

        if (error) {
            console.error("Error adding applicant:", error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            ranking: nextRanking,
            message: `Applicant added with ranking ${nextRanking}`
        });
    } catch (error: unknown) {
        console.error("Unexpected error:", error);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
