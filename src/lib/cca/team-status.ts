import type { TeamStatus } from "@/types/members";

/**
 * Single source of truth for the team-standing vocabulary.
 *
 * Replaces the old `cut_status` table. The schema's `enum.team_status` is
 * declared low to high, so `TEAM_STATUS_ORDER` below doubles as a ranking.
 *
 * Old `cut_status` mapped across as:
 *   ivp-ihg-team -> varsity      (NUS IVP squad, also plays IHG)
 *   ihg-team     -> main-team    (on the hall IHG team sheet)
 *   final-cut    -> reserve      (on the team, not fielded)
 *   first-cut    -> shortlisted  (past the first cut, no team place)
 *   null         -> none
 *
 * The old table split this vocabulary by CCA kind, giving culture a single
 * `first-cut` value labelled "IVP Members". The schema does not make that
 * split, so both kinds now share one ladder. Nothing in the database restricts
 * `team_status` to sports; the contract only says to leave it at `none`
 * elsewhere.
 */
const TEAM_STATUS_TABLE: Record<
	Exclude<TeamStatus, "none">,
	{
		groupKey: "varsity" | "mainTeam" | "reserve" | "shortlisted";
		groupLabel: string;
		shortLabel: string;
		actionLabel: string;
	}
> = {
	varsity: {
		groupKey: "varsity",
		groupLabel: "Varsity - IVP Squad (also plays IHG)",
		shortLabel: "Varsity",
		actionLabel: "Move to Varsity",
	},
	"main-team": {
		groupKey: "mainTeam",
		groupLabel: "Main Team - IHG Team Sheet",
		shortLabel: "Main Team",
		actionLabel: "Move to Main Team",
	},
	reserve: {
		groupKey: "reserve",
		groupLabel: "Reserves - On the Team, Not Fielded",
		shortLabel: "Reserve",
		actionLabel: "Move to Reserve",
	},
	shortlisted: {
		groupKey: "shortlisted",
		groupLabel: "Shortlisted - Past the First Cut",
		shortLabel: "Shortlisted",
		actionLabel: "Move to Shortlisted",
	},
};

/** Declaration order in `enum.team_status`, lowest standing first. */
export const TEAM_STATUS_ORDER: TeamStatus[] = [
	"none",
	"shortlisted",
	"reserve",
	"main-team",
	"varsity",
];

export const TEAM_STATUS_OPTIONS = (
	Object.entries(TEAM_STATUS_TABLE) as [
		Exclude<TeamStatus, "none">,
		(typeof TEAM_STATUS_TABLE)[Exclude<TeamStatus, "none">],
	][]
).map(([status, cfg]) => ({ status, label: cfg.actionLabel }));

function lookup(status: TeamStatus | undefined | null) {
	if (!status || status === "none") return null;
	return TEAM_STATUS_TABLE[status as Exclude<TeamStatus, "none">] ?? null;
}

export function getGroupFromStatus(status: TeamStatus | undefined | null) {
	return lookup(status)?.groupKey ?? "members";
}

export function getStatusLabel(status: TeamStatus | undefined | null): string {
	return lookup(status)?.groupLabel ?? "Members";
}

/** Compact label for table cells. Tolerates raw DB casing/underscores. */
export function formatTeamStatus(status: unknown): string {
	if (typeof status !== "string" || status.trim().length === 0) return "-";

	const normalized = normalizeTeamStatus(status);
	if (!normalized || normalized === "none") return "-";
	return lookup(normalized)?.shortLabel ?? status;
}

/**
 * Coerce a raw value to a `TeamStatus`.
 *
 * Accepts underscores and spaces so a value read straight from Postgres, or
 * carried over from the old `cut_status` vocabulary, still lands correctly.
 */
export function normalizeTeamStatus(status: unknown): TeamStatus | null {
	if (typeof status !== "string") return null;

	const normalized = status
		.toLowerCase()
		.trim()
		.replace(/[_\s]+/g, "-");
	if (!normalized) return null;

	const legacy: Record<string, TeamStatus> = {
		"ivp-ihg-team": "varsity",
		"ihg-team": "main-team",
		"final-cut": "reserve",
		"first-cut": "shortlisted",
	};

	if (normalized in legacy) return legacy[normalized];
	if (TEAM_STATUS_ORDER.includes(normalized as TeamStatus)) return normalized as TeamStatus;
	return null;
}
