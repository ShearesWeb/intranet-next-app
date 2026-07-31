import type { CommitmentPeriod } from "@/types/members";

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
