import type {
	PositionOption,
	SubsidyDeclaration,
	SubsidyStatus,
	SubsidyWithPosition,
} from "@/features/holiday-subsidy/types/declarations";
import { SubsidyStatus as SubsidyStatusValues } from "@/features/holiday-subsidy/types/declarations";

export function buildPositionMap(positions: PositionOption[]): Map<number, PositionOption> {
	return positions.reduce((acc, position) => {
		acc.set(position.id, position);
		return acc;
	}, new Map<number, PositionOption>());
}

export function mapSubsidyToDeclaration(
	subsidy: SubsidyWithPosition,
	positionMap: Map<number, PositionOption>,
): SubsidyDeclaration {
	const joined = Array.isArray(subsidy.cca_positions)
		? subsidy.cca_positions[0]
		: subsidy.cca_positions;
	const position = joined ?? positionMap.get(subsidy.position_id);

	return {
		id: subsidy.id,
		positionId: subsidy.position_id,
		positionName: position?.name || "Unknown Position",
		positionType: position?.position_type || "",
		weekId: subsidy.weekId,
		day: subsidy.day,
		hours: subsidy.hours,
		justification: subsidy.justification || "",
		status: subsidy.status,
		rejectionReason: subsidy.rejection_reason ?? null,
	};
}

export function coerceSubsidyStatus(value: unknown): SubsidyStatus {
	if (typeof value !== "string") return SubsidyStatusValues.PENDING;
	return (Object.values(SubsidyStatusValues) as string[]).includes(value)
		? (value as SubsidyStatus)
		: SubsidyStatusValues.PENDING;
}

export function formatSubsidyStatus(status: SubsidyStatus): string {
	return status.charAt(0).toUpperCase() + status.slice(1);
}
