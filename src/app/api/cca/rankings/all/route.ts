import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { fetchUserInfo } from "@/lib/fetch-user-info";
import { getJcrcManagedCcaNames } from "@/lib/jcrc-cca-access";
import { AUTHORIZED_CHAIR_ROLES, type ChairRole } from "@/lib/lead-auth-service";

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
        const appointmentCcaIds = Array.from(
            new Set(
                (user.appointments || [])
                    .filter((appointment) =>
                        AUTHORIZED_CHAIR_ROLES.includes((appointment.position_type || "").toLowerCase() as ChairRole)
                    )
                    .map((appointment) => appointment.cca_id)
            )
        );
        const allowedJcrcCcaNames = user.is_jcrc ? getJcrcManagedCcaNames(user) : [];

        if (allowedJcrcCcaNames.length === 0 && appointmentCcaIds.length === 0) {
            return NextResponse.json({ data: [] });
        }

        const { data, error } = await supabase
            .from("ccas")
            .select("id, name, cca_type, description")
            .order("name", { ascending: true });

        if (error) {
            console.error("Error fetching CCA ranking list:", error);
            return NextResponse.json({ error: "Failed to load CCAs" }, { status: 500 });
        }

        const allowedIdSet = new Set(appointmentCcaIds);
        const allowedNameSet = new Set(allowedJcrcCcaNames);

        const filteredCcas = (data || []).filter((cca) =>
            allowedIdSet.has(cca.id) || allowedNameSet.has(cca.name)
        );

        const transformed = filteredCcas.map((cca) => ({
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
