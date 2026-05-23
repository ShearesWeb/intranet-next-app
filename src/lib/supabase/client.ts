import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey =
	process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ??
	process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export function createClient() {
	// Create a supabase client on the browser with project's credentials
	return createBrowserClient(supabaseUrl, supabaseKey);
}
