import { test, expect } from "../fixtures";

test.describe("sidebar navigation", () => {
	test("@aria - shows Sheares Intranet branding", async ({ asPersona }) => {
		const page = await asPersona("aria");
		await page.goto("/dashboard");

		const sidebar = page.locator("[data-sidebar='sidebar']");
		await expect(sidebar.getByText("Sheares Intranet")).toBeVisible();
	});

	test("@aria - shows Dashboard link", async ({ asPersona }) => {
		const page = await asPersona("aria");
		await page.goto("/dashboard");

		const sidebar = page.locator("[data-sidebar='sidebar']");
		await expect(
			sidebar.getByRole("link", { name: "Dashboard" }),
		).toBeVisible();
	});

	test("@aria - shows My CCAs link", async ({ asPersona }) => {
		const page = await asPersona("aria");
		await page.goto("/dashboard");

		const sidebar = page.locator("[data-sidebar='sidebar']");
		await expect(
			sidebar.getByRole("link", { name: "My CCAs" }),
		).toBeVisible();
	});

	test("@aria - shows CCA Allocation link", async ({ asPersona }) => {
		const page = await asPersona("aria");
		await page.goto("/dashboard");

		const sidebar = page.locator("[data-sidebar='sidebar']");
		await expect(
			sidebar.getByRole("link", { name: "CCA Allocation" }),
		).toBeVisible();
	});

	test("@aria - does not show Holiday Subsidy (not admin or JCRC)", async ({
		asPersona,
	}) => {
		const page = await asPersona("aria");
		await page.goto("/dashboard");

		const sidebar = page.locator("[data-sidebar='sidebar']");
		await expect(sidebar.getByText("Holiday Subsidy")).not.toBeVisible();
	});

	test("@declan - shows CCA Admin under My CCAs (admin and chair)", async ({
		asPersona,
	}) => {
		const page = await asPersona("declan");
		await page.goto("/dashboard");

		const sidebar = page.locator("[data-sidebar='sidebar']");
		await expect(
			sidebar.getByRole("link", { name: "CCA Admin" }),
		).toBeVisible();
	});

	test("@declan - does not show Holiday Subsidy (admin but not JCRC)", async ({
		asPersona,
	}) => {
		const page = await asPersona("declan");
		await page.goto("/dashboard");

		const sidebar = page.locator("[data-sidebar='sidebar']");
		await expect(sidebar.getByText("Holiday Subsidy")).not.toBeVisible();
	});

	test("@jasper - shows Holiday Subsidy (JCRC)", async ({ asPersona }) => {
		const page = await asPersona("jasper");
		await page.goto("/dashboard");

		const sidebar = page.locator("[data-sidebar='sidebar']");
		await expect(
			sidebar.getByRole("link", { name: "Holiday Subsidy" }),
		).toBeVisible();
	});

	test("@brielle - shows Holiday Subsidy (admin and JCRC)", async ({
		asPersona,
	}) => {
		const page = await asPersona("brielle");
		await page.goto("/dashboard");

		const sidebar = page.locator("[data-sidebar='sidebar']");
		await expect(
			sidebar.getByRole("link", { name: "Holiday Subsidy" }),
		).toBeVisible();
	});

	test("@brielle - shows CCA Admin", async ({ asPersona }) => {
		const page = await asPersona("brielle");
		await page.goto("/dashboard");

		const sidebar = page.locator("[data-sidebar='sidebar']");
		await expect(
			sidebar.getByRole("link", { name: "CCA Admin" }),
		).toBeVisible();
	});

	test("@sage - shows all sidebar sections including Holiday Subsidy and CCA Admin", async ({
		asPersona,
	}) => {
		const page = await asPersona("sage");
		await page.goto("/dashboard");

		const sidebar = page.locator("[data-sidebar='sidebar']");
		await expect(
			sidebar.getByRole("link", { name: "Dashboard" }),
		).toBeVisible();
		await expect(
			sidebar.getByRole("link", { name: "My CCAs" }),
		).toBeVisible();
		await expect(
			sidebar.getByRole("link", { name: "CCA Allocation" }),
		).toBeVisible();
		await expect(
			sidebar.getByRole("link", { name: "Holiday Subsidy" }),
		).toBeVisible();
		await expect(
			sidebar.getByRole("link", { name: "CCA Admin" }),
		).toBeVisible();
	});
});
