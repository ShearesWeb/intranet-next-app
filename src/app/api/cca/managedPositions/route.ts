import { NextResponse } from "next/server";

import { getCoreServiceDisabledApiResponse } from "@/lib/feature-flags";
import { fetchUserInfo } from "@/lib/fetch-user-info";

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
        const fetchUrl = new URL('/api/user/getManagedCCAs', request.url);
        const apiRes = await fetch(fetchUrl, {
            headers: {
                cookie: request.headers.get("cookie") || "",
            },
        });

        if (!apiRes.ok) {
            return NextResponse.json({ error: "Failed to load managed CCA positions" }, { status: apiRes.status });
        }

        const apiData = await apiRes.json();
        const rows = apiData.data || [];

        const { searchParams } = new URL(request.url);
        const ccaIdParam = searchParams.get("ccaId");

        if (ccaIdParam) {
            const ccaId = Number(ccaIdParam);

            if (Number.isNaN(ccaId)) {
                return NextResponse.json({ error: "Invalid CCA ID" }, { status: 400 });
            }

            const row = rows.find((r: any) => r.cca_id === ccaId);

            if (!row) {
                return NextResponse.json({ error: "Managed CCA positions not found" }, { status: 404 });
            }

            return NextResponse.json(row);
        }

        return NextResponse.json(rows);
    } catch (error) {
        console.error("Error fetching managed CCA positions:", error);
        return NextResponse.json({ error: "Failed to load managed CCA positions" }, { status: 500 });
    }
}
