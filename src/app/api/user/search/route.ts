import { NextResponse } from "next/server";
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export async function GET(request: Request) {
    try {
        const getCookies = () => cookies();
        const supabase = createRouteHandlerClient({
            cookies: getCookies
        });

        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            console.log("No authenticated user for request:", authError);
            return NextResponse.json({ userPoints: 0 });
        }

        const { searchParams } = new URL(request.url);
        const query = searchParams.get('query')?.trim() ?? '';

        if (!query || query.length < 2) {
            return NextResponse.json({ users: [] });
        }

        const { data, error } = await supabase
            .from('public_users')
            .select('id, name, email, room')
            .or(
                `name.ilike.%${query}%,email.ilike.%${query}%,room.ilike.%${query}%`
            )
            .limit(10);

        if (error) {
            console.error("User search error:", error);
            return NextResponse.json({ users: [] }, { status: 500 });
        }

        const users = (data ?? []).map(u => ({
            id: u.id,
            name: u.name,
            email: u.email,
            room: u.room
        }));

        return NextResponse.json({ users });
    } catch (error) {
        console.error("User search API error:", error);
        return NextResponse.json({ users: [] }, { status: 500 });
    }
}
