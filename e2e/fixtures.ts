import { test as base, type Page } from "@playwright/test";
import { getSessionCookies } from "./auth-harness";

export const test = base.extend<{
	asPersona: (key: string) => Promise<Page>;
}>({
	asPersona: async ({ browser }, use) => {
		const contexts: Array<Awaited<ReturnType<typeof browser.newContext>>> = [];

		await use(async (key: string) => {
			const cookies = await getSessionCookies(key);
			const context = await browser.newContext();
			await context.addCookies(cookies);
			contexts.push(context);
			const page = await context.newPage();
			return page;
		});

		for (const ctx of contexts) {
			await ctx.close();
		}
	},
});

export { expect } from "@playwright/test";
