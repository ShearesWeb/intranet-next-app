// src/app/api/user/search/route.ts
// API route to search for users by name, email, or room
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { fetchUserId } from "@/lib/fetch-user-info";
import { hasAnyChairAuthorization } from "@/lib/lead-auth-service";

export async function GET(request: Request) {
    try {
        // Added authentication check to prevent unauthorized searches by non-leads/vices
        const userId = await fetchUserId();

        if (!userId) {
            return NextResponse.json({
                success: false,
                message: 'Unauthorized'
            }, { status: 401 });
        }

        const supabase = await createClient();

        const authResult = await hasAnyChairAuthorization(userId, supabase);
        if (!authResult.authorized) {
            return NextResponse.json({
                success: false,
                message: 'Forbidden: Only CCA leads/vices can search users'
            }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const query = searchParams.get("query")?.trim();

        // Validate query parameter
        if (!query || query.length < 2) {
            return NextResponse.json(
                { success: false, data: [], message: "Query must be at least 2 characters." },
                { status: 400 }
            );
        }

        // Perform search
        const { data, error } = await supabase
            .from("public_user_info")
            .select("id, name, email, room")
            .or(`name.ilike.%${query}%,email.ilike.%${query}%,room.ilike.%${query}%`)
            .order("name")
            .limit(10);

        if (error) {
            console.error("User search error:", error);
            return NextResponse.json(
                { success: false, data: [], message: "Database query failed." },
                { status: 500 }
            );
        }

        const users = (data ?? []).map(u => ({
            id: u.id,
            name: u.name,
            email: u.email,
            room: u.room,
        }));

        return NextResponse.json({ success: true, data: users, message: "Users fetched successfully." });

    } catch (err) {
        console.error("User search API error:", err);
        return NextResponse.json(
            { success: false, data: [], message: "Internal server error." },
            { status: 500 }
        );
    }
}
