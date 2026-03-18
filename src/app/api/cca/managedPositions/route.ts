import { NextResponse } from "next/server";

import { getCoreServiceDisabledApiResponse } from "@/lib/feature-flags";
import { fetchUserInfo } from "@/lib/fetch-user-info";
import { getManagedCcaPositions, listManagedCcaPositions } from "@/lib/cca-rankings-access";
import { createClient } from "@/utils/supabase/server";

export async function GET(request: Request) {
    const disabledResponse = getCoreServiceDisabledApiResponse("memberRanking");

    if (disabledResponse) {
        return disabledResponse;
    }

    const user = await fetchUserInfo();

    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const supabase = await createClient();
        const { searchParams } = new URL(request.url);
        const ccaIdParam = searchParams.get("ccaId");

        if (ccaIdParam) {
            const ccaId = Number(ccaIdParam);

            if (Number.isNaN(ccaId)) {
                return NextResponse.json({ error: "Invalid CCA ID" }, { status: 400 });
            }

            const row = await getManagedCcaPositions({ supabase, ccaId });

            if (!row) {
                return NextResponse.json({ error: "Managed CCA positions not found" }, { status: 404 });
            }

            return NextResponse.json(row);
        }

        const rows = await listManagedCcaPositions({ supabase });
        return NextResponse.json(rows);
    } catch (error) {
        console.error("Error fetching managed CCA positions:", error);
        return NextResponse.json({ error: "Failed to load managed CCA positions" }, { status: 500 });
    }
}
