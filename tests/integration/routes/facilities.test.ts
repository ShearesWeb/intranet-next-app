import { beforeEach, describe, expect, it, vi } from "vitest";
import { addDays, getSingaporeDateKey } from "@/lib/nus-academic-calendar";
import { asPersona, ccaIdByName, jsonRequest, makeRequest, readJson } from "../helpers";
import { pgPool } from "../setup";
import type { PersonaKey } from "../../fixtures/types";
import type { FacilityType } from "@/types/facilities";

// The real window closes outside NUS teaching weeks, which would fail these tests
// for months of the year. Hold it open, and close it only to test that refusal.
const bookingWindow = vi.hoisted(() => ({ open: true }));

vi.mock("@/lib/nus-academic-calendar", async (importOriginal) => ({
	...(await importOriginal<typeof import("@/lib/nus-academic-calendar")>()),
	isWithinBookingWindow: () => bookingWindow.open,
}));

beforeEach(() => {
	bookingWindow.open = true;
});

function dateFromToday(days: number): string {
	return addDays(getSingaporeDateKey(), days);
}

// The app has no create-facility route — the catalog is seeded outside it — so
// insert directly. Facilities aren't part of the per-test reseed, so give each
// call a unique sub-venue.
let facilitySeq = 0;
async function createFacility(type: FacilityType = "sheares"): Promise<number> {
	const r = await pgPool.query(
		`INSERT INTO facilities (type, venue, sub_venue) VALUES ($1, 'Test Hall', $2) RETURNING id`,
		[type, `Test Court ${Date.now()}-${facilitySeq++}`],
	);
	return r.rows[0].id as number;
}

/**
 * Publish a schedule so the slot on `slotDate` at `hour` exists.
 *
 * Slots are computed, not stored, so there is nothing to create directly: a
 * schedule row for the matching weekday is what makes the slot bookable.
 */
async function publishSlot(facilityId: number, slotDate: string, hour = 18): Promise<void> {
	asPersona("sage");
	const { POST } = await import("@/app/api/facilities/schedules/route");
	const { status } = await readJson(
		await POST(
			jsonRequest("/api/facilities/schedules", "POST", {
				facility_id: facilityId,
				day_of_week: new Date(slotDate + "T00:00:00").getDay(),
				hour,
				start_date: slotDate,
				end_date: slotDate,
			}),
		),
	);
	expect(status).toBe(201);
}

/** Derived slot status, straight from the function the calendar uses. */
async function slotStatus(facilityId: number, slotDate: string, hour = 18): Promise<string> {
	const r = await pgPool.query(
		`SELECT status::text FROM facility_slots($1::date, $1::date)
		 WHERE facility_id = $2 AND hour = $3`,
		[slotDate, facilityId, hour],
	);
	return r.rows[0]?.status as string;
}

describe("GET /api/facilities/claims", () => {
	it("returns claims (empty baseline) for a chair", async () => {
		asPersona("layla");
		const { GET } = await import("@/app/api/facilities/claims/route");
		const { status, data } = await readJson<unknown[]>(await GET());
		expect(status).toBe(200);
		expect(Array.isArray(data)).toBe(true);
	});

	it("401s for anonymous", async () => {
		asPersona("anonymous");
		const { GET } = await import("@/app/api/facilities/claims/route");
		expect((await readJson(await GET())).status).toBe(401);
	});
});

describe("GET /api/facilities/slots", () => {
	it("400s when start/end are omitted", async () => {
		asPersona("layla");
		const { GET } = await import("@/app/api/facilities/slots/route");
		expect((await readJson(await GET(makeRequest("/api/facilities/slots")))).status).toBe(400);
	});

	it("returns computed slots for a date range", async () => {
		const facilityId = await createFacility();
		const slotDate = dateFromToday(10);
		await publishSlot(facilityId, slotDate);

		asPersona("layla");
		const { GET } = await import("@/app/api/facilities/slots/route");
		const { status, data } = await readJson<Array<{ facility_id: number; status: string }>>(
			await GET(makeRequest(`/api/facilities/slots?start=${slotDate}&end=${slotDate}`)),
		);
		expect(status).toBe(200);
		expect(data.some((s) => s.facility_id === facilityId && s.status === "available")).toBe(true);
	});

	it("rejects a window wider than the 366-day cap", async () => {
		asPersona("layla");
		const { GET } = await import("@/app/api/facilities/slots/route");
		const res = await readJson(
			await GET(
				makeRequest(`/api/facilities/slots?start=${dateFromToday(0)}&end=${dateFromToday(400)}`),
			),
		);
		expect(res.status).toBe(400);
	});

	it("401s for anonymous", async () => {
		asPersona("anonymous");
		const { GET } = await import("@/app/api/facilities/slots/route");
		const res = await readJson(
			await GET(makeRequest("/api/facilities/slots?start=2026-09-01&end=2026-09-02")),
		);
		expect(res.status).toBe(401);
	});
});

