import { NextRequest } from "next/server";
import { getPersonaSession } from "../../tests/integration/setup";
import type { PersonaKey } from "../../tests/fixtures/types";

type Method = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

export type CreateApiRequestOptions = {
	persona: PersonaKey;
	method: Method;
	path: string;
	body?: unknown;
	searchParams?: Record<string, string | undefined>;
	headers?: Record<string, string>;
};

const BASE_URL = "http://localhost:3000";

function projectRef(): string {
	const url = new URL(process.env.SUPABASE_URL ?? "http://127.0.0.1:54321");
	return url.hostname.split(".")[0];
}

export async function createApiRequest(opts: CreateApiRequestOptions): Promise<NextRequest> {
	const url = new URL(opts.path, BASE_URL);
	for (const [k, v] of Object.entries(opts.searchParams ?? {})) {
		if (v !== undefined) url.searchParams.set(k, v);
	}

	const headers = new Headers(opts.headers);
	headers.set("content-type", "application/json");

	if (opts.persona !== "anonymous") {
		const session = await getPersonaSession(opts.persona);
		const cookieName = `sb-${projectRef()}-auth-token`;
		const cookieValue = JSON.stringify([
			session.accessToken,
			session.refreshToken,
			null,
			null,
			null,
		]);
		const cookie = `${cookieName}=${encodeURIComponent(cookieValue)}`;
		headers.set("cookie", cookie);
	}

	const init: { method: Method; headers: Headers; body?: string } = {
		method: opts.method,
		headers,
	};
	if (opts.body !== undefined && opts.method !== "GET") {
		init.body = JSON.stringify(opts.body);
	}

	return new NextRequest(url.toString(), init);
}
