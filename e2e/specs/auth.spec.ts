import { test, expect } from "../fixtures";
import { APP_URL } from "../auth-harness";

test.describe("authentication", () => {
	test("unauthenticated user visiting /dashboard gets redirected to login @anonymous", async ({
		page,
	}) => {
		await page.goto("/dashboard");
		await expect(page).toHaveURL(/\/auth\/login/);
	});

	test("unauthenticated user on / sees landing page with Login Now button @anonymous", async ({
		page,
	}) => {
		await page.goto("/");
		await expect(
			page.getByRole("heading", { name: /Sheares Intranet/ }),
		).toBeVisible();
		await expect(
			page.getByRole("link", { name: "Login Now" }),
		).toBeVisible();
	});

	test("login page shows Sheares Web Intranet branding @anonymous", async ({
		page,
	}) => {
		await page.goto("/auth/login");
		await expect(
			page.getByRole("heading", { name: "Sheares Web Intranet" }),
		).toBeVisible();
	});

	test("authenticated user can access /dashboard @aria", async ({
		asPersona,
	}) => {
		const page = await asPersona("aria");
		await page.goto("/dashboard");
		await expect(page).toHaveURL(/\/dashboard/);
	});

	test("authenticated user visiting /auth/login gets redirected to /dashboard @aria", async ({
		asPersona,
	}) => {
		const page = await asPersona("aria");
		await page.goto("/auth/login");
		await expect(page).toHaveURL(/\/dashboard/);
	});

	test("authenticated user visiting / gets redirected to /dashboard @aria", async ({
		asPersona,
	}) => {
		const page = await asPersona("aria");
		await page.goto("/");
		await expect(page).toHaveURL(/\/dashboard/);
	});

	test("session isolation: two personas see different user data @aria @declan", async ({
		asPersona,
	}) => {
		const ariaPage = await asPersona("aria");
		const declanPage = await asPersona("declan");

		const ariaRes = await ariaPage.request.get(`${APP_URL}/api/user`);
		const declanRes = await declanPage.request.get(`${APP_URL}/api/user`);

		expect(ariaRes.status()).toBe(200);
		expect(declanRes.status()).toBe(200);

		const ariaUser = await ariaRes.json();
		const declanUser = await declanRes.json();

		expect(ariaUser.data.email).toBe("aria.tan.sg@gmail.com");
		expect(declanUser.data.email).toBe("declanho.sg@gmail.com");
		expect(ariaUser.data.email).not.toBe(declanUser.data.email);
	});

	test("sign out via POST /api/auth/signout clears session @aria", async ({
		asPersona,
	}) => {
		const page = await asPersona("aria");

		// Verify session is valid before sign out
		const beforeRes = await page.request.get(`${APP_URL}/api/user`);
		expect(beforeRes.status()).toBe(200);

		// Sign out
		const signOutRes = await page.request.post(`${APP_URL}/api/auth/signout`);
		expect(signOutRes.status()).toBe(200);

		// Subsequent request should be unauthenticated
		const afterRes = await page.request.get(`${APP_URL}/api/user`);
		expect(afterRes.status()).toBe(401);
	});
});
