// src/app/api/cca/[cca_name]/addMember/route.ts
// API route to add a member to a sports or culture CCA
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
        const { user_id, reason } = await request.json();

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

        // Find or create the "Member" position for this CCA
        let { data: memberPosition } = await supabase
            .from('cca_positions')
            .select('id')
            .eq('cca_id', ccaData.id)
            .eq('position_type', 'member')
            .single();

        if (!memberPosition) {
            // Create member position if it doesn't exist
            const { data: newPosition, error: createError } = await supabase
                .from('cca_positions')
                .insert({
                    cca_id: ccaData.id,
                    position_type: 'member',
                    tier_type: 'none',
                    name: 'Member'
                })
                .select('id')
                .single();

            if (createError) {
                console.error('Error creating member position:', createError);
                return NextResponse.json({ error: 'Failed to create member position' }, { status: 500 });
            }
            memberPosition = newPosition;
        }

        // Check if member already exists
        const { data: existingAppointment } = await supabase
            .from('cca_appointments')
            .select('id')
            .eq('user_id', user_id)
            .eq('position_id', memberPosition.id)
            .single();

        if (existingAppointment) {
            return NextResponse.json({
                error: 'User is already appointed to this position'
            }, { status: 400 });
        }

        // Add the member
        const { error: appointmentError } = await supabase
            .from('cca_appointments')
            .insert({
                user_id: user_id,
                position_id: memberPosition.id,
                points: 0
            });

        if (appointmentError) {
            console.error('Error adding member:', appointmentError);
            return NextResponse.json({ error: 'Failed to add member' }, { status: 500 });
        }

        // Log the allocation event (fixed column name)
        try {
            await supabase
                .from('cca_allocation_events')
                .insert({
                    user_id: user_id,
                    position_id: memberPosition.id,
                    reason: reason || 'Added by captain/head',
                    event_type: 'accepted'
                });
        } catch (logError) {
            console.warn('Failed to log allocation event:', logError);
        }

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('Error adding member:', error);
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
