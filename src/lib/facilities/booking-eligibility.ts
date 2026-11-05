import { addDays } from "@/lib/nus-academic-calendar";
import { type AuthenticatedUser, type UserAppointment } from "@/types/user";

/** JCRC's roles are separate CCAs, so they all book under this one. */
export const SHEARES_HALL_CCA_NAME = "Sheares Hall";

/** How many days past today a committee may book. JCRC is held only by the booking weeks. */
export const COMMITTEE_BOOKING_DAYS_AHEAD = 7;

export interface BookingCca {
	id: number;
	name: string;
	/** `committee` for a chair's own committee, `jcrc` for Sheares Hall. */
	kind: "committee" | "jcrc";
}

type BookingUser = Pick<AuthenticatedUser, "appointments">;
type BookingAppointment = Pick<UserAppointment, "cca_kind" | "position_type">;

/**
 * Who may request a facility, and under which CCA.
 *
 * Committee chairs and vice-chairs book under their committee. Sports and culture
 * CCAs cannot book. Everyone in a JCRC-kind leadership seat, including the Sheares
 * Hall positions, books under Sheares Hall. Production models those seats as `lead`
 * and the fixtures as `maincomm`; `blockcomm` is excluded.
 *
 * This is stricter than the `facility_claims` policies, which only require
 * `can_manage_cca` or `is_jcrc`, so the API is what enforces it. Those policies
 * also refuse a committee chair with nobody reporting to them.
 */
export function isCommitteeBookingAppointment(appointment: BookingAppointment): boolean {
	return (
		appointment.cca_kind === "committee" &&
		(appointment.position_type === "lead" || appointment.position_type === "vice")
	);
}

export function isJcrcBookingAppointment(appointment: BookingAppointment): boolean {
	return (
		appointment.cca_kind === "jcrc" &&
		(appointment.position_type === "lead" ||
			appointment.position_type === "vice" ||
			appointment.position_type === "maincomm")
	);
}

/** The committees the user may book under, one entry per committee. */
export function getCommitteeBookingCcas(user: BookingUser): BookingCca[] {
	const ccas = new Map<number, string>();
	for (const appointment of user.appointments) {
		if (isCommitteeBookingAppointment(appointment)) {
			ccas.set(appointment.cca_id, appointment.cca_name);
		}
	}
	return Array.from(ccas, ([id, name]) => ({ id, name, kind: "committee" as const }));
}

export function holdsJcrcBookingSeat(user: BookingUser): boolean {
	return user.appointments.some(isJcrcBookingAppointment);
}

/**
 * Whether this CCA may book `date`, counting from `today` (both YYYY-MM-DD).
 *
 * A committee books at most `COMMITTEE_BOOKING_DAYS_AHEAD` days ahead. Sheares Hall
 * is not limited here, only by the booking weeks every request must also fall in.
 */
export function isWithinCcaBookingLimit(
	cca: Pick<BookingCca, "kind">,
	date: string,
	today: string,
): boolean {
	return cca.kind !== "committee" || date <= addDays(today, COMMITTEE_BOOKING_DAYS_AHEAD);
}

/** "1 week", "2 weeks" or "10 days": how far ahead a booking limit reaches. */
export function formatDayReach(days: number): string {
	if (days % 7 === 0) {
		const weeks = days / 7;
		return weeks === 1 ? "1 week" : `${weeks} weeks`;
	}
	return days === 1 ? "1 day" : `${days} days`;
}
