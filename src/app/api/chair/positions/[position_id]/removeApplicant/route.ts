// src\app\api\chair\positions\[position_id]\removeApplicant\route.ts
// API route to remove a ranked applicant
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { fetchUserId } from "@/lib/fetch-user-info";
import { checkCCAChairAuthorization } from "@/lib/lead-auth-service";

export async function POST(request: Request, { params }: { params: Promise<{ position_id: string }> }) {
    try {
        const { position_id } = await params;
        const supabase = await createClient();

        // Verify authentication and get user ID
        const requestingUserId = await fetchUserId();

        if (!requestingUserId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const positionId = parseInt(position_id, 10);
        if (!positionId) {
            return NextResponse.json({ error: 'Invalid position_id' }, { status: 400 });
        }

        const { user_id } = await request.json();
        if (!user_id) {
            return NextResponse.json({ error: 'Missing user_id' }, { status: 400 });
        }

        // Check if user has lead/vice appointment for this CCA
        const { data: targetPosition } = await supabase
            .from('cca_positions')
            .select('cca_id')
            .eq('id', positionId)
            .single();

        if (!targetPosition) {
            return NextResponse.json({ error: 'Position not found' }, { status: 404 });
        }

        const authResult = await checkCCAChairAuthorization(requestingUserId, targetPosition.cca_id, supabase);
        if (!authResult.authorized) {
            return NextResponse.json({
                error: 'Unauthorized: Not a lead/vice for this CCA'
            }, { status: 403 });
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
