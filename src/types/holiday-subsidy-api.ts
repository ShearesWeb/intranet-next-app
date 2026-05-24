// Route-facing join contracts for holiday subsidy API handlers
import type { SubsidyStatus } from "@/types/declarations";

export interface JoinedPositionSummary {
	id: number;
	name: string;
	position_type: string;
	cca_id?: number;
}

export interface JoinedUserSummary {
	id: number;
	name: string;
	email: string;
	room?: string | null;
}

export interface AppointmentWithSubsidy {
	user_id: number;
	position_id: number;
	cca_positions: JoinedPositionSummary | JoinedPositionSummary[] | null;
}

export interface MemberWithDeclaration {
	id: number;
	user_id: number;
	position_id: number;
	position_type: string;
	position_name: string;
	user_name: string;
	user_email: string;
	hours: number | null;
	comments: string | null;
	justification?: string | null;
}

export interface UserSubsidyRecord {
	id: number;
	subsidy_id: number;
	user_id: number;
	hours: number | null;
	comments: string | null;
	status: SubsidyStatus | null;
	rejection_reason: string | null;
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
