export function canManageCcaMembers(ccaType: string | null | undefined) {
    return ccaType !== "committee";
}

export function getCcaMemberManagementDisabledMessage(ccaType: string | null | undefined) {
    if (ccaType === "committee") {
        return "Committee member management is read-only.";
    }

    return "Member management is not available for this CCA.";
}
