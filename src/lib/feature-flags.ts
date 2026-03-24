export const CORE_SERVICE_FLAGS = {
    memberRanking: false,
    ccaApplications: false,
    holidaySubsidy: false,
};

export type CoreServiceKey = keyof typeof CORE_SERVICE_FLAGS;
export type CoreServiceFlags = typeof CORE_SERVICE_FLAGS;
const MEMBER_RANKING_ALLOWED_CCA_NAMES = new Set([
    "president",
    "sheares hall",
]);

export type CoreServiceFlagContext = {
    ccaName?: string | null;
};

export function getCoreServiceFlags(): CoreServiceFlags {
    return CORE_SERVICE_FLAGS;
}

export function getCoreServiceTitle(service: CoreServiceKey) {
    return service
        .replace(/([a-z])([A-Z])/g, "$1 $2")
        .split(" ")
        .map((word) => (word.toLowerCase() === "cca"
            ? "CCA"
            : word.charAt(0).toUpperCase() + word.slice(1)))
        .join(" ");
}

function isCoreServicePositionOverrideEnabled(service: CoreServiceKey, context?: CoreServiceFlagContext) {
    if (service === "memberRanking") {
        const normalizedCcaName = context?.ccaName?.trim().toLowerCase();
        return Boolean(normalizedCcaName && MEMBER_RANKING_ALLOWED_CCA_NAMES.has(normalizedCcaName));
    }

    return false;
}

export function isCoreServiceEnabled(service: CoreServiceKey, context?: CoreServiceFlagContext) {
    return CORE_SERVICE_FLAGS[service] || isCoreServicePositionOverrideEnabled(service, context);
}

export function getCoreServiceDisabledMessage(service: CoreServiceKey) {
    return `${getCoreServiceTitle(service)} is currently disabled.`;
}

export function isFeatureFlaggedItemEnabled(
    item: { featureFlag?: CoreServiceKey },
    context?: CoreServiceFlagContext
) {
    return !item.featureFlag || isCoreServiceEnabled(item.featureFlag, context);
}

export function getCoreServiceDisabledApiResponse(service: CoreServiceKey, context?: CoreServiceFlagContext) {
    if (isCoreServiceEnabled(service, context)) {
        return null;
    }

    return Response.json(
        {
            error: getCoreServiceDisabledMessage(service),
            service,
        },
        { status: 503 }
    );
}
