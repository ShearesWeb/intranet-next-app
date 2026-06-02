// Canonical declaration and status view-model contracts for holiday subsidy

export const SubsidyStatus = {
	PENDING: "pending",
	APPROVED: "approved",
	REJECTED: "rejected",
} as const;

export type SubsidyStatus = (typeof SubsidyStatus)[keyof typeof SubsidyStatus];

export const SUBSIDY_STATUS_CONFIG: Record<SubsidyStatus, { label: string; color: string }> = {
	pending: { label: "Pending", color: "#fbbf24" },
	approved: { label: "Approved", color: "#10b981" },
	rejected: { label: "Rejected", color: "#f87171" },
};

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

// Calendar view model — enriched declaration with CCA info
export interface CalendarDeclaration {
	id: number;
	position_id: number;
	day: string;
	hours: number;
	justification: string | null;
	status: SubsidyStatus;
	rejection_reason: string | null;
	position_name: string;
	position_type: string;
	cca_id: number;
	cca_name: string;
	member_count: number;
	approved_member_count: number;
	pending_member_count: number;
}

// Dot semantics for the calendar
export type SubsidyDotType =
	| "pending"
	| "approved-needs-members"
	| "approved-complete"
	| "rejected";

export const SUBSIDY_DOT_CONFIG: Record<SubsidyDotType, { label: string; color: string }> = {
	pending: { label: "Pending", color: "#fbbf24" },
	"approved-needs-members": { label: "Member Declarations", color: "#3b82f6" },
	"approved-complete": { label: "Complete", color: "#10b981" },
	rejected: { label: "Rejected", color: "#f87171" },
};

// Member assignment row
export interface MemberAssignment {
	user_id: number;
	position_id: number;
	user_subsidy_id: number | null;
	name: string;
	email: string;
	role: string;
	type: string;
	submitted: boolean;
	hours: number;
	override_hours: number | null;
	approved_hours: number;
	comments: string;
	justification: string;
	status: SubsidyStatus | null;
	rejection_reason: string | null;
}
