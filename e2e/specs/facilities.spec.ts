import { test, expect } from "../fixtures";

// Facilities access model (confirmed intended behaviour):
//   - The Facilities section + index (browse venue slots) are open to every resident.
//   - BOOKING is chair-only: /dashboard/facilities/my-bookings is gated to CCA chairs;
//     a non-chair sees the "Not a CCA Chair" empty state.
//   - ADDING/MANAGING VENUE SLOTS is JCRC/admin-only: /dashboard/facilities/manage is
//     gated; a plain resident sees the "Access Denied" empty state.
// Both pages are reachable by URL (no redirect) — the gate renders an in-page denial,
// matching the rest of the app's "reachable, but role-gated content" pattern.

test.describe("facilities — booking is chair-only", () => {
	test("@declan - a chair can view My CCA Bookings", async ({ asPersona }) => {
		const page = await asPersona("declan");
		await page.goto("/dashboard/facilities/my-bookings");
		await expect(page.getByRole("heading", { name: "My CCA Bookings" })).toBeVisible();
		await expect(page.getByText("Not a CCA Chair")).not.toBeVisible();
	});

	test("@aria - a non-chair is blocked from My CCA Bookings", async ({ asPersona }) => {
		const page = await asPersona("aria");
		await page.goto("/dashboard/facilities/my-bookings");
		await expect(page.getByText("Not a CCA Chair")).toBeVisible();
	});
});

test.describe("facilities — adding/managing venues is JCRC-only", () => {
	test("@jasper - JCRC can manage facilities and add venue slots", async ({ asPersona }) => {
		const page = await asPersona("jasper");
		await page.goto("/dashboard/facilities/manage");
		await expect(page.getByText("Access Denied")).not.toBeVisible();
		await expect(page.getByRole("button", { name: /Add Slot/ })).toBeVisible();
	});

	test("@aria - a regular resident is blocked from Manage Facilities", async ({ asPersona }) => {
		const page = await asPersona("aria");
		await page.goto("/dashboard/facilities/manage");
		await expect(page.getByText("Access Denied")).toBeVisible();
	});

	test("@declan - an admin who is NOT JCRC is blocked (strictly JCRC-only)", async ({
		asPersona,
	}) => {
		// declan is is_admin (Volleyball lead) but not is_jcrc. Managing venues is
		// gated to JCRC only — at the page guard AND the /api/facilities/manage* routes.
		const page = await asPersona("declan");
		await page.goto("/dashboard/facilities/manage");
		await expect(page.getByText("Access Denied")).toBeVisible();
		await expect(page.getByRole("button", { name: /Add Slot/ })).not.toBeVisible();
	});
});
