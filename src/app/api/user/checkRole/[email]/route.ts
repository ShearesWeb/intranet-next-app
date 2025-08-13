import { NextResponse } from "next/server";
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cache } from 'react';

type RouteHandlerSupabaseClient = ReturnType<typeof createRouteHandlerClient>;

const getCachedUserRole = cache(async (email: string, supabase: RouteHandlerSupabaseClient) => {
    const { data: user, error: userError } = await supabase
        .from('public_users')
        .select('id')
        .eq('email', email)
        .single();

    if (userError || !user) {
        return { isAuthorized: false, positions: [] };
    }

    const { data: appointments, error: appointmentError } = await supabase
        .from('cca_appointments')
        .select('position_id')
        .eq('user_id', user.id);

    if (appointmentError || !appointments || appointments.length === 0) {
        return { isAuthorized: false, positions: [] };
    }

    const positionIds = appointments.map(app => app.position_id);

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

    const authorizedRoles = ['lead', 'vice'];

    // ✅ FIXED: Handle ccas as array
    const userPositions = positions.map(pos => ({
        position: pos.name,
        position_type: pos.position_type,
        cca: pos.ccas?.[0]?.name || 'Unknown' // ✅ Array access
    }));

    const isAuthorized = userPositions.some(pos =>
        authorizedRoles.includes(pos.position_type.toLowerCase())
    );

    return {
        isAuthorized,
        positions: userPositions.map(pos =>
            `${pos.position} (${pos.position_type}) - ${pos.cca}`
        )
    };
});

export async function GET(
    request: Request,
    { params }: { params: Promise<{ email: string }> }
) {
    try {
        const { email } = await params;

        const headers = {
            'Cache-Control': 'private, s-maxage=600, stale-while-revalidate=1200',
            'Content-Type': 'application/json',
        };

        const getCookies = () => cookies();
        const supabase = createRouteHandlerClient({ cookies: getCookies });

        const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
        if (authError || !authUser) {
            return NextResponse.json({ isAuthorized: false, positions: [] }, { headers });
        }

        const roleResult = await getCachedUserRole(email, supabase);

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
