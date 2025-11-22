// src/app/api/user/getCCAs/route.ts
// API route to get CCAs a user is appointed to
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { fetchUserInfo } from "@/lib/fetch-user-info";

// ✅ TypeScript interfaces with union types
type CCAMeta = {
        id: number;
        name: string;
        cca_type: string;
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

                const transformedData = appointments.map((appointment) => {
                        const ccaMeta = ccaMap.get(appointment.cca_id);

                        return {
                                name: ccaMeta?.name ?? appointment.cca_name,
                                role: appointment.position_name || 'Unknown Role',
                                position_type: appointment.position_type,
                                cca_type: ccaMeta?.cca_type ?? 'Unknown',
                                description: ccaMeta?.description ?? '',
                                points: appointment.points || 0,
                        };
                });

                return NextResponse.json({
                        data: transformedData,
                });

        } catch (error) {
		console.error("Error fetching user CCAs:", error);
		return NextResponse.json({ data: [] });
	}
}
