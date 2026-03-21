export function normalizeCutStatusForCca(
    cutStatus: string | null | undefined,
    ccaType: string | null | undefined
) {
    if (!cutStatus) {
        return cutStatus ?? null;
    }

    const normalizedStatus = cutStatus.toLowerCase().trim().replace(/[_\s]+/g, "-");
    const normalizedCcaType = ccaType?.toLowerCase().trim();

    if (!normalizedStatus) {
        return null;
    }

    if (normalizedCcaType === "culture" && normalizedStatus === "ivp-ihg-team") {
        return "first-cut";
    }

    return normalizedStatus;
}