describe("GET /api/facilities/catalog", () => {
	it("returns the facility catalog for an authenticated user", async () => {
		asPersona("layla");
		const { GET } = await import("@/app/api/facilities/catalog/route");
		const { status, data } = await readJson<unknown[]>(await GET());
		expect(status).toBe(200);
		expect(Array.isArray(data)).toBe(true);
	});
});

// Full JCRC approval lifecycle: claim → pending → approve → confirmed → revoke → available.
describe("facilities approval flow", () => {
	it("routes every claim through JCRC approval and supports revocation", async () => {
		const facilityId = await createFacility();
		const slotDate = dateFromToday(5);
		await publishSlot(facilityId, slotDate);
		const ccaId = await ccaIdByName("SHWEB");

		asPersona("layla");
		const claims = await import("@/app/api/facilities/claims/route");
		const claimRes = await readJson<{ id: number }>(
			await claims.POST(
				jsonRequest("/api/facilities/claims", "POST", {
					facility_id: facilityId,
					date: slotDate,
					hour: 18,
					cca_id: ccaId,
				}),
			),
		);
		expect(claimRes.status).toBe(201);
		expect(await slotStatus(facilityId, slotDate)).toBe("pending");

		asPersona("sage");
		const approvals = await import("@/app/api/facilities/approvals/route");
		const queue = await readJson<{
			pending: Array<{
				slot: { facility_id: number; date: string; hour: number };
				claimants: Array<{ claim: { claim_id: number } }>;
			}>;
		}>(await approvals.GET());
		expect(queue.status).toBe(200);
		const entry = queue.data.pending.find(
			(p) => p.slot.facility_id === facilityId && p.slot.date === slotDate,
		);
		expect(entry).toBeTruthy();
		expect(entry!.claimants).toHaveLength(1);

		const approveRes = await readJson(
			await approvals.POST(
				jsonRequest("/api/facilities/approvals", "POST", {
					action: "approve",
					claim_id: entry!.claimants[0].claim.claim_id,
					competing_claim_ids: entry!.claimants.map((c) => c.claim.claim_id),
				}),
			),
		);
		expect(approveRes.status).toBe(200);
		expect(await slotStatus(facilityId, slotDate)).toBe("confirmed");

		const queue2 = await readJson<{
			confirmed: Array<{ slot: { facility_id: number }; claim_id: number }>;
		}>(await approvals.GET());
		const confirmed = queue2.data.confirmed.find((c) => c.slot.facility_id === facilityId);
		expect(confirmed).toBeTruthy();

		// Revoking deletes the claim — there is no cancelled status — so the slot reopens.
		const revokeRes = await readJson(
			await approvals.POST(
				jsonRequest("/api/facilities/approvals", "POST", {
					action: "revoke",
					claim_id: confirmed!.claim_id,
				}),
			),
		);
		expect(revokeRes.status).toBe(200);
		expect(await slotStatus(facilityId, slotDate)).toBe("available");
	});

	it("reject clears the claim and reopens the slot", async () => {
		const facilityId = await createFacility();
		const slotDate = dateFromToday(5);
		await publishSlot(facilityId, slotDate);
		const ccaId = await ccaIdByName("SHWEB");

		asPersona("layla");
		const claims = await import("@/app/api/facilities/claims/route");
		const created = await readJson<{ id: number }>(
			await claims.POST(
				jsonRequest("/api/facilities/claims", "POST", {
					facility_id: facilityId,
					date: slotDate,
					hour: 18,
					cca_id: ccaId,
				}),
			),
		);
		expect(created.status).toBe(201);

		asPersona("sage");
		const approvals = await import("@/app/api/facilities/approvals/route");
		const res = await readJson(
			await approvals.POST(
				jsonRequest("/api/facilities/approvals", "POST", {
					action: "reject",
					claim_ids: [created.data.id],
				}),
			),
		);
		expect(res.status).toBe(200);
		// A rejected claim is not live, so the slot is available again.
		expect(await slotStatus(facilityId, slotDate)).toBe("available");
	});

	it("403s the approvals queue for non-JCRC users", async () => {
		asPersona("layla");
		const approvals = await import("@/app/api/facilities/approvals/route");
		expect((await readJson(await approvals.GET())).status).toBe(403);
	});
});

