import type { CommitmentPeriod, CutStatus } from "@/types/members";

export interface CCAMember {
	row_key: string;
	user_id: number;
	name: string;
	position: string;
	position_type: string;
	position_id: number;
	ranking: number;
	remarks: string;
	cut_status?: CutStatus | null;
	commitment_period?: CommitmentPeriod | null;
	attendance: number;
	performance: number;
	helpfulness: number;
	initiative: number;
	attitude: number;
}

export type PositionGroup = {
	position_id: number;
	position: string;
	position_type: string;
	members: CCAMember[];
};

export type RankingSavePayload = {
	user_id: number;
	position_id: number;
	ranking: number;
	attendance: number;
	performance: number;
	helpfulness: number;
	initiative: number;
	attitude: number;
	remarks: string;
};

export type ScoreField = "attendance" | "performance" | "helpfulness" | "initiative" | "attitude";

export const POSITION_TYPE_ORDER: Record<string, number> = {
	lead: 1,
	vice: 2,
	maincomm: 3,
	blockcomm: 4,
	subcomm: 5,
	"team manager": 6,
	member: 7,
	resident: 8,
};

export const MAX_SAVE_PAYLOAD_BYTES = 4_500_000;

export const SCORE_OPTIONS = Array.from({ length: 10 }, (_, index) => index + 1);

export const RESIDENT_METRICS = [
	{ field: "helpfulness", label: "Helpfulness" },
	{ field: "initiative", label: "Initiative" },
	{ field: "attitude", label: "Attitude" },
] as const satisfies ReadonlyArray<{ field: ScoreField; label: string }>;
