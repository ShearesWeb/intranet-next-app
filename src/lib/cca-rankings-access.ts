import { PositionType, UserAppointment } from "@/types/User";
import { createClient } from "@/utils/supabase/server";

export type RankingAccessPosition = {
    id: UserAppointment["position_id"];
    cca_id: UserAppointment["cca_id"];
    name: UserAppointment["position_name"];
    position_type: PositionType;
};

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
};

export async function listManagedCcaPositions({
    supabase,
}: {
    supabase: Awaited<ReturnType<typeof createClient>>;
}) {
    const { data, error } = await supabase
        .from("managed_cca_positions")
        .select("*");

    if (error) {
        throw error;
    }

    console.log(
        "[managed_cca_positions:list]",
        JSON.stringify(data ?? [], null, 2)
    );

    return (data || []) as ManagedCcaPositionsRow[];
}

export async function getManagedCcaPositions({
    supabase,
    ccaId,
}: {
    supabase: Awaited<ReturnType<typeof createClient>>;
    ccaId: number;
}) {
    const { data, error } = await supabase
        .from("managed_cca_positions")
        .select("*")
        .eq("cca_id", ccaId)
        .maybeSingle();

    if (error) {
        throw error;
    }

    console.log(
        `[managed_cca_positions:get] ccaId=${ccaId}`,
        JSON.stringify(data ?? null, null, 2)
    );

    return (data as ManagedCcaPositionsRow | null) || null;
}

export function getManagedPositionIds(managedCca: ManagedCcaPositionsRow | null | undefined) {
    return managedCca?.positions?.map((position) => position.position_id) || [];
}
