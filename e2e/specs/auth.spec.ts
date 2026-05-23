import { test, expect } from "../fixtures";

test.describe("authentication", () => {
	test("unauthenticated user is redirected to login", async ({ page }) => {
		await page.goto("/dashboard");
		await expect(page).toHaveURL(/\/auth\/login/);
	});

	test("authenticated user can access dashboard", async ({ asPersona }) => {
		const page = await asPersona("aria");
		await page.goto("/dashboard");
		await expect(page).toHaveURL(/\/dashboard/);
	});

	test("admin persona sees dashboard", async ({ asPersona }) => {
		const page = await asPersona("declan");
		await page.goto("/dashboard");
		await expect(page).toHaveURL(/\/dashboard/);
	});

	test("JCRC persona sees dashboard", async ({ asPersona }) => {
		const page = await asPersona("brielle");
		await page.goto("/dashboard");
		await expect(page).toHaveURL(/\/dashboard/);
	});

	test("two personas have isolated sessions", async ({ asPersona }) => {
		const ariaPage = await asPersona("aria");
		const declanPage = await asPersona("declan");

		await ariaPage.goto("/dashboard");
		await declanPage.goto("/dashboard");

		await expect(ariaPage).toHaveURL(/\/dashboard/);
		await expect(declanPage).toHaveURL(/\/dashboard/);
	});
});
