import { warmSessionCache } from "./auth-harness";
import { authenticatedPersonas } from "../tests/fixtures/personas";

export default async function globalSetup() {
	const keys = authenticatedPersonas().map((p) => p.key);
	console.log(`Warming session cache for ${keys.length} personas...`);
	await warmSessionCache(keys);
	console.log("Session cache ready.");
}
