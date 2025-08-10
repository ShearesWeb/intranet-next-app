// src/app/api/user/checkRole/[email]/route.ts
import { NextResponse } from "next/server";
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cache } from 'react';

type RouteHandlerSupabaseClient = ReturnType<typeof createRouteHandlerClient>;

// Cache role check for 10 minutes (roles change infrequently)
const getCachedUserRole = cache(async (email: string, supabase: RouteHandlerSupabaseClient) => {
    const { data: user, error: userError } = await supabase
        .from('public_users')
        .select('id')
        .eq('email', email)
        .single();

    if (userError || !user) {
        return { isAuthorized: false, positions: [] };
    }

    const { data: appointments, error } = await supabase
        .from('cca_appointments')
        .select(`
            cca_positions!inner (
                name,
                position_type,
                ccas (
                    name
                )
            )
        `)
        .eq('user_id', user.id);

    if (error) {
        console.error('Error fetching appointments:', error);
        return { isAuthorized: false, positions: [] };
    }

    const authorizedRoles = ['lead', 'vice']; ``
    const userPositions = appointments?.map((app: Record<string, any>) => ({
        position: app.cca_positions.name,
        position_type: app.cca_positions.position_type,
        cca: app.cca_positions.ccas.name
    })) || [];

    const isAuthorized = userPositions.some((pos: Record<string, any>) =>
        authorizedRoles.includes(pos.position_type.toLowerCase())
    );

    return {
        isAuthorized,
        positions: userPositions.map((pos: Record<string, any>) =>
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

        // ✅ Set cache headers for role authorization (10 minutes)
        const headers = {
            'Cache-Control': 'private, s-maxage=600, stale-while-revalidate=1200', // 10min cache, 20min stale
            'Content-Type': 'application/json',
        };

        const getCookies = () => cookies();
        const supabase = createRouteHandlerClient({ cookies: getCookies });

        // Authentication check
        const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
        if (authError || !authUser) {
            return NextResponse.json({ isAuthorized: false, positions: [] }, { headers });
        }

        // ✅ Use cached role check
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
