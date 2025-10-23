// src/app/api/user/checkRole/route.ts
// API route to check if a user has lead/vice roles and return their positions
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { cache } from 'react';
import { fetchUserId } from "@/lib/fetch-user-info";
import { AUTHORIZED_CHAIR_ROLES } from '@/lib/lead-auth-service';

const getCachedUserRole = cache(async (userId: number, supabase: any) => {
    const { data: appointments, error: appointmentError } = await supabase
        .from('cca_appointments')
        .select('position_id')
        .eq('user_id', userId);

    if (appointmentError || !appointments || appointments.length === 0) {
        return { isAuthorized: false, positions: [] };
    }

    const positionIds = appointments.map((app: any) => app.position_id);

    const { data: positions, error: positionError } = await supabase
        .from('cca_positions')
        .select(`
            name,
            position_type,
            cca_id,
            ccas!inner(name)
        `)
        .in('id', positionIds);

    if (positionError || !positions) {
        return { isAuthorized: false, positions: [] };
    }

    const authorizedRoles = AUTHORIZED_CHAIR_ROLES;

    // ✅ FIXED: Handle ccas as array
    const userPositions = positions.map((pos: any) => ({
        position: pos.name,
        position_type: pos.position_type,
        cca: pos.ccas?.[0]?.name || 'Unknown'
    }));

    const isAuthorized = userPositions.some((pos: any) =>
        authorizedRoles.includes(pos.position_type.toLowerCase())
    );

    return {
        isAuthorized,
        positions: userPositions.map((pos: any) =>
            `${pos.position} (${pos.position_type}) - ${pos.cca}`
        )
    };
});

export async function GET(request: Request) {
    try {
        const headers = {
            'Cache-Control': 'private, s-maxage=600, stale-while-revalidate=1200',
            'Content-Type': 'application/json',
        };

        // user ID from cookie
        const userId = await fetchUserId();

        if (!userId) {
            return NextResponse.json({
                isAuthorized: false,
                positions: []
            }, {
                status: 401,
                headers
            });
        }

        const supabase = await createClient();
        const roleResult = await getCachedUserRole(userId, supabase);

        return NextResponse.json(roleResult, { headers });

    } catch (error) {
        console.error("Error checking role:", error);
        return NextResponse.json({ isAuthorized: false, positions: [] }, {
            headers: {
                'Cache-Control': 'no-cache',
                'Content-Type': 'application/json',
            }
        });
    }
}
