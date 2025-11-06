// src/app/api/cca/[cca_name]/members/route.ts
// API route to get members of a lead/vice's CCA
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { phaseService } from '@/lib/phase-service';
import { fetchUserId } from "@/lib/fetch-user-info";
import { checkCCAChairAuthorization } from "@/lib/lead-auth-service";

interface TransformedMember {
    user_id: number;
    name: string;
    email: string;
    room: string;
    position_name: string;
    position_type: string;
    points: number;
    appointed_date: string;
    cut?: boolean;
}

export async function GET(
    request: Request,
    { params }: { params: Promise<{ cca_name: string }> }
) {
    try {
        const { cca_name } = await params;
        const decodedCcaName = decodeURIComponent(cca_name);
        const supabase = await createClient();

        // Verify authentication and get user ID
        const requestingUserId = await fetchUserId();

        if (!requestingUserId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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

        const { data: memberPositionId } = await supabase
            .from('cca_positions')
            .select('id')
            .eq('cca_id', ccaData.id)
            .eq('position_type', 'member')
            .single();

        // Authorization - Check if user is lead/vice for THIS specific CCA
        const authResult = await checkCCAChairAuthorization(requestingUserId, ccaData.id, supabase);
        if (!authResult.authorized) {
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
                comments,
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
                    appointed_date: member.created_at,
                    cut: member.comments?.toLowerCase() === 'cut' ? true : false
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
                .filter(member => member.position_type === 'member' && !member.cut)
                .sort((a, b) => a.name.localeCompare(b.name)),
            cut: transformedMembers
                .filter(member => member.position_type === 'member' && member.cut)
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
            member_position_id: memberPositionId?.id,
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
