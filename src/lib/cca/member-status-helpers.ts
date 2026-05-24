import type { CutStatus } from "@/types/members";

export const getGroupFromStatus = (status: CutStatus | undefined | null) => {
	switch (status) {
		case "ivp-ihg-team":
			return "ivpIhgTeam";
		case "ihg-team":
			return "ihgTeam";
		case "final-cut":
			return "finalCut";
		case "first-cut":
			return "firstCut";
		default:
			return "members";
	}
};

export const getStatusLabel = (status: CutStatus | undefined | null) => {
	switch (status) {
		case "ivp-ihg-team":
			return "Final Cut - IHG Team Members (IVP)";
		case "ihg-team":
			return "Final Cut - IHG Team Members";
		case "final-cut":
			return "Final Cut Members";
		case "first-cut":
			return "IVP Members";
		default:
			return "Members";
	}
};
