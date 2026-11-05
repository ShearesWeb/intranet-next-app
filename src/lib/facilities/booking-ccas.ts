import { ApiError } from "@/lib/api/errors";
import { createClient } from "@/lib/supabase/server";
import { type AuthenticatedUser } from "@/types/user";
import {
	type BookingCca,
	SHEARES_HALL_CCA_NAME,
	getCommitteeBookingCcas,
	holdsJcrcBookingSeat,
} from "./booking-eligibility";

type BookingUser = Pick<AuthenticatedUser, "appointments">;

/**
 * Looked up because most JCRC members hold no Sheares Hall position, so their
 * profile does not carry its id.
 */
async function getShearesHallCca(): Promise<BookingCca> {
	const supabase = await createClient();

	const { data, error } = await supabase
		.from("ccas")
		.select("id, name")
		.eq("name", SHEARES_HALL_CCA_NAME)
		.eq("kind", "jcrc")
		.maybeSingle();

	if (error || !data) {
		console.error("Error loading the Sheares Hall CCA:", error);
		throw new ApiError(500, "Failed to load the CCAs you can book for");
	}

	return data as BookingCca;
}

/** The CCAs the user may request facilities under. */
export async function getBookingCcas(user: BookingUser): Promise<BookingCca[]> {
	const committees = getCommitteeBookingCcas(user);
	if (!holdsJcrcBookingSeat(user)) return committees;
	return [...committees, await getShearesHallCca()];
}

export async function getBookingCcaIds(user: BookingUser): Promise<number[]> {
	return (await getBookingCcas(user)).map((cca) => cca.id);
}

export async function canBookForCca(user: BookingUser, ccaId: number): Promise<boolean> {
	return (await getBookingCcaIds(user)).includes(ccaId);
}
