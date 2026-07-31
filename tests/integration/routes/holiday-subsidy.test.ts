import { describe, expect, it } from "vitest";
import { asPersona, ccaIdByName, makeRequest, readJson, routeParams } from "../helpers";

// GET /api/holiday-subsidy/members/[cca-id] — chair-gated member assignments.
describe("GET /api/holiday-subsidy/members/[cca-id]", () => {
	it("lets the CCA chair read assignments for a day", async () => {
		asPersona("declan");
		const ccaId = await ccaIdByName("Volleyball");
		const { GET } = await import("@/app/api/holiday-subsidy/members/[cca-id]/route");
		const res = await GET(
			makeRequest(`/api/holiday-subsidy/members/${ccaId}?day=2026-01-15`),
			routeParams({ "cca-id": String(ccaId) }),
		);
		const { status, error } = await readJson(res);
		expect(status).toBe(200);
		expect(error).toBeNull();
	});

	it("403s a non-chair (aria) for someone else's CCA", async () => {
		asPersona("aria");
		const ccaId = await ccaIdByName("Volleyball");
		const { GET } = await import("@/app/api/holiday-subsidy/members/[cca-id]/route");
		const res = await GET(
			makeRequest(`/api/holiday-subsidy/members/${ccaId}?day=2026-01-15`),
			routeParams({ "cca-id": String(ccaId) }),
		);
		expect((await readJson(res)).status).toBe(403);
	});

	it("400s when the day query param is missing", async () => {
		asPersona("declan");
		const ccaId = await ccaIdByName("Volleyball");
		const { GET } = await import("@/app/api/holiday-subsidy/members/[cca-id]/route");
		const res = await GET(
			makeRequest(`/api/holiday-subsidy/members/${ccaId}`),
			routeParams({ "cca-id": String(ccaId) }),
		);
		expect((await readJson(res)).status).toBe(400);
	});

	it("401s for anonymous", async () => {
		asPersona("anonymous");
		const ccaId = await ccaIdByName("Volleyball");
		const { GET } = await import("@/app/api/holiday-subsidy/members/[cca-id]/route");
		const res = await GET(
			makeRequest(`/api/holiday-subsidy/members/${ccaId}?day=2026-01-15`),
			routeParams({ "cca-id": String(ccaId) }),
		);
		expect((await readJson(res)).status).toBe(401);
	});
});

// GET /api/holiday-subsidy/approvals — JCRC-only approvals index.
describe("GET /api/holiday-subsidy/approvals", () => {
	it("lets a JCRC member (sage) read the approvals index", async () => {
		asPersona("sage");
		const { GET } = await import("@/app/api/holiday-subsidy/approvals/route");
		const { status, error } = await readJson(await GET());
		expect(status).toBe(200);
		expect(error).toBeNull();
	});

	it("403s a non-JCRC resident (aria)", async () => {
		asPersona("aria");
		const { GET } = await import("@/app/api/holiday-subsidy/approvals/route");
		expect((await readJson(await GET())).status).toBe(403);
	});

	it("401s for anonymous", async () => {
		asPersona("anonymous");
		const { GET } = await import("@/app/api/holiday-subsidy/approvals/route");
		expect((await readJson(await GET())).status).toBe(401);
	});
});
