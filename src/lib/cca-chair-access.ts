import { AuthenticatedUser } from "@/types/User";

type AccessResult<T> =
    | { ok: true; data: T }
    | { ok: false; status: number; error: string };

const CHAIR_POSITION_TYPES = new Set(["lead", "vice"]);

export function isChairPositionType(positionType?: string | null) {
    return CHAIR_POSITION_TYPES.has((positionType || "").toLowerCase().trim());
}

export function checkCcaAuthorization({
    requestingUser,
    cca,
    require,
}: {
    requestingUser: Pick<AuthenticatedUser, "id" | "appointments"> | null | undefined;
    cca?: { id: number; name?: string | null; cca_type?: string | null } | null;
    require?: "chair";
}): AccessResult<{
    userId: number;
    hasChairAccess: boolean;
    authorizedCcaIds: number[];
}> {
    if (!requestingUser) {
        return { ok: false, status: 401, error: "Unauthorized" };
    }

    const authorizedCcaIds = Array.from(
        new Set(
            (requestingUser.appointments || [])
                .filter((appointment) => isChairPositionType(appointment.position_type))
                .map((appointment) => appointment.cca_id)
        )
    );
    const hasChairAccess = cca
        ? authorizedCcaIds.includes(cca.id)
        : authorizedCcaIds.length > 0;

    if (require === "chair" && !hasChairAccess) {
        return { ok: false, status: 403, error: "You are not authorized to manage this CCA" };
    }

    return {
        ok: true,
        data: {
            userId: requestingUser.id,
            hasChairAccess,
            authorizedCcaIds,
        },
    };
}

