// src/app/api/chair/positions/forChair/[email]/route.ts
import { NextResponse } from "next/server";
import { phaseService } from '@/lib/phaseService';
import { cache } from 'react';
import { createClient } from "@/utils/supabase/server";


const getCachedChairAuthorization = cache(async (email: string, supabase: any) => {
    const { data: userData, error: userError } = await supabase
        .from("public_user_info")
        .select("id, email")
        .eq("email", email)
        .single();

    if (userError || !userData) {
        return { authorized: false, ccaIds: [] };
    }

    const { data: chairAppointments, error: appointmentError } = await supabase
        .from("cca_appointments")
        .select(`
            id, user_id, position_id,
            cca_positions!inner(
                id, name, position_type, cca_id,
                ccas(id, name)
            )
        `)
        .eq("user_id", userData.id);

    if (appointmentError) {
        return { authorized: false, ccaIds: [] };
    }

    const authorizedRoles = ["lead", "vice"];
    const ccasSet = new Set<number>();

    (chairAppointments || []).forEach((appointment: any) => {
        if (appointment.cca_positions) {
            const position = appointment.cca_positions;
            const positionType = (position.position_type || "").toLowerCase();
            if (authorizedRoles.includes(positionType)) {
                ccasSet.add(position.cca_id);
            }
        }
    });

    return {
        authorized: ccasSet.size > 0,
        ccaIds: Array.from(ccasSet),
        userData
    };
});

function getValidPositionTypes(currentRound: string): string[] {
    switch (currentRound) {
        case 'maincomm':
            return ['maincomm', 'blockcomm'];
        case 'subcomm':
            return ['subcomm', 'blockcomm', 'maincomm'];
        default:
            return [currentRound];
    }
}

const getCachedPositionsForPhase = cache(async (ccaIds: number[], currentRound: string, supabase: any) => {
    const { data: allPositions, error: posError } = await supabase
        .from("cca_position_info")
        .select("id, name, capacity, available_capacity, applied_count, position_type, cca_id, ccas(id, name)")
        .in("cca_id", ccaIds)
        .gt("available_capacity", 0)
        .not('position_type', 'in', '("lead","vice")')
        .in('position_type', getValidPositionTypes(currentRound));

    if (posError || !allPositions?.length) {
        return [];
    }

    return allPositions;
});

// Helper function to safely extract CCA name
function getCcaName(ccas: any): string {
    // Handle both object and array cases defensively
    if (!ccas) return "Unknown";

    // If it's an array (what TS thinks), take first element
    if (Array.isArray(ccas) && ccas.length > 0) {
        return ccas[0]?.name || "Unknown";
    }

    // If it's an object (what runtime shows), access directly
    if (typeof ccas === 'object' && ccas.name) {
        return ccas.name;
    }

    return "Unknown";
}

export async function GET(
    request: Request,
    { params }: { params: Promise<{ email: string }> }
) {
    try {
        const { email } = await params;

        const headers = {
            'Cache-Control': 'private, s-maxage=300, stale-while-revalidate=600',
            'Content-Type': 'application/json',
        };

        const supabase = await createClient();

        const phaseInfo = await phaseService.getCurrentPhaseInfo();

        if (!phaseInfo.allowChairRanking) {
            return NextResponse.json({
                positions: [],
                error: `Chair ranking is not active. Current phase: ${phaseInfo.phase}`,
                phaseInfo: {
                    phase: phaseInfo.phase,
                    round: phaseInfo.round,
                    userMessage: phaseInfo.userMessage
                }
            }, { headers });
        }

        const authResult = await getCachedChairAuthorization(email, supabase);

        if (!authResult.authorized) {
            return NextResponse.json({ positions: [] }, { headers });
        }

        // Get raw data without forcing types
        const allPositions = await getCachedPositionsForPhase(
            authResult.ccaIds,
            phaseInfo.round,
            supabase
        );

        if (allPositions.length === 0) {
            return NextResponse.json({ positions: [] }, { headers });
        }

        // Extract IDs safely
        const positionIds = allPositions.map((p: any) => p.id);

        // console.log("✅ Position IDs being queried:", positionIds);
        // console.log("✅ Querying cca_user_ranking for these position IDs...");

        const { data: applicationsWithUsers, error: appError } = await supabase
            .from("cca_user_ranking")
            .select(`
                position_id, user_id, ranking,
                public_user_info!inner(id, name, email, room)
            `)
            .in("position_id", positionIds)
            .order('ranking', { ascending: true });

        // console.log("✅ Raw cca_user_ranking query result:", applicationsWithUsers);
        // console.log("✅ Error from cca_user_ranking query:", appError);
        // console.log("✅ Number of applicants found:", applicationsWithUsers?.length || 0);

        // if (applicationsWithUsers && applicationsWithUsers.length > 0) {
        //     console.log("✅ Sample applicant data:", applicationsWithUsers[0]);
        // } else {
        //     console.log("❌ No applicants found - checking why...");

        //     // Test direct query
        //     const { data: testQuery } = await supabase
        //         .from("cca_user_ranking")
        //         .select("*")
        //         .in("position_id", positionIds);

        //     console.log("✅ Direct cca_user_ranking query (no joins):", testQuery);
        // }

        if (appError) {
            console.error("Error fetching applications:", appError);
            return NextResponse.json({ positions: [] }, { headers });
        }

        const applicantsByPosition = new Map<number, Array<{
            id: number;
            name: string;
            email: string;
            room: string;
            ranking: number;
        }>>();

        (applicationsWithUsers || []).forEach((app: any) => {
            if (!applicantsByPosition.has(app.position_id)) {
                applicantsByPosition.set(app.position_id, []);
            }

            // ✅ BULLETPROOF: Handle both array and object cases
            let userData: any = null;

            if (app.public_user_info) {
                // If it's an array, take the first element
                if (Array.isArray(app.public_user_info)) {
                    userData = app.public_user_info[0];
                } else {
                    // If it's an object, use it directly
                    userData = app.public_user_info;
                }

                if (userData) {
                    applicantsByPosition.get(app.position_id)?.push({
                        id: userData.id,
                        name: userData.name,
                        email: userData.email,
                        room: userData.room,
                        ranking: app.ranking,
                    });
                }
            }
        });

        // console.log(allPositions);

        // Map the results using the safe helper function
        const result = allPositions.map((position: any) => ({
            id: position.id,
            name: position.name,
            cca_name: getCcaName(position.ccas), // Use helper function
            total_capacity: position.capacity,
            available_capacity: position.available_capacity,
            applied_count: position.applied_count,
            filled_positions: position.capacity - position.available_capacity,
            position_type: position.position_type,
            applicants: applicantsByPosition.get(position.id) || [],
        }));

        return NextResponse.json({
            positions: result,
            phaseInfo: {
                phase: phaseInfo.phase,
                round: phaseInfo.round,
                userMessage: phaseInfo.userMessage
            }
        }, { headers });

    } catch (error) {
        console.error("Error in forChair API:", error);
        return NextResponse.json({ positions: [] }, {
            status: 500,
            headers: {
                'Cache-Control': 'no-cache',
                'Content-Type': 'application/json',
            }
        });
    }
}
