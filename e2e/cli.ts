import { chromium } from "@playwright/test";
import { getSessionCookies, APP_URL } from "./auth-harness";
import { PERSONAS } from "../tests/fixtures/personas";
import { POSITIONS } from "../tests/fixtures/positions";

function printPersonas(): void {
	console.log("\nAvailable personas:\n");

	for (const p of PERSONAS) {
		const tags: string[] = [];
		if (p.expected.is_admin) tags.push("[admin]");
		if (p.expected.is_jcrc) tags.push("[JCRC]");
		if (p.expected.is_culture_sports_admin) tags.push("[CSA]");

		const appointments = p.appointments
			.map((a) => {
				const pos = POSITIONS.find(
					(pos) => pos.ccaKey === a.ccaKey && pos.name === a.positionName,
				);
				return pos ? `${a.ccaKey}/${pos.positionType}` : `${a.ccaKey}/${a.positionName}`;
			})
			.join(", ");

		const desc = p.email === null ? "unauthenticated" : appointments || "regular resident";
		const tagStr = tags.length > 0 ? "  " + tags.join(" ") : "";
		console.log(`  ${p.key.padEnd(12)} — ${desc}${tagStr}`);
	}
	console.log("");
}

async function login(personaKey: string): Promise<void> {
	const persona = PERSONAS.find((p) => p.key === personaKey);
	if (!persona) {
		console.error(`Unknown persona: "${personaKey}"`);
		console.error(`Run "npx tsx e2e/cli.ts personas" to list available personas.`);
		process.exit(1);
	}
	if (!persona.email) {
		console.error(`Cannot login as anonymous persona.`);
		process.exit(1);
	}

	console.log(`Creating session for ${persona.name} (${persona.key})...`);
	const cookies = await getSessionCookies(personaKey);

	const browser = await chromium.launch({ headless: false });
	const context = await browser.newContext();
	await context.addCookies(cookies);

	const page = await context.newPage();
	await page.goto(`${APP_URL}/dashboard`);

	const tags: string[] = [];
	if (persona.expected.is_admin) tags.push("admin");
	if (persona.expected.is_jcrc) tags.push("JCRC");
	if (persona.expected.is_culture_sports_admin) tags.push("CSA");
	const roleStr = tags.length > 0 ? ` [${tags.join(", ")}]` : "";
	console.log(`\n✓ Browser opened as ${persona.name}${roleStr}`);
	console.log(`  ${APP_URL}/dashboard`);
	console.log(`\nClose the browser or press Ctrl+C to exit.\n`);

	await new Promise<void>((resolve) => {
		browser.on("disconnected", resolve);
		process.on("SIGINT", async () => {
			await browser.close();
			resolve();
		});
	});
}

const [command, ...args] = process.argv.slice(2);

switch (command) {
	case "personas":
		printPersonas();
		break;
	case "login":
		if (!args[0]) {
			console.error('Usage: npx tsx e2e/cli.ts login <persona>');
			process.exit(1);
		}
		login(args[0]).catch((err) => {
			console.error(err.message);
			process.exit(1);
		});
		break;
	default:
		console.error("Usage:");
		console.error("  npx tsx e2e/cli.ts personas        — list available personas");
		console.error("  npx tsx e2e/cli.ts login <persona>  — open browser as persona");
		process.exit(1);
}
