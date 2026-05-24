// Canonical declaration and status view-model contracts for holiday subsidy

export const SubsidyStatus = {
	PENDING: "pending",
	APPROVED: "approved",
	REJECTED: "rejected",
} as const;

export type SubsidyStatus = (typeof SubsidyStatus)[keyof typeof SubsidyStatus];

export interface SubsidyWithPosition {
	id: number;
	position_id: number;
	day: string; // ISO "YYYY-MM-DD" date (SG-local week-start) — DB stores `day DATE`
	weekId: number; // derived client-side via getWeekIdForDay(day); used by the UI/URL
	hours: number;
	justification: string | null;
	status: SubsidyStatus;
	rejection_reason?: string | null;
	cca_positions?: {
		id: number;
		name: string;
		position_type: string;
		cca_id?: number;
	} | null;
}

export interface PositionOption {
	id: number;
	name: string;
	position_type: string;
}

export interface WeekOption {
	id: number;
	label: string;
}

// Dashboard view model
export interface SubsidyDeclaration {
	id: number;
	positionId: number;
	positionName: string;
	positionType: string;
	weekId: number;
	day: string;
	hours: number;
	justification: string;
	status: SubsidyStatus;
	rejectionReason?: string | null;
}

export interface DeclarationSection {
	key: SubsidyStatus;
	title: string;
	data: SubsidyDeclaration[];
}
