import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
	extractSupabaseProjref,
	findForeignSupabaseCookies,
} from "@/lib/supabase/cookie-eviction";

// Legacy app-level user-cache cookies retired in 0ac4cb0. Listed here so the
// signout sweep can clear them off any browser that still carries them.
const LEGACY_COOKIE_NAMES = ["authenticated_user", "user_id"];

export const dynamic = "force-dynamic";

export async function POST() {
	const supabase = await createClient({ allowCookieWrite: true });

	try {
		await supabase.auth.signOut();
	} catch (err) {
		console.warn("[auth/signout] supabase.auth.signOut threw", err);
	}

	const cookieStore = await cookies();
	const projref = extractSupabaseProjref(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "");
	const allNames = cookieStore.getAll().map((c) => c.name);

	const toDelete = new Set<string>(LEGACY_COOKIE_NAMES);
	if (projref) {
		const ownPrefix = `sb-${projref}-`;
		for (const name of allNames) {
			if (name.startsWith(ownPrefix)) toDelete.add(name);
		}
	}
	for (const name of findForeignSupabaseCookies(allNames, projref)) {
		toDelete.add(name);
	}

	for (const name of toDelete) {
		try {
			cookieStore.delete(name);
		} catch {
			// Cookie mutation can fail in some runtime contexts — best effort.
		}
	}

	return NextResponse.json(
		{ ok: true },
		{ status: 200, headers: { "Cache-Control": "no-store, private" } },
	);
}
