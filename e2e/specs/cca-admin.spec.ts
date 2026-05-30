import { test, expect } from "../fixtures";

test.describe("CCA Admin page", () => {
	test("@aria - shows Block Committee (no chair-level CCAs)", async ({ asPersona }) => {
		const page = await asPersona("aria");
		await page.goto("/dashboard/my-cca/admin");
		await expect(page.getByRole("heading", { name: "CCA Admin" })).toBeVisible();
		await expect(page.getByRole("main").getByText("Block Committee")).toBeVisible();
	});

	test("@declan - shows Volleyball CCA in table", async ({ asPersona }) => {
		const page = await asPersona("declan");
		await page.goto("/dashboard/my-cca/admin");
		await expect(page.getByRole("heading", { name: "CCA Admin" })).toBeVisible();
		await expect(page.getByRole("main").getByText("Volleyball")).toBeVisible();
	});

	test("@declan - shows Manage Members button for Volleyball", async ({ asPersona }) => {
		const page = await asPersona("declan");
		await page.goto("/dashboard/my-cca/admin");
		await expect(
			page.getByRole("main").getByRole("link", { name: /Manage Members/ }),
		).toBeVisible();
	});

	test("@declan - shows Rank Members button for Volleyball", async ({ asPersona }) => {
		const page = await asPersona("declan");
		await page.goto("/dashboard/my-cca/admin");
		await expect(
			page.getByRole("main").getByRole("link", { name: /Rank Members/ }),
		).toBeVisible();
	});

	test("@declan - Manage Members links to correct URL", async ({ asPersona }) => {
		const page = await asPersona("declan");
		await page.goto("/dashboard/my-cca/admin");
		const manageLink = page.getByRole("main").getByRole("link", { name: /Manage Members/ });
		await expect(manageLink).toBeVisible();
		await expect(manageLink).toHaveAttribute(
			"href",
			/\/dashboard\/my-cca\/admin\/manage-members\/Volleyball/,
		);
	});

	test("@layla - shows SHWEB in table", async ({ asPersona }) => {
		const page = await asPersona("layla");
		await page.goto("/dashboard/my-cca/admin");
		await expect(page.getByRole("heading", { name: "CCA Admin" })).toBeVisible();
		await expect(page.getByRole("main").getByText("SHWEB")).toBeVisible();
	});

	test("@layla - shows Manage Members button for SHWEB", async ({ asPersona }) => {
		const page = await asPersona("layla");
		await page.goto("/dashboard/my-cca/admin");
		await expect(
			page.getByRole("main").getByRole("link", { name: /Manage Members/ }),
		).toBeVisible();
	});

	test("@brielle - shows JCRC in table", async ({ asPersona }) => {
		const page = await asPersona("brielle");
		await page.goto("/dashboard/my-cca/admin");
		await expect(page.getByRole("heading", { name: "CCA Admin" })).toBeVisible();
		await expect(
			page.getByRole("main").locator("strong", { hasText: "JCRC" }),
		).toBeVisible();
	});

	test("@nova - shows Basketball in table", async ({ asPersona }) => {
		const page = await asPersona("nova");
		await page.goto("/dashboard/my-cca/admin");
		await expect(page.getByRole("heading", { name: "CCA Admin" })).toBeVisible();
		await expect(page.getByRole("main").getByText("Basketball")).toBeVisible();
	});

	test("@sage - shows Drama in table", async ({ asPersona }) => {
		const page = await asPersona("sage");
		await page.goto("/dashboard/my-cca/admin");
		await expect(page.getByRole("heading", { name: "CCA Admin" })).toBeVisible();
		await expect(page.getByRole("main").getByText("Drama")).toBeVisible();
	});

	test("@mason - shows CCA list (player, not chair — no Manage Members for Volleyball)", async ({ asPersona }) => {
		const page = await asPersona("mason");
		await page.goto("/dashboard/my-cca/admin");
		await expect(page.getByRole("heading", { name: "CCA Admin" })).toBeVisible();
		await expect(page.getByRole("main").getByText("Block Committee")).toBeVisible();
	});
});
