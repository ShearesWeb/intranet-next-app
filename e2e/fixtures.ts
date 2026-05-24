import { test as base, type Page, type BrowserContext } from "@playwright/test";
import { getSessionCookies } from "./auth-harness";

const patchedPages = new WeakSet<Page>();

function patchGoto(page: Page) {
	if (patchedPages.has(page)) return;
	patchedPages.add(page);
	const original = page.goto.bind(page);
	page.goto = async (url: string, opts?: Parameters<Page["goto"]>[1]) => {
		if (page.url() !== "about:blank") {
			const current = new URL(page.url()).pathname;
			const target = new URL(url, page.url()).pathname;
			if (current === target) {
				await page.waitForLoadState("domcontentloaded");
				return null;
			}
		}
		return original(url, opts);
	};
}

export const test = base.extend<
	{ asPersona: (key: string) => Promise<Page> },
	{ _personaContexts: Map<string, BrowserContext> }
>({
	_personaContexts: [
		async ({}, use) => {
			const contexts = new Map<string, BrowserContext>();
			await use(contexts);
			for (const ctx of Array.from(contexts.values())) {
				await ctx.close();
			}
		},
		{ scope: "worker" },
	],

	asPersona: async ({ browser, _personaContexts }, use, testInfo) => {
		const headed = testInfo.project.use.headless === false;
		const owned: BrowserContext[] = [];

		await use(async (key: string) => {
			if (headed) {
				const isPrimary = _personaContexts.has(key) || _personaContexts.size === 0;
				if (isPrimary) {
					let ctx = _personaContexts.get(key);
					if (!ctx) {
						ctx = await browser.newContext();
						_personaContexts.set(key, ctx);
					}
					const cookies = await getSessionCookies(key);
					await ctx.addCookies(cookies);
					const page = ctx.pages()[0] ?? (await ctx.newPage());
					patchGoto(page);
					return page;
				}
				// Secondary persona (e.g. session isolation test) — temporary, closes after test
			}

			const cookies = await getSessionCookies(key);
			const ctx = await browser.newContext();
			await ctx.addCookies(cookies);
			owned.push(ctx);
			return await ctx.newPage();
		});

		for (const ctx of owned) {
			await ctx.close();
		}
	},
});

export { expect } from "@playwright/test";
