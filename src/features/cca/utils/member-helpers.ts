import { isChairPositionType } from "@/lib/cca-chair-access";
import type { CommitmentPeriod, CutStatus } from "@/features/cca/types/members";

export { isChairPositionType };

export const SPORTS_STATUS_OPTIONS: Array<{ status: CutStatus; label: string }> = [
	{ status: "ivp-ihg-team", label: "Move to IHG Team (IVP)" },
	{ status: "ihg-team", label: "Move to IHG Team" },
	{ status: "final-cut", label: "Move to Final Cut" },
];

export const CULTURE_STATUS_OPTIONS: Array<{ status: CutStatus; label: string }> = [
	{ status: "first-cut", label: "Promote to IVP" },
];

export function formatCommitmentPeriod(value: CommitmentPeriod | null | undefined): string {
	switch (value) {
		case "semester-1":
			return "Semester 1";
		case "semester-2":
			return "Semester 2";
		case "full-year":
			return "Full Year";
		default:
			return "-";
	}
}

export function getStatusLabel(status: CutStatus): string {
	const all = [...SPORTS_STATUS_OPTIONS, ...CULTURE_STATUS_OPTIONS];
	return all.find((option) => option.status === status)?.label || status;
}
