// src/app/api/sportsCulture/apply/route.ts
// API route to get available sports and culture positions for application
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { cookies } from 'next/headers';
import { phaseService } from '@/lib/phase-service';
import { fetchUserId } from "@/lib/fetch-user-info";

export async function POST(request: Request) {
    try {
        const { position_id } = await request.json();

        const supabase = await createClient();

        // Verify authentication and get user ID
        const requestingUserId = await fetchUserId();

        if (!requestingUserId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Check if applications are open
        const phaseInfo = await phaseService.getCurrentPhaseInfo();
        const applicationsOpen = await areApplicationsOpen(phaseInfo);
        if (!applicationsOpen) {
            return NextResponse.json({
                error: 'Sports/Culture applications are not currently open'
            }, { status: 403 });
        }

        // Verify position is sports/culture member OR team manager position
        const { data: positionData, error: posError } = await supabase
            .from('cca_positions')
            .select(`
                id,
                position_type,
                cca_id,
                ccas!inner(id, name, cca_type)
            `)
            .eq('id', position_id)
            .single();

        if (posError || !positionData) {
            return NextResponse.json({ error: 'Position not found' }, { status: 404 });
        }

        const cca = Array.isArray(positionData.ccas) ? positionData.ccas[0] : positionData.ccas;

        // ✅ UPDATE: Allow both 'member' and 'team manager' positions
        if (!['sports', 'culture'].includes(cca?.cca_type) ||
            !['member', 'team manager'].includes(positionData.position_type)) {
            return NextResponse.json({
                error: 'Invalid position for sports/culture application'
            }, { status: 400 });
        }

        // ✅ NEW: Check for existing applications to the same CCA
        const { data: existingCCAApplications, error: existingError } = await supabase
            .from('cca_appointments')
            .select(`
                position_id,
                cca_positions!inner(
                    position_type,
                    cca_id,
                    name
                )
            `)
            .eq('user_id', requestingUserId)
            .eq('cca_positions.cca_id', positionData.cca_id)
            .in('cca_positions.position_type', ['member', 'team manager']);

        if (existingError) {
            console.error('Error checking existing CCA applications:', existingError);
        }

        // Check if user already applied to a different position in the same CCA
        const conflictingApplication = existingCCAApplications?.find(app =>
            app.position_id !== position_id
        );

        if (conflictingApplication) {
            const conflictPosition = conflictingApplication.cca_positions;
            const conflictPositionData = Array.isArray(conflictPosition) ? conflictPosition[0] : conflictPosition;

            return NextResponse.json({
                error: `You have already applied as ${conflictPositionData?.name || 'another position'} for ${cca.name}. Remove that application first.`
            }, { status: 400 });
        }

        // Check if already applied to this exact position
        const { data: exactMatch } = await supabase
            .from('cca_appointments')
            .select('id')
            .eq('user_id', requestingUserId)
            .eq('position_id', position_id)
            .single();

        if (exactMatch) {
            return NextResponse.json({
                error: 'Already applied to this position'
            }, { status: 400 });
        }

        // Apply to position
        const { error: applyError } = await supabase
            .from('cca_appointments')
            .insert({
                user_id: requestingUserId,
                position_id: position_id,
                points: 0
            });

        if (applyError) {
            console.error('Error applying to position:', applyError);
            return NextResponse.json({ error: 'Failed to apply' }, { status: 500 });
        }

        // Log allocation event
        try {
            await supabase
                .from('cca_allocation_events')
                .insert({
                    user_id: requestingUserId,
                    position_id: position_id,
                    reason: 'Applied during open application period',
                    event_type: 'applied'
                });
        } catch (logError) {
            console.warn('Failed to log allocation event:', logError);
        }

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('Error in sports/culture application:', error);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const { position_id } = await request.json();

        const supabase = await createClient();

        // Verify authentication and get user ID
        const requestingUserId = await fetchUserId();

        if (!requestingUserId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Check if applications are open
        const phaseInfo = await phaseService.getCurrentPhaseInfo();
        const applicationsOpen = await areApplicationsOpen(phaseInfo);
        if (!applicationsOpen) {
            return NextResponse.json({
                error: 'Sports/Culture applications are not currently open'
            }, { status: 403 });
        }

        // Remove application
        const { error: removeError } = await supabase
            .from('cca_appointments')
            .delete()
            .eq('user_id', requestingUserId)
            .eq('position_id', position_id);

        if (removeError) {
            console.error('Error removing application:', removeError);
            return NextResponse.json({ error: 'Failed to remove application' }, { status: 500 });
        }

        // Delete all allocation events for this user and position
        try {
            await supabase
                .from('cca_allocation_events')
                .delete()
                .eq('user_id', requestingUserId)
                .eq('position_id', position_id);
        } catch (deleteError) {
            console.warn('Failed to delete allocation events:', deleteError);
            // Don't fail the request if event deletion fails
        }

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('Error removing sports/culture application:', error);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}

async function areApplicationsOpen(phaseInfo: any): Promise<boolean> {
    const applicationPhases = [
        'subcomm_concurrent_ranking'
    ];
    return applicationPhases.includes(phaseInfo.phase);
}
