import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

type CreateClientOptions = {
	allowCookieWrite?: boolean;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey =
	process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ??
	process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function createClient(options: CreateClientOptions = {}) {
	const cookieStore = await cookies();
	const allowCookieWrite = options.allowCookieWrite === true;

	return createServerClient(supabaseUrl, supabaseKey, {
		cookies: {
			getAll() {
				return cookieStore.getAll();
			},
			setAll(cookiesToSet) {
				if (!allowCookieWrite) return;

				try {
					cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
				} catch {
					// Called from a Server Component -- cookies are read-only.
				}
			},
		},
	});
}
