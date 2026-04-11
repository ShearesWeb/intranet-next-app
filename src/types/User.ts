import { CCAPosition } from "./CCAPosition";

export type PositionType =
	| "lead"
	| "vice"
	| "blockcomm"
	| "maincomm"
	| "subcomm"
	| "team manager"
	| "member"
	| "resident"
	| string;

export type CcaType = "sports" | "culture" | "committee" | string;

export interface UserAppointment extends CCAPosition {
	position_type: PositionType;
	position_name: string;
	points: number;
}

export interface UserRoleFlags {
	is_admin: boolean;
	is_jcrc: boolean;
	is_culture_sports_admin: boolean;
}

export interface AuthenticatedUser extends UserRoleFlags {
	id: number;
	name: string;
	display_name?: string;
	room: string;
	email: string;
	points: number;
	profile_photo_url?: string | null;
	appointments: UserAppointment[];
}

// Maintain backward compatibility for legacy imports
export type User = AuthenticatedUser;
