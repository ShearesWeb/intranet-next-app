import type { ScoreField } from "@/types/ranking";

export const POSITION_TYPE_ORDER: Record<string, number> = {
	lead: 1,
	vice: 2,
	maincomm: 3,
	blockcomm: 4,
	subcomm: 5,
	"team-manager": 6,
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
