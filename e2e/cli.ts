import * as net from "node:net";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { chromium } from "@playwright/test";
import { generateFreshSessionCookies, APP_URL, E2E_PORT, SUPABASE_URL, ANON_KEY } from "./auth-harness";
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

function isPortInUse(port: number): Promise<boolean> {
	return new Promise((resolve) => {
		const socket = net.createConnection({ port, host: "127.0.0.1" });
		socket.once("connect", () => {
			socket.destroy();
			resolve(true);
		});
		socket.once("error", () => resolve(false));
	});
}

function startDevServer(): Promise<ChildProcess> {
	return new Promise((resolve, reject) => {
		const child = spawn("npx", ["next", "dev", "-p", String(E2E_PORT)], {
			cwd: process.cwd(),
			stdio: ["ignore", "pipe", "pipe"],
			env: {
				...process.env,
				NEXT_PUBLIC_SUPABASE_URL: SUPABASE_URL,
				NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY: ANON_KEY,
				NEXT_PUBLIC_SUPABASE_ANON_KEY: ANON_KEY,
			},
		});

		let settled = false;
		const timeout = setTimeout(() => {
			if (!settled) {
				settled = true;
				reject(new Error(`Dev server failed to start within 30s`));
				child.kill();
			}
		}, 30_000);

		child.stdout?.on("data", (chunk: Buffer) => {
			const line = chunk.toString();
			if (!settled && line.includes("Ready in")) {
				settled = true;
				clearTimeout(timeout);
				resolve(child);
			}
		});

		child.stderr?.on("data", (chunk: Buffer) => {
			const line = chunk.toString().trim();
			if (line && !line.includes("ExperimentalWarning")) {
				process.stderr.write(`  [dev] ${line}\n`);
			}
		});

		child.on("error", (err) => {
			if (!settled) {
				settled = true;
				clearTimeout(timeout);
				reject(err);
			}
		});

		child.on("exit", (code) => {
			if (!settled) {
				settled = true;
				clearTimeout(timeout);
				reject(new Error(`Dev server exited with code ${code}`));
			}
		});
	});
}

async function ensureDevServer(): Promise<ChildProcess | null> {
	if (await isPortInUse(E2E_PORT)) {
		console.log(`Using existing dev server on port ${E2E_PORT}`);
		return null;
	}
	console.log(`Starting dev server on port ${E2E_PORT}...`);
	const child = await startDevServer();
	console.log(`Dev server ready.`);
	return child;
}

async function login(personaKey: string): Promise<void> {
	const persona = PERSONAS.find((p) => p.key === personaKey);
	if (!persona) {
		console.error(`Unknown persona: "${personaKey}"`);
		console.error(`Run "npm run e2e:personas" to list available personas.`);
		process.exit(1);
	}
	if (!persona.email) {
		console.error(`Cannot login as anonymous persona.`);
		process.exit(1);
	}

	const devServer = await ensureDevServer();

	console.log(`Creating session for ${persona.name} (${persona.key})...`);
	const cookies = await generateFreshSessionCookies(personaKey);

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
	console.log(`\nBrowser opened as ${persona.name}${roleStr}`);
	console.log(`  ${APP_URL}/dashboard`);
	console.log(`\nClose the browser or press Ctrl+C to exit.\n`);

	await new Promise<void>((resolve) => {
		browser.on("disconnected", () => resolve());
		process.on("SIGINT", async () => {
			await browser.close();
			resolve();
		});
	});

	if (devServer) {
		devServer.kill();
	}
}

function runTests(personaKey: string, extra: string[]): void {
	const persona = PERSONAS.find((p) => p.key === personaKey);
	if (!persona) {
		console.error(`Unknown persona: "${personaKey}"`);
		console.error(`Run "npm run e2e:personas" to list available personas.`);
		process.exit(1);
	}

	const playwrightArgs = [
		"playwright",
		"test",
		"--config",
		"e2e/playwright.config.ts",
		"--grep",
		`@${personaKey}`,
		...extra,
	];

	console.log(`Running e2e tests for ${persona.name} (@${personaKey})...\n`);
	const result = spawnSync("npx", playwrightArgs, { stdio: "inherit" });
	process.exit(result.status ?? 1);
}

const rawArgs = process.argv.slice(2).filter((a) => a !== "--");
const [command, ...args] = rawArgs;

switch (command) {
	case "personas":
		printPersonas();
		break;
	case "login":
		if (!args[0]) {
			console.error("Usage: npm run e2e:login <persona>");
			process.exit(1);
		}
		login(args[0]).catch((err) => {
			console.error(err.message);
			process.exit(1);
		});
		break;
	case "test":
		if (!args[0]) {
			console.error("Usage: npm run e2e:test <persona> [--headed]");
			process.exit(1);
		}
		runTests(args[0], args.slice(1));
		break;
	default:
		if (command) {
			console.error(`Unknown command: "${command}"\n`);
		}
		console.error("Usage:");
		console.error("  npm run e2e                         — run all e2e tests");
		console.error("  npm run e2e:test <persona>          — run tests for one persona");
		console.error("  npm run e2e:test <persona> --headed — same, with visible browser");
		console.error("  npm run e2e:login <persona>         — open browser as persona");
		console.error("  npm run e2e:personas                — list available personas");
		printPersonas();
		process.exit(1);
}
