import { NextRequest } from "next/server";
import { setPersona } from "@/test-utils/integration/persona-supabase";
import type { PersonaKey } from "../fixtures/types";
import { pgPool } from "./setup";

const BASE_URL = "http://localhost:3000";

// Seeded ids aren't stable across reseeds, so resolve by name.
export async function ccaIdByName(name: string): Promise<number> {
	const r = await pgPool.query("SELECT id FROM ccas WHERE name = $1", [name]);
	if (!r.rows[0]) throw new Error(`No CCA named "${name}"`);
	return r.rows[0].id as number;
}

export function asPersona(key: PersonaKey): void {
	setPersona(key);
}

/**
 * Upsert a timed feature flag. Offsets are relative to the DB clock; the
 * beforeEach reseed deletes these rows, so every test starts closed.
 */
export async function setFeatureFlag(
	name: string,
	opts: { enabled: boolean; startsInMs?: number | null; expiresInMs?: number | null },
): Promise<void> {
	await pgPool.query(
		`INSERT INTO feature_flags (name, enabled, starts_at, expires_at)
		 VALUES ($1, $2,
		         CASE WHEN $3::bigint IS NULL THEN NULL ELSE now() + make_interval(secs => $3::bigint / 1000.0) END,
		         CASE WHEN $4::bigint IS NULL THEN NULL ELSE now() + make_interval(secs => $4::bigint / 1000.0) END)
		 ON CONFLICT (name) DO UPDATE
		 SET enabled = EXCLUDED.enabled,
		     starts_at = EXCLUDED.starts_at,
		     expires_at = EXCLUDED.expires_at`,
		[name, opts.enabled, opts.startsInMs ?? null, opts.expiresInMs ?? null],
	);
}

type NextRequestInit = ConstructorParameters<typeof NextRequest>[1];

export function makeRequest(pathAndQuery: string, init?: NextRequestInit): NextRequest {
	return new NextRequest(new URL(pathAndQuery, BASE_URL).toString(), init);
}

export function jsonRequest(pathname: string, method: string, body?: unknown): NextRequest {
	return new NextRequest(new URL(pathname, BASE_URL).toString(), {
		method,
		headers: { "content-type": "application/json" },
		body: body !== undefined ? JSON.stringify(body) : undefined,
	});
}

// Next.js 15 passes route params as a Promise.
export function routeParams<T extends Record<string, string>>(p: T): { params: Promise<T> } {
	return { params: Promise.resolve(p) };
}

export async function readJson<T = unknown>(
	res: Response,
): Promise<{ status: number; data: T; error: string | null }> {
	const body = (await res.json()) as { data: T; error: string | null };
	return { status: res.status, ...body };
}
