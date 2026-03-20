import { checkCcaAuthorization } from "@/lib/cca-chair-access";
import { AuthenticatedUser } from "@/types/User";
import { createClient } from "@/utils/supabase/server";

type AccessResult<T> =
    | { ok: true; data: T }
    | { ok: false; status: number; error: string };

type ManagedCcaAccessRow = {
    cca_id: number;
    cca_name: string | null;
    positions: Array<{
        position_id: number;
    }> | null;
};

export async function getManagedCcaAccess({
    supabase,
    requestingUser,
    cca,
    requireAccess = true,
}: {
    supabase: Awaited<ReturnType<typeof createClient>>;
    requestingUser: Pick<AuthenticatedUser, "id" | "appointments"> | null | undefined;
    cca: { id: number; name?: string | null; cca_type?: string | null };
    requireAccess?: boolean;
}): Promise<AccessResult<{
    hasChairAccess: boolean;
    hasManagedViewAccess: boolean;
    managedPositionIds: number[];
    managedCca: ManagedCcaAccessRow | null;
}>> {
    if (!requestingUser) {
        return { ok: false, status: 401, error: "Unauthorized" };
    }

    const chairAccessResult = checkCcaAuthorization({
        requestingUser,
        cca,
    });

    const { data: managedCca, error } = await supabase
        .from("managed_cca_positions")
        .select("cca_id, cca_name, positions")
        .eq("cca_id", cca.id)
        .maybeSingle();

    if (error) {
        console.error("Error loading managed CCA access:", error);
        return { ok: false, status: 500, error: "Failed to verify access" };
    }

    const managedPositionIds = ((managedCca as ManagedCcaAccessRow | null)?.positions || [])
        .map((position) => position.position_id)
        .filter((positionId): positionId is number => typeof positionId === "number");

    const hasChairAccess = chairAccessResult.ok && chairAccessResult.data.hasChairAccess;
    const hasManagedViewAccess = managedPositionIds.length > 0;

    if (requireAccess && !hasChairAccess && !hasManagedViewAccess) {
        return { ok: false, status: 403, error: "You are not authorized to manage this CCA" };
    }

    return {
        ok: true,
        data: {
            hasChairAccess,
            hasManagedViewAccess,
            managedPositionIds,
            managedCca: (managedCca as ManagedCcaAccessRow | null) || null,
        },
    };
}