describe("GET /api/facilities/booking-ccas", () => {
	it.each<[PersonaKey, string[]]>([
		["layla", ["SHWEB"]],
		["brielle", ["Sheares Hall"]],
		["sage", ["Sheares Hall"]],
		["declan", []],
		["kai", []],
		["ezra", []],
		["jasper", []],
		["aria", []],
	])("lists what %s may book under", async (persona, names) => {
		asPersona(persona);
		const { GET } = await import("@/app/api/facilities/booking-ccas/route");
		const { status, data } = await readJson<Array<{ name: string }>>(await GET());
		expect(status).toBe(200);
		expect(data.map((cca) => cca.name)).toEqual(names);
	});
});

describe("facilities booking eligibility", () => {
	it.each<[PersonaKey, string]>([
		["declan", "Volleyball"],
		["alexis", "Volleyball"],
		["kai", "Choir"],
		["sage", "Drama"],
		["ezra", "SHWEB"],
		["jasper", "Sheares Hall"],
		["brielle", "Volleyball"],
		["aria", "SHWEB"],
	])("403s %s booking for %s", async (persona, ccaName) => {
		const ccaId = await ccaIdByName(ccaName);

		asPersona(persona);
		const claims = await import("@/app/api/facilities/claims/route");
		const res = await readJson(
			await claims.POST(
				jsonRequest("/api/facilities/claims", "POST", {
					facility_id: await createFacility(),
					date: dateFromToday(10),
					hour: 18,
					cca_id: ccaId,
				}),
			),
		);
		expect(res.status).toBe(403);
		expect(res.error).toBe("Not authorized to claim for this CCA");
	});
});

describe("facilities booking rules", () => {
	function request(facilityId: number, date: string, ccaId: number, hour = 18) {
		return jsonRequest("/api/facilities/claims", "POST", {
			facility_id: facilityId,
			date,
			hour,
			cca_id: ccaId,
		});
	}

	it("accepts a same-day claim", async () => {
		const facilityId = await createFacility();
		const slotDate = dateFromToday(0);
		await publishSlot(facilityId, slotDate, 23);
		const ccaId = await ccaIdByName("SHWEB");

		asPersona("layla");
		const claims = await import("@/app/api/facilities/claims/route");
		const res = await readJson(await claims.POST(request(facilityId, slotDate, ccaId, 23)));
		expect(res.status).toBe(201);
		expect(await slotStatus(facilityId, slotDate, 23)).toBe("pending");
	});

	it("refuses a past date", async () => {
		const ccaId = await ccaIdByName("SHWEB");

		asPersona("layla");
		const claims = await import("@/app/api/facilities/claims/route");
		const res = await readJson(
			await claims.POST(request(await createFacility(), dateFromToday(-1), ccaId)),
		);
		expect(res.status).toBe(403);
		expect(res.error).toBe("Past facility slots cannot be booked");
	});

	it("refuses a date outside the booking window", async () => {
		bookingWindow.open = false;
		const ccaId = await ccaIdByName("SHWEB");

		asPersona("layla");
		const claims = await import("@/app/api/facilities/claims/route");
		const res = await readJson(
			await claims.POST(request(await createFacility(), dateFromToday(10), ccaId)),
		);
		expect(res.status).toBe(403);
		expect(res.error).toContain("up to 4 weeks ahead");
	});

	it("accepts a committee claim a week ahead", async () => {
		const facilityId = await createFacility();
		const slotDate = dateFromToday(7);
		await publishSlot(facilityId, slotDate);
		const ccaId = await ccaIdByName("SHWEB");

		asPersona("layla");
		const claims = await import("@/app/api/facilities/claims/route");
		const res = await readJson(await claims.POST(request(facilityId, slotDate, ccaId)));
		expect(res.status).toBe(201);
	});

	it("refuses a committee claim more than a week ahead", async () => {
		const facilityId = await createFacility();
		const slotDate = dateFromToday(8);
		await publishSlot(facilityId, slotDate);
		const ccaId = await ccaIdByName("SHWEB");

		asPersona("layla");
		const claims = await import("@/app/api/facilities/claims/route");
		const res = await readJson(await claims.POST(request(facilityId, slotDate, ccaId)));
		expect(res.status).toBe(403);
		expect(res.error).toBe("Committees can only book up to 1 week ahead");
		expect(await slotStatus(facilityId, slotDate)).toBe("available");
	});

	it("refuses a non-Sheares venue", async () => {
		const ccaId = await ccaIdByName("SHWEB");

		asPersona("layla");
		const claims = await import("@/app/api/facilities/claims/route");
		const res = await readJson(
			await claims.POST(request(await createFacility("nus"), dateFromToday(5), ccaId)),
		);
		expect(res.status).toBe(403);
		expect(res.error).toBe("Only Sheares facilities can be booked");
	});
});

