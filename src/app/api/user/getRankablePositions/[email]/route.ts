// src/app/api/user/getRankablePositions/[email]/route.ts
import { NextResponse } from "next/server";
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { phaseService } from '@/lib/phaseService'; // ✅ ADD: Import phase service

export async function GET(
    request: Request,
    { params }: { params: Promise<{ email: string }> }
) {
    try {
        const { email } = await params;

        // ✅ NEW: Check current phase and get round
        const phaseInfo = await phaseService.getCurrentPhaseInfo();
        if (!phaseInfo.allowApplicantRanking) {
            return NextResponse.json({
                positions: [],
                error: `Student ranking is not active. Current phase: ${phaseInfo.phase}`,
                phaseInfo: {
                    phase: phaseInfo.phase,
                    round: phaseInfo.round,
                    userMessage: phaseInfo.userMessage
                }
            });
        }

        const supabase = createRouteHandlerClient({ cookies });

        // Get user ID
        const { data: user, error: userError } = await supabase
            .from('public_users')
            .select('id')
            .eq('email', email)
            .single();

        if (userError || !user) {
            return NextResponse.json({ positions: [] });
        }

        // ✅ FIXED: Filter applications by current round ONLY
        const { data: applications, error } = await supabase
            .from('user_cca_applications')
            .select(`
                position_id, ranking,
                cca_positions!inner (
                    id, name, description, capacity, position_type,
                    ccas!inner (name)
                )
            `)
            .eq('user_id', user.id)
            .not('ranking', 'is', null)
            .eq('cca_positions.position_type', phaseInfo.round); // ✅ CRITICAL: Only current round positions

        if (error) {
            console.error('Error fetching applications:', error);
            return NextResponse.json({ positions: [] });
        }

        // Get existing user rankings
        const { data: userRankings, error: rankError } = await supabase
            .from('cca_user_ranking')
            .select('position_id, ranking')
            .eq('user_id', user.id);

        if (rankError) {
            console.error('Error fetching user rankings:', rankError);
        }

        const userRankingMap = new Map(
            userRankings?.map(r => [r.position_id, r.ranking]) || []
        );

        const transformedPositions = applications?.map((app: Record<string, any>) => {
            const position = app.cca_positions;
            const cca = position.ccas;

            return {
                id: position.id,
                name: position.name,
                cca_name: cca.name,
                position_type: position.position_type,
                capacity: position.capacity,
                description: position.description,
                user_ranking: userRankingMap.get(position.id) || null,
                is_selected: userRankingMap.has(position.id)
            };
        }) || [];

        return NextResponse.json({
            positions: transformedPositions,
            phaseInfo: {
                phase: phaseInfo.phase,
                round: phaseInfo.round,
                userMessage: phaseInfo.userMessage
            }
        });
    } catch (error) {
        console.error("Error fetching rankable positions:", error);
        return NextResponse.json({ positions: [] });
    }
}
