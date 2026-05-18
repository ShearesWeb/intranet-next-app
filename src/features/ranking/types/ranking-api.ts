import type { PositionType, UserAppointment } from "@/types/User";

export type RankingAccessPosition = {
	id: UserAppointment["position_id"];
	cca_id: UserAppointment["cca_id"];
	name: UserAppointment["position_name"];
	position_type: PositionType;
};

type AppointmentPositionRow = RankingAccessPosition;

type AppointmentUserRow = {
	name: string;
};

export type AppointmentRow = {
	user_id: number;
	cut_status: string | null;
	commitment_period: string | null;
	public_user_info: AppointmentUserRow | AppointmentUserRow[] | null;
	cca_positions: AppointmentPositionRow | AppointmentPositionRow[] | null;
};

export type RankingRow = {
	user_id: number;
	position_id: number;
	scores: unknown | null;
};

export type RankingPayload = {
	user_id: number;
	position_id: number;
	ranking: number;
	attendance: number;
	performance: number;
	helpfulness: number;
	initiative: number;
	attitude: number;
	remarks?: string | null;
};

export type ManagedRankingAccessRow = {
	cca_id: number;
	cca_name: string | null;
	positions: Array<{
		position_id: number;
	}> | null;
};

export type RankingResponseMember = {
	user_id: number;
	name: string;
	position_id: number;
	position: string;
	position_type: string;
	cut_status: string | null;
	commitment_period: string | null;
	ranking: number;
	attendance: number;
	performance: number;
	helpfulness: number;
	initiative: number;
	attitude: number;
	remarks: string | null;
};

export type RankingsApiMember = RankingResponseMember;

export type RankingsApiResponse = {
	members: RankingsApiMember[];
	cca_type?: string | null;
	cca_name?: string | null;
};
