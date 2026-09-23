import { isReboksBookingEnabled } from "@/lib/feature-flags";
import { FACILITY_TYPE_CONFIG, FacilityType } from "@/types/facilities";

/**
 * Derived from the config record rather than hand-listed so a new member of
 * the `FacilityType` union cannot be forgotten here: `FACILITY_TYPE_CONFIG`
 * is a `Record<FacilityType, …>`, so the compiler already forces every type
 * to appear in it, in catalog display order.
 */
const ALL_FACILITY_TYPES = Object.keys(FACILITY_TYPE_CONFIG) as FacilityType[];

/**
 * Whether chairs may see or claim slots of this venue type on the intranet.
 *
 * Every type except `reboks` is always bookable. `reboks` follows
 * `REBOKS_BOOKING_ENABLED` — see the doc comment on that flag for why. Every
 * flag-dependent surface reads this predicate or `bookableFacilityTypes()`
 * rather than comparing against the literal itself. (The JCRC admin editor
 * excludes REBOKS unconditionally — those venues are bot-owned — so it keeps
 * its own check and does not follow the flag.)
 */
export function isBookableFacilityType(type: FacilityType): boolean {
	return type !== "reboks" || isReboksBookingEnabled();
}

/** The venue types chairs may book, in catalog display order. */
export function bookableFacilityTypes(): FacilityType[] {
	return ALL_FACILITY_TYPES.filter(isBookableFacilityType);
}
