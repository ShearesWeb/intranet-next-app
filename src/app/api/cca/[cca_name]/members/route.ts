// src/app/api/cca/[cca_name]/members/route.ts
import { NextResponse } from "next/server";
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

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
            .from('public_users')
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

        // Check if CCA is of type "committee"
        if (ccaData.cca_type !== 'committee') {
            return NextResponse.json({
                error: 'Access denied: Member viewing is only available for committee-type CCAs'
            }, { status: 403 });
        }

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

        // Get all APPOINTED members for this CCA (Fixed ordering)
        const { data: ccaMembers, error: membersError } = await supabase
            .from('cca_appointments')
            .select(`
                user_id,
                points,
                created_at,
                public_users!inner(id, name, email, room),
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
            if (member.public_users) {
                userData = Array.isArray(member.public_users)
                    ? member.public_users[0]
                    : member.public_users;
            }

            // Extract position data
            let positionData: any = null;
            if (member.cca_positions) {
                positionData = Array.isArray(member.cca_positions)
                    ? member.cca_positions
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

        // Group members by position type and sort
        const groupedMembers = {
            lead: transformedMembers
                .filter(member => member.position_type === 'lead')
                .sort((a, b) => a.position_name.localeCompare(b.position_name)),
            vice: transformedMembers
                .filter(member => member.position_type === 'vice')
                .sort((a, b) => a.position_name.localeCompare(b.position_name)),
            maincomm: transformedMembers
                .filter(member => member.position_type === 'maincomm' || member.position_type === 'blockcomm')
                .sort((a, b) => a.position_name.localeCompare(b.position_name)),
            subcomm: transformedMembers
                .filter(member => member.position_type === 'subcomm' || member.position_type === 'team manager')
                .sort((a, b) => a.position_name.localeCompare(b.position_name))
        };

        return NextResponse.json({
            success: true,
            cca: {
                id: ccaData.id,
                name: ccaData.name,
                cca_type: ccaData.cca_type
            },
            groupedMembers,
            total_members: transformedMembers.length
        });

    } catch (error) {
        console.error('Error in members API:', error);
        return NextResponse.json({
            error: 'Internal server error'
        }, { status: 500 });
    }
}
