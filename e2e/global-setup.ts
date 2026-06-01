import { createServerClient } from "@supabase/ssr";
import { warmSessionCache, generateFreshSessionCookies, SUPABASE_URL, ANON_KEY } from "./auth-harness";
import { authenticatedPersonas } from "../tests/fixtures/personas";

export default async function globalSetup() {
	const keys = authenticatedPersonas().map((p) => p.key);
	console.log(`Warming session cache for ${keys.length} personas...`);
	await warmSessionCache(keys);
	console.log("Session cache ready.");

	// ---- TEMP DIAGNOSTIC (remove after) ----------------------------------
	// Replicate the app's server-side auth resolution against a freshly minted
	// persona session to find why the app 401s every persona request in CI.
	const cookies = await generateFreshSessionCookies("declan");
	console.log("DIAG urls:", JSON.stringify({ SUPABASE_URL, NEXT_PUBLIC: process.env.NEXT_PUBLIC_SUPABASE_URL }));
	console.log("DIAG cookie names:", JSON.stringify(cookies.map((c) => c.name)));
	const authCookie = cookies.find((c) => c.name.includes("auth-token"));
	if (authCookie) {
		const raw = authCookie.value.startsWith("base64-")
			? Buffer.from(authCookie.value.slice("base64-".length), "base64").toString("utf-8")
			: authCookie.value;
		try {
			const session = JSON.parse(raw);
			const token: string = session.access_token ?? "";
			const payload = token.split(".")[1];
			const claims = payload ? JSON.parse(Buffer.from(payload, "base64").toString("utf-8")) : {};
			console.log("DIAG token claims:", JSON.stringify({ alg: token.split(".")[0], email: claims.email, role: claims.role, iss: claims.iss, aud: claims.aud }));
		} catch (e) {
			console.log("DIAG token decode failed:", (e as Error).message, "value head:", authCookie.value.slice(0, 40));
		}
	}
	const supabase = createServerClient(SUPABASE_URL, ANON_KEY, {
		cookies: { getAll: () => cookies.map((c) => ({ name: c.name, value: c.value })), setAll: () => {} },
	});
	const gc = await supabase.auth.getClaims();
	console.log("DIAG getClaims:", JSON.stringify({ err: gc.error?.message ?? null, sub: gc.data?.claims?.sub ?? null, email: gc.data?.claims?.email ?? null }));
	const gu = await supabase.auth.getUser();
	console.log("DIAG getUser:", JSON.stringify({ err: gu.error?.message ?? null, email: gu.data?.user?.email ?? null }));
	const v = await supabase.from("authenticated_user_info").select("id,email").maybeSingle();
	console.log("DIAG view:", JSON.stringify({ err: v.error?.message ?? null, code: (v.error as { code?: string } | null)?.code ?? null, row: v.data }));
	throw new Error("DIAG: intentional fast-fail after diagnostics — revert global-setup.ts");
	// ---- END TEMP DIAGNOSTIC ---------------------------------------------
}
