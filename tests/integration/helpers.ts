import * as fs from "node:fs";
import * as path from "node:path";
import { pgPool } from "./setup";
import type { PoolClient } from "pg";

const SEED_SQL = fs.readFileSync(
	path.resolve(__dirname, "../fixtures/seed.sql"),
	"utf8",
);

export async function withRollback<T>(
	body: (client: PoolClient) => Promise<T>,
): Promise<T> {
	const client = await pgPool.connect();
	try {
		await client.query("BEGIN");
		const out = await body(client);
		return out;
	} finally {
		try {
			await client.query("ROLLBACK");
		} finally {
			client.release();
		}
	}
}

export async function resetDb(): Promise<void> {
	const client = await pgPool.connect();
	try {
		await client.query(SEED_SQL);
	} finally {
		client.release();
	}
}
