import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { fetchUserInfo } from "@/lib/fetch-user-info";
import { getCoreServiceDisabledApiResponse } from "@/lib/feature-flags";
import { listManagedCcaPositions } from "@/lib/cca-rankings-access";

export async function GET() {
    const disabledResponse = getCoreServiceDisabledApiResponse("memberRanking");

    if (disabledResponse) {
        return disabledResponse;
    }

    try {
        const user = await fetchUserInfo();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const supabase = await createClient();
        const managedCcas = await listManagedCcaPositions({ supabase });

        if (managedCcas.length === 0) {
            return NextResponse.json({ data: [] });
        }

        const managedCcaIds = managedCcas.map((managedCca) => managedCca.cca_id);
        const { data, error } = await supabase
            .from("ccas")
            .select("id, name, cca_type, description")
            .in("id", managedCcaIds);

        if (error) {
            console.error("Error fetching CCA ranking list:", error);
            return NextResponse.json({ error: "Failed to load CCAs" }, { status: 500 });
        }

        const ccasById = new Map((data || []).map((cca) => [cca.id, cca]));

        const transformed = managedCcas
            .map((managedCca) => {
                const cca = ccasById.get(managedCca.cca_id);
                const primaryPosition = managedCca.positions[0];

                return {
                    id: managedCca.cca_id,
                    name: managedCca.cca_name || cca?.name || "Unknown CCA",
                    role: primaryPosition?.position_name || "Managed Position",
                    position_type: primaryPosition?.position_type || "",
                    cca_type: cca?.cca_type || "committee",
                    description: cca?.description ?? "",
                    points: 0,
                };
            })
            .sort((a, b) => a.name.localeCompare(b.name));

        return NextResponse.json({ data: transformed });
    } catch (error) {
        console.error("Error fetching CCA ranking list:", error);
        return NextResponse.json({ error: "Failed to load CCAs" }, { status: 500 });
    }
}
