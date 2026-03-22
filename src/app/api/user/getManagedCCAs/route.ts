import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { isChairPositionType } from "@/lib/cca-chair-access";
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

type ChairAppointment = {
    cca_id: number;
    cca_name?: string | null;
    position_name: string;
    position_type: PositionType;
};

export async function GET() {
    try {
        const user = await fetchUserInfo();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const supabase = await createClient();

        const chairAppointments = (user.appointments || []).filter((appointment) =>
            isChairPositionType(appointment.position_type)
        ) as ChairAppointment[];

        const chairAppointmentsByCcaId = new Map<number, ChairAppointment>();
        chairAppointments.forEach((appointment) => {
            if (!chairAppointmentsByCcaId.has(appointment.cca_id)) {
                chairAppointmentsByCcaId.set(appointment.cca_id, appointment);
            }
        });

        // 1. Fetch raw managed_cca_positions from Supabase view
        const { data: managedCcas, error: managedError } = await supabase
            .from("managed_cca_positions")
            .select("*");

        if (managedError) {
            throw managedError;
        }

        const managedCcaRows = managedCcas || [];

        if (!managedCcaRows.length && chairAppointmentsByCcaId.size === 0) {
            return NextResponse.json({ data: [] });
        }

        const managedCcaById = new Map(managedCcaRows.map((row) => [row.cca_id, row]));
        const managedCcaIds = Array.from(
            new Set([
                ...managedCcaRows.map((row) => row.cca_id),
                ...chairAppointmentsByCcaId.keys(),
            ])
        );

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
        const transformedData: ManagedCcaPositionsRow[] = managedCcaIds.map((ccaId) => {
            const managedCca = managedCcaById.get(ccaId);
            const chairAppointment = chairAppointmentsByCcaId.get(ccaId);
            const ccaMeta = ccasById.get(ccaId);
            const managedPositions = managedCca?.positions || [];
            const primaryPosition = chairAppointment || managedPositions[0];
            const hasChairAccess = Boolean(chairAppointment);
            const hasManagedPositions = managedPositions.length > 0;

            return {
                // Keep the original fields intact
                cca_id: ccaId,
                cca_name: managedCca?.cca_name || chairAppointment?.cca_name || ccaMeta?.name || "Unknown CCA",
                positions: managedPositions,
                
                // Add the flattened fields required by the CCAData table structure
                id: ccaId,
                name: managedCca?.cca_name || chairAppointment?.cca_name || ccaMeta?.name || "Unknown CCA",
                role: primaryPosition?.position_name || "Manager",
                position_type: primaryPosition?.position_type || "",
                cca_type: (ccaMeta?.cca_type as CcaType) || "committee",
                description: ccaMeta?.description ?? "",
                points: 0, // Admin view doesn't need personal points here
                can_manage_members: hasChairAccess || hasManagedPositions,
                can_rank_members: hasManagedPositions,
            };
        });

        // Alphabetical sort by CCA name
        transformedData.sort((a, b) => a.name.localeCompare(b.name));

        return NextResponse.json({ data: transformedData });

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : error;
        console.error("Error in getManagedCCAs:", message);
        return NextResponse.json({ error: "Failed to fetch managed CCAs" }, { status: 500 });
    }
}
