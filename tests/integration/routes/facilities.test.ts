import { describe, expect, it } from "vitest";
import { asPersona, ccaIdByName, jsonRequest, makeRequest, readJson } from "../helpers";
import { pgPool } from "../setup";

// GET /api/facilities/claims — chair-scoped facility claims.
describe("GET /api/facilities/claims", () => {
	it("returns claims (empty baseline) for a chair", async () => {
		asPersona("declan");
		const { GET } = await import("@/app/api/facilities/claims/route");
		const { status, data } = await readJson<unknown[]>(
			await GET(makeRequest("/api/facilities/claims")),
		);
		expect(status).toBe(200);
		expect(Array.isArray(data)).toBe(true);
	});

	it("401s for anonymous", async () => {
		asPersona("anonymous");
		const { GET } = await import("@/app/api/facilities/claims/route");
		expect((await readJson(await GET(makeRequest("/api/facilities/claims")))).status).toBe(401);
	});
});

// GET /api/facilities/bookings — authenticated dated-slot listing.
describe("GET /api/facilities/bookings", () => {
	it("returns an empty list when start/end are omitted", async () => {
		asPersona("aria");
		const { GET } = await import("@/app/api/facilities/bookings/route");
		const { status, data } = await readJson<unknown[]>(
			await GET(makeRequest("/api/facilities/bookings")),
		);
		expect(status).toBe(200);
		expect(data).toEqual([]);
	});

	it("returns bookings for a date range", async () => {
		asPersona("declan");
		const { GET } = await import("@/app/api/facilities/bookings/route");
		const { status, data } = await readJson<unknown[]>(
			await GET(makeRequest("/api/facilities/bookings?start=2026-01-01&end=2026-01-31")),
		);
		expect(status).toBe(200);
		expect(Array.isArray(data)).toBe(true);
	});

	it("401s for anonymous", async () => {
		asPersona("anonymous");
		const { GET } = await import("@/app/api/facilities/bookings/route");
		expect(
			(
				await readJson(
					await GET(makeRequest("/api/facilities/bookings?start=2026-01-01&end=2026-01-31")),
				)
			).status,
		).toBe(401);
	});
});

// GET /api/facilities/catalog — venue catalog.
describe("GET /api/facilities/catalog", () => {
	it("returns the facility catalog for an authenticated user", async () => {
		asPersona("aria");
		const { GET } = await import("@/app/api/facilities/catalog/route");
		const { status, data } = await readJson<unknown[]>(
			await GET(makeRequest("/api/facilities/catalog")),
		);
		expect(status).toBe(200);
		expect(Array.isArray(data)).toBe(true);
	});
});

// Helpers for the approval-flow tests below.
function dateFromToday(n: number): string {
	const d = new Date();
	d.setDate(d.getDate() + n);
	const m = String(d.getMonth() + 1).padStart(2, "0");
	const day = String(d.getDate()).padStart(2, "0");
	return `${d.getFullYear()}-${m}-${day}`;
}

// Facilities aren't part of the per-test reseed, so give each call a unique sub-venue.
let facilitySeq = 0;
async function createFacility(): Promise<number> {
	asPersona("sage");
	const { POST } = await import("@/app/api/facilities/catalog/route");
	const { status, data } = await readJson<{ id: number }>(
		await POST(jsonRequest("/api/facilities/catalog", "POST", {
			type: "nus",
			venue: "UTown",
			sub_venue: `Dance Studio ${Date.now()}-${facilitySeq++}`,
		})),
	);
	expect(status).toBe(201);
	return data.id;
}

async function createBookingSlot(facilityId: number, bookedDate: string): Promise<number> {
	asPersona("sage");
	const { POST } = await import("@/app/api/facilities/bookings/route");
	const { status, data } = await readJson<{ id: number }>(
		await POST(jsonRequest("/api/facilities/bookings", "POST", {
			facility_id: facilityId,
			booked_date: bookedDate,
			hour: 18,
		})),
	);
	expect(status).toBe(201);
	return data.id;
}

