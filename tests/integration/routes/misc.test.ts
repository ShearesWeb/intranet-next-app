import { describe, expect, it } from "vitest";
import { asPersona } from "../helpers";

// GET /api/ping — unauthenticated health check.
describe("GET /api/ping", () => {
	it("pongs", async () => {
		const { GET } = await import("@/app/api/ping/route");
		const res = await GET();
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ message: "PONG!" });
	});
});

// POST /api/auth/signout — always succeeds and sweeps auth cookies.
describe("POST /api/auth/signout", () => {
	it("returns ok for an authenticated caller", async () => {
		asPersona("declan");
		const { POST } = await import("@/app/api/auth/signout/route");
		const res = await POST();
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ ok: true });
	});

	it("returns ok even for an anonymous caller", async () => {
		asPersona("anonymous");
		const { POST } = await import("@/app/api/auth/signout/route");
		const res = await POST();
		expect(res.status).toBe(200);
	});
});
