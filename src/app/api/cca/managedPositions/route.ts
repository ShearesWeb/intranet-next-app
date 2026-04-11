import { NextResponse } from "next/server";

import { getCoreServiceDisabledApiResponse, isCoreServiceEnabled } from "@/lib/feature-flags";
import { fetchUserInfo } from "@/lib/fetch-user-info";
import { getManagedCcaData } from "@/lib/managed-cca-data";
import { createClient } from "@/utils/supabase/server";

export async function GET(request: Request) {
    const user = await fetchUserInfo();

    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const supabase = await createClient();
        const rows = await getManagedCcaData(supabase, user);
        const disabledResponse = getCoreServiceDisabledApiResponse("memberRanking", {
            isJcrc: user.is_jcrc,
        });

        if (disabledResponse) {
            return disabledResponse;
        }

        const visibleRows = rows.filter((row) => isCoreServiceEnabled("memberRanking", {
            isJcrc: user.is_jcrc && Boolean(row.can_rank_members),
        }));

        const { searchParams } = new URL(request.url);
        const ccaIdParam = searchParams.get("ccaId");

        if (ccaIdParam) {
            const ccaId = Number(ccaIdParam);

            if (Number.isNaN(ccaId)) {
                return NextResponse.json({ error: "Invalid CCA ID" }, { status: 400 });
            }

            const row = visibleRows.find((r) => r.cca_id === ccaId);

            if (!row) {
                return NextResponse.json({ error: "Managed CCA positions not found" }, { status: 404 });
            }

            return NextResponse.json(row);
        }

        return NextResponse.json(visibleRows);
    } catch (error) {
        console.error("Error fetching managed CCA positions:", error);
        return NextResponse.json({ error: "Failed to load managed CCA positions" }, { status: 500 });
    }
}
