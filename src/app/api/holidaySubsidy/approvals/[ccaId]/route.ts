import { NextResponse } from "next/server";
import { fetchUserInfo } from "@/lib/fetch-user-info";
import { createClient } from "@/utils/supabase/server";
import { SubsidyStatus, SubsidyWithPosition, PositionOption } from "@/types/holiday-subsidy";


type Params = {
    params: Promise<{
        ccaId: string;
    }>;
};

// API-specific type with joined position data
type SubsidyFromApi = SubsidyWithPosition & {
    cca_positions?: PositionOption & { cca_id: number };
};

async function assertJcrcAccess() {
    const user = await fetchUserInfo();

    if (!user || !user.is_jcrc) {
        return { authorized: false as const, response: NextResponse.json({ error: "Unauthorized" }, { status: 403 }) };
    }

    return { authorized: true as const };
}

async function loadCcaName(ccaId: number, supabase: Awaited<ReturnType<typeof createClient>>) {
    const { data, error } = await supabase.from("ccas").select("name").eq("id", ccaId).single();

    if (error || !data) {
        return { name: null, error: "CCA not found" };
    }

    return { name: data.name as string };
}

async function fetchCcaData(ccaId: number, supabase: Awaited<ReturnType<typeof createClient>>) {
    const [{ data: positions, error: positionsError }, { data: subsidies, error: subsidiesError }] = await Promise.all([
        supabase.from("cca_positions").select("id, name, position_type").eq("cca_id", ccaId),
        supabase
            .from("subsidies")
            .select(
                `id, position_id, week_id, hours, justification, subsidy_status,
                cca_positions!inner(id, name, position_type, cca_id)`
            )
            .eq("cca_positions.cca_id", ccaId),
    ]);

    if (positionsError) {
        throw new Error(positionsError.message);
    }

    if (subsidiesError) {
        throw new Error(subsidiesError.message);
    }

    return { positions: positions || [], subsidies: (subsidies as unknown as SubsidyFromApi[] | null) || [] };
}

function validateUpdates(
    updates: Array<{ subsidyId: number; status: SubsidyStatus }>
): asserts updates is Array<{ subsidyId: number; status: SubsidyStatus }> {
    if (!Array.isArray(updates) || updates.length === 0) {
        throw new Error("No updates provided");
    }

    for (const update of updates) {
        if (!update || typeof update.subsidyId !== "number" || !Object.values(SubsidyStatus).includes(update.status)) {
            throw new Error("Invalid update payload");
        }
    }
}

async function ensureSubsidiesBelongToCca(
    supabase: Awaited<ReturnType<typeof createClient>>,
    ccaId: number,
    ids: number[]
): Promise<void> {
    const { data, error } = await supabase
        .from("subsidies")
        .select("id, cca_positions!inner(cca_id)")
        .in("id", ids)
        .eq("cca_positions.cca_id", ccaId);

    if (error) {
        throw new Error(error.message);
    }

    const foundIds = new Set((data || []).map((row: { id: number }) => row.id as number));

    const missing = ids.filter((id) => !foundIds.has(id));

    if (missing.length > 0) {
        throw new Error("One or more subsidies do not belong to this CCA");
    }
}

export async function GET(_request: Request, { params }: Params) {
    try {
        const authResult = await assertJcrcAccess();

        if (!authResult.authorized) {
            return authResult.response;
        }

        const { ccaId: ccaIdParam } = await params;
        const ccaId = Number(ccaIdParam);

        if (!ccaId) {
            return NextResponse.json({ error: "Invalid CCA" }, { status: 400 });
        }

        const supabase = await createClient();
        const { name, error } = await loadCcaName(ccaId, supabase);

        if (!name) {
            return NextResponse.json({ error: error || "CCA not found" }, { status: 404 });
        }

        const { positions, subsidies } = await fetchCcaData(ccaId, supabase);

        return NextResponse.json({ ccaName: name, positions, subsidies });
    } catch (error) {
        console.error("Error fetching subsidy approvals:", error);
        return NextResponse.json({ error: "Failed to load subsidy approvals" }, { status: 500 });
    }
}

export async function PATCH(request: Request, { params }: Params) {
    try {
        const authResult = await assertJcrcAccess();

        if (!authResult.authorized) {
            return authResult.response;
        }

        const { ccaId: ccaIdParam } = await params;
        const ccaId = Number(ccaIdParam);

        if (!ccaId) {
            return NextResponse.json({ error: "Invalid CCA" }, { status: 400 });
        }

        const body = await request.json();
        const updates = (body?.updates || []) as Array<{ subsidyId: number; status: SubsidyStatus }>;

        try {
            validateUpdates(updates);
        } catch (err) {
            return NextResponse.json({ error: err instanceof Error ? err.message : "Invalid request" }, { status: 400 });
        }

        const supabase = await createClient();

        await ensureSubsidiesBelongToCca(
            supabase,
            ccaId,
            updates.map((u) => u.subsidyId)
        );

        const groupedByStatus = updates.reduce<Record<SubsidyStatus, number[]>>(
            (acc, { subsidyId, status }) => {
                acc[status].push(subsidyId);
                return acc;
            },
            { pending: [], approved: [], rejected: [] }
        );

        for (const [status, ids] of Object.entries(groupedByStatus) as Array<
            [SubsidyStatus, number[]]
        >) {
            if (ids.length === 0) continue;

            const { error } = await supabase
                .from("subsidies")
                .update({ subsidy_status: status })
                .in("id", ids);

            if (error) {
                throw new Error(error.message);
            }
        }

        const { data, error } = await supabase
            .from("subsidies")
            .select(
                `id, position_id, week_id, hours, justification, subsidy_status,
                cca_positions!inner(id, name, position_type, cca_id)`
            )
            .in(
                "id",
                updates.map((u) => u.subsidyId)
            );

        if (error) {
            throw new Error(error.message);
        }

        return NextResponse.json({ updated: (data as unknown as SubsidyFromApi[] | null) || [] });
    } catch (error) {
        console.error("Error updating subsidy approvals:", error);
        return NextResponse.json({ error: "Failed to update approvals" }, { status: 500 });
    }
}
