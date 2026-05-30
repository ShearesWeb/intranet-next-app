import { test, expect } from "../fixtures";
import { APP_URL } from "../auth-harness";

test.describe("API routes", () => {
	// --- /api/ping ---

	test("GET /api/ping returns 200 @anonymous", async ({ page }) => {
		const response = await page.request.get(`${APP_URL}/api/ping`);
		expect(response.status()).toBe(200);
	});

	// --- /api/user (unauthenticated) ---

	test("GET /api/user returns 401 when unauthenticated @anonymous", async ({
		page,
	}) => {
		const response = await page.request.get(`${APP_URL}/api/user`);
		expect(response.status()).toBe(401);
	});

	// --- /api/user (role flags) ---

	test("GET /api/user returns profile with no admin flags @aria", async ({
		asPersona,
	}) => {
		const page = await asPersona("aria");
		const response = await page.request.get(`${APP_URL}/api/user`);
		expect(response.status()).toBe(200);

		const body = await response.json();
		expect(body.data).toBeTruthy();
		expect(body.data.email).toBe("aria.tan.sg@gmail.com");
		expect(body.data.name).toBe("Aria Tan");
		expect(body.data.is_admin).toBe(false);
		expect(body.data.is_jcrc).toBe(false);
		expect(body.data.is_culture_sports_admin).toBe(false);
		expect(body.error).toBeNull();
	});

	test("GET /api/user returns is_admin and is_culture_sports_admin flags @declan", async ({
		asPersona,
	}) => {
		const page = await asPersona("declan");
		const response = await page.request.get(`${APP_URL}/api/user`);
		expect(response.status()).toBe(200);

		const body = await response.json();
		expect(body.data.email).toBe("declanho.sg@gmail.com");
		expect(body.data.is_admin).toBe(true);
		expect(body.data.is_jcrc).toBe(false);
		expect(body.data.is_culture_sports_admin).toBe(true);
	});

	test("GET /api/user returns is_admin and is_jcrc flags @brielle", async ({
		asPersona,
	}) => {
		const page = await asPersona("brielle");
		const response = await page.request.get(`${APP_URL}/api/user`);
		expect(response.status()).toBe(200);

		const body = await response.json();
		expect(body.data.email).toBe("brielle.koh.j@gmail.com");
		expect(body.data.is_admin).toBe(true);
		expect(body.data.is_jcrc).toBe(true);
		expect(body.data.is_culture_sports_admin).toBe(false);
	});

	test("GET /api/user returns all three flags @sage", async ({
		asPersona,
	}) => {
		const page = await asPersona("sage");
		const response = await page.request.get(`${APP_URL}/api/user`);
		expect(response.status()).toBe(200);

		const body = await response.json();
		expect(body.data.email).toBe("sage.lim.97@gmail.com");
		expect(body.data.is_admin).toBe(true);
		expect(body.data.is_jcrc).toBe(true);
		expect(body.data.is_culture_sports_admin).toBe(true);
	});

	test("GET /api/user returns is_jcrc only @jasper", async ({
		asPersona,
	}) => {
		const page = await asPersona("jasper");
		const response = await page.request.get(`${APP_URL}/api/user`);
		expect(response.status()).toBe(200);

		const body = await response.json();
		expect(body.data.email).toBe("jasper.chua.sg@gmail.com");
		expect(body.data.is_admin).toBe(false);
		expect(body.data.is_jcrc).toBe(true);
		expect(body.data.is_culture_sports_admin).toBe(false);
	});

	// --- /api/user/ccas ---

	test("GET /api/user/ccas returns volleyball appointment @mason", async ({
		asPersona,
	}) => {
		const page = await asPersona("mason");
		const response = await page.request.get(`${APP_URL}/api/user/ccas`);
		expect(response.status()).toBe(200);

		const body = await response.json();
		expect(body.data).toBeInstanceOf(Array);
		expect(body.data.length).toBeGreaterThan(0);

		const volleyball = body.data.find(
			(c: { name: string }) => c.name === "Volleyball",
		);
		expect(volleyball).toBeTruthy();
		expect(volleyball.role).toBe("Player");
	});

	test("GET /api/user/ccas returns multiple appointments @nova", async ({
		asPersona,
	}) => {
		const page = await asPersona("nova");
		const response = await page.request.get(
			`${APP_URL}/api/user/ccas?includeAllAppointments=true`,
		);
		expect(response.status()).toBe(200);

		const body = await response.json();
		expect(body.data).toBeInstanceOf(Array);
		expect(body.data.length).toBeGreaterThanOrEqual(2);

		const ccaNames = body.data.map((c: { name: string }) => c.name);
		expect(ccaNames).toContain("Basketball");
		expect(ccaNames).toContain("SECC");
	});

	test("GET /api/user/ccas returns appointments for regular user @aria", async ({
		asPersona,
	}) => {
		const page = await asPersona("aria");
		const response = await page.request.get(`${APP_URL}/api/user/ccas`);
		expect(response.status()).toBe(200);

		const body = await response.json();
		expect(body.data).toBeInstanceOf(Array);
	});

	// --- /api/user/check-role ---

	test("GET /api/user/check-role returns authorized for admin @declan", async ({
		asPersona,
	}) => {
		const page = await asPersona("declan");
		const response = await page.request.get(`${APP_URL}/api/user/check-role`);
		expect(response.status()).toBe(200);

		const body = await response.json();
		expect(body.data.isAuthorized).toBe(true);
	});

	test("GET /api/user/check-role returns not authorized for regular user @aria", async ({
		asPersona,
	}) => {
		const page = await asPersona("aria");
		const response = await page.request.get(`${APP_URL}/api/user/check-role`);
		expect(response.status()).toBe(200);

		const body = await response.json();
		expect(body.data.isAuthorized).toBe(false);
	});

	// --- /api/user/managed-ccas ---

	test("GET /api/user/managed-ccas returns volleyball for captain @declan", async ({
		asPersona,
	}) => {
		const page = await asPersona("declan");
		const response = await page.request.get(
			`${APP_URL}/api/user/managed-ccas`,
		);
		expect(response.status()).toBe(200);

		const body = await response.json();
		expect(body.data).toBeInstanceOf(Array);
		expect(body.data.length).toBeGreaterThan(0);

		const volleyballEntry = body.data.find(
			(entry: { cca_name: string }) => entry.cca_name === "Volleyball",
		);
		expect(volleyballEntry).toBeTruthy();
	});
});
