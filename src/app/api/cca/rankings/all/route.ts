import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { fetchUserInfo } from "@/lib/fetch-user-info";

export async function GET() {
    try {
        const user = await fetchUserInfo();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        if (!user.is_jcrc) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const supabase = await createClient();
        const { data, error } = await supabase
            .from("ccas")
            .select("id, name, cca_type, description")
            .order("name", { ascending: true });

        if (error) {
            console.error("Error fetching CCA ranking list:", error);
            return NextResponse.json({ error: "Failed to load CCAs" }, { status: 500 });
        }

        const transformed = (data || []).map((cca) => ({
            id: cca.id,
            name: cca.name,
            role: "JCRC Viewer",
            position_type: "jcrc",
            cca_type: cca.cca_type,
            description: cca.description ?? "",
            points: 0,
        }));

        return NextResponse.json({ data: transformed });
    } catch (error) {
        console.error("Error fetching CCA ranking list:", error);
        return NextResponse.json({ error: "Failed to load CCAs" }, { status: 500 });
    }
}
