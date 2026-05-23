import { warmSessionCache } from "./auth-harness";

const PERSONA_KEYS = ["aria", "declan", "brielle"];

export default async function globalSetup() {
	console.log(`Warming session cache for ${PERSONA_KEYS.length} personas...`);
	await warmSessionCache(PERSONA_KEYS);
	console.log("Session cache ready.");
}
