// src\app\api\chair\positions\[position_id]\removeApplicant\route.ts
// API route to remove a ranked applicant
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { fetchUserInfo } from "@/lib/fetch-user-info";
import { checkCcaAuthorization } from "@/lib/cca-chair-access";
import { getCoreServiceDisabledApiResponse } from "@/lib/feature-flags";

const NON_APPLICANT_POSITION_TYPES = new Set(["lead", "vice", "resident"]);

export async function POST(request: Request, { params }: { params: Promise<{ position_id: string }> }) {
    const disabledResponse = getCoreServiceDisabledApiResponse("ccaApplications");

    if (disabledResponse) {
        return disabledResponse;
    }

    try {
        const { position_id } = await params;
        const supabase = await createClient();

        const requestingUser = await fetchUserInfo();

        const positionId = parseInt(position_id, 10);
        const { user_id } = await request.json();
        if (!user_id) {
            return NextResponse.json({ error: 'Missing user_id' }, { status: 400 });
        }

        const { data: position, error: positionError } = await supabase
            .from("cca_positions")
            .select("id, position_type, ccas!inner(id, name, cca_type)")
            .eq("id", positionId)
            .single();

        if (positionError || !position) {
            return NextResponse.json({ error: "Position not found" }, { status: 404 });
        }

        if (NON_APPLICANT_POSITION_TYPES.has((position.position_type || "").toLowerCase())) {
            return NextResponse.json({ error: "This position cannot be ranked" }, { status: 403 });
        }

        const cca = Array.isArray(position.ccas) ? position.ccas[0] : position.ccas;
        const accessResult = checkCcaAuthorization({
            requestingUser,
            cca,
            require: "chair",
        });

        if (!accessResult.ok) {
            return NextResponse.json({ error: accessResult.error }, { status: accessResult.status });
        }

        const { error } = await supabase
            .from('cca_user_ranking')
            .delete()
            .eq('user_id', user_id)
            .eq('position_id', positionId);

        if (error) {
            console.error("Error removing applicant:", error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        console.error("Unexpected error:", error);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
