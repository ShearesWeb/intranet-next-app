import { AuthenticatedUser } from "@/types/user";
import { isManagingAppointment } from "@/lib/cca/cca-chair-access";

/**
 * CCAs the caller holds a managing position in.
 *
 * A hint for rendering, not an authority: `reporting_position_id` may cross
 * CCAs. The `facility_claims` INSERT policy is the real gate, and it calls
 * `internal.can_manage_cca(cca_id, ...)`.
 */
export function getChairCcaIds(user: AuthenticatedUser): number[] {
	return user.appointments.filter(isManagingAppointment).map((a) => a.cca_id);
}

export function isChairOfCca(user: AuthenticatedUser, ccaId: number): boolean {
	return getChairCcaIds(user).includes(ccaId);
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
