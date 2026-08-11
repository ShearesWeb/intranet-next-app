import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { extractSupabaseProjref, findForeignSupabaseCookies } from "./cookie-eviction";

// Conservative ceiling below the tightest limit any edge in front of this app
// enforces (the AWS origin 413s at ~10 KB of request headers; Node defaults to
// 16 KB), leaving headroom for non-Cookie headers on the same request.
const COOKIE_OVERFLOW_THRESHOLD_BYTES = 8 * 1024;

function readSupabaseConfig() {
	return {
		url: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
		key:
			process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
			process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ??
			process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
			"",
	};
}

function evictForeignProjrefCookies(request: NextRequest, currentProjref: string | null): string[] {
	const allNames = request.cookies.getAll().map((c) => c.name);
	const foreign = findForeignSupabaseCookies(allNames, currentProjref);
	for (const name of foreign) {
		request.cookies.delete(name);
	}
	return foreign;
}

function currentProjrefCookieNames(request: NextRequest, currentProjref: string): string[] {
	const prefix = `sb-${currentProjref}-`;
	return request.cookies
		.getAll()
		.map((c) => c.name)
		.filter((n) => n.startsWith(prefix));
}

function clearCurrentProjrefCookies(request: NextRequest, currentProjref: string): string[] {
	const names = currentProjrefCookieNames(request, currentProjref);
	for (const name of names) {
		request.cookies.delete(name);
	}
	return names;
}

function cookieHeaderSize(request: NextRequest): number {
	return request.headers.get("cookie")?.length ?? 0;
}

export async function updateSession(request: NextRequest) {
	const { url: supabaseUrl, key: supabaseKey } = readSupabaseConfig();
	const currentProjref = extractSupabaseProjref(supabaseUrl);

	// Cookies to expire on the browser. Re-stamped onto every response we may
	// return: NextResponse.next()/redirect() each start with an empty cookie
	// jar, so a Set-Cookie written on an earlier response object is lost.
	const pendingClears: string[] = [];
	function stampClears<T extends NextResponse>(response: T): T {
		for (const name of pendingClears) {
			response.cookies.set(name, "", { maxAge: 0, path: "/" });
		}
		return response;
	}

	let supabaseResponse = NextResponse.next({ request });

	const evicted = evictForeignProjrefCookies(request, currentProjref);
	pendingClears.push(...evicted);
	if (evicted.length > 0) {
		console.info(`[auth] evicted ${evicted.length} foreign-projref supabase cookies`);
	}
	stampClears(supabaseResponse);

	if (currentProjref && cookieHeaderSize(request) > COOKIE_OVERFLOW_THRESHOLD_BYTES) {
		const cleared = clearCurrentProjrefCookies(request, currentProjref);
		pendingClears.push(...cleared);
		console.warn(
			`[auth] cookie header > ${COOKIE_OVERFLOW_THRESHOLD_BYTES}B — cleared ${cleared.length} sb-${currentProjref}-* cookies`,
		);
		stampClears(supabaseResponse);
		const path = request.nextUrl.pathname;
		if (!path.startsWith("/auth")) {
			const loginUrl = request.nextUrl.clone();
			loginUrl.pathname = "/auth/login";
			loginUrl.searchParams.set("reason", "cookie_overflow");
			return stampClears(NextResponse.redirect(loginUrl));
		}
	}

	const supabase = createServerClient(supabaseUrl, supabaseKey, {
		cookies: {
			getAll() {
				return request.cookies.getAll();
			},
			setAll(cookiesToSet, ...rest: unknown[]) {
				const headers = rest[0] as Record<string, string> | undefined;

				cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));

				supabaseResponse = NextResponse.next({ request });

				// NextResponse.next() resets response cookies — re-stamp eviction
				// Set-Cookies so they still reach the browser this turn.
				stampClears(supabaseResponse);

				cookiesToSet.forEach(({ name, value, options }) =>
					supabaseResponse.cookies.set(name, value, options),
				);

				if (headers) {
					Object.entries(headers).forEach(([key, value]) =>
						supabaseResponse.headers.set(key, value),
					);
				}
			},
		},
	});

	const { data, error } = await supabase.auth.getClaims();
	const isAuthenticated = Boolean(data?.claims?.sub);
	const path = request.nextUrl.pathname;

	if (error) {
		if (!error.message.includes("Auth session missing")) {
			console.error("Auth error in middleware:", error);
		}

		// Only the dashboard requires an authenticated session. / is a public
		// landing page (it self-redirects to /dashboard for signed-in users via
		// the server component), and /auth/* is the place we'd redirect *to*
		// anyway. Either should pass through with eviction Set-Cookies intact.
		if (path.startsWith("/dashboard")) {
			const loginUrl = request.nextUrl.clone();
			loginUrl.pathname = "/auth/login";
			loginUrl.searchParams.set("reason", "session_expired");
			loginUrl.searchParams.set("next", request.nextUrl.pathname);
			return stampClears(NextResponse.redirect(loginUrl));
		}
		return supabaseResponse;
	}

	if (!isAuthenticated && path.startsWith("/dashboard")) {
		const loginUrl = request.nextUrl.clone();
		loginUrl.pathname = "/auth/login";
		loginUrl.searchParams.set("reason", "session_expired");
		loginUrl.searchParams.set("next", request.nextUrl.pathname);
		return stampClears(NextResponse.redirect(loginUrl));
	}

	if (isAuthenticated && path.startsWith("/auth")) {
		const url = request.nextUrl.clone();
		url.pathname = "/dashboard";
		return stampClears(NextResponse.redirect(url));
	}

	return supabaseResponse;
}
