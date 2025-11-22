import { NextResponse } from "next/server";

import { fetchAuthenticatedUser } from "@/lib/fetch-user-info";
import { createClient } from "@/utils/supabase/server";

type SupabaseClient = ReturnType<typeof createClient> extends Promise<infer T>
    ? T
    : never;

type ApprovalRow = {
    id: number;
    name: string;
    pendingDeclarations: number;
};

async function fetchPendingDeclarations(supabase: SupabaseClient): Promise<ApprovalRow[]> {
    const { data, error } = await supabase
        .from("subsidies")
        .select("subsidy_status, cca_positions!inner(cca_id, ccas!inner(name))")
        .eq("subsidy_status", "pending");

    if (error) {
        throw new Error(error.message);
    }

    const map = new Map<number, ApprovalRow>();

    (data || []).forEach((row) => {
        const ccaId = row.cca_positions?.cca_id as number | undefined;
        const ccaName = row.cca_positions?.ccas?.name as string | undefined;

        if (!ccaId || !ccaName) return;

        const existing = map.get(ccaId);

        if (existing) {
            existing.pendingDeclarations += 1;
        } else {
            map.set(ccaId, { id: ccaId, name: ccaName, pendingDeclarations: 1 });
        }
    });

    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
}

export async function GET() {
    try {
        const user = await fetchAuthenticatedUser();

        if (!user || !user.is_jcrc) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
        }

        const supabase = await createClient();
        const rows = await fetchPendingDeclarations(supabase);

        return NextResponse.json({ ccas: rows });
    } catch (error) {
        console.error("Error loading subsidy approvals:", error);
        return NextResponse.json({ error: "Failed to load subsidy approvals" }, { status: 500 });
    }
}
