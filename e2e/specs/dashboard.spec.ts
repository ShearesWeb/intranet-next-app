import { test, expect } from "../fixtures";
import type { Page } from "@playwright/test";

// The dashboard renders a <LoadingSpinner> until a client-side role fetch
// (useRoleAuth) resolves; only then do the greeting + action cards appear.
// Under heavy local parallelism that fetch can exceed Playwright's default 5s
// timeout, so navigate and wait for the page to hydrate before asserting.
// Waiting also makes the negative card assertions meaningful (a card is absent
// on a LOADED dashboard, not merely because the spinner is still showing).
async function gotoDashboard(page: Page): Promise<void> {
	await page.goto("/dashboard");
	await expect(
		page.getByRole("main").getByText(/Good (Morning|Afternoon|Evening)/),
	).toBeVisible({ timeout: 15_000 });
}

test.describe("dashboard", () => {
	test("@aria - shows greeting with user name Aria Tan", async ({ asPersona }) => {
		const page = await asPersona("aria");
		await gotoDashboard(page);
		const main = page.getByRole("main");
		await expect(main.getByText("Aria Tan")).toBeVisible();
		await expect(
			main.getByText(/Good (Morning|Afternoon|Evening)/),
		).toBeVisible();
	});

	test("@declan - shows greeting with user name Declan Ho", async ({ asPersona }) => {
		const page = await asPersona("declan");
		await gotoDashboard(page);
		const main = page.getByRole("main");
		await expect(main.getByText("Declan Ho")).toBeVisible();
		await expect(
			main.getByText(/Good (Morning|Afternoon|Evening)/),
		).toBeVisible();
	});

	test("@aria - shows My Actions section", async ({ asPersona }) => {
		const page = await asPersona("aria");
		await gotoDashboard(page);
		await expect(page.getByRole("main").getByText("My Actions")).toBeVisible();
	});

	test("@aria - shows My CCAs action card linking to /dashboard/my-cca", async ({
		asPersona,
	}) => {
		const page = await asPersona("aria");
		await gotoDashboard(page);
		const myCcasLink = page
			.getByRole("main")
			.getByRole("link", { name: /My CCAs/ });
		await expect(myCcasLink).toBeVisible();
		await expect(myCcasLink).toHaveAttribute("href", "/dashboard/my-cca");
	});

	test("@aria - shows CCA Ranking action card", async ({ asPersona }) => {
		const page = await asPersona("aria");
		await gotoDashboard(page);
		await expect(
			page.getByRole("main").getByRole("link", { name: /CCA Ranking/ }),
		).toBeVisible();
	});

	test("@aria - does not show Chair Preferences card (not a chair)", async ({
		asPersona,
	}) => {
		const page = await asPersona("aria");
		await gotoDashboard(page);
		await expect(
			page.getByRole("main").getByRole("link", { name: /Chair Preferences/ }),
		).not.toBeVisible();
	});

	test("@declan - shows Chair Preferences card (admin/chair)", async ({
		asPersona,
	}) => {
		const page = await asPersona("declan");
		await gotoDashboard(page);
		await expect(
			page.getByRole("main").getByRole("link", { name: /Chair Preferences/ }),
		).toBeVisible();
	});

	test("@aria - clicking My CCAs card navigates to /dashboard/my-cca", async ({
		asPersona,
	}) => {
		const page = await asPersona("aria");
		await gotoDashboard(page);
		await page
			.getByRole("main")
			.getByRole("link", { name: /My CCAs/ })
			.click();
		await expect(page).toHaveURL(/\/dashboard\/my-cca/);
		await expect(page.getByRole("heading", { name: "My CCAs" })).toBeVisible();
	});
});
