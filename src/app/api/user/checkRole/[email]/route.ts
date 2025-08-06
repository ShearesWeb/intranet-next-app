// src/app/api/user/checkRole/[email]/route.ts
import { NextResponse } from "next/server";
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ email: string }> }
) {
    try {
        const { email } = await params;
        const getCookies = () => cookies();
        const supabase = createRouteHandlerClient({
            cookies: getCookies
        });

        const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();

        if (authError || !authUser) {
            console.log("No authenticated user for checkRole request");
            return NextResponse.json({ isAuthorized: false, positions: [] });
        }

        const { data: user, error: userError } = await supabase
            .from('users')
            .select('id')
            .eq('email', email)
            .single();

        if (userError || !user) {
            return NextResponse.json({ isAuthorized: false, positions: [] });
        }

        // Rest of your existing logic...
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
            return NextResponse.json({ isAuthorized: false, positions: [] });
        }

        const authorizedRoles = ['lead', 'vice'];
        const userPositions = appointments?.map((app: any) => ({
            position: app.cca_positions.name,
            position_type: app.cca_positions.position_type,
            cca: app.cca_positions.ccas.name
        })) || [];

        const isAuthorized = userPositions.some((pos: any) =>
            authorizedRoles.includes(pos.position_type.toLowerCase())
        );

        return NextResponse.json({
            isAuthorized,
            positions: userPositions.map((pos: any) =>
                `${pos.position} (${pos.position_type}) - ${pos.cca}`
            )
        });
    } catch (error) {
        console.error("Error checking role:", error);
        return NextResponse.json({ isAuthorized: false, positions: [] });
    }
}
