// src/app/api/chair/positions/forChair/route.ts
// API route to get positions available for chair ranking along with applicants' info
import { NextResponse } from "next/server";
import { cache } from 'react';
import { createClient } from "@/utils/supabase/server";
import { fetchUserId } from "@/lib/fetch-user-info";
import { getUserAuthorizedCCAs } from "@/lib/lead-auth-service";
import { SupabaseClient } from "@supabase/supabase-js";

const getCachedChairAuthorization = cache(async (userId: number, supabase: SupabaseClient) => {
    return await getUserAuthorizedCCAs(userId, supabase);
});

const getCachedPositionsForPhase = cache(async (ccaIds: number[], supabase: SupabaseClient) => {
    const { data: allPositions, error: posError } = await supabase
        .from("cca_capacity_info")
        .select("id, name, capacity, available_capacity, applied_count, position_type, cca_id, cca_name")
        .in("cca_id", ccaIds)
        .gt("available_capacity", 0)
        .not('position_type', 'in', '("lead","vice")');

    if (posError || !allPositions?.length) {
        return [];
    }

    return allPositions;
});

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function GET(_request: Request) {
    try {
        const userId = await fetchUserId();

        if (!userId) {
            return NextResponse.json({
                positions: [],
                error: 'Unauthorized'
            }, { status: 401 });
        }

        const headers = {
            'Cache-Control': 'private, s-maxage=300, stale-while-revalidate=600',
            'Content-Type': 'application/json',
        };

        const supabase = await createClient();

        const authResult = await getCachedChairAuthorization(userId, supabase);

        if (!authResult.authorized) {
            return NextResponse.json({ positions: [] }, { headers });
        }

        const allPositions = await getCachedPositionsForPhase(
            authResult.ccaIds,
            supabase
        );

        if (allPositions.length === 0) {
            return NextResponse.json({ positions: [] }, { headers });
        }

        const positionIds = allPositions.map((p: any) => p.id);

        const { data: applicationsWithUsers, error: appError } = await supabase
            .from("cca_user_ranking")
            .select(`
                position_id, user_id, ranking,
                public_user_info!inner(id, name, email, room)
            `)
            .in("position_id", positionIds)
            .order('ranking', { ascending: true });

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

            // Handle both array and object cases
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

        console.log(allPositions);

        // Map the results using the safe helper function
        const result = allPositions.map((position: any) => ({
            id: position.id,
            name: position.name,
            cca_name: position.cca_name, // Use helper function
            total_capacity: position.capacity,
            available_capacity: position.available_capacity,
            applied_count: position.applied_count,
            filled_positions: position.capacity - position.available_capacity,
            position_type: position.position_type,
            applicants: applicantsByPosition.get(position.id) || [],
        }));

        return NextResponse.json({
            positions: result
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
