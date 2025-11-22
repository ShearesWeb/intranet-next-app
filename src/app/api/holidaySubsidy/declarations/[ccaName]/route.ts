import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { fetchUserId } from "@/lib/fetch-user-info";
import { checkCCAChairAuthorization } from "@/lib/lead-auth-service";

type Params = {
    params: {
        ccaName: string;
    };
};

async function resolveCCAId(ccaName: string, supabase: any) {
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

async function authorizeChair(ccaId: number, supabase: any) {
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

export async function GET(_request: Request, { params }: Params) {
    try {
        const supabase = await createClient();

        const { ccaId, error } = await resolveCCAId(params.ccaName, supabase);

        if (!ccaId) {
            return NextResponse.json({ error: error || "CCA not found" }, { status: 404 });
        }

        const authResult = await authorizeChair(ccaId, supabase);

        if (!authResult.authorized) {
            return NextResponse.json({ error: authResult.message }, { status: authResult.status });
        }

        const { data: positions, error: positionError } = await supabase
            .from("cca_positions")
            .select("id, name, position_type, cca_id")
            .eq("cca_id", ccaId);

        if (positionError) {
            return NextResponse.json({ error: positionError.message }, { status: 500 });
        }

        const { data: subsidies, error: subsidyError } = await supabase
            .from("subsidies")
            .select(
                `id, position_id, week_id, hours, reason, subsidy_status,
                cca_positions!inner (id, name, position_type, cca_id)
            `
            )
            .eq("cca_positions.cca_id", ccaId);

        if (subsidyError) {
            return NextResponse.json({ error: subsidyError.message }, { status: 500 });
        }

        return NextResponse.json({ positions: positions || [], subsidies: subsidies || [] });
    } catch (error) {
        console.error("Error fetching subsidy declarations:", error);
        return NextResponse.json({ error: "Failed to load subsidy declarations" }, { status: 500 });
    }
}

export async function POST(request: Request, { params }: Params) {
    try {
        const supabase = await createClient();

        const { ccaId, error } = await resolveCCAId(params.ccaName, supabase);

        if (!ccaId) {
            return NextResponse.json({ error: error || "CCA not found" }, { status: 404 });
        }

        const authResult = await authorizeChair(ccaId, supabase);

        if (!authResult.authorized) {
            return NextResponse.json({ error: authResult.message }, { status: authResult.status });
        }

        const body = await request.json();
        const { positionId, weekId, hours, reason } = body || {};

        if (!positionId || !weekId) {
            return NextResponse.json({ error: "Position and week are required" }, { status: 400 });
        }

        const { data: position, error: positionError } = await supabase
            .from("cca_positions")
            .select("id, cca_id")
            .eq("id", positionId)
            .single();

        if (positionError || !position || position.cca_id !== ccaId) {
            return NextResponse.json({ error: "Invalid position for this CCA" }, { status: 400 });
        }

        const { data, error: insertError } = await supabase
            .from("subsidies")
            .insert({
                position_id: positionId,
                week_id: weekId,
                hours,
                reason,
            })
            .select("id, position_id, week_id, hours, reason, subsidy_status")
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
