import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { fetchUserInfo } from "@/lib/fetch-user-info";
import { getManagedCcaAccess } from "@/lib/cca-management-access";

export async function GET(
    request: Request,
    { params }: { params: Promise<{ ccaId: string }> }
) {
    try {
        const { ccaId } = await params;
        const { searchParams } = new URL(request.url);
        const query = searchParams.get("query")?.trim();

        if (!query || query.length < 2) {
            return NextResponse.json(
                { success: false, data: [], message: "Query must be at least 2 characters." },
                { status: 400 }
            );
        }

        const requestingUser = await fetchUserInfo();
        if (!requestingUser) {
            return NextResponse.json(
                { success: false, data: [], message: "Unauthorized" },
                { status: 401 }
            );
        }

        const supabase = await createClient();

        const { data: ccaData, error: ccaError } = await supabase
            .from("ccas")
            .select("id, name, cca_type")
            .eq("id", ccaId)
            .single();

        if (ccaError || !ccaData) {
            return NextResponse.json(
                { success: false, data: [], message: "CCA not found" },
                { status: 404 }
            );
        }

        const authResult = await getManagedCcaAccess({
            supabase,
            requestingUser,
            cca: ccaData,
        });

        if (!authResult.ok) {
            return NextResponse.json(
                { success: false, data: [], message: authResult.error },
                { status: authResult.status }
            );
        }

        const { data, error } = await supabase
            .from("public_user_info")
            .select("id, name, email, room")
            .or(`name.ilike.%${query}%,email.ilike.%${query}%,room.ilike.%${query}%`)
            .order("name")
            .limit(10);

        if (error) {
            console.error("Member search error:", error);
            return NextResponse.json(
                { success: false, data: [], message: "Database query failed." },
                { status: 500 }
            );
        }

        const users = (data ?? []).map((user) => ({
            id: user.id,
            name: user.name,
            email: user.email,
            room: user.room,
        }));

        return NextResponse.json({
            success: true,
            data: users,
            message: "Users fetched successfully.",
        });
    } catch (error) {
        console.error("Member search API error:", error);
        return NextResponse.json(
            { success: false, data: [], message: "Internal server error." },
            { status: 500 }
        );
    }
}
