import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { SubsidyStatus } from "@/types/holiday-subsidy";
import { fetchUserId } from "@/lib/fetch-user-info";
import { checkCCAChairAuthorization } from "@/lib/lead-auth-service";


type Params = {
    params: Promise<{
        ccaName: string;
    }>;
};

async function resolveCCAId(ccaName: string, supabase: Awaited<ReturnType<typeof createClient>>) {
    const decodedName = decodeURIComponent(ccaName);

    const { data, error } = await supabase
        .from("ccas")
        .select("id, name")
        .ilike("name", decodedName)
        .single();

    if (error || !data) {
        return { ccaId: null, error: "CCA not found" };
    }

    return { ccaId: data.id as number, ccaName: data.name as string };
}

async function authorizeChair(ccaId: number, supabase: Awaited<ReturnType<typeof createClient>>) {
    const userId = await fetchUserId();

    if (!userId) {
        return { authorized: false, status: 401, message: "Unauthorized" };
    }

    const { authorized, error } = await checkCCAChairAuthorization(userId, ccaId, supabase);

    if (error) {
        return { authorized: false, status: 500, message: error };
    }

    if (!authorized) {
        return { authorized: false, status: 403, message: "You are not authorized to manage this CCA" };
    }

    return { authorized: true, status: 200 };
}

async function validatePosition(
    supabase: Awaited<ReturnType<typeof createClient>>,
    positionId: number,
    ccaId: number
) {
    const { data: position, error: positionError } = await supabase
        .from("cca_positions")
        .select("id, cca_id")
        .eq("id", positionId)
        .single();

    if (positionError || !position || position.cca_id !== ccaId) {
        return { valid: false, error: "Invalid position for this CCA" };
    }

    return { valid: true };
}

export async function GET(_request: Request, { params }: Params) {
    try {
        const supabase = await createClient();

        const { ccaName } = await params;
        const { ccaId, error } = await resolveCCAId(ccaName, supabase);

        if (!ccaId) {
            return NextResponse.json({ error: error || "CCA not found" }, { status: 404 });
        }

        const authResult = await authorizeChair(ccaId, supabase);

        if (!authResult.authorized) {
            return NextResponse.json({ error: authResult.message }, { status: authResult.status });
        }

        const { data: positionsWithSubsidies, error: positionError } = await supabase
            .from("cca_positions")
            .select(`
                id,
                name,
                position_type,
                cca_id,
                subsidies (
                    id,
                    position_id,
                    week_id,
                    hours,
                    justification,
                    subsidy_status
                )
            `)
            .eq("cca_id", ccaId);

        if (positionError) {
            return NextResponse.json({ error: positionError.message }, { status: 500 });
        }

        // Flatten subsidies and clean up positions to match previous response structure
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const subsidies = positionsWithSubsidies?.flatMap((p: any) => p.subsidies || []) || [];
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const positions = positionsWithSubsidies?.map(({ subsidies, ...rest }) => rest) || [];

        return NextResponse.json({ positions, subsidies });
    } catch (error) {
        console.error("Error fetching subsidy declarations:", error);
        return NextResponse.json({ error: "Failed to load subsidy declarations" }, { status: 500 });
    }
}

export async function POST(request: Request, { params }: Params) {
    try {
        const supabase = await createClient();

        const { ccaName } = await params;
        const { ccaId, error } = await resolveCCAId(ccaName, supabase);

        if (!ccaId) {
            return NextResponse.json({ error: error || "CCA not found" }, { status: 404 });
        }

        const authResult = await authorizeChair(ccaId, supabase);

        if (!authResult.authorized) {
            return NextResponse.json({ error: authResult.message }, { status: authResult.status });
        }

        const body = await request.json();
        const { positionId, weekId, hours, justification } = body || {};

        if (!positionId || !weekId || hours === undefined || hours === null || justification === undefined) {
            return NextResponse.json({ error: "Position, week, hours, and justification are required" }, { status: 400 });
        }

        const positionValidation = await validatePosition(supabase, positionId, ccaId);

        if (!positionValidation.valid) {
            return NextResponse.json({ error: positionValidation.error }, { status: 400 });
        }

        const { data, error: insertError } = await supabase
            .from("subsidies")
            .insert({
                position_id: positionId,
                week_id: weekId,
                hours,
                justification,
            })
            .select("id, position_id, week_id, hours, justification, subsidy_status")
            .single();

        if (insertError) {
            const status = insertError.code === "23505" ? 409 : 500;
            const message = insertError.code === "23505"
                ? "A declaration for this position and week already exists"
                : insertError.message;
            return NextResponse.json({ error: message }, { status });
        }

        return NextResponse.json({ subsidy: data });
    } catch (error) {
        console.error("Error creating subsidy declaration:", error);
        return NextResponse.json({ error: "Failed to submit declaration" }, { status: 500 });
    }
}

