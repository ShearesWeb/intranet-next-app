import { describe, expect, it } from "vitest";
import { asPersona, ccaIdByName, readJson, routeParams } from "../helpers";

// GET /api/chair/positions/for-chair — positions visible to the calling chair.
describe("GET /api/chair/positions/for-chair", () => {
	it("returns a result for a chair (declan)", async () => {
		asPersona("declan");
		const { GET } = await import("@/app/api/chair/positions/for-chair/route");
		const { status, error } = await readJson(await GET());
		expect(status).toBe(200);
		expect(error).toBeNull();
	});
});

// GET /api/cca/[cca-id]/rankings — chair/JCRC-gated ranking view.
describe("GET /api/cca/[cca-id]/rankings", () => {
	it("404s for a non-existent CCA", async () => {
		asPersona("declan");
		const { GET } = await import("@/app/api/cca/[cca-id]/rankings/route");
		const res = await GET(new Request("http://localhost/x"), routeParams({ "cca-id": "999999" }));
		expect(res.status).toBe(404);
	});

	it("serves the chair their CCA's rankings (declan / Volleyball)", async () => {
		asPersona("declan");
		const ccaId = await ccaIdByName("Volleyball");
		const { GET } = await import("@/app/api/cca/[cca-id]/rankings/route");
		const res = await GET(
			new Request("http://localhost/x"),
			routeParams({ "cca-id": String(ccaId) }),
		);
		expect(res.status).toBe(200);
	});

	it("denies a non-chair (aria) access to a CCA's rankings", async () => {
		asPersona("aria");
		const ccaId = await ccaIdByName("Volleyball");
		const { GET } = await import("@/app/api/cca/[cca-id]/rankings/route");
		const res = await GET(
			new Request("http://localhost/x"),
			routeParams({ "cca-id": String(ccaId) }),
		);
		expect(res.status).toBeGreaterThanOrEqual(401);
		expect(res.status).toBeLessThan(500);
	});
});
