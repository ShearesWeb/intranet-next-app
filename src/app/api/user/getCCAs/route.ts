// src/app/api/user/getCCAs/route.ts
// API route to get CCAs a user is appointed to
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { fetchUserInfo } from "@/lib/fetch-user-info";
import { buildManageCcaView } from "@/lib/cca-rankings-access";
import { CcaType } from "@/types/User";

type CCAMeta = {
        id: number;
        name: string;
        cca_type: CcaType;
        description: string;
        image_url: string | null;
};

export async function GET() {
        try {
                const supabase = await createClient();

                // Get user with hydrated appointments (from cached cookie where possible)
                const user = await fetchUserInfo();

                if (!user) {
                        return NextResponse.json({
                                error: 'Unauthorized'
                        }, { status: 401 });
                }

                const appointments = user.appointments || [];

                if (!appointments.length) {
                        return NextResponse.json({ data: [] });
                }

                const ccaIds = Array.from(new Set(appointments.map((appointment) => appointment.cca_id)));

                const { data: ccas, error: ccasError } = await supabase
                        .from('ccas')
                        .select('id, name, cca_type, description, image_url')
                        .in('id', ccaIds);

                if (ccasError) {
                        console.error("Error fetching CCA metadata:", ccasError);
                        return NextResponse.json({ data: [] });
                }

                const ccaMap = new Map<number, CCAMeta>((ccas || []).map((cca) => [cca.id, cca as CCAMeta]));

                const transformedData = buildManageCcaView({
                        requestingUser: user,
                        ccas: Array.from(ccaMap.values()),
                });

                return NextResponse.json({
                        data: transformedData,
                });

        } catch (error) {
		console.error("Error fetching user CCAs:", error);
		return NextResponse.json({ data: [] });
	}
}
