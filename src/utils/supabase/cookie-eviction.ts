// Helpers for evicting Supabase auth cookies that belong to *other* Supabase
// projects than the one this app is configured for. Multiple projref'd cookies
// pile up on a shared host (notably `localhost` during dev, and the parent
// domain in production after a project rotation) and push the request header
// past Node's 16 KB default — yielding HTTP 431. See investigation notes on
// the cookie-overflow fix.

const SUPABASE_COOKIE_PATTERN = /^sb-([a-z0-9]+)-/;

export function extractSupabaseProjref(supabaseUrl: string): string | null {
	try {
		const host = new URL(supabaseUrl).hostname;
		if (!host.endsWith(".supabase.co")) return null;
		const label = host.split(".")[0];
		return label || null;
	} catch {
		return null;
	}
}

export function findForeignSupabaseCookies(
	cookieNames: readonly string[],
	currentProjref: string | null,
): string[] {
	if (!currentProjref) return [];
	const foreign: string[] = [];
	for (const name of cookieNames) {
		const m = name.match(SUPABASE_COOKIE_PATTERN);
		if (m && m[1] !== currentProjref) {
			foreign.push(name);
		}
	}
	return foreign;
}
