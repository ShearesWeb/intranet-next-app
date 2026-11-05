import { toast } from "sonner";
import { ScheduleCell } from "@/lib/facilities/weekly-availability";
import { ClaimStatus } from "@/types/facilities";

async function send(url: string, method: string, body: unknown, fallback: string): Promise<void> {
	let response: Response;
	try {
		response = await fetch(url, {
			method,
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body),
		});
	} catch {
		throw new Error("Network error — please try again");
	}
	if (!response.ok) {
		const json = (await response.json().catch(() => null)) as { error?: string } | null;
		throw new Error(json?.error ?? fallback);
	}
}

export function errorMessage(error: unknown, fallback: string): string {
	return error instanceof Error ? error.message : fallback;
}

export function requestVenue(input: {
	facilityId: number;
	date: string;
	hours: number[];
	ccaId: number;
}): Promise<void> {
	return send(
		"/api/facilities/claims",
		"POST",
		{ facility_id: input.facilityId, date: input.date, hours: input.hours, cca_id: input.ccaId },
		"Failed to send request",
	);
}

export function withdrawClaims(claimIds: number[]): Promise<void> {
	return send("/api/facilities/claims", "DELETE", { claim_ids: claimIds }, "Failed to withdraw");
}

/** Withdraw a whole merged request and tell the user what happened to it. */
export async function withdrawBooking(booking: {
	claim_ids: number[];
	status: ClaimStatus;
}): Promise<void> {
	await withdrawClaims(booking.claim_ids);
	toast.success(
		booking.status === "approved" ? "Booking cancelled · slot reopened" : "Request withdrawn",
	);
}

export function decideClaims(
	action: "approve" | "reject" | "revoke",
	claimIds: number[],
	competingClaimIds: number[] = [],
): Promise<void> {
	return send(
		"/api/facilities/approvals",
		"POST",
		{ action, claim_ids: claimIds, competing_claim_ids: competingClaimIds },
		"Action failed",
	);
}

export function saveWeeklyHours(
	facilityId: number,
	cells: ScheduleCell[],
	cancelClaimIds: number[],
): Promise<void> {
	return send(
		"/api/facilities/schedules",
		"PUT",
		{ facility_id: facilityId, cells, cancel_claim_ids: cancelClaimIds },
		"Failed to update availability",
	);
}

export function setVenueVisible(facilityId: number, visible: boolean): Promise<void> {
	return send(
		"/api/facilities/schedules",
		"PATCH",
		{ facility_id: facilityId, visible },
		"Failed to update availability",
	);
}
