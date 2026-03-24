import { NextResponse } from "next/server";
import { fetchUserInfo } from "@/lib/fetch-user-info";
import { getCoreServiceDisabledApiResponse, isCoreServiceEnabled } from "@/lib/feature-flags";

type ManagedCcaRankingRow = {
    cca_name?: string | null;
    can_rank_members?: boolean;
};

export async function GET(request: Request) {
    try {
        const user = await fetchUserInfo();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const fetchUrl = new URL('/api/user/getManagedCCAs', request.url);
        const apiRes = await fetch(fetchUrl, {
            headers: {
                cookie: request.headers.get("cookie") || "",
            },
        });

        if (!apiRes.ok) {
            console.error("Error fetching CCA ranking list from getManagedCCAs");
            return NextResponse.json({ error: "Failed to load CCAs" }, { status: 500 });
        }

        const data = await apiRes.json();
        const rows = (data.data || []) as ManagedCcaRankingRow[];
        const disabledResponse = getCoreServiceDisabledApiResponse("memberRanking", {
            ccaName: rows.find((row) => isCoreServiceEnabled("memberRanking", {
                ccaName: row.cca_name,
            }))?.cca_name,
        });

        if (disabledResponse) {
            return disabledResponse;
        }

        const visibleRows = rows.filter((row) => isCoreServiceEnabled("memberRanking", {
            ccaName: row.cca_name,
        }));

        return NextResponse.json({ data: visibleRows });
    } catch (error) {
        console.error("Error fetching CCA ranking list:", error);
        return NextResponse.json({ error: "Failed to load CCAs" }, { status: 500 });
    }
}
