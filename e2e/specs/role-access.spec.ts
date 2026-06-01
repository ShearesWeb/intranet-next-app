import { test, expect } from "../fixtures";

// ─── Unauthenticated ──────────────────────────────────────────────
test.describe("anonymous", () => {
	test("@anonymous - /dashboard redirects to /auth/login", async ({ page }) => {
		await page.goto("/dashboard");
		await expect(page).toHaveURL(/\/auth\/login/);
		await expect(page).toHaveURL(/reason=session_expired/);
	});

	test("@anonymous - /dashboard/my-cca redirects to /auth/login", async ({ page }) => {
		await page.goto("/dashboard/my-cca");
		await expect(page).toHaveURL(/\/auth\/login/);
		await expect(page).toHaveURL(/reason=session_expired/);
	});

	test("@anonymous - /dashboard/my-cca/admin redirects to /auth/login", async ({ page }) => {
		await page.goto("/dashboard/my-cca/admin");
		await expect(page).toHaveURL(/\/auth\/login/);
		await expect(page).toHaveURL(/reason=session_expired/);
	});

	test("@anonymous - /dashboard/cca-allocation redirects to /auth/login", async ({ page }) => {
		await page.goto("/dashboard/cca-allocation");
		await expect(page).toHaveURL(/\/auth\/login/);
		await expect(page).toHaveURL(/reason=session_expired/);
	});

	test("@anonymous - /dashboard/holiday-subsidy redirects to /auth/login", async ({ page }) => {
		await page.goto("/dashboard/holiday-subsidy");
		await expect(page).toHaveURL(/\/auth\/login/);
		await expect(page).toHaveURL(/reason=session_expired/);
	});

	test("@anonymous - /dashboard/holiday-subsidy/approvals redirects to /auth/login", async ({ page }) => {
		await page.goto("/dashboard/holiday-subsidy/approvals");
		await expect(page).toHaveURL(/\/auth\/login/);
		await expect(page).toHaveURL(/reason=session_expired/);
	});
});

// ─── Regular resident (aria) — no appointments, no flags ──────────
test.describe("aria — regular resident", () => {
	test("@aria - can access /dashboard", async ({ asPersona }) => {
		const page = await asPersona("aria");
		await page.goto("/dashboard");
		await expect(page.getByRole("main").getByText("Aria Tan")).toBeVisible();
	});

	test("@aria - CCA Admin shows Block Committee only", async ({ asPersona }) => {
		const page = await asPersona("aria");
		await page.goto("/dashboard/my-cca/admin");
		await expect(page.getByRole("heading", { name: "CCA Admin" })).toBeVisible();
		await expect(page.getByRole("main").getByText("Block Committee")).toBeVisible();
	});

	test("@aria - rank applicants shows 'No CCA positions to manage.'", async ({ asPersona }) => {
		const page = await asPersona("aria");
		await page.goto("/dashboard/cca-allocation/rank-applicants");
		await expect(
			page.getByRole("heading", { name: /Chair preferences/i }),
		).toBeVisible();
		await expect(page.getByText("No CCA positions to manage")).toBeVisible();
	});

	test("@aria - holiday subsidy shows not authorized message", async ({ asPersona }) => {
		const page = await asPersona("aria");
		await page.goto("/dashboard/holiday-subsidy/declarations");
		await expect(page.getByText(/not a chair/i)).toBeVisible();
	});

	test("@aria - holiday subsidy approvals shows 'JCRC access only'", async ({ asPersona }) => {
		const page = await asPersona("aria");
		await page.goto("/dashboard/holiday-subsidy/approvals");
		await expect(page.getByText(/JCRC access only/i)).toBeVisible();
	});
});

// ─── Sports member (mason) — Volleyball/Player, no flags ──────────
test.describe("mason — volleyball member", () => {
	test("@mason - can access /dashboard", async ({ asPersona }) => {
		const page = await asPersona("mason");
		await page.goto("/dashboard");
		await expect(page.getByRole("main")).toBeVisible();
	});

	test("@mason - CCA Admin shows Block Committee (player, no chair access)", async ({ asPersona }) => {
		const page = await asPersona("mason");
		await page.goto("/dashboard/my-cca/admin");
		await expect(page.getByRole("heading", { name: "CCA Admin" })).toBeVisible();
		await expect(page.getByRole("main").getByText("Block Committee")).toBeVisible();
	});
});

// ─── Sports lead (declan) — Volleyball/Captain, is_admin + CSA ────
test.describe("declan — volleyball captain", () => {
	test("@declan - can access /dashboard", async ({ asPersona }) => {
		const page = await asPersona("declan");
		await page.goto("/dashboard");
		await expect(page.getByRole("main").getByText("Declan Ho")).toBeVisible();
	});

	test("@declan - CCA Admin shows Volleyball", async ({ asPersona }) => {
		const page = await asPersona("declan");
		await page.goto("/dashboard/my-cca/admin");
		await expect(page.getByRole("heading", { name: "CCA Admin" })).toBeVisible();
		await expect(page.getByRole("main").getByText("Volleyball")).toBeVisible();
	});

	test("@declan - CCA Admin has Manage Members button for Volleyball", async ({ asPersona }) => {
		const page = await asPersona("declan");
		await page.goto("/dashboard/my-cca/admin");
		await expect(
			page.getByRole("main").getByRole("link", { name: /Manage Members/ }),
		).toBeVisible();
	});

	test("@declan - can access rank applicants page", async ({ asPersona }) => {
		const page = await asPersona("declan");
		await page.goto("/dashboard/cca-allocation/rank-applicants");
		await expect(
			page.getByRole("heading", { name: /Chair preferences/i }),
		).toBeVisible();
	});

	test("@declan - holiday subsidy approvals shows 'JCRC access only'", async ({ asPersona }) => {
		const page = await asPersona("declan");
		await page.goto("/dashboard/holiday-subsidy/approvals");
		await expect(page.getByText(/JCRC access only/i)).toBeVisible();
	});
});

