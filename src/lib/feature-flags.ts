export const CORE_SERVICE_FLAGS = {
    memberRanking: true,
    ccaApplications: false,
    holidaySubsidy: false,
};

export type CoreServiceKey = keyof typeof CORE_SERVICE_FLAGS;
export type CoreServiceFlags = typeof CORE_SERVICE_FLAGS;

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

export function isCoreServiceEnabled(service: CoreServiceKey) {
    return CORE_SERVICE_FLAGS[service];
}

export function getCoreServiceDisabledMessage(service: CoreServiceKey) {
    return `${getCoreServiceTitle(service)} is currently disabled.`;
}

export function isFeatureFlaggedItemEnabled(item: { featureFlag?: CoreServiceKey }) {
    return !item.featureFlag || isCoreServiceEnabled(item.featureFlag);
}

export function getCoreServiceDisabledApiResponse(service: CoreServiceKey) {
    if (isCoreServiceEnabled(service)) {
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
