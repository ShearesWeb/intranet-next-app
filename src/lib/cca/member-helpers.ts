import type { Period } from "@/types/members";

export function formatPeriod(value: Period | null | undefined): string {
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
