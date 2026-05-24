// Route-facing join contracts for holiday subsidy API handlers
import type { SubsidyStatus } from "@/types/declarations";

export interface JoinedPositionSummary {
	id: number;
	name: string;
	position_type: string;
	cca_id?: number;
}

export interface PositionSubsidyRecord {
	id: number;
	position_id: number;
	day: string;
	hours: number;
	justification: string | null;
	status: SubsidyStatus;
	rejection_reason?: string | null;
}

export interface PositionWithSubsidies {
	id: number;
	name: string;
	position_type: string;
	cca_id: number;
	cca_subsidies: PositionSubsidyRecord[] | null;
}

export interface WeeklyApprovalSubmission {
	id: number;
	subsidy_id: number;
	user_id: number;
	hours: number | null;
	comments: string | null;
	status: SubsidyStatus | null;
	rejection_reason: string | null;
	cca_subsidies: {
		id: number;
		position_id: number;
		day: string;
		hours: number;
		justification: string | null;
		cca_positions: JoinedPositionSummary | JoinedPositionSummary[] | null;
	} | null;
}
