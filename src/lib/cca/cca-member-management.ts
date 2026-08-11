export function canManageCcaMembers(ccaKind: string | null | undefined) {
	return ccaKind !== "committee";
}

export function getCcaMemberManagementDisabledMessage(ccaKind: string | null | undefined) {
	if (ccaKind === "committee") {
		return "Committee member management is read-only.";
	}

	return "Member management is not available for this CCA.";
}
