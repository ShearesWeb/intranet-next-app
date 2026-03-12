// src/app/api/user/checkRole/route.ts
// API route to check if a user has lead/vice roles and return their positions
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { cache } from 'react';
import { fetchUserInfo } from "@/lib/fetch-user-info";
import { AUTHORIZED_CHAIR_ROLES } from '@/lib/lead-auth-service';
import { SupabaseClient } from "@supabase/supabase-js";

type PositionWithCcaRow = {
    name: string;
    position_type: string;
    cca_id: number;
    ccas: { name: string } | Array<{ name: string }> | null;
};

type UserPositionSummary = {
    position: string;
    position_type: string;
    cca: string;
};

const getCachedUserRole = cache(async (userId: number, supabase: SupabaseClient) => {
    // Check if user is admin first (optional optimization, but we need positions anyway)
    // Actually, we can check admin status in the main handler.
    
    const { data: appointments, error: appointmentError } = await supabase
        .from('cca_appointments')
        .select('position_id')
        .eq('user_id', userId);

    if (appointmentError || !appointments || appointments.length === 0) {
        return { isAuthorized: false, positions: [] };
    }

    const positionIds = appointments.map((app: { position_id: number }) => app.position_id);

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

    // ✅ FIXED: Handle ccas as array or object
    const userPositions: UserPositionSummary[] = (positions as PositionWithCcaRow[]).map((pos) => {
        const ccaName = Array.isArray(pos.ccas) 
            ? pos.ccas[0]?.name 
            : pos.ccas?.name;
            
        return {
            position: pos.name,
            position_type: pos.position_type,
            cca: ccaName || 'Unknown'
        };
    });

    const isAuthorized = userPositions.some((pos) => {
        const normalizedRole = pos.position_type.toLowerCase();
        return authorizedRoles.some((role) => role === normalizedRole);
    });

    return {
        isAuthorized,
        positions: userPositions.map((pos) =>
            `${pos.position} (${pos.position_type}) - ${pos.cca}`
        )
    };
});

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function GET(_request: Request) {
    try {
        const headers = {
            'Cache-Control': 'no-store, private',
            'Content-Type': 'application/json',
        };

        // Get full user info to check admin status
        const userInfo = await fetchUserInfo();

        if (!userInfo) {
            return NextResponse.json({
                isAuthorized: false,
                positions: []
            }, {
                status: 401,
                headers
            });
        }

        const supabase = await createClient();
        const roleResult = await getCachedUserRole(userInfo.id, supabase);

        // Allow admins to access chair features
        if (userInfo.is_admin) {
            roleResult.isAuthorized = true;
            if (roleResult.positions.length === 0) {
                roleResult.positions.push("Administrator Access");
            }
        }

        return NextResponse.json(roleResult, { headers });

    } catch (error) {
        console.error("Error checking role:", error);
        return NextResponse.json({ isAuthorized: false, positions: [] }, {
            headers: {
                'Cache-Control': 'no-store, private',
                'Content-Type': 'application/json',
            }
        });
    }
}
