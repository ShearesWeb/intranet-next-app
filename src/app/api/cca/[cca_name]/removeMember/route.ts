// src/app/api/cca/[cca_name]/removeMember/route.ts
// API route to remove a member from a sports or culture CCA
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { phaseService } from '@/lib/phase-service';
import { fetchUserId } from "@/lib/fetch-user-info";
import { checkCCAChairAuthorization } from "@/lib/lead-auth-service";

export async function POST(
    request: Request,
    { params }: { params: Promise<{ cca_name: string }> }
) {
    try {
        const { cca_name } = await params;
        const decodedCcaName = decodeURIComponent(cca_name);
        const { user_id, position_id, reason } = await request.json();

        const supabase = await createClient();

        // Verify authentication and get user ID
        const requestingUserId = await fetchUserId();

        if (!requestingUserId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
                error: 'Sports/Culture member management is currently not available'
            }, { status: 403 });
        }

        // Verify requesting user has lead/vice role for this CCA
        const authResult = await checkCCAChairAuthorization(requestingUserId, ccaData.id, supabase);
        if (!authResult.authorized) {
            return NextResponse.json({
                error: 'Unauthorized: You are not a lead/vice for this CCA'
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