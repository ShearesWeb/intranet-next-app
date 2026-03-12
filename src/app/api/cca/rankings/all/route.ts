import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { fetchUserInfo } from "@/lib/fetch-user-info";

export async function GET() {
    try {
        const user = await fetchUserInfo();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        if (!user.is_jcrc && !user.is_admin) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const supabase = await createClient();
        let ccasQuery = supabase
            .from("ccas")
            .select("id, name, cca_type, description");

        // JCRC can view all CCAs; admins can only view CCAs they are appointed to.
        if (!user.is_jcrc) {
            const appointmentCcaIds = Array.from(
                new Set((user.appointments || []).map((appointment) => appointment.cca_id))
            );

            if (appointmentCcaIds.length === 0) {
                return NextResponse.json({ data: [] });
            }

            ccasQuery = ccasQuery.in("id", appointmentCcaIds);
        }

        const { data, error } = await ccasQuery.order("name", { ascending: true });

        if (error) {
            console.error("Error fetching CCA ranking list:", error);
            return NextResponse.json({ error: "Failed to load CCAs" }, { status: 500 });
        }

        const transformed = (data || []).map((cca) => ({
            id: cca.id,
            name: cca.name,
            role: user.is_jcrc ? "JCRC Viewer" : "Admin Viewer",
            position_type: user.is_jcrc ? "jcrc" : "admin",
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
