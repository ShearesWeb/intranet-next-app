// Persona QA CLI: `make e2e-personas` / `make e2e-login PERSONA=<key>`.

import { magicLinkFor, APP_URL } from "./auth-harness";
import { PERSONAS } from "../tests/fixtures/personas";
import { POSITIONS } from "../tests/fixtures/positions";

function roleTags(expected: {
	is_chair?: boolean;
	is_jcrc?: boolean;
	is_culture_sports_chair?: boolean;
}): string[] {
	const tags: string[] = [];
	if (expected.is_chair) tags.push("chair");
	if (expected.is_jcrc) tags.push("JCRC");
	if (expected.is_culture_sports_chair) tags.push("culture/sports chair");
	return tags;
}

function printPersonas(): void {
	console.log("\nAvailable personas:\n");
	for (const p of PERSONAS) {
		const tags = roleTags(p.expected).map((t) => `[${t}]`);
		const appointments = p.appointments
			.map((a) => {
				const pos = POSITIONS.find((pos) => pos.ccaKey === a.ccaKey && pos.name === a.positionName);
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
		console.error(`Run "make e2e-personas" to list available personas.`);
		process.exit(1);
	}
	if (!persona.email) {
		console.error(`Cannot log in as the anonymous persona.`);
		process.exit(1);
	}

	const link = await magicLinkFor(personaKey);
	const tags = roleTags(persona.expected);
	const roleStr = tags.length > 0 ? ` [${tags.join(", ")}]` : "";

	console.log(`\nLog in as ${persona.name}${roleStr}:\n`);
	console.log(`  ${link}\n`);
	console.log(`Open the link in your browser (dev app expected at ${APP_URL}).\n`);
}

const rawArgs = process.argv.slice(2).filter((a) => a !== "--");
const [command, ...args] = rawArgs;

switch (command) {
	case "personas":
		printPersonas();
		break;
	case "login":
		if (!args[0]) {
			console.error("Usage: make e2e-login PERSONA=<persona>");
			process.exit(1);
		}
		login(args[0]).catch((err) => {
			console.error(err instanceof Error ? err.message : String(err));
			process.exit(1);
		});
		break;
	default:
		if (command) console.error(`Unknown command: "${command}"\n`);
		console.error("Usage:");
		console.error("  make e2e-login PERSONA=<persona>   — print a magic-link to log in as persona");
		console.error("  make e2e-personas                 — list available personas");
		printPersonas();
		process.exit(1);
}