describe("JCRC booking under Sheares Hall", () => {
	it("lets one JCRC member book and another see and withdraw it", async () => {
		const facilityId = await createFacility();
		const slotDate = dateFromToday(10);
		await publishSlot(facilityId, slotDate);
		const ccaId = await ccaIdByName("Sheares Hall");

		asPersona("brielle");
		const claims = await import("@/app/api/facilities/claims/route");
		const created = await readJson<{ id: number; cca_name: string }>(
			await claims.POST(
				jsonRequest("/api/facilities/claims", "POST", {
					facility_id: facilityId,
					date: slotDate,
					hour: 18,
					cca_id: ccaId,
				}),
			),
		);
		expect(created.status).toBe(201);
		expect(created.data.cca_name).toBe("Sheares Hall");

		asPersona("sage");
		const list = await readJson<Array<{ id: number }>>(await claims.GET());
		expect(list.data.map((claim) => claim.id)).toContain(created.data.id);

		const withdrawn = await readJson(
			await claims.DELETE(
				jsonRequest("/api/facilities/claims", "DELETE", { claim_ids: [created.data.id] }),
			),
		);
		expect(withdrawn.status).toBe(200);
		expect(await slotStatus(facilityId, slotDate)).toBe("available");
	});
});

describe("facility_schedules date bounds", () => {
	it("offers slots only inside the schedule's start/end dates", async () => {
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

		// A four-week window holds several matching weekdays; the bounds keep exactly one.
		const r = await pgPool.query(
			// `date` is a type name to the parser, so quote it and qualify the alias.
			`SELECT s."date"::text AS "date" FROM facility_slots($1::date, $2::date) s
			 WHERE s.facility_id = $3 AND s.hour = 20 ORDER BY s."date"`,
			[dateFromToday(0), dateFromToday(28), facilityId],
		);
		expect(r.rows.map((row) => row.date)).toEqual([startDate]);
	});
});

describe("facilities claim withdrawal", () => {
	it("requests and withdraws a multi-hour booking as a whole", async () => {
		const facilityId = await createFacility();
		const slotDate = dateFromToday(5);
		await publishSlot(facilityId, slotDate, 18);
		await publishSlot(facilityId, slotDate, 19);
		const ccaId = await ccaIdByName("SHWEB");

		asPersona("layla");
		const claims = await import("@/app/api/facilities/claims/route");
		const created = await readJson<Array<{ id: number }>>(
			await claims.POST(
				jsonRequest("/api/facilities/claims", "POST", {
					facility_id: facilityId,
					date: slotDate,
					hours: [18, 19],
					cca_id: ccaId,
				}),
			),
		);
		expect(created.status).toBe(201);
		expect(created.data).toHaveLength(2);
		expect(await slotStatus(facilityId, slotDate, 18)).toBe("pending");
		expect(await slotStatus(facilityId, slotDate, 19)).toBe("pending");

		const withdrawn = await readJson(
			await claims.DELETE(
				jsonRequest("/api/facilities/claims", "DELETE", {
					claim_ids: created.data.map((claim) => claim.id),
				}),
			),
		);
		expect(withdrawn.status).toBe(200);
		expect(await slotStatus(facilityId, slotDate, 18)).toBe("available");
		expect(await slotStatus(facilityId, slotDate, 19)).toBe("available");
	});

	it("removes the claim, reopens the slot, and allows a fresh claim", async () => {
		const facilityId = await createFacility();
		const slotDate = dateFromToday(5);
		await publishSlot(facilityId, slotDate);
		const ccaId = await ccaIdByName("SHWEB");

		asPersona("layla");
		const claims = await import("@/app/api/facilities/claims/route");
		const created = await readJson<{ id: number }>(
			await claims.POST(
				jsonRequest("/api/facilities/claims", "POST", {
					facility_id: facilityId,
					date: slotDate,
					hour: 18,
					cca_id: ccaId,
				}),
			),
		);
		expect(created.status).toBe(201);

		const claimRoute = await import("@/app/api/facilities/claims/[id]/route");
		const del = await readJson(
			await claimRoute.DELETE(makeRequest("/api/facilities/claims"), {
				params: Promise.resolve({ id: String(created.data.id) }),
			}),
		);
		expect(del.status).toBe(200);
		expect(await slotStatus(facilityId, slotDate)).toBe("available");

		// The live-claim unique index only covers non-rejected rows, so re-claiming works.
		const again = await readJson(
			await claims.POST(
				jsonRequest("/api/facilities/claims", "POST", {
					facility_id: facilityId,
					date: slotDate,
					hour: 18,
					cca_id: ccaId,
				}),
			),
		);
		expect(again.status).toBe(201);
	});
});
