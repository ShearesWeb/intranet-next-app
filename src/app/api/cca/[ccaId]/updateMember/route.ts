import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { fetchUserInfo } from "@/lib/fetch-user-info";
import { checkCcaAuthorization } from "@/lib/cca-rankings-access";

export async function POST(
    request: Request,
    { params }: { params: Promise<{ ccaId: string }> }
) {
    try {
        const { ccaId } = await params;
        const { user_id, position_id, cut_status, commitment_period, comments, ranking, attendance_rating, performance_rating } = await request.json();

        const supabase = await createClient();
        const requestingUser = await fetchUserInfo();

        if (!requestingUser) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const ccaIdNum = parseInt(ccaId, 10);
        if (isNaN(ccaIdNum)) {
            return NextResponse.json({ error: 'Invalid CCA ID' }, { status: 400 });
        }

        const authResult = checkCcaAuthorization({
            requestingUser,
            cca: { id: ccaIdNum, name: null, cca_type: null },
            require: "chair",
        });

        if (!authResult.ok) {
            return NextResponse.json({
                error: 'Unauthorized: You are not a lead/vice for this CCA'
            }, { status: 403 });
        }

        console.log('Updating member:', { user_id, position_id, cut_status, commitment_period, comments });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const updates: any = {};
        if (cut_status !== undefined) updates.cut_status = cut_status;
        if (commitment_period !== undefined) updates.commitment_period = commitment_period;
        if (comments !== undefined) updates.comments = comments;

        if (Object.keys(updates).length === 0) {
            return NextResponse.json({ success: true });
        }

        if ((cut_status !== undefined || commitment_period !== undefined) && !position_id) {
            return NextResponse.json({ error: 'position_id is required for member updates' }, { status: 400 });
        }

        const { data: updatedRows, error } = await supabase
            .from('cca_appointments')
            .update(updates)
            .select('user_id, position_id')
            .eq('user_id', user_id)
            .eq('position_id', position_id);

        if (error) {
            console.error('Error updating member:', error);
            return NextResponse.json({ error: 'Failed to update member' }, { status: 500 });
        }

        if (!updatedRows || updatedRows.length === 0) {
            return NextResponse.json({ error: 'No matching member appointment found for update' }, { status: 404 });
        }

        // Upsert ranking
        if (ranking !== undefined || attendance_rating !== undefined || performance_rating !== undefined || comments !== undefined) {
             const rankingUpdate = {
                 user_id,
                 position_id,
                 ranking: ranking || 999,
                 attendance: Math.max(1, attendance_rating || 0),
                 performance: Math.max(1, performance_rating || 0),
                 remarks: comments || '',
                 updated_at: new Date().toISOString()
             };
             
             const { error: rankError } = await supabase
                 .from('cca_member_rankings')
                 .upsert(rankingUpdate, { onConflict: 'user_id, position_id' });
                 
             if (rankError) {
                 console.error('Error updating ranking:', rankError);
                 return NextResponse.json({ error: 'Failed to update ranking: ' + rankError.message }, { status: 500 });
             }
        }

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('Error updating member:', error);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
