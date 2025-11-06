// src/app/api/cca/[cca_name]/cutMember/route.ts
// API route to cut a member from a sports or culture CCA
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { phaseService } from '@/lib/phase-service';
import { fetchUserId } from "@/lib/fetch-user-info";
import { checkCCAChairAuthorization } from "@/lib/lead-auth-service";

export async function POST(
    request: Request,
    { params }: { params: Promise<{ cca_name: string }> }
) {
    try {
        const { cca_name } = await params;
        const decodedCcaName = decodeURIComponent(cca_name);
        const { user_id, position_id, reason } = await request.json();

        const supabase = await createClient();

        // Check phase permissions
        const phaseInfo = await phaseService.getCurrentPhaseInfo();
        const canManage = await isInSportsCultureManagementPhase(phaseInfo);

        if (!canManage) {
            return NextResponse.json({
                error: 'Sports/Culture member management is currently not available'
            }, { status: 403 });
        }

        // Cut the member
        console.log('Cutting member:', { user_id, position_id, reason });
        const { error } = await supabase
            .rpc('cut_sports_cca_member', {
                p_position_id: position_id,
                p_user_id: user_id,
            });

        if (error) {
            console.error('Error cutting member:', error);
            return NextResponse.json({ error: 'Failed to cut member' }, { status: 500 });
        }

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('Error cutting member:', error);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}

async function isInSportsCultureManagementPhase(phaseInfo: any): Promise<boolean> {
    const sportsCulturePhases = [
        'subcomm_results_processing',
        'full_results_available'
    ];
    return true;
}