export async function PATCH(request: Request, { params }: Params) {
    try {
        const supabase = await createClient();

        const { ccaName } = await params;
        const { ccaId, error } = await resolveCCAId(ccaName, supabase);

        if (!ccaId) {
            return NextResponse.json({ error: error || "CCA not found" }, { status: 404 });
        }

        const authResult = await authorizeChair(ccaId, supabase);

        if (!authResult.authorized) {
            return NextResponse.json({ error: authResult.message }, { status: authResult.status });
        }

        const body = await request.json();
        const { subsidyId, positionId, weekId, hours, justification } = body || {};

        if (!subsidyId || !positionId || !weekId || hours === undefined || hours === null || justification === undefined) {
            return NextResponse.json(
                { error: "Subsidy ID, position, week, hours, and justification are required" },
                { status: 400 }
            );
        }

        const { data: existing, error: fetchError } = await supabase
            .from("subsidies")
            .select("id, position_id, subsidy_status, cca_positions!inner(cca_id)")
            .eq("id", subsidyId)
            .single();

        if (fetchError || !existing) {
            return NextResponse.json({ error: "Subsidy declaration not found" }, { status: 404 });
        }

        const positionValidation = await validatePosition(supabase, positionId, ccaId);

        if (!positionValidation.valid) {
            return NextResponse.json({ error: positionValidation.error }, { status: 400 });
        }

        const { data, error: updateError } = await supabase
            .from("subsidies")
            .update({
                position_id: positionId,
                week_id: weekId,
                hours,
                justification,
                subsidy_status: SubsidyStatus.PENDING,
            })
            .eq("id", subsidyId)
            .select("id, position_id, week_id, hours, justification, subsidy_status")
            .single();

        if (updateError) {
            const status = updateError.code === "23505" ? 409 : 500;
            const message = updateError.code === "23505"
                ? "A declaration for this position and week already exists"
                : updateError.message;
            return NextResponse.json({ error: message }, { status });
        }

        return NextResponse.json({ subsidy: data });
    } catch (error) {
        console.error("Error updating subsidy declaration:", error);
        return NextResponse.json({ error: "Failed to update declaration" }, { status: 500 });
    }
}

export async function DELETE(request: Request, { params }: Params) {
    try {
        const supabase = await createClient();

        const { ccaName } = await params;
        const { ccaId, error } = await resolveCCAId(ccaName, supabase);

        if (!ccaId) {
            return NextResponse.json({ error: error || "CCA not found" }, { status: 404 });
        }

        const authResult = await authorizeChair(ccaId, supabase);

        if (!authResult.authorized) {
            return NextResponse.json({ error: authResult.message }, { status: authResult.status });
        }

        const body = await request.json();
        const { subsidyId } = body || {};

        if (!subsidyId) {
            return NextResponse.json({ error: "Subsidy ID is required" }, { status: 400 });
        }

        const { data: existing, error: fetchError } = await supabase
            .from("subsidies")
            .select("id, subsidy_status, cca_positions!inner(cca_id)")
            .eq("id", subsidyId)
            .single();

        if (fetchError || !existing) {
            return NextResponse.json({ error: "Subsidy declaration not found" }, { status: 404 });
        }

        if (existing.subsidy_status !== SubsidyStatus.PENDING) {
            return NextResponse.json({ error: "Only pending declarations can be deleted" }, { status: 400 });
        }

        const { error: deleteError } = await supabase.from("subsidies").delete().eq("id", subsidyId);

        if (deleteError) {
            return NextResponse.json({ error: deleteError.message }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error deleting subsidy declaration:", error);
        return NextResponse.json({ error: "Failed to delete declaration" }, { status: 500 });
    }
}
