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

async function fetchCcasWithAnySubsidy(supabase: Awaited<ReturnType<typeof createClient>>): Promise<ApprovalRow[]> {
    const { data, error } = await supabase
        .from("subsidies")
        .select(
            `cca_positions!inner (
                cca_id,
                ccas!inner (
                    id,
                    name
                )
            )`
        );

    if (error) {
        throw new Error(error.message);
    }

    const map = new Map<number, ApprovalRow>();

    (data as SubsidyWithCCA[] | null | undefined)?.forEach((row) => {
        const ccaId = row.cca_positions?.ccas?.id ?? row.cca_positions?.cca_id;
        const ccaName = row.cca_positions?.ccas?.name;

        if (!ccaId || !ccaName) return;

        if (!map.has(ccaId)) {
            map.set(ccaId, {
                id: ccaId,
                name: ccaName,
                pendingDeclarations: 0,
                pendingWeekly: 0,
            });
        }
    });

    return Array.from(map.values());
}

export async function GET() {
    try {
        const user = await fetchUserInfo();

        if (!user || !user.is_jcrc) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
        }

        const supabase = await createClient();

        const [subsidyCcas, declarations, weeklyMap] = await Promise.all([
            fetchCcasWithAnySubsidy(supabase),
            fetchSubsidies(supabase),
            fetchPendingWeeklyCommitments(supabase),
        ]);

        const ccaMap = new Map<number, ApprovalRow>();

        // Seed CCAs that have any subsidy entry (any status)
        subsidyCcas.forEach((cca) => {
            ccaMap.set(cca.id, {
                id: cca.id,
                name: cca.name,
                pendingDeclarations: 0,
                pendingWeekly: 0,
            });
        });

        // Add declarations
        declarations.forEach((decl) => {
            const existing = ccaMap.get(decl.id);
            if (existing) {
                existing.pendingDeclarations = decl.pendingDeclarations;
            } else {
                ccaMap.set(decl.id, {
                    id: decl.id,
                    name: decl.name,
                    pendingDeclarations: decl.pendingDeclarations,
                    pendingWeekly: 0,
                });
            }
        });

        // Add weekly commitments
        weeklyMap.forEach((weekly, ccaId) => {
            const existing = ccaMap.get(ccaId);
            if (existing) {
                existing.pendingWeekly = weekly.count;
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
