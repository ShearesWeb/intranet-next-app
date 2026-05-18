import { SubsidyStatus } from "@/types/holiday-subsidy";

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
	public_user_info: JoinedUserSummary | JoinedUserSummary[] | null;
}

export interface MemberWithDeclaration {
	id: number;
	user_id: number;
	position_id: number;
	position_type: string;
	position_name: string;
	user_name: string;
	user_email: string;
}

export interface UserSubsidyRecord {
	user_id: number;
	position_id: number;
	hours: number;
	justification: string | null;
	comments: string | null;
	subsidy_status: SubsidyStatus | null;
}

export interface PositionSubsidyRecord {
	id?: number;
	position_id: number;
	week_id?: number;
	hours: number;
	justification: string | null;
	subsidy_status?: SubsidyStatus;
}

export interface PositionWithSubsidies {
	id: number;
	name: string;
	position_type: string;
	cca_id: number;
	subsidies: PositionSubsidyRecord[] | null;
}

export interface WeeklyApprovalSubmission {
	user_id: number;
	position_id: number;
	hours: number;
	justification: string | null;
	comments: string | null;
	subsidy_status: SubsidyStatus | null;
	cca_positions: JoinedPositionSummary | JoinedPositionSummary[] | null;
	public_user_info: JoinedUserSummary | JoinedUserSummary[] | null;
}
