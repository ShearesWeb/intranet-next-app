import { describe, expect, it } from "vitest";
import { asPersona, readJson } from "../helpers";

// GET /api/user — returns the authenticated caller's resolved profile + flags.
describe("GET /api/user", () => {
	it("returns the authenticated user (declan)", async () => {
		asPersona("declan");
		const { GET } = await import("@/app/api/user/route");
		const { status, data, error } = await readJson<{ email: string; is_admin: boolean }>(await GET());

		expect(status).toBe(200);
		expect(error).toBeNull();
		expect(data.email).toBe("declanho.sg@gmail.com");
	});

	it("resolves the triple-flag persona (sage)", async () => {
		asPersona("sage");
		const { GET } = await import("@/app/api/user/route");
		const { status, data } = await readJson<{
			is_admin: boolean;
			is_jcrc: boolean;
			is_culture_sports_admin: boolean;
		}>(await GET());

		expect(status).toBe(200);
		expect(data.is_admin).toBe(true);
		expect(data.is_jcrc).toBe(true);
		expect(data.is_culture_sports_admin).toBe(true);
	});

	it("401s for an anonymous caller", async () => {
		asPersona("anonymous");
		const { GET } = await import("@/app/api/user/route");
		const { status, error } = await readJson(await GET());

		expect(status).toBe(401);
		expect(error).toBe("Unauthorized");
	});
});