async function bookingStatus(bookingId: number): Promise<string> {
	const r = await pgPool.query("SELECT status FROM facility_bookings WHERE id = $1", [bookingId]);
	return r.rows[0].status as string;
}

// Full JCRC approval lifecycle: claim → pending → approve → confirmed → revoke → available.
describe("facilities approval flow", () => {
	it("routes every claim through JCRC approval and supports revocation", async () => {
		const facilityId = await createFacility();
		const bookingId = await createBookingSlot(facilityId, dateFromToday(10));
		const ccaId = await ccaIdByName("Volleyball");

		// Chair claims → booking goes pending (not confirmed).
		asPersona("declan");
		const claims = await import("@/app/api/facilities/claims/route");
		const claimRes = await readJson<{ id: number }>(
			await claims.POST(
				jsonRequest("/api/facilities/claims", "POST", { booking_id: bookingId, cca_id: ccaId }),
			),
		);
		expect(claimRes.status).toBe(201);
		expect(await bookingStatus(bookingId)).toBe("pending");

		// The single uncontested claim still shows in the JCRC queue.
		asPersona("sage");
		const approvals = await import("@/app/api/facilities/approvals/route");
		const queue = await readJson<{
			pending: { booking: { id: number }; claimants: { claim: { id: number } }[] }[];
			confirmed: { booking: { id: number } }[];
		}>(await approvals.GET());
		expect(queue.status).toBe(200);
		const entry = queue.data.pending.find((p) => p.booking.id === bookingId);
		expect(entry).toBeTruthy();
		expect(entry!.claimants).toHaveLength(1);

		// Approve → confirmed and listed under upcoming confirmed.
		const approveRes = await readJson(
			await approvals.POST(
				jsonRequest("/api/facilities/approvals", "POST", {
					action: "approve",
					booking_id: bookingId,
					winning_claim_id: entry!.claimants[0].claim.id,
				}),
			),
		);
		expect(approveRes.status).toBe(200);
		expect(await bookingStatus(bookingId)).toBe("confirmed");

		const queue2 = await readJson<{ confirmed: { booking: { id: number } }[] }>(
			await approvals.GET(),
		);
		expect(queue2.data.confirmed.some((c) => c.booking.id === bookingId)).toBe(true);

		// Revoke → the trigger rolls the booking back to available.
		const revokeRes = await readJson(
			await approvals.POST(
				jsonRequest("/api/facilities/approvals", "POST", {
					action: "revoke",
					booking_id: bookingId,
				}),
			),
		);
		expect(revokeRes.status).toBe(200);
		expect(await bookingStatus(bookingId)).toBe("available");
	});

	it("reject clears all pending claims and reopens the slot", async () => {
		const facilityId = await createFacility();
		const bookingId = await createBookingSlot(facilityId, dateFromToday(10));
		const ccaId = await ccaIdByName("Volleyball");

		asPersona("declan");
		const claims = await import("@/app/api/facilities/claims/route");
		await claims.POST(
			jsonRequest("/api/facilities/claims", "POST", { booking_id: bookingId, cca_id: ccaId }),
		);

		asPersona("sage");
		const approvals = await import("@/app/api/facilities/approvals/route");
		const res = await readJson(
			await approvals.POST(
				jsonRequest("/api/facilities/approvals", "POST", {
					action: "reject",
					booking_id: bookingId,
				}),
			),
		);
		expect(res.status).toBe(200);
		expect(await bookingStatus(bookingId)).toBe("available");
	});

	it("403s the approvals queue for non-JCRC users", async () => {
		asPersona("declan");
		const approvals = await import("@/app/api/facilities/approvals/route");
		expect((await readJson(await approvals.GET())).status).toBe(403);
	});
});

