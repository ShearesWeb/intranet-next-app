import { AuthenticatedUser } from "@/types/user";
import { isManagingAppointment } from "@/lib/cca/cca-chair-access";

/**
 * CCAs the caller holds a managing position in.
 *
 * Not the booking rule, which is `canBookForCca` in `booking-ccas.ts`.
 * A hint for rendering, not an authority: `reporting_position_id` may cross CCAs.
 */
export function getChairCcaIds(user: AuthenticatedUser): number[] {
	return user.appointments.filter(isManagingAppointment).map((a) => a.cca_id);
}

/**
 * Only JCRC may publish schedules or resolve claims.
 *
 * The admin concept is gone from the schema, so JCRC is the whole test now.
 * `facility_schedules` writes and `facility_claims` UPDATE are both gated to
 * `internal.is_jcrc(...)` by policy.
 */
export function canManageFacilities(user: AuthenticatedUser): boolean {
	return user.is_jcrc;
}
