import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { fetchUserInfo } from "@/lib/fetch-user-info";
import { PositionType, CcaType } from "@/types/User";

export type ManagedCcaPosition = {
    position_id: number;
    position_name: string;
    position_type: PositionType;
    description: string | null;
    access_depth: number;
};

export type ManagedCcaPositionsRow = {
    cca_id: number;
    cca_name: string;
    positions: ManagedCcaPosition[];
    // Extended fields for CCAAdmin table
    id: number;
    name: string;
    role: string;
    position_type: PositionType | "";
    cca_type: CcaType | "committee";
    description: string;
    points: number;
    can_manage_members: boolean;
    can_rank_members: boolean;
};

export async function GET() {
    try {
        const user = await fetchUserInfo();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const supabase = await createClient();

        // 1. Fetch raw managed_cca_positions from Supabase view
        const { data: managedCcas, error: managedError } = await supabase
            .from("managed_cca_positions")
            .select("*");

        if (managedError) {
            throw managedError;
        }

        if (!managedCcas || managedCcas.length === 0) {
            return NextResponse.json({ data: [] });
        }

        const managedCcaIds = managedCcas.map((row) => row.cca_id);

        // 2. Fetch CCA metadata (description, type) for the UI
        const { data: ccasData, error: ccasError } = await supabase
            .from("ccas")
            .select("id, name, cca_type, description")
            .in("id", managedCcaIds);

        if (ccasError) {
            throw ccasError;
        }

        const ccasById = new Map((ccasData || []).map((cca) => [cca.id, cca]));

        // 3. Transform and extend the data
        const transformedData: ManagedCcaPositionsRow[] = managedCcas.map((managedCca) => {
            const ccaMeta = ccasById.get(managedCca.cca_id);
            const primaryPosition = managedCca.positions?.[0];

            return {
                // Keep the original fields intact
                cca_id: managedCca.cca_id,
                cca_name: managedCca.cca_name,
                positions: managedCca.positions || [],
                
                // Add the flattened fields required by the CCAData table structure
                id: managedCca.cca_id,
                name: managedCca.cca_name || ccaMeta?.name || "Unknown CCA",
                role: primaryPosition?.position_name || "Manager",
                position_type: primaryPosition?.position_type || "",
                cca_type: (ccaMeta?.cca_type as CcaType) || "committee",
                description: ccaMeta?.description ?? "",
                points: 0, // Admin view doesn't need personal points here
                can_manage_members: true, // Always true if it appears in managed_cca_positions
                can_rank_members: true, // Assuming true for admin tables globally
            };
        });

        // Alphabetical sort by CCA name
        transformedData.sort((a, b) => a.name.localeCompare(b.name));

        return NextResponse.json({ data: transformedData });

    } catch (error: any) {
        console.error("Error in getManagedCCAs:", error.message || error);
        return NextResponse.json({ error: "Failed to fetch managed CCAs" }, { status: 500 });
    }
}