// The 3-day hard gate on claims.
describe("facilities booking lead-time gate", () => {
	it("rejects claims on slots within 3 days of the date", async () => {
		const facilityId = await createFacility();
		const bookingId = await createBookingSlot(facilityId, dateFromToday(1));
		const ccaId = await ccaIdByName("Volleyball");

		asPersona("declan");
		const claims = await import("@/app/api/facilities/claims/route");
		const res = await readJson(
			await claims.POST(
				jsonRequest("/api/facilities/claims", "POST", { booking_id: bookingId, cca_id: ccaId }),
			),
		);
		expect(res.status).toBe(403);
		expect(await bookingStatus(bookingId)).toBe("available");
	});

	it("accepts claims exactly at the 3-day boundary", async () => {
		const facilityId = await createFacility();
		const bookingId = await createBookingSlot(facilityId, dateFromToday(3));
		const ccaId = await ccaIdByName("Volleyball");

		asPersona("declan");
		const claims = await import("@/app/api/facilities/claims/route");
		const res = await readJson(
			await claims.POST(
				jsonRequest("/api/facilities/claims", "POST", { booking_id: bookingId, cca_id: ccaId }),
			),
		);
		expect(res.status).toBe(201);
	});
});

// Schedule date bounds drive materialisation.
describe("facilities schedule date bounds", () => {
	it("materialises bookings only inside the schedule's start/end dates", async () => {
		const facilityId = await createFacility();
		const startDate = dateFromToday(7);
		const endDate = dateFromToday(13);
		const dayOfWeek = new Date(startDate + "T00:00:00").getDay();

		asPersona("sage");
		const schedules = await import("@/app/api/facilities/schedules/route");
		const createRes = await readJson(
			await schedules.POST(
				jsonRequest("/api/facilities/schedules", "POST", {
					facility_id: facilityId,
					day_of_week: dayOfWeek,
					hour: 20,
					start_date: startDate,
					end_date: endDate,
				}),
			),
		);
		expect(createRes.status).toBe(201);

		const materialize = await import("@/app/api/facilities/bookings/materialize/route");
		expect((await readJson(await materialize.POST())).status).toBe(200);

		// The 8-week horizon holds several matching weekdays; the bounds keep exactly one.
		const r = await pgPool.query(
			"SELECT booked_date::text FROM facility_bookings WHERE facility_id = $1 AND hour = 20",
			[facilityId],
		);
		expect(r.rows.map((row) => row.booked_date)).toEqual([startDate]);
	});
});

// Withdrawal deletes the claim row so the slot reopens and can be re-claimed.
describe("facilities claim withdrawal", () => {
	it("removes the claim, reopens the booking, and allows a fresh claim", async () => {
		const facilityId = await createFacility();
		const bookingId = await createBookingSlot(facilityId, dateFromToday(10));
		const ccaId = await ccaIdByName("Volleyball");

		asPersona("declan");
		const claims = await import("@/app/api/facilities/claims/route");
		const first = await readJson<{ id: number }>(
			await claims.POST(
				jsonRequest("/api/facilities/claims", "POST", { booking_id: bookingId, cca_id: ccaId }),
			),
		);
		expect(first.status).toBe(201);

		const claimRoute = await import("@/app/api/facilities/claims/[id]/route");
		const del = await readJson(
			await claimRoute.DELETE(
				jsonRequest(`/api/facilities/claims/${first.data.id}`, "DELETE"),
				{ params: Promise.resolve({ id: String(first.data.id) }) },
			),
		);
		expect(del.status).toBe(200);

		// Row gone, booking back to available.
		const rows = await pgPool.query("SELECT id FROM facility_claims WHERE booking_id = $1", [
			bookingId,
		]);
		expect(rows.rows).toHaveLength(0);
		expect(await bookingStatus(bookingId)).toBe("available");

		// Same CCA can claim the same slot again — no unique-constraint ghost.
		const second = await readJson(
			await claims.POST(
				jsonRequest("/api/facilities/claims", "POST", { booking_id: bookingId, cca_id: ccaId }),
			),
		);
		expect(second.status).toBe(201);
	});
});
