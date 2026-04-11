import { CcaType, PositionType } from "@/types/User";
import { CommitmentPeriod, CutStatus, Member } from "@/types/dashboard";

export interface CcaSummary {
	id: number;
	name: string;
	cca_type: CcaType;
}

export interface MemberPermissions {
	canManageMembers: boolean;
	ccaType: CcaType | "";
	managementMessage: string;
}

export type GroupedMembers = Record<string, Member[]>;

export interface MemberJoinPosition {
	id: number;
	name: string;
	position_type: PositionType;
	cca_id: number;
}

export interface MemberJoinUser {
	id: number;
	name: string;
	email: string;
	room: string;
}

export interface MemberWithJoins {
	user_id: number;
	points: number | null;
	created_at: string;
	cut_status: CutStatus | string | null;
	commitment_period: CommitmentPeriod | null;
	public_user_info: MemberJoinUser | MemberJoinUser[] | null;
	cca_positions: MemberJoinPosition | MemberJoinPosition[] | null;
}

export type MemberUpdate = Partial<{
	cut_status: CutStatus | null;
	commitment_period: CommitmentPeriod;
	comments: string;
}>;
