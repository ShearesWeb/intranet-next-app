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

	test("@aria - shows Holiday Subsidy & Facilities sections but not their gated sub-items", async ({
		asPersona,
	}) => {
		const page = await asPersona("aria");
		await page.goto("/dashboard");

		const sidebar = page.locator("[data-sidebar='sidebar']");
		// Top-level sections are visible to every resident (feature-flag gated only)...
		await expect(sidebar.getByRole("link", { name: "Holiday Subsidy" })).toBeVisible();
		await expect(sidebar.getByRole("link", { name: "Facilities", exact: true })).toBeVisible();
		// ...but the chair/JCRC-gated sub-items are filtered out for a plain resident.
		await expect(sidebar.getByRole("link", { name: "Subsidy Declarations" })).not.toBeVisible();
		await expect(sidebar.getByRole("link", { name: "Approvals" })).not.toBeVisible();
		await expect(sidebar.getByRole("link", { name: "My CCA Bookings" })).not.toBeVisible();
		await expect(sidebar.getByRole("link", { name: "Manage Facilities" })).not.toBeVisible();
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

	test("@declan - chair (not JCRC) sees the section + chair sub-item but not JCRC-only ones", async ({
		asPersona,
	}) => {
		const page = await asPersona("declan");
		await page.goto("/dashboard");

		const sidebar = page.locator("[data-sidebar='sidebar']");
		await expect(sidebar.getByRole("link", { name: "Holiday Subsidy" })).toBeVisible();
		// Chair-only sub-items are visible to declan (a CCA chair)...
		await expect(sidebar.getByRole("link", { name: "My CCA Bookings" })).toBeVisible();
		// ...but JCRC-only sub-items are not (declan is not JCRC).
		await expect(sidebar.getByRole("link", { name: "Approvals" })).not.toBeVisible();
		await expect(sidebar.getByRole("link", { name: "Manage Facilities" })).not.toBeVisible();
	});

	test("@jasper - JCRC sees the Manage Facilities sub-item", async ({ asPersona }) => {
		const page = await asPersona("jasper");
		await page.goto("/dashboard");

		const sidebar = page.locator("[data-sidebar='sidebar']");
		await expect(sidebar.getByRole("link", { name: "Manage Facilities" })).toBeVisible();
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
