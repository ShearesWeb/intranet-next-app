// src/app/api/cca/[cca_name]/removeMember/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { cookies } from 'next/headers';
import { phaseService } from '@/lib/phaseService';

export async function POST(
    request: Request,
    { params }: { params: Promise<{ cca_name: string }> }
) {
    try {
        const { cca_name } = await params;
        const decodedCcaName = decodeURIComponent(cca_name);
        const { user_id, position_id, reason } = await request.json();

        const supabase = await createClient();

        // Verify authentication
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Get requesting user's data
        const { data: requestingUser, error: userError } = await supabase
            .from('public_user_info')
            .select('id')
            .eq('email', user.email)
            .single();

        if (userError || !requestingUser) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        // Get CCA data
        const { data: ccaData, error: ccaError } = await supabase
            .from('ccas')
            .select('id, name, cca_type')
            .eq('name', decodedCcaName)
            .single();

        if (ccaError || !ccaData) {
            return NextResponse.json({ error: 'CCA not found' }, { status: 404 });
        }

        // Check if CCA is sports or culture type
        if (!['sports', 'culture'].includes(ccaData.cca_type)) {
            return NextResponse.json({
                error: 'This endpoint is only for sports and culture CCAs'
            }, { status: 403 });
        }

        // Check phase permissions
        const phaseInfo = await phaseService.getCurrentPhaseInfo();
        const canManage = await isInSportsCultureManagementPhase(phaseInfo);

        if (!canManage) {
            return NextResponse.json({
                error: 'Sports/Culture member management is not currently available'
            }, { status: 403 });
        }

        // Verify requesting user has lead/vice role for this CCA
        const { data: userAppointments } = await supabase
            .from('cca_appointments')
            .select(`
                cca_positions!inner (
                cca_id,
                position_type
                )
            `)
            .eq('user_id', requestingUser.id)
            .eq('cca_positions.cca_id', ccaData.id)
            .in('cca_positions.position_type', ['lead', 'vice']);

        if (!userAppointments || userAppointments.length === 0) {
            return NextResponse.json({
                error: 'Unauthorized: Not a lead/vice for this CCA'
            }, { status: 403 });
        }

        const { data: memberPosition } = await supabase
            .from('cca_positions')
            .select('id')
            .eq('cca_id', ccaData.id)
            .eq('position_type', 'member')
            .single();

        if (!memberPosition) {
            return NextResponse.json({ error: 'Member position not found' }, { status: 404 });
        }

        // Remove the member
        const { error: removeError } = await supabase
            .from('cca_appointments')
            .delete()
            .eq('user_id', user_id)
            .eq('position_id', memberPosition.id);

        if (removeError) {
            console.error('Error removing member:', removeError);
            return NextResponse.json({ error: 'Failed to remove member' }, { status: 500 });
        }

        // Log the allocation event (fixed column name)
        try {
            await supabase
                .from('cca_allocation_events')
                .insert({
                    user_id: user_id,
                    position_id: memberPosition.id,
                    reason: reason || 'Removed by captain/head',
                    event_type: 'cut'
                });
        } catch (logError) {
            console.warn('Failed to log allocation event:', logError);
        }

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('Error removing member:', error);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}

async function isInSportsCultureManagementPhase(phaseInfo: any): Promise<boolean> {
    const sportsCulturePhases = [
        'subcomm_results_processing',
        'full_results_available'
    ];
    return sportsCulturePhases.includes(phaseInfo.phase);
}
``