// src\app\api\chair\positions\[position_id]\addApplicant\route.ts
// API route to add an applicant to rank
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { fetchUserInfo } from "@/lib/fetch-user-info";
import { checkCcaAuthorization } from "@/lib/cca-rankings-access";

const NON_APPLICANT_POSITION_TYPES = new Set(["lead", "vice", "resident"]);

export async function POST(request: Request, { params }: { params: Promise<{ position_id: string }> }) {
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

        // Check if applicant already exists
        const { data: existingApplicant } = await supabase
            .from('cca_user_ranking')
            .select('id')
            .eq('user_id', user_id)
            .eq('position_id', positionId)
            .single();

        if (existingApplicant) {
            return NextResponse.json({ error: 'Applicant already exists for this position' }, { status: 400 });
        }

        // Get current number of applicants to determine next rank
        const { data: currentApplicants, error: countError } = await supabase
            .from('cca_user_ranking')
            .select('ranking')
            .eq('position_id', positionId)
            .order('ranking', { ascending: false })
            .limit(1);

        if (countError) {
            console.error("Error counting current applicants:", countError);
            return NextResponse.json({ error: 'Failed to determine ranking' }, { status: 500 });
        }

        // Calculate next ranking: highest current rank + 1, or 1 if no applicants
        const nextRanking = currentApplicants.length > 0
            ? (currentApplicants[0].ranking || 0) + 1
            : 1;

        // Insert new applicant with calculated ranking
        const { error } = await supabase
            .from('cca_user_ranking')
            .insert({
                user_id: user_id,
                position_id: positionId,
                ranking: nextRanking
            });

        if (error) {
            console.error("Error adding applicant:", error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            ranking: nextRanking,
            message: `Applicant added with ranking ${nextRanking}`
        });
    } catch (error: unknown) {
        console.error("Unexpected error:", error);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
