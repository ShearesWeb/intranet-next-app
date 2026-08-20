/**
 * Allocation reveal — pure logic behind the "envelope" reveal on My CCAs.
 *
 * Allocation happens in two rounds and the reveal follows the same split:
 *
 * - `maincomm` — maincomm and blockcomm appointments (leads and vices are
 *   maincomm-level roles, so they belong to this round too).
 * - `subcomm` — subcomm appointments. Appointments already revealed in the
 *   maincomm round ride along, flagged `revealedEarlier`, so a resident sees
 *   the full picture without the round-one cards re-animating as news.
 *
 * Which round is live is a compile-time flag (`getAllocationRevealPeriod()`),
 * not data, so the reveal cannot get ahead of the actual allocation run.
 */

import type { AllocationRevealPeriod } from "@/lib/feature-flags";
import type { CCAData } from "@/types/cca-data";
import type { PositionType } from "@/types/user";

/** Position types belonging to each round, in the order they are revealed. */
const PERIOD_POSITION_TYPES: Record<AllocationRevealPeriod, readonly PositionType[]> = {
	maincomm: ["lead", "vice", "maincomm", "blockcomm"],
	subcomm: ["subcomm"],
};

/** Rounds that ran before the given one, earliest first. */
const PRECEDING_PERIODS: Record<AllocationRevealPeriod, readonly AllocationRevealPeriod[]> = {
	maincomm: [],
	subcomm: ["maincomm"],
};

export interface RevealSlot {
	/** `${cca.id}-${cca.role}` — stable across re-renders, unique per appointment. */
	key: string;
	name: string;
	description: string;
	/** Position name, e.g. "Training IC". */
	position: string;
	positionType: PositionType;
	ccaKind: CCAData["cca_kind"];
	points: number;
	/** True for cards carried over from an earlier round. */
	revealedEarlier: boolean;
}

export interface RevealConsolation {
	title: string;
	body: string;
	followUp: string;
	/** The "you're still a shearite" closer — omitted when it would ring hollow. */
	closer: string | null;
}

export interface AllocationReveal {
	period: AllocationRevealPeriod;
	/** Human label for the live round, e.g. "Maincomm & Blockcomm". */
	periodLabel: string;
	/** Cards to animate in, earlier rounds first. Empty when `outcome` is "none". */
	slots: RevealSlot[];
	outcome: "allocated" | "none";
	consolation: RevealConsolation | null;
	/** True when a later round is still to come — drives the "more soon" note. */
	hasLaterRound: boolean;
}

export const PERIOD_LABELS: Record<AllocationRevealPeriod, string> = {
	maincomm: "Maincomm & Blockcomm",
	subcomm: "Subcomm",
};

export function isPositionTypeInPeriod(
	positionType: PositionType,
	period: AllocationRevealPeriod,
): boolean {
	return PERIOD_POSITION_TYPES[period].includes(positionType);
}

function toSlot(cca: CCAData, revealedEarlier: boolean): RevealSlot {
	return {
		key: `${cca.id}-${cca.role}`,
		name: cca.name,
		description: cca.description,
		position: cca.role,
		positionType: cca.position_type,
		ccaKind: cca.cca_kind,
		points: cca.points,
		revealedEarlier,
	};
}

function orderWithinPeriod(period: AllocationRevealPeriod) {
	const order = PERIOD_POSITION_TYPES[period];
	return (a: CCAData, b: CCAData) =>
		order.indexOf(a.position_type) - order.indexOf(b.position_type);
}

function selectForPeriod(ccas: CCAData[], period: AllocationRevealPeriod): CCAData[] {
	return ccas
		.filter((cca) => isPositionTypeInPeriod(cca.position_type, period))
		.sort(orderWithinPeriod(period));
}

function buildConsolation(
	period: AllocationRevealPeriod,
	hadEarlierAllocation: boolean,
): RevealConsolation {
	const closer =
		"You're still very much a part of our hall community, and a precious shearite to all of us. \u{1F9E1}";

	if (period === "maincomm") {
		return {
			title: "No allocations found.",
			body: "We're really sorry you didn't get a maincomm or blockcomm role this time.",
			followUp:
				"There's still a subcomm round ahead! Believe in yourself and show up for more interviews!!",
			closer,
		};
	}

	if (hadEarlierAllocation) {
		return {
			title: "No allocations found.",
			body: "You didn't get any subcomm positions this round.",
			followUp:
				"However, you have already been allocated maincomm and blockcomm appointments from the last round. Congrats again on those!",
			closer: null,
		};
	}

	return {
		title: "No allocations found.",
		body: "You didn't get any subcomm positions.",
		followUp:
			"There are still plenty of other ways to be active in Sheares! Take more culture and sports, your block and level always need you too!",
		closer,
	};
}

/**
 * Turn a resident's appointments into the reveal for the live round.
 *
 * A round with nothing in it is not an error — it is the consolation path, and
 * every resident gets one reveal either way.
 */
export function buildAllocationReveal(
	ccas: CCAData[],
	period: AllocationRevealPeriod,
): AllocationReveal {
	const current = selectForPeriod(ccas, period);
	const earlier = PRECEDING_PERIODS[period].flatMap((earlierPeriod) =>
		selectForPeriod(ccas, earlierPeriod),
	);

	const allocated = current.length > 0;

	return {
		period,
		periodLabel: PERIOD_LABELS[period],
		slots: allocated
			? [...earlier.map((cca) => toSlot(cca, true)), ...current.map((cca) => toSlot(cca, false))]
			: [],
		outcome: allocated ? "allocated" : "none",
		consolation: allocated ? null : buildConsolation(period, earlier.length > 0),
		hasLaterRound: period === "maincomm",
	};
}

/**
 * Per-user, per-round key for "has already watched this".
 *
 * Scoped by user id because a shared browser must not replay one resident's
 * allocation to the next person who logs in — the session-isolation invariant
 * applies to cached UI state too.
 */
export function revealSeenStorageKey(userId: number, period: AllocationRevealPeriod): string {
	return `sheares:allocation-reveal-seen:${userId}:${period}`;
}
