import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { extractSupabaseProjref, findForeignSupabaseCookies } from "./cookie-eviction";

// Conservative ceiling below Node's 16 KB --max-http-header-size default,
// leaving headroom for non-Cookie headers on the same request.
const COOKIE_OVERFLOW_THRESHOLD_BYTES = 12 * 1024;

function readSupabaseConfig() {
	return {
		url: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
		key:
			process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ??
			process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
			"",
	};
}

function evictForeignProjrefCookies(
	request: NextRequest,
	response: NextResponse,
	currentProjref: string | null,
): number {
	const allNames = request.cookies.getAll().map((c) => c.name);
	const foreign = findForeignSupabaseCookies(allNames, currentProjref);
	for (const name of foreign) {
		request.cookies.delete(name);
		response.cookies.set(name, "", { maxAge: 0, path: "/" });
	}
	return foreign.length;
}

function currentProjrefCookieNames(request: NextRequest, currentProjref: string): string[] {
	const prefix = `sb-${currentProjref}-`;
	return request.cookies
		.getAll()
		.map((c) => c.name)
		.filter((n) => n.startsWith(prefix));
}

function clearCurrentProjrefCookies(
	request: NextRequest,
	response: NextResponse,
	currentProjref: string,
): string[] {
	const names = currentProjrefCookieNames(request, currentProjref);
	for (const name of names) {
		request.cookies.delete(name);
		response.cookies.set(name, "", { maxAge: 0, path: "/" });
	}
	return names;
}

function cookieHeaderSize(request: NextRequest): number {
	return request.headers.get("cookie")?.length ?? 0;
}

export async function updateSession(request: NextRequest) {
	const { url: supabaseUrl, key: supabaseKey } = readSupabaseConfig();
	const currentProjref = extractSupabaseProjref(supabaseUrl);

	let supabaseResponse = NextResponse.next({ request });

	const evicted = evictForeignProjrefCookies(request, supabaseResponse, currentProjref);
	if (evicted > 0) {
		console.info(`[auth] evicted ${evicted} foreign-projref supabase cookies`);
	}

	if (currentProjref && cookieHeaderSize(request) > COOKIE_OVERFLOW_THRESHOLD_BYTES) {
		const cleared = clearCurrentProjrefCookies(request, supabaseResponse, currentProjref);
		console.warn(
			`[auth] cookie header > ${COOKIE_OVERFLOW_THRESHOLD_BYTES}B — cleared ${cleared.length} sb-${currentProjref}-* cookies`,
		);
		const path = request.nextUrl.pathname;
		if (!path.startsWith("/auth")) {
			const loginUrl = request.nextUrl.clone();
			loginUrl.pathname = "/auth/login";
			loginUrl.searchParams.set("reason", "cookie_overflow");
			const redirect = NextResponse.redirect(loginUrl);
			for (const name of cleared) {
				redirect.cookies.set(name, "", { maxAge: 0, path: "/" });
			}
			return redirect;
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
				if (currentProjref) {
					const stillForeign = findForeignSupabaseCookies(
						request.cookies.getAll().map((c) => c.name),
						currentProjref,
					);
					for (const name of stillForeign) {
						supabaseResponse.cookies.set(name, "", { maxAge: 0, path: "/" });
					}
				}

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
			return NextResponse.redirect(loginUrl);
		}
		return supabaseResponse;
	}

	if (!isAuthenticated && path.startsWith("/dashboard")) {
		const loginUrl = request.nextUrl.clone();
		loginUrl.pathname = "/auth/login";
		loginUrl.searchParams.set("reason", "session_expired");
		loginUrl.searchParams.set("next", request.nextUrl.pathname);
		return NextResponse.redirect(loginUrl);
	}

	if (isAuthenticated && path.startsWith("/auth")) {
		const url = request.nextUrl.clone();
		url.pathname = "/dashboard";
		return NextResponse.redirect(url);
	}

	return supabaseResponse;
}
