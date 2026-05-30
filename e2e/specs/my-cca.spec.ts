import { test, expect } from "../fixtures";

test.describe("My CCAs page", () => {
	test("@aria - shows page title My CCAs", async ({ asPersona }) => {
		const page = await asPersona("aria");
		await page.goto("/dashboard/my-cca");

		await expect(
			page.getByRole("heading", { name: "My CCAs" }),
		).toBeVisible();
	});

	test("@aria - shows empty state or block committee only", async ({
		asPersona,
	}) => {
		const page = await asPersona("aria");
		await page.goto("/dashboard/my-cca");

		const main = page.getByRole("main");
		// aria has no CCA appointments — may see empty state or block committee
		await expect(
			main.getByText(/No CCA appointments found|Block Committee/),
		).toBeVisible();
	});

	test("@mason - shows Volleyball in CCA table", async ({ asPersona }) => {
		const page = await asPersona("mason");
		await page.goto("/dashboard/my-cca");

		await expect(
			page.getByRole("heading", { name: "My CCAs" }),
		).toBeVisible();
		await expect(
			page.getByRole("main").getByText("Volleyball"),
		).toBeVisible();
	});

	test("@mason - table has CCA, Role, Type, Points columns", async ({
		asPersona,
	}) => {
		const page = await asPersona("mason");
		await page.goto("/dashboard/my-cca");

		const main = page.getByRole("main");
		// Wait for the table to render
		await expect(main.getByText("Volleyball")).toBeVisible();

		// Verify all four column headers are present
		await expect(main.getByText("CCA", { exact: true })).toBeVisible();
		await expect(main.getByText("Role", { exact: true })).toBeVisible();
		await expect(main.getByText("Type", { exact: true })).toBeVisible();
		await expect(main.getByText("Points", { exact: true })).toBeVisible();
	});

	test("@nova - shows multiple appointments (Basketball and SECC)", async ({
		asPersona,
	}) => {
		const page = await asPersona("nova");
		await page.goto("/dashboard/my-cca");

		const main = page.getByRole("main");
		await expect(main.getByText("Basketball")).toBeVisible();
		await expect(main.getByText("SECC")).toBeVisible();
	});

	test("@declan - shows Volleyball with captain or lead role", async ({
		asPersona,
	}) => {
		const page = await asPersona("declan");
		await page.goto("/dashboard/my-cca");

		const main = page.getByRole("main");
		await expect(main.getByText("Volleyball")).toBeVisible();
		// declan is captain (lead position type) — verify the role badge is present
		await expect(main.getByText(/Captain/i)).toBeVisible();
	});

	test("@sage - shows both Drama and JCRC appointments", async ({
		asPersona,
	}) => {
		const page = await asPersona("sage");
		await page.goto("/dashboard/my-cca");

		const main = page.getByRole("main");
		await expect(main.getByText("Drama")).toBeVisible();
		await expect(main.getByText("JCRC", { exact: true }).first()).toBeVisible();
	});
});
