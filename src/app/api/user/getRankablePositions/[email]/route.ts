import { NextResponse } from "next/server";
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { phaseService } from '@/lib/phaseService';

// ✅ FIXED: Correct interfaces to match actual Supabase return types
interface CCAData {
    name: string;
    cca_type: string;
    description: string;
    image_url: string | null;
}

interface PositionData {
    id: number;
    name: string;
    position_type: string;
    capacity: number;
    available_capacity: number;
    applied_count: number;
    description: string | null;
    ccas: CCAData[];  // This stays as array
}

// ✅ FIXED: Based on TypeScript errors, cca_position_info is actually an array
interface SupabaseUserRankingData {
    position_id: number;
    ranking: number;
    cca_position_info: PositionData[];  // Array as TypeScript infers
}

export async function GET(
    request: Request,
    { params }: { params: Promise<{ email: string }> }
) {
    try {
        const { email } = await params;

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

        // ✅ Query using correct view name
        const { data: userRankings, error: rankingsError } = await supabase
            .from('cca_user_ranking')
            .select(`
                position_id,
                ranking,
                cca_position_info!inner (
                    id,
                    name,
                    position_type,
                    capacity,
                    available_capacity,
                    applied_count,
                    description,
                    ccas!inner (name, cca_type, description, image_url)
                )
            `)
            .eq('user_id', user.id)
            .eq('cca_position_info.position_type', phaseInfo.round);

        if (rankingsError) {
            console.error('Error fetching user rankings:', rankingsError);
            return NextResponse.json({ positions: [] });
        }

        console.log("✅ User rankings found:", userRankings);

        // ✅ ENHANCED DEBUG: Log the actual ccas structure
        if (userRankings && userRankings.length > 0) {
            // ✅ FIXED: Handle both array and single object cases
            const positionInfo = userRankings[0].cca_position_info;
            const firstPosition = Array.isArray(positionInfo) ? positionInfo[0] : positionInfo;
            console.log("🔍 DEBUG: First position ccas structure:", JSON.stringify(firstPosition?.ccas, null, 2));
            console.log("🔍 DEBUG: ccas is array?", Array.isArray(firstPosition?.ccas));
            console.log("🔍 DEBUG: ccas length:", firstPosition?.ccas?.length);
        }

        // ✅ Get user's current applications from user_cca_applications
        const { data: userApplications, error: appError } = await supabase
            .from('user_cca_applications')
            .select('position_id, ranking, application_status')
            .eq('user_id', user.id);

        if (appError) {
            console.error('Error fetching user applications:', appError);
        }

        // Create a map of student's current application rankings
        const userApplicationMap = new Map(
            userApplications?.map(app => [app.position_id, app.ranking]) || []
        );

        // ✅ FIXED: Handle both array and single object cases
        const transformedPositions = userRankings?.map((ranking: SupabaseUserRankingData) => {
            // ✅ FIXED: Handle both array and single object cases for position info
            const positionInfo = ranking.cca_position_info;
            const position = Array.isArray(positionInfo) ? positionInfo[0] : positionInfo;

            // ✅ ENHANCED: Bulletproof CCA name extraction with detailed logging
            let ccaName = 'Unknown';
            let ccaDescription = 'No description available';

            console.log("🔍 DEBUG: Processing position:", position?.name);
            console.log("🔍 DEBUG: Raw ccas data:", JSON.stringify(position?.ccas, null, 2));

            try {
                if (position?.ccas) {
                    if (Array.isArray(position.ccas)) {
                        console.log("🔍 DEBUG: ccas is array with length:", position.ccas.length);
                        if (position.ccas.length > 0) {
                            console.log("🔍 DEBUG: First ccas element:", JSON.stringify(position.ccas[0], null, 2));
                            ccaName = position.ccas[0]?.name || 'Unknown';
                            ccaDescription = position.ccas[0]?.description || 'No description available';
                            console.log("🔍 DEBUG: Extracted ccaName:", ccaName);
                        } else {
                            console.log("🔍 DEBUG: ccas array is empty");
                        }
                    } else if (typeof position.ccas === 'object') {
                        console.log("🔍 DEBUG: ccas is object:", JSON.stringify(position.ccas, null, 2));
                        ccaName = (position.ccas as any).name || 'Unknown';
                        ccaDescription = (position.ccas as any).description || 'No description available';
                        console.log("🔍 DEBUG: Extracted ccaName from object:", ccaName);
                    } else {
                        console.log("🔍 DEBUG: ccas is neither array nor object:", typeof position.ccas);
                    }
                } else {
                    console.log("🔍 DEBUG: ccas is null/undefined");
                }
            } catch (error) {
                console.error("🔍 DEBUG: Error extracting CCA name:", error);
            }

            // ✅ FIXED: Add null check for position
            if (!position) {
                console.error("🔍 DEBUG: Position is null/undefined");
                return null;
            }

            return {
                id: position.id,
                name: position.name,
                cca_name: ccaName,  // ✅ Should now work properly
                position_type: position.position_type,
                capacity: position.capacity,
                available_capacity: position.available_capacity,
                applied_count: position.applied_count,
                description: position.description || ccaDescription,
                user_ranking: userApplicationMap.get(position.id) || null,
                is_selected: userApplicationMap.has(position.id)
            };
        }).filter(Boolean) || []; // ✅ FIXED: Filter out null values

        console.log("✅ Final transformed positions:", transformedPositions);

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
