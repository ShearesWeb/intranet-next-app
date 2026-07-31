import { describe, expect, it } from "vitest";
import { asPersona, makeRequest, readJson } from "../helpers";

// GET /api/user/ccas — the caller's CCAs, derived from their appointments.
describe("GET /api/user/ccas", () => {
	it("returns declan's CCA (Volleyball, as chair)", async () => {
		asPersona("declan");
		const { GET } = await import("@/app/api/user/ccas/route");
		const { status, data } = await readJson<Array<{ name: string; can_manage_members: boolean }>>(
			await GET(makeRequest("/api/user/ccas")),
		);

		expect(status).toBe(200);
		const volleyball = data.find((c) => c.name === "Volleyball");
		expect(volleyball).toBeDefined();
		expect(volleyball?.can_manage_members).toBe(true);
	});

	it("grants no chair powers to a plain resident (aria)", async () => {
		// Every resident is auto-enrolled into their Block Committee by the
		// sync_block_resident trigger, so aria has an appointment — but no row she
		// can manage.
		asPersona("aria");
		const { GET } = await import("@/app/api/user/ccas/route");
		const { status, data } = await readJson<Array<{ can_manage_members: boolean }>>(
			await GET(makeRequest("/api/user/ccas")),
		);

		expect(status).toBe(200);
		expect(data.every((c) => c.can_manage_members === false)).toBe(true);
	});

	it("401s for an anonymous caller", async () => {
		asPersona("anonymous");
		const { GET } = await import("@/app/api/user/ccas/route");
		const { status } = await readJson(await GET(makeRequest("/api/user/ccas")));
		expect(status).toBe(401);
	});
});

// GET /api/user/managed-ccas — positions the caller can manage.
describe("GET /api/user/managed-ccas", () => {
	it("includes Volleyball for chair declan", async () => {
		asPersona("declan");
		const { GET } = await import("@/app/api/user/managed-ccas/route");
		const { status, data } = await readJson<Array<{ cca_name?: string }>>(await GET());
		expect(status).toBe(200);
		expect(Array.isArray(data)).toBe(true);
		expect(data.length).toBeGreaterThan(0);
	});

	it("excludes a CCA a plain resident cannot manage (aria has no Volleyball)", async () => {
		asPersona("aria");
		const { GET } = await import("@/app/api/user/managed-ccas/route");
		const { status, data } = await readJson<Array<{ cca_name?: string }>>(await GET());
		expect(status).toBe(200);
		expect(data.some((r) => r.cca_name === "Volleyball")).toBe(false);
	});

	it("401s for anonymous", async () => {
		asPersona("anonymous");
		const { GET } = await import("@/app/api/user/managed-ccas/route");
		const { status } = await readJson(await GET());
		expect(status).toBe(401);
	});
});

// GET /api/user/search — chair-only directory search.
describe("GET /api/user/search", () => {
	it("lets a chair search the directory", async () => {
		asPersona("declan");
		const { GET } = await import("@/app/api/user/search/route");
		const { status, data } = await readJson<Array<{ email: string }>>(
			await GET(makeRequest("/api/user/search?query=tan")),
		);
		expect(status).toBe(200);
		expect(Array.isArray(data)).toBe(true);
		expect(data.length).toBeGreaterThan(0);
	});

	it("403s a non-chair resident (aria)", async () => {
		asPersona("aria");
		const { GET } = await import("@/app/api/user/search/route");
		const { status } = await readJson(await GET(makeRequest("/api/user/search?query=tan")));
		expect(status).toBe(403);
	});

	it("400s a too-short query", async () => {
		asPersona("declan");
		const { GET } = await import("@/app/api/user/search/route");
		const { status } = await readJson(await GET(makeRequest("/api/user/search?query=a")));
		expect(status).toBe(400);
	});

	it("401s for anonymous", async () => {
		asPersona("anonymous");
		const { GET } = await import("@/app/api/user/search/route");
		const { status } = await readJson(await GET(makeRequest("/api/user/search?query=tan")));
		expect(status).toBe(401);
	});
});
