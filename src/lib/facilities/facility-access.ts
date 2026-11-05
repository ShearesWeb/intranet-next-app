import { AuthenticatedUser } from "@/types/user";

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
