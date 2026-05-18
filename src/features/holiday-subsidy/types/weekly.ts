// Weekly commitment and approval flow contracts
import type { SubsidyStatus } from "@/features/holiday-subsidy/types/declarations";

export interface WeeklyRow {
	id: number;
	user_id: number;
	position_id: number;
	user_subsidy_id: number | null;
	name: string;
	email: string;
	role: string;
	type: string;
	// Effective hours: per-user override if present, else envelope rate.
	hours: number;
	// Per-user override raw value (may be null for "inherit envelope").
	override_hours: number | null;
	// Envelope rate (always present because the row only renders for approved envelopes).
	approved_hours: number;
	// Chair's per-member note (chair-writable, JCRC + member readable).
	comments: string;
	// Envelope-level chair justification (read-only here).
	justification: string;
	has_approved_subsidy: boolean;
	submitted: boolean;
	status: SubsidyStatus | null;
	rejection_reason: string | null;
}

export type WeeklyApprovalStatus = "pending" | "approved" | "rejected";

export interface WeeklyApprovalRow {
	// SERIAL cca_user_subsidies.id
	id: number;
	user_subsidy_id: number;
	subsidy_id: number;
	user_id: number;
	position_id: number;
	name: string;
	email: string;
	role: string;
	type: string;
	hours: number;
	comments: string;
	justification: string;
	status: WeeklyApprovalStatus;
	rejection_reason: string | null;
}
