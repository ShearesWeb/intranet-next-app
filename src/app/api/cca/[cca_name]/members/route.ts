// src/app/api/cca/[cca_name]/members/route.ts
import { NextResponse } from "next/server";
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { phaseService } from '@/lib/phaseService';

interface TransformedMember {
    user_id: number;
    name: string;
    email: string;
    room: string;
    position_name: string;
    position_type: string;
    points: number;
    appointed_date: string;
}

export async function GET(
    request: Request,
    { params }: { params: Promise<{ cca_name: string }> }
) {
    try {
        const { cca_name } = await params;
        const decodedCcaName = decodeURIComponent(cca_name);
        const supabase = createRouteHandlerClient({ cookies });

        // Verify authentication
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Get requesting user's ID
        const { data: userData, error: userError } = await supabase
            .from('public_user_info')
            .select('id')
            .eq('email', user.email)
            .single();

        if (userError || !userData) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        // Get CCA ID and type from name
        const { data: ccaData, error: ccaError } = await supabase
            .from('ccas')
            .select('id, name, cca_type')
            .eq('name', decodedCcaName)
            .single();

        if (ccaError || !ccaData) {
            return NextResponse.json({ error: 'CCA not found' }, { status: 404 });
        }

        // Support committee, sports, and culture types
        // if (!['committee', 'sports', 'culture'].includes(ccaData.cca_type)) {
        //     return NextResponse.json({
        //         error: 'Access denied: Member viewing is only available for committee, sports, and culture CCAs'
        //     }, { status: 403 });
        // }

        // Authorization - Check if user is lead/vice for THIS specific CCA
        const { data: userAppointments, error: appointmentError } = await supabase
            .from('cca_appointments')
            .select(`
                cca_positions!inner (
                cca_id,
                position_type,
                name
                )
            `)
            .eq('user_id', userData.id)
            .eq('cca_positions.cca_id', ccaData.id)
            .in('cca_positions.position_type', ['lead', 'vice']);

        if (appointmentError || !userAppointments || userAppointments.length === 0) {
            return NextResponse.json({
                error: 'Unauthorized: You are not a lead/vice for this CCA'
            }, { status: 403 });
        }

        // Get phase info for sports/culture management permissions
        const phaseInfo = await phaseService.getCurrentPhaseInfo();
        const canManageSportsCulture = await isInSportsCultureManagementPhase(phaseInfo);

        // Get all appointed members for this CCA
        const { data: ccaMembers, error: membersError } = await supabase
            .from('cca_appointments')
            .select(`
                user_id,
                points,
                created_at,
                public_user_info!inner(id, name, email, room),
                cca_positions!inner(id, name, position_type, cca_id)
            `)
            .eq('cca_positions.cca_id', ccaData.id);

        if (membersError) {
            console.error('Error fetching CCA members:', membersError);
            return NextResponse.json({ error: 'Failed to fetch members' }, { status: 500 });
        }

        // Transform the data with proper type safety
        const transformedMembers: TransformedMember[] = [];

        ccaMembers?.forEach((member: any) => {
            // Extract user data
            let userData: any = null;
            if (member.public_user_info) {
                userData = Array.isArray(member.public_user_info)
                    ? member.public_user_info[0]
                    : member.public_user_info;
            }

            // Extract position data
            let positionData: any = null;
            if (member.cca_positions) {
                positionData = Array.isArray(member.cca_positions)
                    ? member.cca_positions[0]
                    : member.cca_positions;
            }

            if (userData && positionData) {
                transformedMembers.push({
                    user_id: member.user_id,
                    name: userData.name,
                    email: userData.email,
                    room: userData.room,
                    position_name: positionData.name,
                    position_type: positionData.position_type,
                    points: member.points || 0,
                    appointed_date: member.created_at
                });
            }
        });

        // Group members by position type (including sports-specific positions)
        const groupedMembers = {
            lead: transformedMembers
                .filter(member => member.position_type === 'lead')
                .sort((a, b) => a.position_name.localeCompare(b.position_name)),
            vice: transformedMembers
                .filter(member => member.position_type === 'vice')
                .sort((a, b) => a.position_name.localeCompare(b.position_name)),
            maincomm: transformedMembers
                .filter(member => ['maincomm', 'blockcomm'].includes(member.position_type))
                .sort((a, b) => a.position_name.localeCompare(b.position_name)),
            subcomm: transformedMembers
                .filter(member => member.position_type === 'subcomm')
                .sort((a, b) => a.position_name.localeCompare(b.position_name)),
            teamManager: transformedMembers
                .filter(member => member.position_type === 'team manager')
                .sort((a, b) => a.position_name.localeCompare(b.position_name)),
            members: transformedMembers
                .filter(member => member.position_type === 'member')
                .sort((a, b) => a.name.localeCompare(b.name))
        };

        return NextResponse.json({
            success: true,
            cca: {
                id: ccaData.id,
                name: ccaData.name,
                cca_type: ccaData.cca_type
            },
            groupedMembers,
            total_members: transformedMembers.length,
            permissions: {
                canManageMembers: canManageSportsCulture || ccaData.cca_type === 'committee',
                ccaType: ccaData.cca_type
            }
        });

    } catch (error) {
        console.error('Error in members API:', error);
        return NextResponse.json({
            error: 'Internal server error'
        }, { status: 500 });
    }
}

// Determine if we're in sports/culture management phase
async function isInSportsCultureManagementPhase(phaseInfo: any): Promise<boolean> {
    // Sports/Culture management is available after subcomm_concurrent_ranking expires
    const sportsCulturePhases = [
        'subcomm_results_processing',
        'full_results_available'
    ];

    return sportsCulturePhases.includes(phaseInfo.phase);
}
