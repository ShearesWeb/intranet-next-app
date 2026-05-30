import { test, expect } from "../fixtures";

test.describe("navigation and routing", () => {
	test("@anonymous - landing page shows Welcome to the Sheares Intranet heading", async ({
		page,
	}) => {
		await page.goto("/");
		await expect(
			page.getByRole("heading", { name: /Welcome to the Sheares Intranet/ }),
		).toBeVisible();
	});

	test("@anonymous - landing page has Login Now button linking to /auth/login", async ({
		page,
	}) => {
		await page.goto("/");
		const loginButton = page.getByRole("link", { name: "Login Now" });
		await expect(loginButton).toBeVisible();
		await expect(loginButton).toHaveAttribute("href", "/auth/login");
	});

	test("@aria - can navigate to My CCAs from dashboard card", async ({
		asPersona,
	}) => {
		const page = await asPersona("aria");
		await page.goto("/dashboard");
		await page
			.getByRole("main")
			.getByRole("link", { name: /My CCAs/ })
			.click();
		await expect(page).toHaveURL(/\/dashboard\/my-cca/);
		await expect(page.getByRole("heading", { name: "My CCAs" })).toBeVisible();
	});

	test("@aria - can navigate to /dashboard/cca-allocation", async ({
		asPersona,
	}) => {
		const page = await asPersona("aria");
		await page.goto("/dashboard/cca-allocation");
		await expect(page).toHaveURL(/\/dashboard\/cca-allocation/);
	});

	test("@aria - can navigate to /dashboard/cca-allocation/rank", async ({
		asPersona,
	}) => {
		const page = await asPersona("aria");
		await page.goto("/dashboard/cca-allocation/rank");
		await expect(page).toHaveURL(/\/dashboard\/cca-allocation\/rank/);
	});

	test("@declan - can navigate to /dashboard/cca-allocation/rank-applicants", async ({
		asPersona,
	}) => {
		const page = await asPersona("declan");
		await page.goto("/dashboard/cca-allocation/rank-applicants");
		await expect(page).toHaveURL(/\/dashboard\/cca-allocation\/rank-applicants/);
	});
});
