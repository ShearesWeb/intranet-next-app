import { canJcrcAccessCca, getJcrcManagedCcaNamesFromAppointments } from "@/lib/jcrc-cca-access";
import { AuthenticatedUser, CcaType, PositionType, UserAppointment } from "@/types/User";
import { CCAData } from "@/types/dashboard";

type AccessResult<T> =
    | { ok: true; data: T }
    | { ok: false; status: number; error: string };

export type RankingAccessPosition = {
    id: UserAppointment["position_id"];
    cca_id: UserAppointment["cca_id"];
    name: UserAppointment["position_name"];
    position_type: PositionType;
};

export type CcaPositionAccess = RankingAccessPosition & {
    canAccess: boolean;
    canRank: boolean;
};

const COMMITTEE_CHAIR_RANKABLE_POSITION_TYPES = new Set(["maincomm", "blockcomm", "member", "resident"]);
const SPORTS_RANKABLE_POSITION_TYPES = new Set(["teammanager", "member"]);

const getCommitteeFirstWord = (name?: string) => {
    const normalized = (name || "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();

    return normalized.split(" ")[0] || "";
};

const normalizePositionToken = (value?: string) =>
    (value || "").toLowerCase().replace(/[\s_-]+/g, "").trim();

const isChairPositionType = (positionType?: string | null) => {
    const normalized = (positionType || "").toLowerCase().trim();
    return normalized === "lead" || normalized === "vice";
};

const isSportsRankablePosition = (position?: { position_type?: string; name?: string } | null) => {
    if (!position) return false;
    const typeToken = normalizePositionToken(position.position_type);
    return SPORTS_RANKABLE_POSITION_TYPES.has(typeToken);
};

function getAppointmentsByCca(
    requestingUser: Pick<AuthenticatedUser, "appointments"> | null | undefined
) {
    return new Map<number, UserAppointment>(
        (requestingUser?.appointments || []).map((appointment) => [appointment.cca_id, appointment])
    );
}

export function buildManageCcaView({
    requestingUser,
    ccas,
}: {
    requestingUser: Pick<AuthenticatedUser, "appointments"> | null | undefined;
    ccas: Pick<CCAData, "id" | "name" | "cca_type" | "description">[];
}) {
    if (!requestingUser?.appointments?.length) {
        return [] as CCAData[];
    }

    const appointmentsByCca = getAppointmentsByCca(requestingUser);
    const ccasById = new Map<number, Pick<CCAData, "id" | "name" | "cca_type" | "description">>(
        ccas.map((cca) => [cca.id, cca])
    );

    return Array.from(appointmentsByCca.values()).flatMap((appointment) => {
        const cca = ccasById.get(appointment.cca_id);
        const canManageMembers = isChairPositionType(appointment.position_type);
        const canRankMembers =
            canManageMembers ||
            (appointment.position_type === "maincomm" && cca?.cca_type === "committee");

        return [{
            id: appointment.cca_id,
            name: cca?.name || appointment.cca_name,
            role: appointment.position_name,
            position_type: appointment.position_type,
            cca_type: cca?.cca_type || "committee",
            description: cca?.description || "",
            points: appointment.points || 0,
            can_manage_members: canManageMembers,
            can_rank_members: canRankMembers,
        }];
    });
}

export function buildCcaPositionAccess({
    requestingUser,
    cca,
    positions,
}: {
    requestingUser: Pick<AuthenticatedUser, "appointments"> | null | undefined;
    cca: { id: number; cca_type: CcaType | null };
    positions: RankingAccessPosition[];
}) {
    if (!requestingUser?.appointments?.length) {
        return [] as CcaPositionAccess[];
    }

    const appointment = getAppointmentsByCca(requestingUser).get(cca.id);

    if (!appointment) {
        return positions.map((position) => ({
            ...position,
            canAccess: false,
            canRank: false,
        }));
    }

    const isCommittee = cca.cca_type === "committee";
    const isSports = cca.cca_type === "sports";
    const appointmentPositionType = appointment.position_type?.toLowerCase();
    const hasChairRole = isChairPositionType(appointmentPositionType);
    const maincommFirstWord =
        appointmentPositionType === "maincomm"
            ? getCommitteeFirstWord(appointment.position_name)
            : "";
    const matchedSubcommPositionIds = new Set(
        positions
            .filter((position) => position.position_type === "subcomm")
            .filter((position) => getCommitteeFirstWord(position.name) === maincommFirstWord)
            .map((position) => position.id)
    );

    return positions.map((position) => {
        const positionType = (position.position_type || "").toLowerCase();
        const isLeadRankingVice = appointmentPositionType === "lead" && positionType === "vice";

        if (isLeadRankingVice) {
            return {
                ...position,
                canAccess: true,
                canRank: true,
            };
        }

        if (isChairPositionType(positionType)) {
            return {
                ...position,
                canAccess: false,
                canRank: false,
            };
        }

        if (isSports && !isSportsRankablePosition(position)) {
            return {
                ...position,
                canAccess: false,
                canRank: false,
            };
        }

        let canAccess = false;
        let canRank = false;

        if (!isCommittee) {
            canAccess = hasChairRole;
            canRank = hasChairRole;
        } else if (hasChairRole) {
            const isChairRankableCommitteePosition = COMMITTEE_CHAIR_RANKABLE_POSITION_TYPES.has(positionType);
            canAccess = isChairRankableCommitteePosition;
            canRank = isChairRankableCommitteePosition;
        } else {
            const isMatchedSubcomm =
                position.position_type === "subcomm" &&
                matchedSubcommPositionIds.has(position.id);
            canAccess = isMatchedSubcomm;
            canRank = isMatchedSubcomm;
        }

        return {
            ...position,
            canAccess,
            canRank,
        };
    });
}

export function checkCcaAuthorization({
    requestingUser,
    cca,
    positions = [],
    require,
}: {
    requestingUser: Pick<AuthenticatedUser, "id" | "is_admin" | "is_jcrc" | "appointments"> | null | undefined;
    cca?: { id: number; name: string | null; cca_type: CcaType | null } | null;
    positions?: RankingAccessPosition[];
    require?: "chair" | "access" | "rank";
}): AccessResult<{
    userId: number;
    hasChairAccess: boolean;
    authorizedCcaIds: number[];
    jcrcManagedCcaNames: string[];
    canAccess: boolean;
    canRank: boolean;
    requiresPerformance: boolean;
    positions: CcaPositionAccess[];
}> {
    if (!requestingUser) {
        return { ok: false, status: 401, error: "Unauthorized" };
    }

    const appointmentsByCca = getAppointmentsByCca(requestingUser);
    const authorizedCcaIds = Array.from(
        new Set(
            Array.from(appointmentsByCca.values())
                .filter((appointment) => isChairPositionType(appointment.position_type))
                .map((appointment) => appointment.cca_id)
        )
    );
    const jcrcManagedCcaNames = getJcrcManagedCcaNamesFromAppointments(requestingUser);
    const positionAccess = cca ? buildCcaPositionAccess({ requestingUser, cca, positions }) : [];
    const canChairAccess = cca
        ? authorizedCcaIds.includes(cca.id)
        : authorizedCcaIds.length > 0;
    const canAccess = Boolean(
        requestingUser.is_admin ||
        canChairAccess ||
        (cca && canJcrcAccessCca(jcrcManagedCcaNames, cca.name)) ||
        positionAccess.some((position) => position.canAccess)
    );
    const canRank = Boolean(
        requestingUser.is_admin ||
        positionAccess.some((position) => position.canRank)
    );

    if (require === "chair" && !canChairAccess) {
        return { ok: false, status: 403, error: "You are not authorized to manage this CCA" };
    }

    if (require === "access" && !canAccess) {
        return { ok: false, status: 403, error: "You are not authorized to view rankings for this CCA" };
    }

    if (require === "rank" && !canRank) {
        return { ok: false, status: 403, error: "Unauthorized" };
    }

    return {
        ok: true,
        data: {
            userId: requestingUser.id,
            hasChairAccess: canChairAccess,
            authorizedCcaIds,
            jcrcManagedCcaNames,
            canAccess,
            canRank,
            requiresPerformance: cca?.cca_type !== "sports",
            positions: positionAccess,
        },
    };
}
