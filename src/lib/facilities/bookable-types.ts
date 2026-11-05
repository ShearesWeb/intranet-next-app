import { Facility, FacilityType } from "@/types/facilities";

/**
 * Whether chairs may see or claim slots of this venue type on the intranet.
 *
 * Historical non-Sheares rows remain valid data, but only Sheares facilities
 * are exposed as bookable by the application.
 */
export function isBookableFacilityType(type: FacilityType): boolean {
	return type === "sheares";
}

// Product-level exclusions stay effective even when catalog data differs between environments.
const HIDDEN_FACILITY_NAMES = new Set(["dance studio"]);

/** Venues kept off both the Book calendar and the availability editor. */
export function isHiddenFacility(facility: Pick<Facility, "venue" | "sub_venue">): boolean {
	return [facility.venue, facility.sub_venue].some((name) =>
		HIDDEN_FACILITY_NAMES.has(name.trim().toLowerCase()),
	);
}
