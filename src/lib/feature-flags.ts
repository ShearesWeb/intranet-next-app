/**
 * Compile-time service gates. Changing one requires a code edit + deploy.
 *
 * `pointsRecap` is off outside the end-of-year window: points keep moving until
 * the year closes, so a recap shown in October would be a wrapped-up story
 * about an unfinished year. While it is off the dashboard card invites
 * residents to check back instead of offering a recap to open.
 *
 * `memberRanking` and `holidaySubsidy` are parked pending a schema decision,
 * not retired. Their source is intentionally still in the tree:
 *
 * - `memberRanking` has no backing table at all. The schema refactor dropped
 *   the `evaluations` domain, so `cca_appointment_evaluations` no longer
 *   exists and every read and write in that feature would fail at runtime.
 * - `holidaySubsidy` is excluded from all three changelog masters, so
 *   `cca_subsidies` and `cca_user_subsidies` are absent from a freshly applied
 *   database. The `subsidy/` directory is still in the schema repo, so
 *   restoring it is a one-line change per master — but the app also has to
 *   re-key envelopes from CCA to position first, because authorization now
 *   resolves through the management chain.
 *
 * Turning either back on means doing that work first. See the migration notes
 * on the schema-refactor branch.
 */
const CORE_SERVICE_FLAGS = {
	memberRanking: false,
	ccaApplications: true,
	holidaySubsidy: false,
	facilities: true,
	allocationReveal: true,
	pointsRecap: false,
};

/**
 * Which allocation round the My CCAs reveal is currently showing.
 *
 * Allocation runs in two rounds — maincomm/blockcomm first, subcomm after — and
 * the reveal has to follow, not lead: pointing it at `subcomm` before that round
 * has been allocated would show every resident an empty result. Flip this in the
 * same change that ships the subcomm allocation, and set `allocationReveal` to
 * false outside a reveal window so nobody gets an envelope out of season.
 */
export type AllocationRevealPeriod = "maincomm" | "subcomm";

const ALLOCATION_REVEAL_PERIOD: AllocationRevealPeriod = "subcomm";

export function getAllocationRevealPeriod(): AllocationRevealPeriod {
	return ALLOCATION_REVEAL_PERIOD;
}

export type CoreServiceKey = keyof typeof CORE_SERVICE_FLAGS;
export type CoreServiceFlags = typeof CORE_SERVICE_FLAGS;

export function getCoreServiceFlags(): CoreServiceFlags {
	return CORE_SERVICE_FLAGS;
}

export function getCoreServiceTitle(service: CoreServiceKey) {
	return service
		.replace(/([a-z])([A-Z])/g, "$1 $2")
		.split(" ")
		.map((word) =>
			word.toLowerCase() === "cca" ? "CCA" : word.charAt(0).toUpperCase() + word.slice(1),
		)
		.join(" ");
}

/**
 * Per-role escape hatch on top of the compile-time flag.
 *
 * Deliberately empty while `memberRanking` is parked. The JCRC override used to
 * live here, and reinstating it now would hand JCRC a feature whose table the
 * schema no longer has. Restore the `memberRanking`/`isJcrc` case in the same
 * change that restores the flag.
 */
function isCoreServicePositionOverrideEnabled() {
	return false;
}

export function isCoreServiceEnabled(service: CoreServiceKey) {
	return CORE_SERVICE_FLAGS[service] || isCoreServicePositionOverrideEnabled();
}

export function getCoreServiceDisabledMessage(service: CoreServiceKey) {
	return `${getCoreServiceTitle(service)} is currently disabled.`;
}

export function isFeatureFlaggedItemEnabled(item: { featureFlag?: CoreServiceKey }) {
	return !item.featureFlag || isCoreServiceEnabled(item.featureFlag);
}

export function getCoreServiceDisabledApiResponse(service: CoreServiceKey) {
	if (isCoreServiceEnabled(service)) {
		return null;
	}

	return Response.json(
		{
			error: getCoreServiceDisabledMessage(service),
			service,
		},
		{ status: 503 },
	);
}