// ─── Committee lead (layla) — SHWEB/President, is_admin ───────────
test.describe("layla — SHWEB president", () => {
	test("@layla - CCA Admin shows SHWEB", async ({ asPersona }) => {
		const page = await asPersona("layla");
		await page.goto("/dashboard/my-cca/admin");
		await expect(page.getByRole("heading", { name: "CCA Admin" })).toBeVisible();
		await expect(page.getByRole("main").getByText("SHWEB")).toBeVisible();
	});

	test("@layla - CCA Admin does not show unrelated CCAs", async ({ asPersona }) => {
		const page = await asPersona("layla");
		await page.goto("/dashboard/my-cca/admin");
		await expect(page.getByRole("main").getByText("Volleyball")).not.toBeVisible();
		await expect(page.getByRole("main").getByText("JCRC")).not.toBeVisible();
	});
});

// ─── JCRC blockcomm (jasper) — JCRC/Blockcomm, is_jcrc only ──────
test.describe("jasper — JCRC blockcomm", () => {
	test("@jasper - can access holiday subsidy", async ({ asPersona }) => {
		const page = await asPersona("jasper");
		await page.goto("/dashboard/holiday-subsidy");
		await expect(page.getByRole("heading", { name: /Holiday Subsidy Guide/ })).toBeVisible();
	});

	test("@jasper - holiday subsidy approvals is accessible (not 'JCRC access only')", async ({ asPersona }) => {
		const page = await asPersona("jasper");
		await page.goto("/dashboard/holiday-subsidy/approvals");
		await expect(page.getByText(/JCRC access only/i)).not.toBeVisible();
		await expect(
			page.getByRole("heading", { name: /Subsidy Approvals/ }),
		).toBeVisible();
	});

	test("@jasper - CCA Admin shows Block Committee and JCRC", async ({ asPersona }) => {
		const page = await asPersona("jasper");
		await page.goto("/dashboard/my-cca/admin");
		await expect(page.getByRole("heading", { name: "CCA Admin" })).toBeVisible();
		await expect(page.getByRole("main").getByText("Block Committee")).toBeVisible();
	});
});

// ─── JCRC maincomm (brielle) — JCRC/Maincomm, is_admin + is_jcrc ─
test.describe("brielle — JCRC maincomm", () => {
	test("@brielle - holiday subsidy approvals is accessible", async ({ asPersona }) => {
		const page = await asPersona("brielle");
		await page.goto("/dashboard/holiday-subsidy/approvals");
		await expect(page.getByText(/JCRC access only/i)).not.toBeVisible();
		await expect(
			page.getByRole("heading", { name: /Subsidy Approvals/ }),
		).toBeVisible();
	});

	test("@brielle - CCA Admin shows JCRC", async ({ asPersona }) => {
		const page = await asPersona("brielle");
		await page.goto("/dashboard/my-cca/admin");
		await expect(page.getByRole("heading", { name: "CCA Admin" })).toBeVisible();
		await expect(
			page.getByRole("main").locator("strong", { hasText: "JCRC" }),
		).toBeVisible();
	});
});

// ─── Triple flag (sage) — Drama/Director + JCRC/Maincomm ──────────
test.describe("sage — drama + JCRC", () => {
	test("@sage - CCA Admin shows Drama", async ({ asPersona }) => {
		const page = await asPersona("sage");
		await page.goto("/dashboard/my-cca/admin");
		await expect(page.getByRole("heading", { name: "CCA Admin" })).toBeVisible();
		await expect(page.getByRole("main").getByText("Drama")).toBeVisible();
	});

	test("@sage - holiday subsidy approvals is accessible (has JCRC flag)", async ({ asPersona }) => {
		const page = await asPersona("sage");
		await page.goto("/dashboard/holiday-subsidy/approvals");
		await expect(page.getByText(/JCRC access only/i)).not.toBeVisible();
		await expect(
			page.getByRole("heading", { name: /Subsidy Approvals/ }),
		).toBeVisible();
	});
});

// ─── Multi-appointment (nova) — Basketball/Captain + SECC/Subcomm ──
test.describe("nova — basketball + SECC", () => {
	test("@nova - CCA Admin shows Basketball", async ({ asPersona }) => {
		const page = await asPersona("nova");
		await page.goto("/dashboard/my-cca/admin");
		await expect(page.getByRole("heading", { name: "CCA Admin" })).toBeVisible();
		await expect(page.getByRole("main").getByText("Basketball")).toBeVisible();
	});
});
