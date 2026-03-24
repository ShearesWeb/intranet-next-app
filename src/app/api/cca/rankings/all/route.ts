import { NextResponse } from "next/server";
import { fetchUserInfo } from "@/lib/fetch-user-info";
import { getCoreServiceDisabledApiResponse, isCoreServiceEnabled } from "@/lib/feature-flags";

type ManagedCcaRankingRow = {
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
            isJcrc: user.is_jcrc,
        });

        if (disabledResponse) {
            return disabledResponse;
        }

        const visibleRows = rows.filter((row) => isCoreServiceEnabled("memberRanking", {
            isJcrc: user.is_jcrc && Boolean(row.can_rank_members),
        }));

        return NextResponse.json({ data: visibleRows });
    } catch (error) {
        console.error("Error fetching CCA ranking list:", error);
        return NextResponse.json({ error: "Failed to load CCAs" }, { status: 500 });
    }
}
