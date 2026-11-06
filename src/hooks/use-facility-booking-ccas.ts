"use client";

import { useMemo } from "react";
import { useApiQuery } from "@/hooks/use-api-query";
import { useAuth } from "@/lib/auth/auth-context";
import { type BookingCca } from "@/lib/facilities/booking-eligibility";

/** The CCAs the current user may request facilities under. */
export function useFacilityBookingCcas() {
	const { user } = useAuth();
	const { data, error } = useApiQuery<BookingCca[]>("/api/facilities/booking-ccas", {
		enabled: Boolean(user),
		toastOnError: true,
		errorMessage: "Failed to load the CCAs you can book for",
	});
	const bookingCcas = useMemo(() => data ?? [], [data]);

	return {
		bookingCcas,
		canBook: bookingCcas.length > 0,
		ready: data !== undefined || error !== null,
	};
}
