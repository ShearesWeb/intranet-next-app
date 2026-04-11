import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { fetchUserInfo } from "@/lib/fetch-user-info";
import { getManagedCcaData } from "@/lib/managed-cca-data";

export type { ManagedCcaPosition, ManagedCcaPositionsRow } from "@/lib/managed-cca-data";

export async function GET() {
    try {
        const user = await fetchUserInfo();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const supabase = await createClient();
        const data = await getManagedCcaData(supabase, user);
        return NextResponse.json({ data });

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : error;
        console.error("Error in getManagedCCAs:", message);
        return NextResponse.json({ error: "Failed to fetch managed CCAs" }, { status: 500 });
    }
}
