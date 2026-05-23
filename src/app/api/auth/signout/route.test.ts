import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	createClient: vi.fn(),
	cookies: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
	createClient: mocks.createClient,
}));

vi.mock("next/headers", () => ({
	cookies: mocks.cookies,
}));

function makeCookieStore(initial: string[]) {
	const present = new Set(initial);
	const deleted: string[] = [];
	return {
		getAll: () => Array.from(present).map((name) => ({ name, value: "v" })),
		delete: (name: string) => {
			present.delete(name);
			deleted.push(name);
		},
		_deleted: deleted,
	};
}

describe("POST /api/auth/signout", () => {
	const ORIGINAL_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;

	beforeEach(() => {
		vi.clearAllMocks();
		process.env.NEXT_PUBLIC_SUPABASE_URL = "https://mlklfakrvuvkftgowzts.supabase.co";
	});

	afterEach(() => {
		if (ORIGINAL_SUPABASE_URL === undefined) {
			delete process.env.NEXT_PUBLIC_SUPABASE_URL;
		} else {
			process.env.NEXT_PUBLIC_SUPABASE_URL = ORIGINAL_SUPABASE_URL;
		}
	});

	it("calls supabase.auth.signOut() and returns 200", async () => {
		const signOut = vi.fn().mockResolvedValue({ error: null });
		mocks.createClient.mockResolvedValue({ auth: { signOut } });
		mocks.cookies.mockResolvedValue(makeCookieStore([]));

		const { POST } = await import("./route");
		const response = await POST();

		expect(signOut).toHaveBeenCalledTimes(1);
		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ ok: true });
	});

	it("deletes current-projref sb-* cookies and legacy app cookies", async () => {
		const signOut = vi.fn().mockResolvedValue({ error: null });
		mocks.createClient.mockResolvedValue({ auth: { signOut } });
		const store = makeCookieStore([
			"sb-mlklfakrvuvkftgowzts-auth-token.0",
			"sb-mlklfakrvuvkftgowzts-auth-token.1",
			"sb-mlklfakrvuvkftgowzts-auth-token-code-verifier",
			"authenticated_user",
			"user_id",
			"sidebar:state",
		]);
		mocks.cookies.mockResolvedValue(store);

		const { POST } = await import("./route");
		await POST();

		expect(store._deleted).toEqual(
			expect.arrayContaining([
				"sb-mlklfakrvuvkftgowzts-auth-token.0",
				"sb-mlklfakrvuvkftgowzts-auth-token.1",
				"sb-mlklfakrvuvkftgowzts-auth-token-code-verifier",
				"authenticated_user",
				"user_id",
			]),
		);
		expect(store._deleted).not.toContain("sidebar:state");
	});

	it("also deletes foreign sb-<otherref>-* cookies as a belt-and-suspenders sweep", async () => {
		const signOut = vi.fn().mockResolvedValue({ error: null });
		mocks.createClient.mockResolvedValue({ auth: { signOut } });
		const store = makeCookieStore([
			"sb-fekyehxztmfdnuknfmeq-auth-token.0",
			"sb-jsajbspexukgtnqczppq-auth-token.0",
		]);
		mocks.cookies.mockResolvedValue(store);

		const { POST } = await import("./route");
		await POST();

		expect(store._deleted).toEqual(
			expect.arrayContaining([
				"sb-fekyehxztmfdnuknfmeq-auth-token.0",
				"sb-jsajbspexukgtnqczppq-auth-token.0",
			]),
		);
	});

	it("still returns 200 even if supabase.auth.signOut throws", async () => {
		const signOut = vi.fn().mockRejectedValue(new Error("network blip"));
		mocks.createClient.mockResolvedValue({ auth: { signOut } });
		mocks.cookies.mockResolvedValue(makeCookieStore([]));

		const { POST } = await import("./route");
		const response = await POST();

		expect(response.status).toBe(200);
	});
});
