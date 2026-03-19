import { NextResponse } from "next/server";
import { fetchUserInfo } from "@/lib/fetch-user-info";
import { getCoreServiceDisabledApiResponse } from "@/lib/feature-flags";

export async function GET(request: Request) {
    const disabledResponse = getCoreServiceDisabledApiResponse("memberRanking");

    if (disabledResponse) {
        return disabledResponse;
    }

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
        return NextResponse.json({ data: data.data || [] });
    } catch (error) {
        console.error("Error fetching CCA ranking list:", error);
        return NextResponse.json({ error: "Failed to load CCAs" }, { status: 500 });
    }
}
