import type { CutStatus } from "@/types/members";

// Single source of truth for the cut-status vocabulary. Each surface reads its
// own label column, so wording can differ per screen without the keys drifting.
const CUT_STATUS_TABLE: Record<
	CutStatus,
	{
		groupKey: "ivpIhgTeam" | "ihgTeam" | "finalCut" | "firstCut";
		groupLabel: string;
		shortLabel: string;
		actionLabel: string;
		ccaType: "sports" | "culture";
	}
> = {
	"ivp-ihg-team": {
		groupKey: "ivpIhgTeam",
		groupLabel: "Final Cut - IHG Team Members (IVP)",
		shortLabel: "IVP & IHG Team",
		actionLabel: "Move to IHG Team (IVP)",
		ccaType: "sports",
	},
	"ihg-team": {
		groupKey: "ihgTeam",
		groupLabel: "Final Cut - IHG Team Members",
		shortLabel: "IHG Team Only",
		actionLabel: "Move to IHG Team",
		ccaType: "sports",
	},
	"final-cut": {
		groupKey: "finalCut",
		groupLabel: "Final Cut Members",
		shortLabel: "Final Cut",
		actionLabel: "Move to Final Cut",
		ccaType: "sports",
	},
	"first-cut": {
		groupKey: "firstCut",
		groupLabel: "IVP Members",
		shortLabel: "IVP",
		actionLabel: "Promote to IVP",
		ccaType: "culture",
	},
};

function optionsFor(ccaType: "sports" | "culture") {
	return (Object.entries(CUT_STATUS_TABLE) as [CutStatus, (typeof CUT_STATUS_TABLE)[CutStatus]][])
		.filter(([, cfg]) => cfg.ccaType === ccaType)
		.map(([status, cfg]) => ({ status, label: cfg.actionLabel }));
}

export const SPORTS_STATUS_OPTIONS = optionsFor("sports");
export const CULTURE_STATUS_OPTIONS = optionsFor("culture");

export function getGroupFromStatus(status: CutStatus | undefined | null) {
	return (status && CUT_STATUS_TABLE[status]?.groupKey) || "members";
}

export function getStatusLabel(status: CutStatus | undefined | null): string {
	return (status && CUT_STATUS_TABLE[status]?.groupLabel) || "Members";
}

/** Compact label for table cells. Tolerates raw DB casing/underscores. */
export function formatCutStatus(status: unknown): string {
	if (typeof status !== "string" || status.trim().length === 0) return "-";

	const normalized = status
		.toLowerCase()
		.trim()
		.replace(/[_\s]+/g, "-") as CutStatus;
	return CUT_STATUS_TABLE[normalized]?.shortLabel ?? status;
}
