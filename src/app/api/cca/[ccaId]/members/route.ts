// src/app/api/cca/[cca_name]/members/route.ts
// API route to get members of a lead/vice's CCA
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { fetchUserInfo } from "@/lib/fetch-user-info";
import { getManagedCcaAccess } from "@/lib/cca-management-access";
import { normalizeCutStatusForCca } from "@/lib/cca-cut-status";

interface TransformedMember {
    user_id: number;
    name: string;
    email: string;
    room: string;
    position_id?: number;
    position_name: string;
    position_type: string;
    points: number;
    appointed_date: string;
    cut_status?: string;
    commitment_period?: string;
}

export async function GET(
    _request: Request,
    { params }: { params: Promise<{ ccaId: string }> }
) {
    try {
        const { ccaId } = await params;
        const supabase = await createClient();

        // Verify authentication and get user ID
        const requestingUser = await fetchUserInfo();

        if (!requestingUser) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Get CCA ID and type from name
        const { data: ccaData, error: ccaError } = await supabase
            .from('ccas')
            .select('id, name, cca_type')
            .eq('id', ccaId)
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

        // Get all positions for this CCA (for Add Member dialog)
        const { data: allPositions } = await supabase
            .from('cca_positions')
            .select('id, name, position_type')
            .eq('cca_id', ccaData.id)
            .order('name');

        // Authorization - Check if user is lead/vice for THIS specific CCA
        const authResult = await getManagedCcaAccess({
            supabase,
            requestingUser,
            cca: ccaData,
        });

        if (!authResult.ok) {
            return NextResponse.json({
                error: authResult.error
            }, { status: authResult.status });
        }

        // Get all appointed members for this CCA
        const { data: ccaMembers, error: membersError } = await supabase
            .from('cca_appointments')
            .select(`
                user_id,
                points,
                created_at,
                cut_status,
                commitment_period,
                public_user_info!inner(id, name, email, room),
                cca_positions!inner(id, name, position_type, cca_id)
            `)
            .eq('cca_positions.cca_id', ccaData.id);

        if (membersError) {
            console.error('Error fetching CCA members:', membersError);
            return NextResponse.json({ error: 'Failed to fetch members' }, { status: 500 });
        }

        const transformedMembers: TransformedMember[] = [];

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ccaMembers?.forEach((member: any) => {
            const userData = member.public_user_info;
            
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
                    position_id: positionData.id,
                    position_name: positionData.name,
                    position_type: positionData.position_type,
                    points: member.points || 0,
                    appointed_date: member.created_at,
                    cut_status: normalizeCutStatusForCca(member.cut_status, ccaData.cca_type),
                    commitment_period: member.commitment_period,
                });
            }
        });

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
            
            ivpIhgTeam: transformedMembers
                .filter(member => member.cut_status === 'ivp-ihg-team')
                .sort((a, b) => a.name.localeCompare(b.name)),
            ihgTeam: transformedMembers
                .filter(member => member.cut_status === 'ihg-team')
                .sort((a, b) => a.name.localeCompare(b.name)),
            finalCut: transformedMembers
                .filter(member => member.cut_status === 'final-cut')
                .sort((a, b) => a.name.localeCompare(b.name)),
            firstCut: transformedMembers
                .filter(member => member.cut_status === 'first-cut')
                .sort((a, b) => a.name.localeCompare(b.name)),

            members: transformedMembers
                .filter(member => member.position_type === 'member' && !member.cut_status)
                .sort((a, b) => a.name.localeCompare(b.name)),
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
            all_positions: allPositions,
            total_members: transformedMembers.length,
            permissions: {
                canManageMembers: true,
                ccaType: ccaData.cca_type
            }
        });

    } catch (error) {
        console.error('Error fetching members:', error);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
