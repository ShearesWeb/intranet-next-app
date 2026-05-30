import type { CCAData } from "@/types/cca-data";
import { isResidentPositionType } from "@/lib/ranking/cca-ranking-metrics";

const leadershipPositionTypes = new Set(["lead", "vice", "maincomm", "subcomm"]);

export function isLeadershipRole(cca: Pick<CCAData, "position_type" | "role">) {
	const positionType = String(cca.position_type || "")
		.trim()
		.toLowerCase();
	const role = String(cca.role || "")
		.trim()
		.toLowerCase();

	return (
		leadershipPositionTypes.has(positionType) || role.includes("lead") || role.includes("vice")
	);
}

export function isBlockCcaName(value?: string | null) {
	return String(value || "")
		.trim()
		.toLowerCase()
		.startsWith("block");
}

export function isResidentBlockPosition(positionType?: string | null, role?: string | null) {
	return (
		isResidentPositionType(positionType) ||
		String(role || "")
			.trim()
			.toLowerCase() === "resident"
	);
}
