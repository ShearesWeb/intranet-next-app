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
