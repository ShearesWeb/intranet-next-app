// src/app/api/user/getRankablePositions/[email]/route.ts
// API route to get rankable positions for a user
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { fetchUserId } from "@/lib/fetch-user-info";
import { getCoreServiceDisabledApiResponse } from "@/lib/feature-flags";

const NON_RANKABLE_POSITION_TYPES = "(lead,vice,resident)";

interface CCAData {
    id: number;
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
    ccas: CCAData[];  // Keep as array for consistency
}

export async function GET() {
    const disabledResponse = getCoreServiceDisabledApiResponse("ccaApplications");

    if (disabledResponse) {
        return disabledResponse;
    }

    try {
        const supabase = await createClient();

        // Get user ID from cookie
        const userId = await fetchUserId();

        if (!userId) {
            return NextResponse.json({
                error: 'Unauthorized'
            }, { status: 401 });
        }

        // ✅ Get ALL available positions
        const { data: availablePositions, error: positionsError } = await supabase
            .from('cca_capacity_info')
            .select(`
                id,
                name,
                position_type,
                capacity,
                available_capacity,
                applied_count,
                description,
                ccas!inner (id, name, cca_type, description, image_url)
            `)
            .gt('available_capacity', 0)
            .not('position_type', 'in', NON_RANKABLE_POSITION_TYPES)
            .order('name', { ascending: true });

        if (positionsError) {
            console.error('Error fetching available positions:', positionsError);
            return NextResponse.json({ positions: [] });
        }

        // console.log("✅ Available positions found:", availablePositions?.length || 0);

        // ✅ ENHANCED DEBUG: Log the actual ccas structure for first position
        // if (availablePositions && availablePositions.length > 0) {
        //     console.log("🔍 DEBUG: First position ccas structure:", JSON.stringify(availablePositions[0].ccas, null, 2));
        //     console.log("🔍 DEBUG: ccas is array?", Array.isArray(availablePositions[0].ccas));
        //     console.log("🔍 DEBUG: ccas length:", availablePositions[0].ccas?.length);
        // }

        // ✅ Get user's current applications from user_cca_applications
        const { data: userApplications, error: appError } = await supabase
            .from('user_cca_applications')
            .select('position_id, ranking, application_status')
            .eq('user_id', userId);

        if (appError) {
            console.error('Error fetching user applications:', appError);
        }

        // Create a map of student's current application rankings
        const userApplicationMap = new Map(
            userApplications?.map(app => [app.position_id, app.ranking]) || []
        );

        // ✅ BULLETPROOF: Transform ALL available positions with robust CCA extraction
        const transformedPositions = availablePositions?.map(position => {
            // ✅ ENHANCED: Bulletproof CCA name extraction (copied from working code)
            let ccaName = 'Unknown';
            let ccaDescription = 'No description available';

            // console.log("🔍 DEBUG: Processing position:", position?.name);
            // console.log("🔍 DEBUG: Raw ccas data:", JSON.stringify(position?.ccas, null, 2));

            try {
                if (position?.ccas) {
                    if (Array.isArray(position.ccas)) {
                        // console.log("🔍 DEBUG: ccas is array with length:", position.ccas.length);
                        if (position.ccas.length > 0) {
                            // console.log("🔍 DEBUG: First ccas element:", JSON.stringify(position.ccas[0], null, 2));
                            ccaName = position.ccas[0]?.name || 'Unknown';
                            ccaDescription = position.ccas[0]?.description || 'No description available';
                            // console.log("🔍 DEBUG: Extracted ccaName:", ccaName);
                        } else {
                            // console.log("🔍 DEBUG: ccas array is empty");
                        }
                    } else if (typeof position.ccas === 'object') {
                        // console.log("🔍 DEBUG: ccas is object:", JSON.stringify(position.ccas, null, 2));
                        ccaName = (position.ccas as PositionData).name || 'Unknown';
                        ccaDescription = (position.ccas as PositionData).description || 'No description available';
                        // console.log("🔍 DEBUG: Extracted ccaName from object:", ccaName);
                    } else {
                        // console.log("🔍 DEBUG: ccas is neither array nor object:", typeof position.ccas);
                    }
                } else {
                    // console.log("🔍 DEBUG: ccas is null/undefined");
                }
            } catch (error) {
                console.error("🔍 DEBUG: Error extracting CCA name:", error);
            }

            return {
                id: position.id,
                name: position.name,
                cca_name: ccaName,
                position_type: position.position_type,
                capacity: position.capacity,
                available_capacity: position.available_capacity,
                applied_count: position.applied_count,
                description: position.description || ccaDescription,
                user_ranking: userApplicationMap.get(position.id) || null,
                is_selected: userApplicationMap.has(position.id)
            };
        }) || [];

        // console.log("✅ Final transformed positions:", transformedPositions.length);
        // console.log("✅ Sample position with CCA name:", transformedPositions[0]);

        return NextResponse.json({
            positions: transformedPositions
        });

    } catch (error) {
        console.error("Error fetching rankable positions:", error);
        return NextResponse.json({ positions: [] });
    }
}
