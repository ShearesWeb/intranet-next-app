import { NextResponse } from "next/server";

import { fetchUserInfo } from "@/lib/fetch-user-info";
import { createClient } from "@/utils/supabase/server";
import { SubsidyStatus } from "@/types/holiday-subsidy";

type ApprovalRow = {
    id: number;
    name: string;
    pendingDeclarations: number;
    pendingWeekly: number;
};

type SubsidyWithCCA = {
    cca_positions?: {
        cca_id?: number;
        ccas?: {
            id?: number;
            name?: string;
        } | null;
    } | null;
};

async function fetchSubsidies(supabase: Awaited<ReturnType<typeof createClient>>): Promise<ApprovalRow[]> {
    const { data, error } = await supabase
        .from("subsidies")
        .select(
            `subsidy_status,
            cca_positions!inner (
                cca_id,
                ccas!inner (
                    id,
                    name
                )
            )`
        )
        .eq("subsidy_status", SubsidyStatus.PENDING);

    if (error) {
        throw new Error(error.message);
    }

    const map = new Map<number, ApprovalRow>();

    (data as SubsidyWithCCA[] | null | undefined)?.forEach((row) => {
        const ccaId = row.cca_positions?.ccas?.id ?? row.cca_positions?.cca_id;
        const ccaName = row.cca_positions?.ccas?.name;

        if (!ccaId || !ccaName) return;

        const existing = map.get(ccaId);

        if (existing) {
            existing.pendingDeclarations += 1;
        } else {
            map.set(ccaId, { id: ccaId, name: ccaName, pendingDeclarations: 1, pendingWeekly: 0 });
        }
    });

    return Array.from(map.values());
}

type UserSubsidyWithCCA = {
    cca_positions?: {
        cca_id?: number;
        ccas?: {
            id?: number;
            name?: string;
        } | null;
    } | null;
};

async function fetchPendingWeeklyCommitments(
    supabase: Awaited<ReturnType<typeof createClient>>
): Promise<Map<number, { id: number; name: string; count: number }>> {
    const { data, error } = await supabase
        .from("user_subsidies")
        .select(
            `subsidy_status,
            cca_positions!inner (
                cca_id,
                ccas!inner (
                    id,
                    name
                )
            )`
        )
        .eq("subsidy_status", SubsidyStatus.PENDING);

    if (error) {
        throw new Error(error.message);
    }

    const map = new Map<number, { id: number; name: string; count: number }>();

    (data as UserSubsidyWithCCA[] | null | undefined)?.forEach((row) => {
        const ccaId = row.cca_positions?.ccas?.id ?? row.cca_positions?.cca_id;
        const ccaName = row.cca_positions?.ccas?.name;

        if (!ccaId || !ccaName) return;

        const existing = map.get(ccaId);

        if (existing) {
            existing.count += 1;
        } else {
            map.set(ccaId, { id: ccaId, name: ccaName, count: 1 });
        }
    });

    return map;
}

export async function GET() {
    try {
        const user = await fetchUserInfo();

        if (!user || !user.is_jcrc) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
        }

        const supabase = await createClient();
        
        // Fetch both pending declarations and weekly commitments
        const declarations = await fetchSubsidies(supabase);
        const weeklyMap = await fetchPendingWeeklyCommitments(supabase);

        // Merge the data
        const ccaMap = new Map<number, ApprovalRow>();

        // Add declarations
        declarations.forEach((decl) => {
            ccaMap.set(decl.id, {
                id: decl.id,
                name: decl.name,
                pendingDeclarations: decl.pendingDeclarations,
                pendingWeekly: 0,
            });
        });

        // Add weekly commitments
        weeklyMap.forEach((weekly, ccaId) => {
            const existing = ccaMap.get(ccaId);
            if (existing) {
                existing.pendingWeekly = weekly.count;
            } else {
                ccaMap.set(ccaId, {
                    id: weekly.id,
                    name: weekly.name,
                    pendingDeclarations: 0,
                    pendingWeekly: weekly.count,
                });
            }
        });

        // Convert to sorted array
        const ccas = Array.from(ccaMap.values()).sort((a, b) => a.name.localeCompare(b.name));

        return NextResponse.json({ ccas });
    } catch (error) {
        console.error("Error loading subsidy approvals:", error);
        return NextResponse.json({ error: "Failed to load subsidy approvals" }, { status: 500 });
    }
}
