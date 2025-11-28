import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { fetchUserInfo } from "@/lib/fetch-user-info";
import { VALID_STATUSES } from "@/lib/constants/holiday-subsidy";
import type { SubsidyStatus, SubsidyWithCCAInfo } from "@/types/holiday-subsidy";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Verify that the requesting user has JCRC access
 */
async function assertJcrcAccess() {
    const user = await fetchUserInfo();

    if (!user || !user.is_jcrc) {
        return {
            authorized: false as const,
            response: NextResponse.json({ error: "Unauthorized" }, { status: 403 }),
        };
    }

    return { authorized: true as const };
}

/**
 * Fetch all subsidy declarations with CCA and position information
 */
async function fetchAllDeclarations(supabase: SupabaseClient): Promise<SubsidyWithCCAInfo[]> {
    const { data, error } = await supabase
        .from("subsidies")
        .select(
            `id, position_id, week_id, hours, justification, subsidy_status,
            cca_positions (
                id, name, position_type, cca_id,
                ccas (
                    id, name
                )
            )`
        );

    if (error) {
        throw new Error(error.message);
    }

    // Sort by status (pending first), then by CCA name
    const declarations = (data as unknown as SubsidyWithCCAInfo[]) || [];

    return declarations.sort((a, b) => {
        // Status priority: pending > approved > rejected
        const statusOrder = { pending: 0, approved: 1, rejected: 2 };
        const statusDiff = statusOrder[a.subsidy_status] - statusOrder[b.subsidy_status];

        if (statusDiff !== 0) return statusDiff;

        // Then sort by CCA name
        const ccaNameA = a.cca_positions?.ccas?.name || "";
        const ccaNameB = b.cca_positions?.ccas?.name || "";
        return ccaNameA.localeCompare(ccaNameB);
    });
}

/**
 * Validate update payload structure
 */
function validateUpdates(
    updates: Array<{ subsidyId: number; status: SubsidyStatus }>
): asserts updates is Array<{ subsidyId: number; status: SubsidyStatus }> {
    if (!Array.isArray(updates) || updates.length === 0) {
        throw new Error("No updates provided");
    }

    for (const update of updates) {
        if (!update || typeof update.subsidyId !== "number" || !VALID_STATUSES.has(update.status)) {
            throw new Error("Invalid update payload");
        }
    }
}

/**
 * GET /api/holidaySubsidy/approvals
 * Fetch all subsidy declarations for JCRC approval
 */
export async function GET() {
    try {
        const authResult = await assertJcrcAccess();

        if (!authResult.authorized) {
            return authResult.response;
        }

        const supabase = await createClient();
        const declarations = await fetchAllDeclarations(supabase);

        return NextResponse.json({ declarations });
    } catch (error) {
        console.error("Error loading subsidy approvals:", error);
        return NextResponse.json({ error: "Failed to load subsidy approvals" }, { status: 500 });
    }
}

/**
 * PATCH /api/holidaySubsidy/approvals
 * Bulk update subsidy declaration statuses
 */
export async function PATCH(request: Request) {
    try {
        const authResult = await assertJcrcAccess();

        if (!authResult.authorized) {
            return authResult.response;
        }

        const body = await request.json();
        const updates = (body?.updates || []) as Array<{ subsidyId: number; status: SubsidyStatus }>;

        try {
            validateUpdates(updates);
        } catch (err) {
            return NextResponse.json(
                { error: err instanceof Error ? err.message : "Invalid request" },
                { status: 400 }
            );
        }

        const supabase = await createClient();

        // Group updates by status for efficient bulk updates
        const groupedByStatus = updates.reduce<Record<SubsidyStatus, number[]>>(
            (acc, { subsidyId, status }) => {
                acc[status].push(subsidyId);
                return acc;
            },
            { pending: [], approved: [], rejected: [] }
        );

        // Execute bulk updates
        for (const [status, ids] of Object.entries(groupedByStatus) as Array<[SubsidyStatus, number[]]>) {
            if (ids.length === 0) continue;

            const { error } = await supabase
                .from("subsidies")
                .update({ subsidy_status: status })
                .in("id", ids);

            if (error) {
                throw new Error(error.message);
            }
        }

        // Fetch updated records to return
        const { data, error } = await supabase
            .from("subsidies")
            .select(
                `id, position_id, week_id, hours, justification, subsidy_status,
                cca_positions(id, name, position_type, cca_id, ccas(id, name))`
            )
            .in(
                "id",
                updates.map((u) => u.subsidyId)
            );

        if (error) {
            throw new Error(error.message);
        }

        return NextResponse.json({ updated: (data as unknown as SubsidyWithCCAInfo[] | null) || [] });
    } catch (error) {
        console.error("Error updating subsidy approvals:", error);
        return NextResponse.json({ error: "Failed to update approvals" }, { status: 500 });
    }
}
