import { test, expect } from "../fixtures";

test.describe("dashboard", () => {
	test("@aria - shows greeting with user name Aria Tan", async ({ asPersona }) => {
		const page = await asPersona("aria");
		await page.goto("/dashboard");
		const main = page.getByRole("main");
		await expect(main.getByText("Aria Tan")).toBeVisible();
		await expect(
			main.getByText(/Good (Morning|Afternoon|Evening)/),
		).toBeVisible();
	});

	test("@declan - shows greeting with user name Declan Ho", async ({ asPersona }) => {
		const page = await asPersona("declan");
		await page.goto("/dashboard");
		const main = page.getByRole("main");
		await expect(main.getByText("Declan Ho")).toBeVisible();
		await expect(
			main.getByText(/Good (Morning|Afternoon|Evening)/),
		).toBeVisible();
	});

	test("@aria - shows My Actions section", async ({ asPersona }) => {
		const page = await asPersona("aria");
		await page.goto("/dashboard");
		await expect(page.getByRole("main").getByText("My Actions")).toBeVisible();
	});

	test("@aria - shows My CCAs action card linking to /dashboard/my-cca", async ({
		asPersona,
	}) => {
		const page = await asPersona("aria");
		await page.goto("/dashboard");
		const myCcasLink = page
			.getByRole("main")
			.getByRole("link", { name: /My CCAs/ });
		await expect(myCcasLink).toBeVisible();
		await expect(myCcasLink).toHaveAttribute("href", "/dashboard/my-cca");
	});

	test("@aria - shows CCA Ranking action card", async ({ asPersona }) => {
		const page = await asPersona("aria");
		await page.goto("/dashboard");
		await expect(
			page.getByRole("main").getByRole("link", { name: /CCA Ranking/ }),
		).toBeVisible();
	});

	test("@aria - does not show Rank Applicants card (not a chair)", async ({
		asPersona,
	}) => {
		const page = await asPersona("aria");
		await page.goto("/dashboard");
		await expect(
			page.getByRole("main").getByRole("link", { name: /Rank Applicants/ }),
		).not.toBeVisible();
	});

	test("@declan - shows Rank Applicants card (admin/chair)", async ({
		asPersona,
	}) => {
		const page = await asPersona("declan");
		await page.goto("/dashboard");
		await expect(
			page.getByRole("main").getByRole("link", { name: /Rank Applicants/ }),
		).toBeVisible();
	});

	test("@aria - clicking My CCAs card navigates to /dashboard/my-cca", async ({
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
});
