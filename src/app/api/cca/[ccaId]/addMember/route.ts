// src/app/api/cca/[cca_name]/addMember/route.ts
// API route to add a member to a CCA (sports, culture, or others)
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { fetchUserId } from "@/lib/fetch-user-info";
import { checkCCAChairAuthorization } from "@/lib/lead-auth-service";

export async function POST(
    request: Request,
    { params }: { params: Promise<{ ccaId: string }> }
) {
    try {
        const { ccaId } = await params;
        const { user_id, position_id, commitment_period } = await request.json();

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
            .eq('id', ccaId)
            .single();

        if (ccaError || !ccaData) {
            return NextResponse.json({ error: 'CCA not found' }, { status: 404 });
        }

        // Verify requesting user has lead/vice role for this CCA
        const authResult = await checkCCAChairAuthorization(requestingUserId, ccaData.id, supabase);
        if (!authResult.authorized) {
            return NextResponse.json({
                error: 'Unauthorized: You are not a lead/vice for this CCA'
            }, { status: 403 });
        }

        let targetPositionId = position_id;

        if (!targetPositionId) {
            // Find or create the "Member" position for this CCA if no position specified
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
            targetPositionId = memberPosition.id;
        }

        // Check if member already exists
        const { data: existingAppointment } = await supabase
            .from('cca_appointments')
            .select('id')
            .eq('user_id', user_id)
            .eq('position_id', targetPositionId)
            .single();

        if (existingAppointment) {
            return NextResponse.json({
                error: 'User is already appointed to this position'
            }, { status: 400 });
        }

        // Check capacity
        const { data: positionInfo } = await supabase
            .from('cca_positions')
            .select('capacity')
            .eq('id', targetPositionId)
            .single();

        if (positionInfo && positionInfo.capacity > 0) {
            const { count } = await supabase
                .from('cca_appointments')
                .select('*', { count: 'exact', head: true })
                .eq('position_id', targetPositionId);
            
            if ((count || 0) >= positionInfo.capacity) {
                return NextResponse.json({
                    error: `Position capacity (${positionInfo.capacity}) would be exceeded. Current appointments: ${count || 0}.`
                }, { status: 400 });
            }
        }

        // Add the member
        const { error: appointmentError } = await supabase
            .from('cca_appointments')
            .insert({
                user_id: user_id,
                position_id: targetPositionId,
                points: 0,
                cca_id: ccaData.id,
                commitment_period: commitment_period
            });

        if (appointmentError) {
            console.error('Error adding member:', appointmentError);
            return NextResponse.json({ error: 'Failed to add member' }, { status: 500 });
        }

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('Error adding member:', error);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
