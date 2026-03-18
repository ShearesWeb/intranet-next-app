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

    // Create a server's supabase client with newly configured cookie,
    // which could be used to maintain user's session
    return createServerClient(
        supabaseUrl,
        supabaseKey,
        {
            cookies: {
                getAll() {
                    return cookieStore.getAll();
                },
                setAll(cookiesToSet) {
                    if (!allowCookieWrite) {
                        // Intentionally disabled by default.
                        // We do not write Supabase auth cookies on the server to avoid
                        // server-driven cookie state overriding the active browser session.
                        return;
                    }

                    cookiesToSet.forEach(({ name, value, options }) =>
                        cookieStore.set(name, value, options)
                    );
                },
            },
        }
    );
}
