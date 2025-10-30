// src/app/api/sportsCulture/available/route.ts
// API route to get available sports and culture positions for application
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { cookies } from 'next/headers';
import { phaseService } from '@/lib/phase-service';
import { fetchUserId } from "@/lib/fetch-user-info";

interface AvailablePosition {
    id: number;
    name: string;
    cca_name: string;
    cca_id: number;
    cca_type: 'sports' | 'culture';
    description: string | null;
    capacity: number | null;
    is_applied: boolean;
    user_current_role?: string;
    conflict_reason?: string;
    can_apply: boolean;
}

export async function GET(request: Request) {
    try {
        const supabase = await createClient();

        // Verify authentication and get user ID
        const requestingUserId = await fetchUserId();

        if (!requestingUserId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Check if applications are open
        const phaseInfo = await phaseService.getCurrentPhaseInfo();
        const applicationsOpen = await areApplicationsOpen(phaseInfo);

        // Get user's current CCA appointments (ALL CCAs, not just sports/culture)
        const { data: userCurrentCCAs, error: currentCCAsError } = await supabase
            .from('cca_appointments')
            .select(`
                position_id,
                cca_positions!inner(
                    name,
                    position_type,
                    cca_id,
                    ccas!inner(id, name, cca_type)
                )
            `)
            .eq('user_id', requestingUserId);

        if (currentCCAsError) {
            console.error('Error fetching user current CCAs:', currentCCAsError);
        }

        // ✅ Create maps for conflict checking
        const userCCAMap = new Map<number, string>(); // cca_id -> position_type (existing roles)
        const userApplicationsByCCA = new Map<number, { positionId: number, positionType: string, positionName: string }>(); // cca_id -> applied position info

        userCurrentCCAs?.forEach((appointment: any) => {
            const position = appointment.cca_positions;
            if (position && position.ccas) {
                const cca = Array.isArray(position.ccas) ? position.ccas[0] : position.ccas;
                if (cca) {
                    userCCAMap.set(cca.id, position.position_type);

                    // ✅ Track applications to sports/culture positions
                    if (['sports', 'culture'].includes(cca.cca_type) && ['member', 'team manager'].includes(position.position_type)) {
                        userApplicationsByCCA.set(cca.id, {
                            positionId: appointment.position_id,
                            positionType: position.position_type,
                            positionName: position.name
                        });
                    }
                }
            }
        });

        // Get all sports and culture positions (member AND team manager positions)
        const { data: positions, error: positionsError } = await supabase
            .from('cca_positions')
            .select(`
                id,
                name,
                description,
                capacity,
                ccas!inner(id, name, cca_type)
            `)
            .in('ccas.cca_type', ['sports', 'culture'])
            .in('position_type', ['member', 'team manager']); // ✅ Include both types

        if (positionsError) {
            console.error('Error fetching positions:', positionsError);
            return NextResponse.json({ positions: [] });
        }

        // Get user's current applications for sports/culture
        const { data: userApplications, error: appError } = await supabase
            .from('cca_appointments')
            .select('position_id')
            .eq('user_id', requestingUserId);

        if (appError) {
            console.error('Error fetching user applications:', appError);
        }

        const appliedPositionIds = new Set(
            userApplications?.map(app => app.position_id) || []
        );

        // Transform positions data with enhanced conflict checking
        const transformedPositions: AvailablePosition[] = positions?.map(position => {
            const cca = Array.isArray(position.ccas) ? position.ccas[0] : position.ccas;
            const ccaId = cca?.id || 0;
            const ccaName = cca?.name || 'Unknown';
            const ccaType = cca?.cca_type as 'sports' | 'culture';

            // Check if user has existing role in this CCA
            const userCurrentRole = userCCAMap.get(ccaId);
            const isApplied = appliedPositionIds.has(position.id);

            let canApply = true;
            let conflictReason = '';

            // ✅ Check for existing permanent roles (lead/vice/member from other processes)
            if (userCurrentRole) {
                if (userCurrentRole === 'member') {
                    canApply = false;
                    conflictReason = `You are already a member of ${ccaName}`;
                } else if (userCurrentRole === 'lead') {
                    canApply = false;
                    conflictReason = `You are the lead of ${ccaName} - cannot apply as ${position.name.toLowerCase()}`;
                } else if (userCurrentRole === 'vice') {
                    canApply = false;
                    conflictReason = `You are the vice lead of ${ccaName} - cannot apply as ${position.name.toLowerCase()}`;
                } else if (userCurrentRole === 'team manager') {
                    canApply = false;
                    conflictReason = `You are already the team manager of ${ccaName}`;
                }
            }

            // ✅ NEW: Check for conflicting applications within the same CCA
            const existingApplication = userApplicationsByCCA.get(ccaId);
            if (existingApplication && existingApplication.positionId !== position.id) {
                canApply = false;
                conflictReason = `You have already applied as ${existingApplication.positionName} for ${ccaName}`;
            }

            return {
                id: position.id,
                name: position.name,
                cca_name: ccaName,
                cca_id: ccaId,
                cca_type: ccaType,
                description: position.description,
                capacity: position.capacity,
                is_applied: isApplied,
                user_current_role: userCurrentRole || undefined,
                conflict_reason: conflictReason || undefined,
                can_apply: canApply
            };
        }) || [];

        // Group by CCA type
        const groupedPositions = {
            sports: transformedPositions.filter(p => p.cca_type === 'sports'),
            culture: transformedPositions.filter(p => p.cca_type === 'culture')
        };

        return NextResponse.json({
            positions: groupedPositions,
            applicationsOpen,
            phaseInfo: {
                phase: phaseInfo.phase,
                userMessage: phaseInfo.userMessage
            }
        });

    } catch (error) {
        console.error('Error fetching sports/culture positions:', error);
        return NextResponse.json({ positions: { sports: [], culture: [] } });
    }
}

async function areApplicationsOpen(phaseInfo: any): Promise<boolean> {
    const applicationPhases = [
        'subcomm_concurrent_ranking'
    ];
    return applicationPhases.includes(phaseInfo.phase);
}
