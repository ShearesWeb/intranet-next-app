import { requireAuth } from "@/lib/api/auth";
import { apiOk, apiError, handleApiError } from "@/lib/api/response";
import { getCoreServiceDisabledApiResponse } from "@/lib/feature-flags";
import {
	getClaimsForCcas,
	createClaim,
	createClaims,
	deleteClaims,
	getClaimOwners,
} from "@/lib/facilities/facility-claims";
import { canBookForCca, getBookingCcaIds } from "@/lib/facilities/booking-ccas";
import { canManageFacilities } from "@/lib/facilities/facility-access";
import { getFacilityType } from "@/lib/facilities/facility-catalog";
import { getSingaporeDateKey, isWithinBookingWindow } from "@/lib/nus-academic-calendar";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

/** Every claim of the CCAs the caller may book for. */
export async function GET() {
	const disabledResponse = getCoreServiceDisabledApiResponse("facilities");
	if (disabledResponse) return disabledResponse;

	try {
		const user = await requireAuth();
		const bookingCcaIds = await getBookingCcaIds(user);
		if (bookingCcaIds.length === 0) return apiOk([]);
		const claims = await getClaimsForCcas(bookingCcaIds);
		return apiOk(claims.filter((claim) => claim.facility_type === "sheares"));
	} catch (e) {
		return handleApiError(e);
	}
}

export async function POST(req: NextRequest) {
	const disabledResponse = getCoreServiceDisabledApiResponse("facilities");
	if (disabledResponse) return disabledResponse;

	try {
		const user = await requireAuth();
		const { facility_id, date, hour, hours, cca_id } = await req.json();
		const requestedHours: number[] = Array.isArray(hours)
			? [...new Set<number>(hours)]
			: hour != null
				? [hour]
				: [];

		if (facility_id == null || !date || requestedHours.length === 0 || cca_id == null) {
			return apiError("facility_id, date, hour and cca_id are required", 400);
		}
		if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
			return apiError("date must use YYYY-MM-DD format", 400);
		}
		if (requestedHours.some((value) => !Number.isInteger(value) || value < 0 || value > 23)) {
			return apiError("hour must be 0–23", 400);
		}
		if (!(await canBookForCca(user, cca_id))) {
			return apiError("Not authorized to claim for this CCA", 403);
		}
		if (date < getSingaporeDateKey()) {
			return apiError("Past facility slots cannot be booked", 403);
		}

		if (!isWithinBookingWindow(date)) {
			return apiError(
				"Facilities can only be booked up to 4 weeks ahead, during the NUS semester",
				403,
			);
		}

		// The DB checks that a schedule actually publishes the slot.
		// Read the type from the database so a hand-rolled request cannot bypass
		// the Sheares-only booking boundary. This applies to JCRC callers too.
		const type = await getFacilityType(facility_id);
		if (type !== "sheares") {
			return apiError("Only Sheares facilities can be booked", 403);
		}

		if (Array.isArray(hours)) {
			return apiOk(await createClaims(facility_id, date, requestedHours, cca_id, user.id), 201);
		}
		return apiOk(await createClaim(facility_id, date, requestedHours[0], cca_id, user.id), 201);
	} catch (e) {
		return handleApiError(e);
	}
}

/** Withdraw a whole multi-hour request in one go. */
export async function DELETE(req: NextRequest) {
	const disabledResponse = getCoreServiceDisabledApiResponse("facilities");
	if (disabledResponse) return disabledResponse;

	try {
		const user = await requireAuth();
		const { claim_ids } = await req.json();

		if (!Array.isArray(claim_ids) || claim_ids.length === 0) {
			return apiError("claim_ids is required", 400);
		}

		const distinct = [...new Set<number>(claim_ids)];
		const owners = await getClaimOwners(distinct);
		if (owners.length !== distinct.length) return apiError("Claim not found", 404);
		if (!canManageFacilities(user)) {
			const bookingCcaIds = await getBookingCcaIds(user);
			if (!owners.every((claim) => bookingCcaIds.includes(claim.cca_id))) {
				return apiError("Not authorized to modify these claims", 403);
			}
		}

		await deleteClaims(distinct);
		return apiOk({ success: true });
	} catch (e) {
		return handleApiError(e);
	}
}
