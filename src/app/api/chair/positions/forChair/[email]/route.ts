// src/app/api/chair/positions/forChair/[email]/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { phaseService } from '@/lib/phaseService';
import { cache } from 'react';

// ✅ Cache chair authorization for 5 minutes (chair roles rarely change)
const getCachedChairAuthorization = cache(async (email: string, supabase: any) => {
    const { data: userData, error: userError } = await supabase
        .from("public_users")
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
            const positionType = (appointment.cca_positions.position_type || "").toLowerCase();
            if (authorizedRoles.includes(positionType)) {
                ccasSet.add(appointment.cca_positions.cca_id);
            }
        }
    });

    return {
        authorized: ccasSet.size > 0,
        ccaIds: Array.from(ccasSet),
        userData
    };
});

// ✅ Cache positions for current phase (changes only when phase changes)
const getCachedPositionsForPhase = cache(async (ccaIds: number[], currentRound: string, supabase: any) => {
    const { data: allPositions, error: posError } = await supabase
        .from("cca_positions")
        .select("id, name, capacity, position_type, cca_id, ccas(id, name)")
        .in("cca_id", ccaIds)
        .gt("capacity", 0)
        .not('position_type', 'in', '("lead","vice")')
        .eq('position_type', currentRound);

    if (posError || !allPositions?.length) {
        return [];
    }

    return allPositions;
});

export async function GET(
    request: Request,
    { params }: { params: Promise<{ email: string }> }
) {
    try {
        const { email } = await params;

        // ✅ Set aggressive caching headers for chair authorization
        const headers = {
            'Cache-Control': 'private, s-maxage=300, stale-while-revalidate=600', // 5min cache, 10min stale
            'Content-Type': 'application/json',
        };

        const getCookies = () => cookies();
        const supabase = createRouteHandlerClient({ cookies: getCookies });

        // ✅ Check phase info (already optimized in your phaseService)
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

        // ✅ Use cached chair authorization
        const authResult = await getCachedChairAuthorization(email, supabase);

        if (!authResult.authorized) {
            return NextResponse.json({ positions: [] }, { headers });
        }

        // ✅ Use cached positions for current phase
        const allPositions = await getCachedPositionsForPhase(
            authResult.ccaIds,
            phaseInfo.round,
            supabase
        );

        if (allPositions.length === 0) {
            return NextResponse.json({ positions: [] }, { headers });
        }

        // ✅ OPTIMIZED: Single query to get all applicants with user data
        const positionIds = allPositions.map((p: any) => p.id);

        const { data: applicationsWithUsers, error: appError } = await supabase
            .from("user_cca_applications")
            .select(`
                position_id, user_id, ranking,
                public_users!inner(id, name, email, room)
            `)
            .in("position_id", positionIds)
            .order('ranking', { ascending: true });

        if (appError) {
            console.error("Error fetching applications:", appError);
            return NextResponse.json({ positions: [] }, { headers });
        }

        // ✅ Group applicants by position
        const applicantsByPosition = new Map();

        (applicationsWithUsers || []).forEach((app: any) => {
            if (!applicantsByPosition.has(app.position_id)) {
                applicantsByPosition.set(app.position_id, []);
            }

            applicantsByPosition.get(app.position_id).push({
                id: app.public_users.id,
                name: app.public_users.name,
                email: app.public_users.email,
                room: app.public_users.room,
                ranking: app.ranking,
            });
        });

        // ✅ Build final result
        const result = allPositions.map((position: any) => ({
            id: position.id,
            name: position.name,
            cca_name: position.ccas?.name ?? "Unknown",
            capacity: position.capacity,
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
                'Cache-Control': 'no-cache', // Don't cache errors
                'Content-Type': 'application/json',
            }
        });
    }
}
